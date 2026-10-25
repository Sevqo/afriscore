# Reconciliation
Owner: AfriCore engineering. Reviewed: 2026-10-25.

New workspace payments match trusted request IDs, organization, environment, currency, document and open balance. No amount-only fuzzy auto-match. Partial confirmation allocates that amount; duplicate provider references allocate nothing twice. Invoice state derives from allocations; order payment status remains separate from fulfillment.

Exceptions: currency_mismatch, amount_mismatch, closed_request, document_state, reversal_requires_review. They preserve original event IDs and enter pending_review. Review records actor/note and marks reviewed without rewriting payment proof or journal. Complex reallocation and reversal/refund settlement are incomplete and block live launch.

Legacy exact/tolerance/partial services remain unchanged. CSV imports are merchant provenance, never provider proof. UI provides allocations, queue and notes. Monitor pending exceptions externally; no pager/alert provider is configured.
