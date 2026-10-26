# Smart contracts
Owner: AfriCore engineering/security. Reviewed 2026-10-26.

chain/contracts/AfriCoreAnchors.sol is a small immutable root registry. AccessControl protects PUBLISHER_ROLE; DEFAULT_ADMIN_ROLE can grant/revoke publishers and pause/unpause future publication. publish(batch,root) rejects zero/duplicate commitments and records the publication block. verify(batch,leaf,proof) uses OpenZeppelin MerkleProof. Existing roots cannot be edited/deleted through the contract. No payable entry/fallback, merchant funds, tokens or invoice assets exist.

Admin compromise can change publishers and stop publication; an authorized malicious publisher can post misleading new roots, so verifiers must independently evaluate issuer authority and evidence. It cannot rewrite an existing batch. Initial local admin is a public disposable Hardhat account, never a production identity. Production governance requires managed signer/multisig/separation of duties and external contract review. No external audit or formal verification is claimed.

Compile via chain/scripts/compile.mjs using locked solc, optimizer200 and Cancun EVM. npm run chain:node starts loopback local EVM; npm run test:chain compiles/deploys and checks unauthorized publication, zero/duplicate rejection, inclusion/tampering, pause and refusal of funds. npm run chain:deploy deploys locally and records actual chain/address/transaction/compiler/gas. It refuses nonlocal deployment.

Upgrade strategy: no proxy or mutable roots. Deploy a reviewed new registry version, explicitly pin its address/version, retain old roots and publish migration metadata. Do not silently switch historical verification to a new contract. Testnet deployment needs a separate explicit reviewed command/config; the local deployment script does not buy gas or deploy publicly.
