# Financial intelligence
Reviewed 2026-10-25. Implementation: src/operations/intelligence.ts.

GET /api/v1/organizations/:org/intelligence uses the authenticated organization and X-Environment; currency defaults KES. Optional from/to are ISO dates. Integer minor units remain currency separated. Dates use Africa/Nairobi for daily reporting. API keys require read scope; write access is separately enforced.

Confirmed collections come from provider events and allocations, not imported credits. Outflows comprise recorded expenses and imported debit transactions, deduplicated through transaction_id. Corrections append a superseding expense, inheriting its source/obligation links; old records remain. This is gross recorded cash movement, not bank balance, audited revenue or profit. Expense omissions and cash outside the platform can materially change the result.

Receivables use issued invoice balances and as-of allocations, aging buckets, overdue share, customer concentration and historical payment delays. Customer behavior requires at least three fully settled invoices before publishing delay/on-time statistics. Sparse records are labeled limited data, never a credit or fraud score. Insights include evidence record IDs, an explanation and a suggested review action; they do not execute it.

Quality surfaces history days, freshness, source coverage, missing expenses and unallocated payments. No fabricated opening balance, margin or profitability is shown. Reports and forecasts should be reviewed against source records. Imported sample connector data remains explicitly sandbox and unverified.

The workspace provides charts with tabular alternatives, expense categories, obligations, payer behavior and drill-down source IDs. It is a bounded first implementation: full cohort analytics, accounting-grade profitability, custom report builders and cross-currency conversion remain deferred. Large-workspace aggregation/caching and database pagination need performance qualification before scale.


## Connected platform continuation
See [CONNECTED_PLATFORM_ARCHITECTURE.md](CONNECTED_PLATFORM_ARCHITECTURE.md) and [CONNECTED_PLATFORM_REPORT.md](CONNECTED_PLATFORM_REPORT.md) for the owner-approved Milestone 3 extensions and current verification/operational boundaries. Historical readiness statements above describe their original release; retain the documented financial, consent, issuer and privacy invariants.
