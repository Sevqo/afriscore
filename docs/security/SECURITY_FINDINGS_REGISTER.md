# Second-pass findings register

28 October 2026. `Fixed` below means code corrected with regression coverage; it does not mean external deployment is verified. Release status is in SECURITY_TEST_RESULTS. All listed files are repository-relative.

| ID | Source / priority | Root cause and actual exposure | Disposition / evidence |
|---|---|---|---|
| H01 | New high 1 | Optional gateway secret allowed an unconfigured production origin | Fixed: production validation + fail-closed middleware; gateway tests |
| H02 | New high 2 | Broad public proxy included token-protected operator APIs | Fixed: default-deny edge policy, normalization checks; Worker tests; internal customer UI gated |
| H03 | New high 3 | Hop-count-derived identity could select a proxy IP | Fixed: edge-bound canonical IP after gateway authentication; multi-IP/IPv6/forgery tests; live multi-network acceptance remains untested |
| H04 | New high 4 | Organization-only AI quota could be multiplied | Fixed: atomic identity/global reservations, concurrency, kill switch and workspace caps; second-pass tests |
| M01 | New medium 5 | Unverified email writes, collision 500, redundant updates | Fixed: verified conflict-aware synchronization and verified invitation acceptance; platform/second-pass tests |
| M02 | New medium 6 | Small password blocklist; no privileged MFA | Partial: eight-character policy retained by owner, stronger local patterns; HIBP not approved; managed MFA unsupported; external gate |
| M03 | New medium 7 | Runtime path regexes encoded workspace permissions | Fixed: explicit method/declared-route/kind matrix, unknown routes denied; capability tests |
| M04 | New medium 8 | URL capability leakage in sampled and application logs | Fixed: disable Worker invocation URL logs; redact full capability segments and queries; log/edge tests |
| M05 | New medium 9 | Search inspected hidden JSON fields | Fixed: visible field allowlist, literal search escaping, stable filtering/page order; application-refinement tests. Generic JSON scans remain a performance limitation |
| F01 | Earlier payment idempotency | Conflicting replay could associate another request | Fixed within active sandbox provider: exact ownership/content checks and existing uniqueness; platform payment tests. Independent live provider/account namespaces are a launch gate |
| F02 | Earlier ledger deletion | Claimed deletion acceptance | Ordinary deletion not reproduced: existing keyed head/sequence checks already reject it. Added external expected checkpoint for whole-snapshot rollback; ledger tests |
| F03 | Earlier identifier hashing | Low-entropy deterministic salted hashes | Fixed new writes: domain-separated HMAC; audited exact legacy-match upgrades; existing links/history retained; identifier tests |
| F04 | Earlier encryption | No authenticated record context or key versions | Versioned/context-bound writes and compatible readers implemented; staged activation and historical re-encryption are controlled rollout tasks; context/rotation/legacy tests |
| F05 | Earlier webhook credentials | Legacy signing secret stored plaintext | Fixed new writes: encrypted storage + one-time display; zero historical legacy subscription rows in approved development snapshot; webhook tests |
| F06 | Earlier approvals | Approval did not commit to reviewed decision/state | Fixed: resource hash, exact parameters, authority recheck, expiry and atomic single use; mutation/replay tests; additive 006 |
| F07 | Earlier KYC | Audit after response; retention/scanning incomplete | Partial: private permission checks retained, audit before bytes fixed. Scanning and governed purge remain external/operational gates |
| F08 | Earlier Compose | Database/cache ports on all interfaces | Fixed: loopback host bindings; no hosted container networking changed |
| S01 | Service review | Reconciliation/receipt settlement date used processing time | Fixed: transaction dates and latest receipt; receipt regression tests |
| S02 | Service review | Large synchronous combinatorial search | Fixed: 5,000-node budget, yielding per invoice, ambiguous result review; reconciliation tests |
| S03 | Service review | Inline HTTP during settlement | Fixed: transactional durable jobs, bounded retry worker and consent recheck; outbox tests; additive 006 |
| S04 | Service review | Unverified imports generated automatic credit decisions | Fixed: review-only cards and zero recommended credit with explicit provenance; business-decision tests; legal launch gate retained |
| S05 | Service review | Substring intent and hard-coded currency | Fixed: whole-token intent catalog, ambiguity rejection and currency guards; query/metrics tests |
| R01 | Previously mitigated SSRF | DNS validation and actual connection could diverge | Fixed: connection-pinned TLS lookup, public address policy, allowlist, deadlines/body caps/no redirects; tests. Hosted egress still disabled pending receiver qualification |

There are 23 primary review areas. Twenty-two have at least one confirmed hardening/correctness issue; the broad ordinary-ledger-deletion claim was not reproduced. MFA, full KYC lifecycle and encryption rollout are explicitly partial. Additional review found and corrected receipt overpayment races, future-record summary leakage, failure-window currency text and dependency advisories; these are documented in the main report and test record rather than silently changing the original issue count.
