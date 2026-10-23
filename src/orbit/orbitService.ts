import { dbAll } from "../db";
import { getBusiness } from "../services/businessService";
import { ONBOARDING_GRANTEE, OnboardingError, IngestStatementInput } from "../services/businessOnboardingService";
import { hasActiveConsentScope } from "../services/consentService";
import { deterministicJobId, getOrbitQueues } from "./queue";
import { Workflow, WorkflowEvent, isTerminal, workflowStore } from "./stateMachine";

/**
 * Orbit API surface: triggers that create workflows and enqueue their first
 * job, plus read models for the admin observability endpoint.
 */

export interface TriggerResult {
  workflowId: string;
  jobId: string;
  duplicate: boolean;
}

export interface PaymentInput {
  amount: number;
  reference?: string;
  counterparty?: string;
  transactionId?: string;
}

export interface WorkflowView {
  workflow: Workflow;
  history: WorkflowEvent[];
  dead_letter: Array<{
    id: string;
    queue: string;
    error_message: string;
    attempts_made: number;
    failed_at: string;
  }>;
}

/**
 * Starts (or dedupes) a statement-ingestion workflow.
 *
 * The API returns immediately with a workflow id; the heavy work happens in
 * the ingestion -> normalization -> ledger -> scoring queues. The workflow id
 * and first job id are both derived from the content hash + subject, so the
 * same upload twice yields the same workflow and the queue drops the duplicate.
 */
export async function startStatementIngestionWorkflow(businessId: string, input: IngestStatementInput): Promise<TriggerResult> {
  const business = await getBusiness(businessId);
  if (!business) throw new OnboardingError("business_not_found", "Business not found.");

  // Fast-fail without creating a workflow when consent is missing.
  const consented = await hasActiveConsentScope("business", businessId, ONBOARDING_GRANTEE, "statements");
  if (!consented) {
    throw new OnboardingError("consent_required", "Business consent must be recorded before a statement can be read.");
  }

  const baseId = `wf_${deterministicJobId(["statement_ingestion", input.content, businessId])}`;
  const existing = await workflowStore.get(baseId);

  if (existing && !isTerminal(existing.state)) {
    return { workflowId: existing.id, jobId: deterministicJobId(["ingestion", input.content, businessId]), duplicate: true };
  }
  if (existing && existing.state === "READY") {
    return { workflowId: existing.id, jobId: deterministicJobId(["ingestion", input.content, businessId]), duplicate: true };
  }

  // A previously failed workflow gets a fresh id so the user can retry the
  // same file deliberately, while an in-flight/ready upload is deduped.
  const workflowId = existing ? `${baseId}-${Date.now()}` : baseId;

  await workflowStore.create({
    id: workflowId,
    kind: "statement_ingestion",
    subjectType: "business",
    subjectId: businessId,
  });

  const jobId = deterministicJobId(["ingestion", input.content, businessId, workflowId]);
  await getOrbitQueues().ingestion.enqueue(
    {
      workflowId,
      subjectType: "business",
      subjectId: businessId,
      sourceType: input.sourceType,
      shortcode: input.shortcode,
      fileName: input.fileName,
      label: input.label,
      content: input.content,
    },
    { jobId }
  );

  return { workflowId, jobId, duplicate: false };
}

/**
 * Starts (or dedupes) the receivables matching workflow for an incoming
 * payment. When the payment carries a reference, (subject, reference, amount)
 * is the idempotency key, so a retried M-Pesa webhook does not double-post.
 */
export async function startPaymentMatchingWorkflow(businessId: string, payment: PaymentInput): Promise<TriggerResult> {
  const business = await getBusiness(businessId);
  if (!business) throw new OnboardingError("business_not_found", "Business not found.");

  const dedupe = payment.reference
    ? `wf_${deterministicJobId(["payment_matching", businessId, payment.reference, payment.amount])}`
    : `wf_${deterministicJobId(["payment_matching", businessId, payment.amount, Date.now()])}`;

  const existing = await workflowStore.get(dedupe);
  if (existing) {
    return { workflowId: existing.id, jobId: deterministicJobId(["matching", existing.id]), duplicate: true };
  }

  await workflowStore.create({
    id: dedupe,
    kind: "payment_matching",
    subjectType: "business",
    subjectId: businessId,
  });

  const jobId = deterministicJobId(["matching", dedupe]);
  await getOrbitQueues().matching.enqueue(
    { workflowId: dedupe, subjectType: "business", subjectId: businessId, payment },
    { jobId }
  );

  return { workflowId: dedupe, jobId, duplicate: false };
}

export async function getWorkflowView(workflowId: string): Promise<WorkflowView | undefined> {
  const workflow = await workflowStore.get(workflowId);
  if (!workflow) return undefined;

  const history = await workflowStore.history(workflowId);
  const deadLetter = await dbAll<WorkflowView["dead_letter"][number]>(
    `SELECT id, queue, error_message, attempts_made, failed_at
     FROM dead_letter_jobs WHERE workflow_id = ? ORDER BY failed_at DESC`,
    [workflowId]
  );

  return { workflow, history, dead_letter: deadLetter };
}

export async function listWorkflowsForSubject(subjectType: "business" | "individual", subjectId: string): Promise<Workflow[]> {
  return workflowStore.listBySubject(subjectType, subjectId);
}
