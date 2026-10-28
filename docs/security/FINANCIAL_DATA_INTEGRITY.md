# Financial data integrity

See [report C/F](SECOND_PASS_REMEDIATION.md). Requested payment, provider-confirmed payment, invoice allocation, settlement and merchant-recorded expense remain distinct. No real M-Pesa, financing, escrow or tax-authority operation was activated.

Sandbox provider references retain global environment uniqueness. Repeated references are accepted only when ownership, payment request, amount, currency and outcome match. Conflicts do not silently reuse another merchant's record. Independent providers/accounts require a reviewed authoritative namespace before live rollout.

Receipt/reconciliation paths serialize on a business-scoped lock in PostgreSQL; SQLite serializes transactions. A linked receipt must agree with the completed incoming transaction's amount/currency and uses its timestamp. A fully paid invoice derives its date from the latest receipt. Manually supplied receipts remain merchant evidence and do not count as independently matched receipts.

Mixed currencies are rejected in legacy aggregates; new workspace finance uses explicit currency filters and minor units. Legacy major-unit decimal fields remain for API compatibility. Future issue/payment dates and out-of-window failure rows do not improve historical metrics. Existing `revenue_trend` keys describe recorded inflow, which can include transfers/loans. Decision cards therefore return manual review and no credit recommendation.

Combination matching uses a 5,000-node budget and defers ambiguity; it does not silently select one of several equally plausible payments. This is a per-invoice CPU bound, not a guarantee that loading an arbitrarily large legacy dataset is cheap. Documented KES fee tolerance remains a legacy policy; no fee tolerance is inferred for other currencies.

Historical timestamps should only be repaired where linked transaction evidence determines the correct date, under a reviewed backup/audit procedure. No bulk rewriting of customer financial history is performed by schema migration 006.
