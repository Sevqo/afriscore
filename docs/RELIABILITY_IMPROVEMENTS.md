# Reliability improvements

Record queries now filter before pagination, bind all user values, treat SQL wildcard characters literally, cap search input, and order ties by ID. Existing organization/environment/kind/date indexes remain; no destructive migration or new schema is needed. Returned pages stay bounded (25 in the workspace, API maximum 100). Leading-substring JSON search still requires a scoped scan; large-workspace full-text indexing and load qualification remain future work. Payment/reconciliation lists and some selectors still expose bounded loaded subsets rather than an unlimited search surface.

The main workspace prevents out-of-order requests from changing a later scope. Search uses the server instead of filtering only the first loaded page. Previous/next controls, displayed record range, reset-on-scope behavior and browser-demo transport pagination use consistent semantics. Financial charts explicitly continue to describe loaded records.

The same completion gate also protects Stage 2 currency changes and secondary data, so a slow earlier forecast/analytics response cannot be presented as the newly selected currency. Old figures clear during the next authorized load. This changes presentation ordering, not financial arithmetic or server authorization.

Stage 2 scheduled work runs in the API process independently of a browser. A failed workspace is logged with a bounded code and cannot prevent later businesses/environments from running. Failures are counted; the failed job is not silently discarded or reported successful. This does not solve a permanently broken job within that same workspace, process crashes or distributed leases. Those remain operator/architecture work. Existing atomic run/notification deduplication and webhook retry/dead-letter mechanisms remain authoritative.

No financial state is confirmed by frontend success. No mock replaces the backend. Existing event/ledger/proof history and authorization are preserved. No migration or new endpoint was introduced; existing list query behavior and customer validation were corrected. API route contracts remain 59 legacy and 136 workspace operations.

Performance observations are local functional-test timings and bounded asset/build sizes, not capacity benchmarks. No production latency SLO, memory leak clearance, Lighthouse score or scalability claim is made. Single-instance deployment, shared rate limits/leases, external monitoring and large-history aggregation remain gates.

Small local SQLite read sample (20 sequential requests per endpoint after three warmups): customer page p50/p95 2.12/3.57ms, report 2.55/3.75ms, intelligence 5.04/6.97ms. Maximum observed was9.04ms. Audit-server working set was47.33MB before and52.11MB after; this short sample cannot establish a memory leak or its absence. It found no significant latency issue at this tiny synthetic scale. Raw measurements: .tmp/product-audit/performance.json. No production or large-record load was performed.
