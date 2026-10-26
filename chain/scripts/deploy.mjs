import fs from 'node:fs';
import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import { compile } from './compile.mjs';
const rpc = process.env.AFRICORE_ANCHOR_RPC || 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpc);
try {
  const chain = Number((await provider.getNetwork()).chainId);
  if (chain !== 31337)
    throw Error(
      'This deployment script is local-only. Testnet deployment requires a separately reviewed explicit configuration.',
    );
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(rpc).hostname))
    throw Error('Local RPC must be loopback');
  const signer = await provider.getSigner(),
    artifact = compile(),
    contract = await new ContractFactory(
      artifact.abi,
      artifact.bytecode,
      signer,
    ).deploy(await signer.getAddress());
  await contract.waitForDeployment();
  const receipt = await contract.deploymentTransaction().wait();
  const result = {
    chain_id: chain,
    contract_address: await contract.getAddress(),
    deployment_transaction: receipt.hash,
    block_number: receipt.blockNumber,
    publisher: await signer.getAddress(),
    compiler: artifact.compiler,
    version: '1',
    deployed_at: new Date().toISOString(),
    network: 'local_ephemeral',
    gas_used: receipt.gasUsed.toString(),
    cost_wei: (receipt.gasUsed * receipt.gasPrice).toString(),
  };
  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync(
    process.env.AFRICORE_DEPLOYMENT_FILE || '.tmp/chain-deployment.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  provider.destroy();
}
