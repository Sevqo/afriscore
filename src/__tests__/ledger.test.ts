import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

// Must run before any module that loads the DB adapter.
const { sqlitePath } = configureTestEnv("ledger");

import { migrate, dbRun,dbGet } from "../db";
import { appendEvent, getLedger, verifyChainIntegrity,ledgerCheckpoint } from "../services/ledgerService";

describe("hash-chained ledger", () => {
  before(async () => {
    await migrate();
    await truncateAll(dbRun);
  });

  after(() => {
    removeSqliteFile(sqlitePath);
  });

  test("first entry chains from the genesis hash", async () => {
    const entry = await appendEvent("business", "biz-genesis", "business.created", { name: "Test" });
    assert.strictEqual(entry.prev_hash, "0".repeat(64));
    assert.strictEqual(entry.entry_hash.length, 64);
  });

  test("each subsequent entry chains from the previous entry's hash", async () => {
    const a = await appendEvent("business", "biz-chain", "business.created", { step: 1 });
    const b = await appendEvent("business", "biz-chain", "verification.checks_run", { step: 2 });
    const c = await appendEvent("business", "biz-chain", "score.updated", { step: 3 });

    assert.strictEqual(b.prev_hash, a.entry_hash);
    assert.strictEqual(c.prev_hash, b.entry_hash);
  });

  test("an untampered chain verifies as valid", async () => {
    await appendEvent("business", "biz-valid", "business.created", { x: 1 });
    await appendEvent("business", "biz-valid", "verification.checks_run", { x: 2 });

    const result = await verifyChainIntegrity("business", "biz-valid");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.entryCount, 2);
  });

  test("chains for different subjects are independent", async () => {
    await appendEvent("business", "biz-iso-1", "business.created", {});
    await appendEvent("business", "biz-iso-2", "business.created", {});

    const one = await verifyChainIntegrity("business", "biz-iso-1");
    const two = await verifyChainIntegrity("business", "biz-iso-2");
    assert.strictEqual(one.entryCount, 1);
    assert.strictEqual(two.entryCount, 1);
    assert.strictEqual(one.valid && two.valid, true);
  });

  test("TAMPER DETECTION: editing stored event data breaks the chain", async () => {
    await appendEvent("business", "biz-tamper", "business.created", { legal_name: "Honest Traders" });
    await appendEvent("business", "biz-tamper", "score.updated", { trust_score: 40 });

    const before = await verifyChainIntegrity("business", "biz-tamper");
    assert.strictEqual(before.valid, true);

    // Simulate an attacker with direct DB write access inflating a trust
    // score after the fact — exactly the scenario the ledger exists to catch.
    const entries = await getLedger("business", "biz-tamper");
    const target = entries.find((e) => e.event_type === "score.updated")!;
    await dbRun(`UPDATE ledger SET event_data = ? WHERE id = ?`, [
      JSON.stringify({ trust_score: 99 }),
      target.id,
    ]);

    const after = await verifyChainIntegrity("business", "biz-tamper");
    assert.strictEqual(after.valid, false, "tampered chain must NOT verify");
    assert.strictEqual(after.brokenAt, target.id, "should identify which entry was altered");
  });

  test("TAMPER DETECTION: deleting a middle entry breaks the chain", async () => {
    await appendEvent("business", "biz-del", "business.created", { step: 1 });
    await appendEvent("business", "biz-del", "verification.checks_run", { step: 2 });
    await appendEvent("business", "biz-del", "score.updated", { step: 3 });

    const entries = await getLedger("business", "biz-del");
    const middle = entries[1];
    await dbRun(`DELETE FROM ledger WHERE id = ?`, [middle.id]);

    const result = await verifyChainIntegrity("business", "biz-del");
    assert.strictEqual(result.valid, false, "chain with a removed entry must NOT verify");
  });

  test("TAMPER DETECTION: truncating the tail is detected via the head anchor", async () => {
    await appendEvent("business", "biz-tail", "business.created", { step: 1 });
    await appendEvent("business", "biz-tail", "score.updated", { trust_score: 10 });
    await appendEvent("business", "biz-tail", "score.updated", { trust_score: 20 });

    // Deleting the newest entry used to leave a perfectly "valid" chain.
    const entries = await getLedger("business", "biz-tail");
    await dbRun(`DELETE FROM ledger WHERE id = ?`, [entries[entries.length - 1].id]);

    const result = await verifyChainIntegrity("business", "biz-tail");
    assert.strictEqual(result.valid, false, "tail truncation must be detected");
    assert.strictEqual(result.reason, "entry_count_mismatch");
    assert.strictEqual(result.anchored, true);
  });

  test("TAMPER DETECTION: deleting the whole post-upgrade ledger is detected", async () => {
    await appendEvent("business", "biz-wipe", "business.created", { step: 1 });
    await appendEvent("business", "biz-wipe", "score.updated", { trust_score: 5 });
    await dbRun(`DELETE FROM ledger WHERE subject_id = ?`, ["biz-wipe"]);

    const result = await verifyChainIntegrity("business", "biz-wipe");
    assert.strictEqual(result.valid, false, "an emptied chain must not look like a clean history");
  });

  test("TAMPER DETECTION: a rewritten chain cannot forge the keyed head anchor", async () => {
    await appendEvent("business", "biz-forge", "business.created", { step: 1 });
    await appendEvent("business", "biz-forge", "score.updated", { trust_score: 10 });

    // Simulates a DB-write attacker rewriting the head hash without the key.
    await dbRun(`UPDATE ledger_heads SET head_hash = ? WHERE subject_id = ?`, ["f".repeat(64), "biz-forge"]);

    const result = await verifyChainIntegrity("business", "biz-forge");
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.anchored, true);
  });

  test("concurrent appends produce a single unforked, correctly sequenced chain", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => appendEvent("business", "biz-concurrent", "score.updated", { i }))
    );

    const result = await verifyChainIntegrity("business", "biz-concurrent");
    assert.strictEqual(result.valid, true, "concurrent appends must not fork the chain");
    assert.strictEqual(result.entryCount, 8);
    assert.strictEqual(result.anchored, true);

    const entries = await getLedger("business", "biz-concurrent");
    const seqs = entries.map((e) => e.seq);
    assert.deepStrictEqual(seqs, [1, 2, 3, 4, 5, 6, 7, 8]);
  });
  test('a separately retained checkpoint detects an otherwise valid snapshot rollback',async()=>{
    const first=await appendEvent('business','biz-checkpoint','business.created',{fixture:true});
    const old=await dbGet('SELECT * FROM ledger_heads WHERE subject_id=?',['biz-checkpoint']);
    const second=await appendEvent('business','biz-checkpoint','score.updated',{fixture:true});
    const checkpoint=await ledgerCheckpoint('business','biz-checkpoint');
    await dbRun('DELETE FROM ledger WHERE id=?',[second.id]);
    await dbRun('UPDATE ledger_heads SET entry_count=?,head_hash=?,anchor_hmac=?,updated_at=? WHERE subject_id=?',[old.entry_count,old.head_hash,old.anchor_hmac,old.updated_at,'biz-checkpoint']);
    assert.equal((await verifyChainIntegrity('business','biz-checkpoint')).valid,true,'A complete valid snapshot needs external evidence to identify rollback');
    assert.equal((await verifyChainIntegrity('business','biz-checkpoint',checkpoint)).valid,false);
    await dbRun('DELETE FROM ledger WHERE id=?',[first.id]);await dbRun('DELETE FROM ledger_heads WHERE subject_id=?',['biz-checkpoint']);
    assert.equal((await verifyChainIntegrity('business','biz-checkpoint',checkpoint)).valid,false);
  });
});
