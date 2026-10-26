# Product explanation inventory

The canonical typed inventory is website/src/education/guides.ts: 23 guides for Business, Pay, Reconciliation, Invoicing, Cash Flow, Intelligence, Automation, Protected Payments, Business Passport, Trust Network, Credentials, Blockchain Verification, Business Verification, Privacy, Connect, Data, four business audiences, Developers, Verification API and Sandbox.

Each guide supplies purpose, audience, problem, steps, fictional example, outcome, availability limit, related tools and FAQs. Components.tsx presents that data with breadcrumbs, workflow, annotated input/process/result, story, before/after, availability and targeted demo CTA. Core financial/trust pages add local interactive examples. DeveloperTutorial.tsx provides the actual workspace invoice endpoint, headers, response shape and operational error guidance.

Examples explain partial allocation (invoice KSh 2,500, receipt KSh 1,500, remainder KSh 1,000), cash timing, selected claims, independent proof layers and delayed contractor receipts. They are not claims about customer results. Product demo links select an existing workspace section without resetting data.

Maintenance: update the guide and corresponding lesson together when implementation changes. Validate route links and rendered HTML with npm --prefix website run build. Use CONTENT_ACCURACY.md before adding capability claims.
