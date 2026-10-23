import { randomUUID } from "node:crypto";
import { dbAll, dbGet, dbRun, isPostgres } from "../db";
import { getBusiness } from "../services/businessService";
import { loadBusinessContext } from "../services/businessMetricsService";
import { appendEvent } from "../services/ledgerService";
import { autoMatchPayments, getReceivablesSummary } from "../services/receivablesService";
import { emitEvent } from "../services/webhookService";
import { logger } from "../logging";
import {
  ONBOARDING_GRANTEE,
  ledgerStatementIngestion,
  normalizeStatement,
} from "../services/businessOnboardingService";
import { hasActiveConsentScope } from "../services/consentService";
import { StatementParseError } from "../services/statement/parser";
import { MAX_ATTEMPTS, OrbitQueues, deterministicJobId } from "./queue";
import {
  DeadLetterJobPayload,
  IngestionJobPayload,
  LedgerJobPayload,
  MatchingJobPayload,
  NormalizationJobPayload,
  OrbitQueueName,
  ScoringJobPayload,
} from "./types";
import { FAILED_STATE_BY_PHASE, WorkflowState, isTerminal, workflowStore } from "./stateMachine";

/**
 * Orbit workers.
 *
 * Each processor is idempotent: it advances the workflow only forward, relies
 * on DB-level dedupe for transactions, and on the ledger-idempotency check for
 * chain writes. A failed job is retried by the queue runtime (3 attempts,
 * exponential backoff in Redis); once exhausted the failure handler records a
 * dead-letter job which the DLQ worker turns into a terminal FAILED state, a
 * ledger error event and a `workflow.failed` notification.
 */

type LedgerSubjectType = "business" | "person";

interface WorkflowRef {
  workflowId?: string;
  subjectType?: "business" | "individual";
  subjectId?: string;
}

function ledgerSubjectType(subjectType: "business" | "individual"): LedgerSubjectType {
  return subjectType === "individual" ? "person" : "business";
}

async function reach(workflowId: string, to: WorkflowState, event: string): Promise<void> {
  await workflowStore.advance(workflowId, to, event);
}

/** "Extract raw text": BOM strip + emptiness check on the uploaded content. */
export function extractRawText(content: string): string {
  const text = content.replace(/^\uFEFF/, "").trim();
  if (!text) throw new StatementParseError("unreadable_file", "The uploaded file is empty.");
  return text;
}

export function failedStateFor(queue: OrbitQueueName, error: Error): WorkflowState {
  // A corrupt/unreadable statement is a parsing failure regardless of which
  // queue surfaced it.
  if (error instanceof StatementParseError) return "FAILED_PARSING";
  switch (queue) {
    case "ingestion":
      return FAILED_STATE_BY_PHASE.parsing;
    case "normalization":
      return FAILED_STATE_BY_PHASE.normalization;
    case "ledger":
      return FAILED_STATE_BY_PHASE.ledger;
    case "matching":
      return FAILED_STATE_BY_PHASE.reconciling;
    case "scoring":
      return FAILED_STATE_BY_PHASE.scoring;
    default:
      return "FAILED";
  }
}

// ---------------------------------------------------------------------------
// Payment intake (simulated M-Pesa webhook)
// ---------------------------------------------------------------------------

async function ensurePaymentAccount(businessId: string): Promise<{ id: string }> {
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM accounts WHERE business_id = ? AND provider = 'mpesa' AND account_identifier = 'payments-webhook'`,
    [businessId]
  );
  if (existing) return existing;

  const id = randomUUID();
  await dbRun(
    `INSERT INTO accounts (id, business_id, provider, account_identifier, status, connected_at)
     VALUES (?, ?, 'mpesa', 'payments-webhook', 'connected', ?)`,
    [id, businessId, new Date().toISOString()]
  );
  return { id };
}

async function recordIncomingPayment(
  businessId: string,
  payment: { amount: number; reference?: string; counterparty?: string; transactionId?: string }
): Promise<{ id: string; external_id: string; amount: number }> {
  if (payment.transactionId) {
    const existing = await dbGet<{ id: string; external_id: string; amount: number }>(
      `SELECT id, external_id, amount FROM transactions WHERE id = ? AND business_id = ?`,
      [payment.transactionId, businessId]
    );
    if (existing) return existing;
  }

  const account = await ensurePaymentAccount(businessId);
  const externalId = payment.reference?.trim() || `PAY-${deterministicJobId([businessId, payment.amount, Date.now()])}`;

  const insert = isPostgres
    ? `INSERT INTO transactions
         (id, account_id, business_id, subject_type, external_id, amount, currency, type, counterparty, category, status, source_provider, raw_status, occurred_at, created_at)
       VALUES (@id, @account_id, @business_id, 'business', @external_id, @amount, 'KES', 'credit', @counterparty, 'sales', 'completed', 'mpesa', 'webhook', @occurred_at, @created_at)
       ON CONFLICT (account_id, external_id) DO NOTHING`
    : `INSERT OR IGNORE INTO transactions
         (id, account_id, business_id, subject_type, external_id, amount, currency, type, counterparty, category, status, source_provider, raw_status, occurred_at, created_at)
       VALUES (@id, @account_id, @business_id, 'business', @external_id, @amount, 'KES', 'credit', @counterparty, 'sales', 'completed', 'mpesa', 'webhook', @occurred_at, @created_at)`;

  const now = new Date().toISOString();
  await dbRun(insert, {
    id: randomUUID(),
    account_id: account.id,
    business_id: businessId,
    external_id: externalId,
    amount: payment.amount,
    counterparty: payment.counterparty ?? null,
    occurred_at: now,
    created_at: now,
  });

  const row = await dbGet<{ id: string; external_id: string; amount: number }>(
    `SELECT id, external_id, amount FROM transactions WHERE account_id = ? AND external_id = ?`,
    [account.id, externalId]
  );
  if (!row) throw new Error("payment_transaction_not_recorded");
  return row;
}

async function findMatchedInvoiceId(businessId: string, transactionId: string, reference?: string): Promise<string | undefined> {
  const rows = await dbAll<{ invoice_id: string }>(
    `SELECT invoice_id FROM invoice_payments
     WHERE business_id = ? AND (transaction_id = ? OR (? IS NOT NULL AND reference = ?))
     LIMIT 1`,
    [businessId, transactionId, reference ?? null, reference ?? null]
  );
  return rows[0]?.invoice_id;
}

async function recordUnmatchedPayment(
  businessId: string,
  transaction: { id: string; external_id: string; amount: number },
  payment: { counterparty?: string; reference?: string },
  reason: string
): Promise<void> {
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM unmatched_payments WHERE business_id = ? AND transaction_id = ? AND status = 'open' LIMIT 1`,
    [businessId, transaction.id]
  );
  if (existing) return;

  await dbRun(
    `INSERT INTO unmatched_payments (id, business_id, transaction_id, amount, reference, counterparty, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      randomUUID(),
      businessId,
      transaction.id,
      transaction.amount,
      payment.reference ?? transaction.external_id,
      payment.counterparty ?? null,
      reason,
      new Date().toISOString(),
    ]
  );
}

// ---------------------------------------------------------------------------
// Processors
// ---------------------------------------------------------------------------

async function processIngestion(queues: OrbitQueues, payload: IngestionJobPayload): Promise<void> {
  const workflow = await workflowStore.get(payload.workflowId);
  if (!workflow) throw new Error(`workflow_not_found: ${payload.workflowId}`);
  if (workflow.state === "READY") return;

  if (workflow.state === "PENDING") {
    // Consent is verified before any statement content is touched.
    if (payload.subjectType === "business") {
      const consented = await hasActiveConsentScope("business", payload.subjectId, ONBOARDING_GRANTEE, "statements");
      if (!consented) throw new Error("consent_required");
    }
    await reach(payload.workflowId, "CONSENT_VERIFIED", "consent.verified");
  }

  await reach(payload.workflowId, "PARSING", "parsing_started");
  extractRawText(payload.content);

  await queues.normalization.enqueue(
    {
      workflowId: payload.workflowId,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      sourceType: payload.sourceType,
      shortcode: payload.shortcode,
      fileName: payload.fileName,
      label: payload.label,
      content: payload.content,
    },
    { jobId: deterministicJobId(["normalization", payload.content, payload.subjectId]) }
  );
}

async function processNormalization(queues: OrbitQueues, payload: NormalizationJobPayload): Promise<void> {
  await reach(payload.workflowId, "NORMALIZING", "normalization_started");

  const normalized = await normalizeStatement(payload.subjectId, {
    sourceType: payload.sourceType,
    shortcode: payload.shortcode,
    fileName: payload.fileName,
    label: payload.label,
    content: payload.content,
  });

  await queues.ledger.enqueue(
    {
      workflowId: payload.workflowId,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      statementId: normalized.statement.id,
      sourceType: payload.sourceType,
      shortcode: normalized.shortcode,
    },
    { jobId: deterministicJobId(["ledger", normalized.statement.id]) }
  );
}

async function processLedger(queues: OrbitQueues, payload: LedgerJobPayload): Promise<void> {
  await reach(payload.workflowId, "RECONCILING", "ledger_started");
  await ledgerStatementIngestion(payload.subjectId, payload.statementId);

  await queues.scoring.enqueue(
    { workflowId: payload.workflowId, subjectType: payload.subjectType, subjectId: payload.subjectId, reason: "ingestion" },
    { jobId: deterministicJobId(["scoring", payload.workflowId]) }
  );
}

async function processScoring(queues: OrbitQueues, payload: ScoringJobPayload): Promise<void> {
  await reach(payload.workflowId, "SCORING", "scoring_started");

  if (payload.subjectType === "business") {
    const business = await getBusiness(payload.subjectId);
    if (!business) throw new Error("business_not_found");

    const context = await loadBusinessContext(payload.subjectId);
    const receivables = await getReceivablesSummary(payload.subjectId);

    await appendEvent("business", payload.subjectId, "profile.scored", {
      workflow_id: payload.workflowId,
      reason: payload.reason,
      health_score: context.health.score,
      health_band: context.health.band,
      months_of_history: context.metrics.totals.months_of_history,
      dso_days: receivables?.dso_days ?? null,
      open_invoice_value: receivables?.open_invoice_value ?? null,
      inflow: context.metrics.totals.inflow,
    });

    await reach(payload.workflowId, "READY", "workflow.completed");
    await emitEvent(
      "profile.ready",
      {
        workflow_id: payload.workflowId,
        subject_type: "business",
        subject_id: payload.subjectId,
        health_score: context.health.score,
        health_band: context.health.band,
        dso_days: receivables?.dso_days ?? null,
      },
      { type: "business", id: payload.subjectId, is_sandbox: business.is_sandbox }
    );
    return;
  }

  // Individual subjects: no business metrics to recompute in this phase.
  await reach(payload.workflowId, "READY", "workflow.completed");
}

async function processMatching(queues: OrbitQueues, payload: MatchingJobPayload): Promise<void> {
  await reach(payload.workflowId, "RECONCILING", "matching_started");

  const business = await getBusiness(payload.subjectId);
  if (!business) throw new Error("business_not_found");

  const transaction = await recordIncomingPayment(payload.subjectId, payload.payment);
  await autoMatchPayments(payload.subjectId);

  const invoiceId = await findMatchedInvoiceId(payload.subjectId, transaction.id, payload.payment.reference);

  if (invoiceId) {
    await appendEvent("business", payload.subjectId, "payment.matched", {
      workflow_id: payload.workflowId,
      invoice_id: invoiceId,
      transaction_id: transaction.id,
      amount: transaction.amount,
      reference: payload.payment.reference ?? transaction.external_id,
    });

    // Recalculate DSO / health after a successful match.
    await queues.scoring.enqueue(
      { workflowId: payload.workflowId, subjectType: payload.subjectType, subjectId: payload.subjectId, reason: "dso_recalc" },
      { jobId: deterministicJobId(["scoring", "dso", payload.workflowId]) }
    );
    return;
  }

  await recordUnmatchedPayment(payload.subjectId, transaction, payload.payment, "no_matching_invoice");
  await appendEvent("business", payload.subjectId, "payment.unmatched", {
    workflow_id: payload.workflowId,
    transaction_id: transaction.id,
    amount: transaction.amount,
    reference: payload.payment.reference ?? transaction.external_id,
    reason: "no_matching_invoice",
  });
  await reach(payload.workflowId, "READY", "payment.unmatched");
}

async function processDeadLetter(payload: DeadLetterJobPayload): Promise<void> {
  logger.error("orbit_job_dead_lettered", {
    original_job_id: payload.originalJobId,
    queue: payload.queue,
    workflow_id: payload.workflowId,
    attempts: payload.attemptsMade,
    error: payload.error,
  });

  if (!payload.workflowId) return;
  const workflow = await workflowStore.get(payload.workflowId);
  if (!workflow || isTerminal(workflow.state)) return;

  await workflowStore.fail(payload.workflowId, payload.failedState as WorkflowState, payload.error);

  if (payload.subjectId && payload.subjectType) {
    const subjectType = ledgerSubjectType(payload.subjectType);
    try {
      await appendEvent(subjectType, payload.subjectId, "workflow.failed", {
        workflow_id: payload.workflowId,
        queue: payload.queue,
        error: payload.error,
        attempts: payload.attemptsMade,
        failed_state: payload.failedState,
      });
    } catch (err) {
      logger.error("orbit_failure_ledger_write_failed", {
        workflow_id: payload.workflowId,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const business = payload.subjectType === "business" ? await getBusiness(payload.subjectId) : undefined;
      await emitEvent(
        "workflow.failed",
        {
          workflow_id: payload.workflowId,
          queue: payload.queue,
          state: payload.failedState,
          error: payload.error,
          attempts: payload.attemptsMade,
        },
        { type: subjectType, id: payload.subjectId, is_sandbox: !!business?.is_sandbox }
      );
    } catch (err) {
      logger.error("orbit_failure_notification_failed", {
        workflow_id: payload.workflowId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function recordDeadLetter(input: {
  jobId: string;
  queue: OrbitQueueName;
  payload: unknown;
  error: Error;
  attemptsMade: number;
}): Promise<void> {
  const ref = input.payload as WorkflowRef;
  await dbRun(
    `INSERT INTO dead_letter_jobs (id, queue, workflow_id, subject_type, subject_id, name, payload, attempts_made, error_message, failed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.queue,
      ref.workflowId ?? null,
      ref.subjectType ?? null,
      ref.subjectId ?? null,
      input.queue,
      JSON.stringify(input.payload),
      input.attemptsMade,
      input.error.message,
      new Date().toISOString(),
    ]
  );
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** Registers every queue processor and wires the retry-exhausted -> DLQ path. */
export function registerWorkers(queues: OrbitQueues): void {
  queues.ingestion.register((payload) => processIngestion(queues, payload));
  queues.normalization.register((payload) => processNormalization(queues, payload));
  queues.ledger.register((payload) => processLedger(queues, payload));
  queues.scoring.register((payload) => processScoring(queues, payload));
  queues.matching.register((payload) => processMatching(queues, payload));
  queues.deadLetter.register((payload) => processDeadLetter(payload));

  queues.setFailureHandler(async (input) => {
    await recordDeadLetter(input);

    const ref = input.payload as WorkflowRef;
    const failedState = failedStateFor(input.queue, input.error);
    const deadLetter: DeadLetterJobPayload = {
      originalJobId: input.jobId,
      queue: input.queue,
      workflowId: ref.workflowId,
      subjectType: ref.subjectType,
      subjectId: ref.subjectId,
      name: input.queue,
      payload: input.payload,
      attemptsMade: input.attemptsMade,
      error: input.error.message,
      failedState,
    };
    await queues.deadLetter.enqueue(deadLetter, { jobId: deterministicJobId(["dead-letter", input.jobId]) });
  });
}

export { MAX_ATTEMPTS };
