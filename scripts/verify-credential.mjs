#!/usr/bin/env node
/** Independent JOSE verification using Node crypto, not the AfriCore server verifier. */
import fs from 'node:fs';
import { verify, createPublicKey } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import {
  AbiCoder,
  keccak256,
  sha256,
  toUtf8Bytes,
  id,
  Contract,
  JsonRpcProvider,
} from 'ethers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
export function verifyJws(token, metadata) {
  if (typeof token !== 'string' || token.length > 100000)
    throw Error('Unsupported token');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('Invalid JWS');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url')),
    payload = JSON.parse(Buffer.from(parts[1], 'base64url'));
  if (header.alg !== 'ES256' || header.jku || header.x5u)
    throw Error('Unsupported header');
  const key = metadata.jwks.keys.find((k) => k.kid === header.kid);
  if (!key || !['active', 'retired'].includes(key.state) || key.d)
    throw Error('Unknown, compromised or private key');
  if (payload.issuer !== metadata.issuer) throw Error('Issuer mismatch');
  const valid = verify(
    'sha256',
    Buffer.from(parts[0] + '.' + parts[1]),
    { key: createPublicKey({ key, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
    Buffer.from(parts[2], 'base64url'),
  );
  if (!valid) throw Error('Invalid signature');
  return { header, payload };
}
export async function verifyBundle(bundle, options = {}) {
  const { header, payload: vc } = verifyJws(
    bundle.credential,
    bundle.issuer_metadata,
  );
  if (
    !Array.isArray(vc.credentialStatus) ||
    vc.credentialStatus.length !== 2 ||
    new Set(vc.credentialStatus.map((s) => s.statusPurpose)).size !== 2 ||
    vc.credentialStatus.some(
      (s) => !['revocation', 'suspension'].includes(s.statusPurpose),
    ) ||
    !vc.validFrom ||
    !vc.validUntil ||
    !Number.isFinite(Date.parse(vc.validFrom)) ||
    !Number.isFinite(Date.parse(vc.validUntil))
  )
    throw Error('Complete status and validity profile required');
  if (
    header.typ !== 'vc+jwt' ||
    !vc.type.includes('VerifiableCredential') ||
    !vc.credentialSubject?.id
  )
    throw Error('Unsupported VC profile');
  if (options.issuer && vc.issuer !== options.issuer)
    throw Error('Pinned issuer mismatch');
  const current = new Date().toISOString(),
    report = {
      signature: 'valid',
      issuer: vc.issuer,
      issuer_status: bundle.issuer_metadata.status,
      issuer_metadata_freshness: 'caller_supplied_snapshot_not_live_registry',
      issuer_authority: 'Requires independent registry/governance assessment',
      period:
        Date.parse(vc.validFrom) <= Date.parse(current) &&
        Date.parse(vc.validUntil) > Date.parse(current)
          ? 'current'
          : 'expired_or_future',
      status: 'unchecked',
      inclusion: 'not_supplied',
      onchain: 'not_checked',
      policy: 'independent-v1',
      verified_at: current,
    };
  let status = 'active';
  for (const entry of vc.credentialStatus || []) {
    const statusToken = bundle.status_lists?.[entry.statusPurpose];
    if (!statusToken) throw Error('Fresh status-list credential required');
    const list = verifyJws(statusToken, bundle.issuer_metadata).payload;
    if (
      list.id !== entry.statusListCredential ||
      Date.parse(list.validUntil) < Date.parse(current) ||
      Date.parse(list.validFrom) > Date.parse(current) ||
      list.credentialSubject.statusPurpose !== entry.statusPurpose
    )
      throw Error('Status-list mismatch or staleness');
    const encoded = list.credentialSubject.encodedList;
    if (!encoded.startsWith('u')) throw Error('Unsupported multibase');
    const bytes = gunzipSync(Buffer.from(encoded.slice(1), 'base64url'), {
        maxOutputLength: 1048576,
      }),
      index = Number(entry.statusListIndex);
    if (!Number.isSafeInteger(index) || index < 0 || index >= bytes.length * 8)
      throw Error('Invalid status index');
    if (bytes[Math.floor(index / 8)] & (1 << (7 - (index % 8))))
      status =
        entry.statusPurpose === 'revocation'
          ? 'revoked'
          : status === 'revoked'
            ? status
            : 'suspended';
  }
  report.status = status;
  if (bundle.proof && bundle.proof.status !== 'not_batched') {
    const p = bundle.proof,
      domain = id('AfriCoreVCCommitment:v1'),
      commitment = keccak256(
        AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'bytes32', 'bytes32'],
          [domain, sha256(toUtf8Bytes(bundle.credential)), p.salt],
        ),
      );
    if (
      commitment !== p.commitment ||
      !StandardMerkleTree.verify(
        p.root,
        ['bytes32', 'bytes32'],
        [domain, commitment],
        p.proof,
      )
    )
      throw Error('Merkle inclusion invalid');
    report.inclusion = 'valid';
    if (options.rpc && options.contract) {
      const provider = new JsonRpcProvider(options.rpc);
      try {
        const chain = Number((await provider.getNetwork()).chainId);
        if (
          chain !== p.chain_id ||
          p.contract_address.toLowerCase() !== options.contract.toLowerCase()
        )
          throw Error('Pinned chain/contract mismatch');
        const contract = new Contract(
            options.contract,
            [
              'function batches(bytes32) view returns(bytes32 root,uint256 blockNumber)',
            ],
            provider,
          ),
          batch = await contract.batches(p.batch_ref),
          confirmations =
            (await provider.getBlockNumber()) - Number(batch.blockNumber) + 1;
        report.onchain =
          batch.root === p.root &&
          confirmations >=
            Number(options.confirmations || p.required_confirmations || 1)
            ? 'confirmed'
            : 'unconfirmed';
        report.confirmations = confirmations;
      } finally {
        provider.destroy();
      }
    }
  }
  report.currently_acceptable =
    report.period === 'current' &&
    report.status === 'active' &&
    ['approved_sandbox', 'approved'].includes(bundle.issuer_metadata.status);
  report.limitations =
    'Technical validity only. Evaluate issuer authority, evidence and disclosure policy separately.';
  return report;
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/verify-credential.mjs')) {
  try {
    const args = process.argv.slice(2),
      value = (name) => args[args.indexOf(name) + 1];
    if (!args.includes('--file'))
      throw Error(
        'Usage: node scripts/verify-credential.mjs --file bundle.json [--rpc URL --contract ADDRESS --issuer URI]',
      );
    const bundle = JSON.parse(fs.readFileSync(value('--file'), 'utf8'));
    const report = await verifyBundle(bundle, {
      rpc: args.includes('--rpc') ? value('--rpc') : undefined,
      contract: args.includes('--contract') ? value('--contract') : undefined,
      issuer: args.includes('--issuer') ? value('--issuer') : undefined,
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.currently_acceptable) process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({ verified: false, error: error.message }));
    process.exitCode = 1;
  }
}
