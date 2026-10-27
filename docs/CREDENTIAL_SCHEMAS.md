# Credential schemas
Owner: AfriCore engineering. Reviewed 2026-10-26. Registry version 1.0; profile VC2-JOSE-ES256-minimal-v1.

GET /api/v1/trust/schemas discovers versioned schemas; /:type returns JSON Schema. src/trust/contracts.ts is authoritative for the supported minimal credential profile and request schemas. Credential summary claims are computed by the service, not accepted as arbitrary issuer JSON or AI conclusions.

| Type | Required source and minimal claim |
| --- | --- |
| BusinessIdentityCredential | Workspace profile; display name, country, exact identity/representative assurance |
| PaymentActivityCredential | Successful sandbox provider events; qualifying count, period, currency-separated minor-unit totals, explicit simulation provenance |
| TradingHistoryCredential | Completed paid/fulfilled order references; count/period and recorded-source limitations, without claiming independent live verification |
| InvoiceSettlementCredential | Fully settled invoice evidence; settled count, currencies, period, recorded allocation source |
| DeliveryCompletionCredential | Delivered shipment evidence; completed count, reporter assurance types and period; no live courier proof |
| SupplierRelationshipCredential | Authenticated confirmed relationship evidence; count/categories and independence limitation |
| CustomerRelationshipCredential | Authenticated confirmed relationship evidence; same transparent source limitations |
| BusinessDataCoverageCredential | Selected evidence categories and actual source-verified count, including zero |
| BusinessRegistrationReviewCredential | Current manual document-review result and jurisdiction; registry_source_verified:false; no independent representative proof |

All include evidence count, assurance level, method, limitations, coverage description and schema version. Mixed currencies are separate maps, never converted or summed together. No raw invoices, counterparties, identity numbers or transaction descriptions enter minimal activity claims. Subject display name/country are still disclosed and must be included in holder review/authorization.

Levels: 0 self-reported/sandbox; 1 documented manual review; 2 authorized source verification; 3 independent corroboration. Only supported evidence methods can assign levels. Current adapters cannot mint levels2/3. Type support is not proof that authoritative evidence for that type exists. Unsupported/ineligible evidence is rejected. Correction requires suspension/revocation and new issuance, preserving old signatures and anchors.
