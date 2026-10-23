import { z } from "zod";
import { StatementSourceType } from "../services/statement/parser";

/**
 * Orbit Core: fully-typed queue payloads. Every queue carries a payload whose
 * shape is validated at enqueue time, so a worker can never receive an
 * unexpected object at runtime.
 */

export const SUBJECT_TYPE = z.enum(["business", "individual"]);
export type SubjectType = z.infer<typeof SUBJECT_TYPE>;

/** Statement ingestion: the API uploads content directly (no file storage),
 *  so "reading the file" in the ingestion worker is a passthrough of this
 *  already-provided raw text. */
export const IngestionJobPayload = z.object({
  workflowId: z.string(),
  subjectType: SUBJECT_TYPE,
  subjectId: z.string(),
  sourceType: z.enum(["individual_mpesa", "business_till", "business_paybill", "bank"]),
  shortcode: z.string().optional(),
  fileName: z.string().optional(),
  label: z.string().optional(),
  content: z.string().min(1),
});
export type IngestionJobPayload = z.infer<typeof IngestionJobPayload>;

/** Normalization: parse raw text, dedupe by receipt number, write rows. */
export const NormalizationJobPayload = z.object({
  workflowId: z.string(),
  subjectType: SUBJECT_TYPE,
  subjectId: z.string(),
  sourceType: z.enum(["individual_mpesa", "business_till", "business_paybill", "bank"]),
  shortcode: z.string().optional(),
  fileName: z.string().optional(),
  label: z.string().optional(),
  content: z.string().min(1),
});
export type NormalizationJobPayload = z.infer<typeof NormalizationJobPayload>;

/** Ledger: write the just-ingested transactions/statement to the chain. */
export const LedgerJobPayload = z.object({
  workflowId: z.string(),
  subjectType: SUBJECT_TYPE,
  subjectId: z.string(),
  statementId: z.string(),
  sourceType: z.string(),
  shortcode: z.string().nullable(),
});
export type LedgerJobPayload = z.infer<typeof LedgerJobPayload>;

/** Scoring: recalculate metrics / health / DSO after data changed. */
export const ScoringJobPayload = z.object({
  workflowId: z.string(),
  subjectType: SUBJECT_TYPE,
  subjectId: z.string(),
  reason: z.enum(["ingestion", "dso_recalc"]),
});
export type ScoringJobPayload = z.infer<typeof ScoringJobPayload>;

/** Matching: reconcile an incoming (simulated M-Pesa) payment. */
export const MatchingJobPayload = z.object({
  workflowId: z.string(),
  subjectType: SUBJECT_TYPE,
  subjectId: z.string(),
  payment: z.object({
    amount: z.number().positive(),
    reference: z.string().optional(),
    counterparty: z.string().optional(),
    transactionId: z.string().optional(),
  }),
});
export type MatchingJobPayload = z.infer<typeof MatchingJobPayload>;

/** Dead-letter: a job that exhausted retries, replayed for the DLQ worker. */
export const DeadLetterJobPayload = z.object({
  originalJobId: z.string(),
  queue: z.string(),
  workflowId: z.string().optional(),
  subjectType: SUBJECT_TYPE.optional(),
  subjectId: z.string().optional(),
  name: z.string(),
  payload: z.unknown(),
  attemptsMade: z.number().int().nonnegative(),
  error: z.string(),
  failedState: z.string(),
});
export type DeadLetterJobPayload = z.infer<typeof DeadLetterJobPayload>;

export type OrbitPayload =
  | IngestionJobPayload
  | NormalizationJobPayload
  | LedgerJobPayload
  | ScoringJobPayload
  | MatchingJobPayload
  | DeadLetterJobPayload;

export type OrbitQueueName = "ingestion" | "normalization" | "ledger" | "scoring" | "matching" | "dead-letter";

export const ORBIT_QUEUE_NAMES: readonly OrbitQueueName[] = [
  "ingestion",
  "normalization",
  "ledger",
  "scoring",
  "matching",
  "dead-letter",
];

export function statementSourceType(value: string): StatementSourceType | undefined {
  return ["individual_mpesa", "business_till", "business_paybill", "bank"].includes(value)
    ? (value as StatementSourceType)
    : undefined;
}
