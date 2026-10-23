import { randomUUID } from "node:crypto";
import { dbAll, dbGet, dbRun } from "../db";

/**
 * Orbit state machine.
 *
 * Every unit of orchestration is a `workflow` row with an explicit state, and
 * every transition is appended to `workflow_events` (state history). Workers
 * only move a workflow forward (or into a FAILED_* terminal state); going
 * backwards or leaving a terminal state is rejected.
 *
 * Ingestion lifecycle: PENDING -> CONSENT_VERIFIED -> PARSING -> NORMALIZING
 *   -> RECONCILING -> SCORING -> READY
 * Matching lifecycle: PENDING -> RECONCILING -> SCORING -> READY
 */

export const WORKFLOW_STATES = [
  "PENDING",
  "CONSENT_VERIFIED",
  "PARSING",
  "NORMALIZING",
  "RECONCILING",
  "SCORING",
  "READY",
  "FAILED_PARSING",
  "FAILED_NORMALIZATION",
  "FAILED_LEDGER",
  "FAILED_RECONCILING",
  "FAILED_SCORING",
  "FAILED",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

const RANK: Record<WorkflowState, number> = {
  PENDING: 0,
  CONSENT_VERIFIED: 1,
  PARSING: 2,
  NORMALIZING: 3,
  RECONCILING: 4,
  SCORING: 5,
  READY: 6,
  FAILED_PARSING: 100,
  FAILED_NORMALIZATION: 100,
  FAILED_LEDGER: 100,
  FAILED_RECONCILING: 100,
  FAILED_SCORING: 100,
  FAILED: 100,
};

export const FAILED_STATE_BY_PHASE: Record<"parsing" | "normalization" | "ledger" | "reconciling" | "scoring", WorkflowState> = {
  parsing: "FAILED_PARSING",
  normalization: "FAILED_NORMALIZATION",
  ledger: "FAILED_LEDGER",
  reconciling: "FAILED_RECONCILING",
  scoring: "FAILED_SCORING",
};

export type WorkflowKind = "statement_ingestion" | "payment_matching";
export type SubjectType = "business" | "individual";

export interface Workflow {
  id: string;
  kind: WorkflowKind;
  subject_type: SubjectType;
  subject_id: string;
  state: WorkflowState;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowEvent {
  id: string;
  workflow_id: string;
  seq: number;
  from_state: WorkflowState | null;
  to_state: WorkflowState;
  event: string | null;
  error: string | null;
  created_at: string;
}

export class InvalidTransitionError extends Error {
  constructor(from: WorkflowState, to: WorkflowState) {
    super(`Invalid workflow transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function isTerminal(state: WorkflowState): boolean {
  return state === "READY" || state.startsWith("FAILED");
}

export function isAllowedTransition(from: WorkflowState, to: WorkflowState): boolean {
  if (from === to) return false;
  if (isTerminal(from)) return false;
  // Any state may fail; forward progress is rank-increasing.
  if (RANK[to] >= 100) return true;
  return RANK[to] > RANK[from];
}

export class WorkflowStore {
  /** Creates a workflow in PENDING and records the initial transition. */
  async create(input: { kind: WorkflowKind; subjectType: SubjectType; subjectId: string; id?: string }): Promise<Workflow> {
    const now = new Date().toISOString();
    const workflow: Workflow = {
      id: input.id ?? randomUUID(),
      kind: input.kind,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      state: "PENDING",
      error_code: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    await dbRun(
      `INSERT INTO workflows (id, kind, subject_type, subject_id, state, error_code, error_message, created_at, updated_at)
       VALUES (@id, @kind, @subject_type, @subject_id, @state, @error_code, @error_message, @created_at, @updated_at)`,
      workflow
    );
    await this.appendEvent(workflow.id, null, "PENDING", "workflow.created", null);

    return workflow;
  }

  async get(workflowId: string): Promise<Workflow | undefined> {
    return dbGet<Workflow>(`SELECT * FROM workflows WHERE id = ?`, [workflowId]);
  }

  async history(workflowId: string): Promise<WorkflowEvent[]> {
    return dbAll<WorkflowEvent>(`SELECT * FROM workflow_events WHERE workflow_id = ? ORDER BY seq ASC`, [workflowId]);
  }

  async listBySubject(subjectType: SubjectType, subjectId: string): Promise<Workflow[]> {
    return dbAll<Workflow>(
      `SELECT * FROM workflows WHERE subject_type = ? AND subject_id = ? ORDER BY created_at DESC`,
      [subjectType, subjectId]
    );
  }

  /**
   * Moves a workflow to `to`, appending an event. Throws InvalidTransitionError
   * for backwards/terminal transitions.
   */
  async transition(
    workflowId: string,
    to: WorkflowState,
    options: { event?: string; error?: string | null } = {}
  ): Promise<Workflow> {
    const workflow = await this.get(workflowId);
    if (!workflow) throw new Error(`workflow_not_found: ${workflowId}`);

    if (!isAllowedTransition(workflow.state, to)) {
      throw new InvalidTransitionError(workflow.state, to);
    }

    const now = new Date().toISOString();
    const isFailure = RANK[to] >= 100;
    await dbRun(
      `UPDATE workflows SET state = ?, updated_at = ?, error_code = ?, error_message = ? WHERE id = ?`,
      [to, now, isFailure ? to : null, isFailure ? (options.error ?? null) : null, workflowId]
    );
    await this.appendEvent(workflowId, workflow.state, to, options.event ?? null, options.error ?? null);

    return (await this.get(workflowId))!;
  }

  /**
   * Idempotent forward progress: moves to `to` only if the workflow is not
   * already at/after that state. Safe to call when a job is retried after a
   * partial run.
   */
  async advance(workflowId: string, to: WorkflowState, event?: string): Promise<Workflow> {
    const workflow = await this.get(workflowId);
    if (!workflow) throw new Error(`workflow_not_found: ${workflowId}`);
    if (isTerminal(workflow.state)) return workflow;
    if (RANK[to] <= RANK[workflow.state]) return workflow;
    return this.transition(workflowId, to, { event });
  }

  /** Terminal failure transition; no-op if the workflow already failed. */
  async fail(workflowId: string, failedState: WorkflowState, error: string): Promise<Workflow | undefined> {
    const workflow = await this.get(workflowId);
    if (!workflow) return undefined;
    if (isTerminal(workflow.state)) return workflow;
    return this.transition(workflowId, failedState, { event: "workflow.failed", error });
  }

  private async appendEvent(
    workflowId: string,
    from: WorkflowState | null,
    to: WorkflowState,
    event: string | null,
    error: string | null
  ): Promise<void> {
    const row = await dbGet<{ next: number | string | null }>(
      `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM workflow_events WHERE workflow_id = ?`,
      [workflowId]
    );
    await dbRun(
      `INSERT INTO workflow_events (id, workflow_id, seq, from_state, to_state, event, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), workflowId, Number(row?.next ?? 1), from, to, event, error, new Date().toISOString()]
    );
  }
}

export const workflowStore = new WorkflowStore();
