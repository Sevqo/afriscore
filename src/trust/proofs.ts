import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import {
  AbiCoder,
  keccak256,
  sha256,
  toUtf8Bytes,
  id as ethId,
  Contract,
  JsonRpcProvider,
  Wallet,
  NonceManager,
  FetchRequest,
} from 'ethers';
import { randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun, dbTransaction } from '../db';
import { Access, fail, audit } from '../platform/auth';
import { seal, unseal, now } from '../platform/crypto';
import { flags } from './store';
import { emit } from '../operations/events';
export const proofDomain = ethId('AfriCoreVCCommitment:v1');
export const anchorAbi = [
  'function batches(bytes32) view returns(bytes32 root,uint256 blockNumber)',
  'function publish(bytes32 batch,bytes32 root)',
  'function verify(bytes32 batch,bytes32 leaf,bytes32[] proof) view returns(bool)',
];
export function commitmentFor(token: string, salt: string) {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'bytes32'],
      [proofDomain, sha256(toUtf8Bytes(token)), salt],
    ),
  );
}
export function inclusion(commitment: string, root: string, proof: string[]) {
  try {
    return StandardMerkleTree.verify(
      root,
      ['bytes32', 'bytes32'],
      [proofDomain, commitment],
      proof,
    );
  } catch {
    return false;
  }
}
export async function makeBatch(a: Access) {
  if (a.environment !== 'sandbox') fail(503, 'Production anchoring disabled');
  return dbTransaction(async () => {
    await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [a.org]);
    const candidates = await dbAll(
      "SELECT c.id,c.commitment FROM ac3_credentials c LEFT JOIN ac3_batch_items b ON b.credential_id=c.id WHERE c.environment='sandbox' AND c.status='active' AND c.valid_until>? AND b.credential_id IS NULL ORDER BY c.created_at LIMIT 100",
      [now()],
    );
    if (!candidates.length)
      fail(409, 'No unbatched eligible sandbox credentials');
    const tree = StandardMerkleTree.of(
        candidates.map((c) => [proofDomain, c.commitment]),
        ['bytes32', 'bytes32'],
      ),
      id = randomUUID(),
      data = {
        version: 'africore-merkle-v1',
        batch_ref: ethId(id),
        credential_count: candidates.length,
        tree: tree.dump(),
        network: 'not_submitted',
        confirmations: 0,
      };
    await dbRun(
      'INSERT INTO ac3_batches(id,environment,root,state,data,next_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [
        id,
        'sandbox',
        tree.root,
        'queued',
        seal(JSON.stringify(data)),
        now(),
        now(),
        now(),
      ],
    );
    for (const [index, value] of tree.entries()) {
      const c = candidates.find((c) => c.commitment === value[1])!;
      await dbRun(
        'INSERT INTO ac3_batch_items(credential_id,batch_id,proof_sealed) VALUES (?,?,?)',
        [c.id, id, seal(JSON.stringify(tree.getProof(index)))],
      );
    }
    await audit(a.org, a.actor, 'proof.batch_queued', id);
    return {
      id,
      root: tree.root,
      state: 'queued',
      credential_count: candidates.length,
    };
  });
}
function config() {
  const rpc = process.env.AFRICORE_ANCHOR_RPC,
    address = process.env.AFRICORE_ANCHOR_ADDRESS,
    chain = Number(process.env.AFRICORE_ANCHOR_CHAIN_ID || 31337);
  if (!rpc || !address) return null;
  if (![31337, 11155111].includes(chain))
    fail(503, 'Only local31337 and Sepolia11155111 are allowed');
  if (chain === 11155111 && !flags().testnet_anchoring)
    fail(503, 'Testnet anchoring disabled');
  const url = new URL(rpc);
  if (
    chain === 31337 &&
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  )
    fail(503, 'Local chain requires loopback RPC');
  return {
    rpc,
    address,
    chain,
    confirmations: Math.max(
      1,
      Number(
        process.env.AFRICORE_ANCHOR_CONFIRMATIONS || (chain === 31337 ? 1 : 3),
      ),
    ),
  };
}
async function connection() {
  const c = config();
  if (!c) return null;
  const request = new FetchRequest(c.rpc);
  request.timeout = 5000;
  const provider = new JsonRpcProvider(request);
  try {
    if (Number((await provider.getNetwork()).chainId) !== c.chain)
      throw Error('chain_id_mismatch');
    const code = await provider.getCode(c.address);
    if (code === '0x') throw Error('anchor_contract_missing');
    return {
      c,
      provider,
      contract: new Contract(c.address, anchorAbi, provider),
    };
  } catch (error) {
    provider.destroy();
    throw error;
  }
}
let busy = false;
export async function runAnchorQueue() {
  if (busy || !process.env.AFRICORE_ANCHOR_RPC) return { processed: 0 };
  busy = true;
  let processed = 0;
  try {
    let conn;
    try {
      conn = await connection();
    } catch {
      const rows = await dbAll(
        "SELECT * FROM ac3_batches WHERE state IN ('queued','retrying','submitted','reorged') AND next_at<=? LIMIT 10",
        [now()],
      );
      for (const row of rows) {
        const attempts = row.attempts + 1,
          data = {
            ...JSON.parse(unseal(row.data)),
            error: 'anchor_rpc_unavailable',
          };
        await dbRun(
          'UPDATE ac3_batches SET state=?,attempts=?,data=?,next_at=?,updated_at=? WHERE id=?',
          [
            attempts >= 5 ? 'failed' : 'retrying',
            attempts,
            seal(JSON.stringify(data)),
            new Date(
              Date.now() + Math.min(60000, 1000 * 2 ** attempts),
            ).toISOString(),
            now(),
            row.id,
          ],
        );
      }
      return { processed: 0, rpc_unavailable: true };
    }
    if (!conn) return { processed: 0 };
    const { c, provider, contract } = conn;
    const batches = await dbAll(
      "SELECT * FROM ac3_batches WHERE state IN ('queued','submitted','retrying','confirmed','reorged') AND next_at<=? ORDER BY created_at LIMIT 10",
      [now()],
    );
    for (const batch of batches) {
      let data = JSON.parse(unseal(batch.data));
      try {
        const recorded = await contract.batches(data.batch_ref);
        if (recorded.root !== '0x' + '0'.repeat(64)) {
          if (recorded.root !== batch.root)
            throw Error('onchain_root_conflict');
          const block = await provider.getBlock(Number(recorded.blockNumber));
          if (!block) throw Error('chain_block_missing');
          const confirmations =
            (await provider.getBlockNumber()) -
            Number(recorded.blockNumber) +
            1;
          let receipt = data.transaction_hash
            ? await provider.getTransactionReceipt(data.transaction_hash)
            : null;
          if (receipt && receipt.blockHash !== block.hash) receipt = null;
          data = {
            ...data,
            network: c.chain === 31337 ? 'local_evm' : 'sepolia',
            chain_id: c.chain,
            contract_address: c.address,
            block_number: Number(recorded.blockNumber),
            block_hash: block.hash,
            confirmations,
            required_confirmations: c.confirmations,
            ...(receipt
              ? {
                  gas_used: receipt.gasUsed.toString(),
                  gas_price_wei: receipt.gasPrice.toString(),
                  cost_wei: (receipt.gasUsed * receipt.gasPrice).toString(),
                }
              : {}),
            checked_at: now(),
          };
          const state =
            confirmations >= c.confirmations ? 'confirmed' : 'submitted';
          await dbRun(
            'UPDATE ac3_batches SET state=?,data=?,next_at=?,updated_at=? WHERE id=?',
            [
              state,
              seal(JSON.stringify(data)),
              new Date(Date.now() + 15000).toISOString(),
              now(),
              batch.id,
            ],
          );
          if (state === 'confirmed' && batch.state !== 'confirmed') {
            const items = await dbAll(
              'SELECT c.id,c.org_id FROM ac3_batch_items b JOIN ac3_credentials c ON c.id=b.credential_id WHERE b.batch_id=?',
              [batch.id],
            );
            for (const item of items)
              await emit(
                {
                  org: item.org_id,
                  actor: 'anchor-worker',
                  environment: 'sandbox',
                  role: 'system',
                  api: false,
                },
                'proof.anchor_confirmed',
                {
                  id: item.id,
                  batch_id: batch.id,
                  chain_id: c.chain,
                  transaction_hash: data.transaction_hash || null,
                },
              );
          }
          processed++;
          continue;
        }
        if (batch.state === 'confirmed') {
          data = {
            ...data,
            error: 'onchain_root_missing_reorganization',
            confirmations: 0,
          };
          await dbRun(
            "UPDATE ac3_batches SET state='reorged',data=?,next_at=?,updated_at=? WHERE id=?",
            [seal(JSON.stringify(data)), now(), now(), batch.id],
          );
          continue;
        }
        if (data.transaction_hash) {
          const receipt = await provider.getTransactionReceipt(
            data.transaction_hash,
          );
          if (receipt?.status === 0) throw Error('transaction_reverted');
          const transaction = await provider.getTransaction(
            data.transaction_hash,
          );
          if (transaction) {
            await dbRun('UPDATE ac3_batches SET next_at=? WHERE id=?', [
              new Date(Date.now() + 15000).toISOString(),
              batch.id,
            ]);
            continue;
          }
          if (Date.now() - Date.parse(data.submitted_at) < 60000) continue;
          data.previous_transaction_hash = data.transaction_hash;
          delete data.transaction_hash;
        }
        const signer =
          c.chain === 31337
            ? await provider.getSigner()
            : new NonceManager(
                new Wallet(
                  process.env.AFRICORE_ANCHOR_PRIVATE_KEY || '',
                  provider,
                ),
              );
        const tx = await new Contract(c.address, anchorAbi, signer).publish(
          data.batch_ref,
          batch.root,
        );
        data = {
          ...data,
          transaction_hash: tx.hash,
          submitted_at: now(),
          chain_id: c.chain,
          contract_address: c.address,
          network: c.chain === 31337 ? 'local_evm' : 'sepolia',
          required_confirmations: c.confirmations,
        };
        await dbRun(
          "UPDATE ac3_batches SET state='submitted',data=?,next_at=?,updated_at=? WHERE id=?",
          [
            seal(JSON.stringify(data)),
            new Date(Date.now() + 1000).toISOString(),
            now(),
            batch.id,
          ],
        );
        processed++;
      } catch (error) {
        const attempts = batch.attempts + 1;
        data = {
          ...data,
          error: [
            'chain_id_mismatch',
            'anchor_contract_missing',
            'onchain_root_conflict',
            'transaction_reverted',
            'chain_block_missing',
          ].includes((error as Error).message)
            ? (error as Error).message
            : 'anchor_rpc_or_transaction_failed',
        };
        await dbRun(
          'UPDATE ac3_batches SET state=?,attempts=?,data=?,next_at=?,updated_at=? WHERE id=?',
          [
            attempts >= 5 ? 'failed' : 'retrying',
            attempts,
            seal(JSON.stringify(data)),
            new Date(
              Date.now() + Math.min(60000, 1000 * 2 ** attempts),
            ).toISOString(),
            now(),
            batch.id,
          ],
        );
      }
    }
    provider.destroy();
    return { processed };
  } finally {
    busy = false;
  }
}
export async function proofFor(a: Access, credentialId: string) {
  const row = await dbGet(
    'SELECT c.id,c.commitment,c.salt_sealed,i.proof_sealed,b.id AS batch_id,b.root,b.state,b.data FROM ac3_credentials c JOIN ac3_batch_items i ON i.credential_id=c.id JOIN ac3_batches b ON b.id=i.batch_id WHERE c.id=? AND c.org_id=? AND c.environment=?',
    [credentialId, a.org, a.environment],
  );
  if (!row) return { status: 'not_batched' };
  const data = JSON.parse(unseal(row.data));
  return {
    version: 'africore-merkle-v1',
    status: row.state,
    credential_id: row.id,
    commitment: row.commitment,
    salt: unseal(row.salt_sealed),
    proof: JSON.parse(unseal(row.proof_sealed)),
    root: row.root,
    batch_id: row.batch_id,
    batch_ref: data.batch_ref,
    chain_id: data.chain_id || null,
    contract_address: data.contract_address || null,
    transaction_hash: data.transaction_hash || null,
    confirmations: data.confirmations || 0,
    required_confirmations: data.required_confirmations || 1,
    checked_at: data.checked_at || null,
    block_number: data.block_number || null,
    block_hash: data.block_hash || null,
    gas_used: data.gas_used || null,
    cost_wei: data.cost_wei || null,
  };
}
export async function verifyProof(token: string, proof: any) {
  const calculated = commitmentFor(token, proof.salt);
  if (
    calculated !== proof.commitment ||
    !inclusion(calculated, proof.root, proof.proof)
  )
    return {
      inclusion: false,
      onchain: false,
      reason: 'commitment_or_inclusion_invalid',
    };
  let conn;
  try {
    conn = await connection();
  } catch {
    return {
      inclusion: true,
      onchain: false,
      reason: 'RPC_unavailable_or_chain_mismatch',
    };
  }
  if (!conn)
    return { inclusion: true, onchain: false, reason: 'RPC_not_configured' };
  try {
    const { c, provider, contract } = conn;
    if (
      proof.chain_id !== c.chain ||
      proof.contract_address?.toLowerCase() !== c.address.toLowerCase()
    )
      return {
        inclusion: true,
        onchain: false,
        reason: 'pinned_chain_contract_mismatch',
      };
    const root = await contract.batches(proof.batch_ref),
      confirmations =
        (await provider.getBlockNumber()) - Number(root.blockNumber) + 1;
    return {
      inclusion: true,
      onchain: root.root === proof.root && confirmations >= c.confirmations,
      confirmations,
      required_confirmations: c.confirmations,
      chain_id: c.chain,
    };
  } finally {
    conn.provider.destroy();
  }
}
