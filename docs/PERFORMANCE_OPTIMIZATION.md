# Application performance

Business reuses account bootstrap data, parallelizes independent reads, prefetches common sidebar destinations and uses scoped cached results during revalidation. Intelligence and Automations batch independent reads. A 45-second request deadline prevents indefinitely pending API calls. Stale view guards preserve organization, environment, section, currency and applied date boundaries. Mutations are never automatically replayed.

Isolated local SQLite benchmark: cold HTTP 20.55ms; repeated memory reads averaged 0.0283ms; 20 repeats used one network load total. This measures the query layer, not hosted Neon latency or full route interaction. Free Render cold starts remain possible. All widgets do not yet have independent failure/retry states; some module loads remain grouped.
