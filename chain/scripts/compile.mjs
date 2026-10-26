import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function compile() {
  const name = 'AfriCoreAnchors.sol',
    source = fs.readFileSync(
      new URL('../contracts/' + name, import.meta.url),
      'utf8',
    );
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: 'Solidity',
        sources: { [name]: { content: source } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: 'cancun',
          outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
        },
      }),
      {
        import: (file) => {
          try {
            return { contents: fs.readFileSync(require.resolve(file), 'utf8') };
          } catch {
            return { error: 'Unresolved import ' + file };
          }
        },
      },
    ),
  );
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length)
    throw Error(errors.map((e) => e.formattedMessage).join('\n'));
  const contract = output.contracts[name].AfriCoreAnchors;
  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
    compiler: solc.version(),
  };
}
