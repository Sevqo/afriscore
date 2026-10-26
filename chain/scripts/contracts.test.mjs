import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ContractFactory,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
  concat,
  ZeroHash,
} from 'ethers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { compile } from './compile.mjs';
test('local immutable anchor contract: access, duplicates, inclusion, pause and no funds', async () => {
  const provider = new JsonRpcProvider(
    process.env.AFRICORE_ANCHOR_RPC || 'http://127.0.0.1:8545',
  );
  try {
    assert.equal(Number((await provider.getNetwork()).chainId), 31337);
    const owner = await provider.getSigner(0),
      outsider = await provider.getSigner(1),
      artifact = compile(),
      contract = await new ContractFactory(
        artifact.abi,
        artifact.bytecode,
        owner,
      ).deploy(await owner.getAddress());
    await contract.waitForDeployment();
    const domain = keccak256(toUtf8Bytes('AfriCoreVCCommitment:v1')),
      commitments = ['fixture1', 'fixture2', 'fixture3'].map((s) =>
        keccak256(toUtf8Bytes(s)),
      ),
      tree = StandardMerkleTree.of(
        commitments.map((c) => [domain, c]),
        ['bytes32', 'bytes32'],
      ),
      batch = keccak256(toUtf8Bytes('testbatch-' + Date.now()));
    await assert.rejects(() =>
      contract.connect(outsider).publish(batch, tree.root),
    );
    await assert.rejects(() => contract.publish(batch, ZeroHash));
    await (await contract.publish(batch, tree.root)).wait();
    assert.equal((await contract.batches(batch)).root, tree.root);
    await assert.rejects(() => contract.publish(batch, tree.root));
    for (const [index, value] of tree.entries()) {
      assert.equal(
        await contract.verify(
          batch,
          tree.leafHash(value),
          tree.getProof(index),
        ),
        true,
      );
      assert.equal(
        await contract.verify(
          batch,
          keccak256(toUtf8Bytes('tampered')),
          tree.getProof(index),
        ),
        false,
      );
    }
    await (await contract.pause()).wait();
    await assert.rejects(() =>
      contract.publish(keccak256(toUtf8Bytes('paused')), tree.root),
    );
    await (await contract.unpause()).wait();
    await assert.rejects(() =>
      owner.sendTransaction({ to: contract.target, value: 1n }),
    );
    assert.equal(await provider.getBalance(contract.target), 0n);
    assert.equal((await contract.batches(batch)).root, tree.root);
  } finally {
    provider.destroy();
  }
});
