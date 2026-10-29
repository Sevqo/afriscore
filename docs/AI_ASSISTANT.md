# AfriCore Assistant
Implementation: src/operations/assistant.ts. Four fixed tools: financial_summary, receivables, forecast and reconciliation. The server performs all authorization and arithmetic before optional language generation. No SQL execution, external tools, financial actions or model-selected tenant access exist. Responses include computed evidence and actions_executed:false.

Configure server-only OPENAI_API_KEY and AFRICORE_AI_MODEL in ignored .env, or leave unconfigured. No browser key exists. Provider abstraction supports a fixture implementation for tests and OpenAI Responses for generation (store:false, bounded output, 20-second timeout). Each request requires explicit consent before sending its question and minimized evidence to the external provider. Do not paste secrets or third-party personal information in a question. Numeric/domain evidence omits customer names, contacts and freeform documents. This reduces exposure; it does not replace a lawful processing assessment.

The default organization quota is 50 requests/day (AFRICORE_AI_DAILY_REQUEST_LIMIT), reserved atomically. Usage stores provider/model, status, token counts and duration, not prompt/reply text. Computed evidence remains usable when unconfigured or failed. Provider failures never become fabricated answers. Credit exhaustion has a distinct status and should be repaired in billing, not retried aggressively. Token counts are not monetary cost estimates.

Local setup on 2026-10-25 created a key using the OpenAI Platform secure flow and saved it only to ignored .env. One synthetic live request returned HTTP 429 credit_balance_exhausted. Therefore real model output is not verified; fixture-provider tests validate the adapter boundary, minimization and error handling. Add credits/authorized project billing before retrying. An initial unused key from interrupted setup needs manual revocation in Platform.

The chosen local model is gpt-5-mini; deployment model choice is explicit. Confirm current model availability and privacy/retention settings before use. Sources: https://developers.openai.com/api/docs/guides/text and https://developers.openai.com/api/docs/models/gpt-5-mini . Internal Kai remains a separate read-only documentation search foundation, without code execution or issue access.


## Connected platform continuation
See [CONNECTED_PLATFORM_ARCHITECTURE.md](CONNECTED_PLATFORM_ARCHITECTURE.md) and [CONNECTED_PLATFORM_REPORT.md](CONNECTED_PLATFORM_REPORT.md) for the owner-approved Milestone 3 extensions and current verification/operational boundaries. Historical readiness statements above describe their original release; retain the documented financial, consent, issuer and privacy invariants.
