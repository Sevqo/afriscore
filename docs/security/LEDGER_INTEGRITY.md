# Ledger integrity

The existing sequence, previous hash, canonical entry hash, count and keyed head detect modification, missing middle entries and tail deletion when the trusted head remains. They cannot prove freshness after an attacker restores both the entire chain and its matching historical head.

`ledgerCheckpoint` exports subject, expected entry count, head hash and anchor HMAC. `verifyChainIntegrity` can accept that separately trusted expected checkpoint and reject even a formerly valid complete snapshot. The regression test demonstrates the difference between database-local validity and independent expected-tip verification.

Operational procedure: retain checkpoints after completed write batches in independently controlled immutable custody, track capture time and scope, and provide that expected checkpoint to verification. Protect checkpoint integrity and prevent an attacker from selecting an older checkpoint. No automatic independent checkpoint sink, schedule or legacy ledger blockchain anchoring was provisioned. A caller omitting the expected checkpoint receives only database-local checks. Credential batch anchoring is a separate system and is not represented as anchoring every legacy financial ledger write.

Existing ledger history is not rewritten by HMAC identifier migration, timestamp correction or key-version rollout. Repair events must append evidence; never recalculate a clean chain over surviving rows to hide damage.
