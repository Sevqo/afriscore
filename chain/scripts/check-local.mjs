import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../..'),
  rpc = 'http://127.0.0.1:18545';
fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
const env = {
  ...process.env,
  AFRICORE_ANCHOR_RPC: rpc,
  AFRICORE_DEPLOYMENT_FILE: '.tmp/test-chain-deployment.json',
};
let ready = false,
  closed = false;
const node = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/hardhat/dist/src/cli.js'),
    'node',
    '--network',
    'local',
    '--hostname',
    '127.0.0.1',
    '--port',
    '18545',
  ],
  {
    cwd: path.join(root, 'chain'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let diagnostics = '';
node.stdout.on('data', (data) => {
  diagnostics = (
    diagnostics +
    String(data).replace(
      /Private Key:.*$/gm,
      '[public development key omitted]',
    )
  ).slice(-2000);
  if (diagnostics.includes('Started HTTP')) ready = true;
});
node.stderr.on('data', (data) => {
  diagnostics = (diagnostics + data).slice(-1000);
});
node.on('exit', () => (closed = true));
async function run(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error('Check failed with exit ' + code)),
    );
  });
}
try {
  for (let i = 0; i < 300 && !ready; i++) {
    if (closed) throw Error('Local EVM startup failed: ' + diagnostics);
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw Error('Local EVM startup timed out: ' + diagnostics);
  await run(['--test', 'chain/scripts/contracts.test.mjs']);
  await run(['chain/scripts/deploy.mjs']);
  const deployment = JSON.parse(
    fs.readFileSync(path.join(root, env.AFRICORE_DEPLOYMENT_FILE), 'utf8'),
  );
  env.AFRICORE_ANCHOR_ADDRESS = deployment.contract_address;
  env.AFRICORE_ANCHOR_CHAIN_ID = '31337';
  await run(['--test', 'dist/__tests__/trust.test.js']);
  await run([
    'scripts/verify-credential.mjs',
    '--file',
    '.tmp/stage3-verification-bundle.json',
    '--rpc',
    rpc,
    '--contract',
    deployment.contract_address,
  ]);
  const bundle = JSON.parse(
    fs.readFileSync(
      path.join(root, '.tmp/stage3-verification-bundle.json'),
      'utf8',
    ),
  );
  fs.writeFileSync(
    path.join(root, '.tmp/local-chain-test-report.json'),
    JSON.stringify(
      { deployment, anchor: bundle.proof, tested_at: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(
    'Local contract, signed-credential, authorization, anchoring and independent verification checks passed.',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  node.kill('SIGTERM');
}
