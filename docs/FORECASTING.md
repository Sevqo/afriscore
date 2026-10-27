# Cash-flow forecasting
Implementation: src/operations/intelligence.ts. POST organizations/:org/forecasts under /api/v1. Supports 7, 30, 60 and 90 days in one explicit currency.

Forecasts combine outstanding invoice due dates, observed payer delay when history is sufficient, recurring obligations and non-invoice historical collection/outflow baselines. Baseline extrapolation requires at least 30 days and five events; invoice receipts are excluded from the collection baseline to avoid counting them twice. Baselines use at most 90 observed days. Explicit obligation-linked expenses are excluded from the generic expense baseline. Unlinked recurring expenses may still overlap obligations; connect the obligation_id when recording them.

Expected assumes 90% collection, optimistic 100%, conservative 65% plus 14 days. Custom accepts collection basis points, collection delay and outflow basis points. Assumptions are visible and adjustable, not learned probabilities. Weekly/monthly/quarterly/yearly and once obligations are expanded; overdue one-time obligations carry to the next forecast day. Calendar recurrence and horizon bounds are deterministic.

Responses include daily inflows/outflows/cumulative movement, projected totals, source IDs, assumptions, coverage warnings and scenario bounds. Starting balance is null because no verified bank balance exists. Confidence intervals are null: scenarios are not statistical confidence intervals. Net movement cannot be interpreted as money available, guaranteed revenue, financing eligibility or financial advice. No AI model computes these amounts.

Reproduce with fixed date fixtures in stage2.test.ts. Compare scenarios and invoice dates/allocations rather than validating a forecast against invented outcomes. Backtesting, calibrated uncertainty and richer seasonal models remain future work.
