# Blockchain architecture
Owner: AfriCore engineering/security. Reviewed 2026-10-26.

The chain stores only randomized batch references, Merkle roots, publication block and authorized publisher events. Credentials, names, subject URIs, transaction descriptions, documents and salts remain off-chain. Publishing a root proves commitment inclusion/time under network assumptions, not that a business claim is true.

Local development uses Hardhat3 EDR, EVM chain31337, loopback RPC. Ethereum Sepolia11155111 is the only configurable public testnet and is disabled by default. Mainnet/other chain IDs are rejected. Sepolia was selected for broad Ethereum tooling/public verification; its test validator/economic/RPC assumptions differ from production mainnet. An L2 may later reduce fees but adds sequencer/bridge/finality assumptions and has not been selected or deployed. Local chain is reproducible and free but ephemeral and controlled by its operator, so it is not independent institutional trust.

Compare: local EVM is deterministic/fast/no real cost but fully controlled and resettable; Sepolia supplies public RPC/explorer infrastructure and external inclusion, with testnet reliability/finality and faucet availability limits; mainnet has real economic costs and stronger economic settlement assumptions but is explicitly outside authorized scope. Credentials and status logic are chain-independent; only the anchoring adapter/config changes.

Primary network reference: https://ethereum.org/developers/docs/networks/ . OpenZeppelin tree/contract verification: https://docs.openzeppelin.com/contracts/5.x/api/utils#MerkleProof . No gas purchase, token issuance, wallet custody, lending protocol, NFT or customer-fund transfer is implemented.

Public testnet deployment is not completed: no authorized Sepolia RPC, disposable funded publisher key or faucet resources were supplied. Production anchoring is hard-disabled. Local addresses/transactions are recorded in STAGE3_TEST_RESULTS.md and .tmp/chain-deployment.json; local resets invalidate those deployments. Never label local hashes as Sepolia transactions.
