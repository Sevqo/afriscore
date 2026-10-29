export type Guide = {
  name: string;
  summary: string;
  audience: string;
  problem: string;
  steps: [string, string][];
  example: string;
  outcome: string;
  limit: string;
  related: string[];
  faqs: [string, string][];
  lesson: string;
};
const sandbox =
  "Sandbox evaluation only. No real funds move, and live payment providers are not enabled.";
const trust =
  "Sandbox beta. A signature protects integrity; it does not prove a claim is true or an issuer is independently recognized. No government endorsement is claimed.";
export const guides: Record<string, Guide> = {
  "/products/business": {
    name: "AfriCore Business",
    summary:
      "One workspace for customers, orders, invoices and payment records. Follow a sale from the first customer conversation to the final payment update.",
    audience:
      "Retailers, service businesses, suppliers and growing teams using notebooks, phones and separate spreadsheets.",
    problem:
      "Scattered records make it easy to miss an invoice or have two employees chase the same payment.",
    steps: [
      [
        "Set up your business",
        "Add business details, currency and separate team roles.",
      ],
      [
        "Record a sale",
        "Save the customer, create an order and issue an invoice when needed.",
      ],
      [
        "Follow its payment",
        "Create a sandbox request and inspect the provider-confirmed result.",
      ],
      [
        "Review the day",
        "Check outstanding invoices, exceptions and recorded movement.",
      ],
    ],
    example:
      "A fictional retailer records a KSh 12,000 order once. Its customer, invoice and confirmed payment remain connected instead of being copied into three spreadsheets.",
    outcome: "A connected history and a clear list of work needing attention.",
    limit:
      sandbox + " Server-side roles control who may change financial records.",
    related: ["/products/invoicing", "/products/pay", "/products/automations"],
    faqs: [
      [
        "Can employees share one account?",
        "Invite employees with their own accounts and roles. Permissions are checked on each request.",
      ],
      [
        "Does it replace an accountant?",
        "No. It organizes covered operational records; complete accounting, tax and statutory reporting need appropriate systems and qualified review.",
      ],
    ],
    lesson: "organize-business-records",
  },
  "/products/pay": {
    name: "AfriCore Pay",
    summary:
      "Create a payment request for an eligible order or issued invoice, share its checkout link, and follow the result supplied by the payment provider.",
    audience: "Sellers who need to know which order a payment belongs to.",
    problem:
      "A screenshot or a message saying “paid” does not establish a provider-confirmed receipt.",
    steps: [
      [
        "Create a request",
        "Choose the document and remaining amount in one currency.",
      ],
      [
        "Share its link",
        "Send the private checkout URL to your customer yourself.",
      ],
      [
        "Check confirmation",
        "Simulate success, failure, delay or partial payment in sandbox.",
      ],
      [
        "Review the record",
        "A trusted event updates the request and allocation; exceptions remain visible.",
      ],
    ],
    example:
      "A fictional WhatsApp seller records a KSh 12,000 order and shares a sandbox checkout. A delayed scenario remains pending; a final successful confirmation updates the order.",
    outcome:
      "A payment event and allocation connected to the right business record.",
    limit:
      sandbox +
      " Daraja sandbox STK initiation/status contracts are implemented but await authorized credentials and external acceptance. Live collection, C2B, refunds and reversals through Daraja remain disabled. Settlement is separate from confirmation and matching.",
    related: [
      "/products/reconciliation",
      "/solutions/social-commerce",
      "/products/invoicing",
    ],
    faqs: [
      [
        "Is a link a receipt?",
        "No. A link asks for payment. A confirmed event records the provider’s result.",
      ],
      [
        "What happens if payment fails or is delayed?",
        "Failure remains failed. Delay remains pending until a final trusted result arrives; neither is counted as a successful collection.",
      ],
      [
        "Can a screenshot confirm payment?",
        "No. Frontend assertions, screenshots and imported credits cannot act as provider proof.",
      ],
    ],
    lesson: "payment-links",
  },
  "/products/reconciliation": {
    name: "Payment reconciliation",
    summary:
      "Reconciliation means checking which incoming payment belongs to which order or invoice. It separates paid, partially paid and unmatched records.",
    audience:
      "Shops, suppliers and finance teams handling many invoices or orders.",
    problem:
      "Two customers can pay the same amount. Guessing from amount alone can mark the wrong invoice as paid.",
    steps: [
      [
        "Start with the sale",
        "Keep the invoice reference, currency and amount due.",
      ],
      [
        "Receive trusted evidence",
        "Use a provider-confirmed payment and its reference.",
      ],
      [
        "Match the records",
        "Review provider references and allocate eligible confirmed evidence to one or more open invoices in the same currency.",
      ],
      [
        "Review exceptions",
        "Keep ambiguous, duplicate, reversed or mismatched events for review.",
      ],
      [
        "Preserve history",
        "Record a review note without deleting original evidence.",
      ],
    ],
    example:
      "A fictional shop sends 20 invoices and receives 15 payments. References reveal which five need follow-up. A KSh 1,500 receipt against a KSh 2,500 invoice leaves KSh 1,000 outstanding.",
    outcome:
      "An auditable allocation and a focused exception queue instead of a guessed paid label.",
    limit:
      sandbox +
      " Matching does not establish a bank balance or erase reversal risk.",
    related: ["/products/pay", "/products/invoicing", "/products/data"],
    faqs: [
      [
        "Does every payment match automatically?",
        "No. Missing evidence or conflicts remain for review instead of being forced into a match.",
      ],
      [
        "What if two payments have the same amount?",
        "Use document relationships, references and currency too. Equal amounts alone are insufficient.",
      ],
      [
        "What about partial payments?",
        "Only confirmed allocations reduce the receivable. The remainder stays outstanding.",
      ],
      [
        "Can I correct a mistake?",
        "Review unresolved evidence and record a reason for allocations. Confirmed simulator returns append adjustments; original events remain retained. Unlinked reversal reports still require review.",
      ],
      [
        "How is a payment verified?",
        "Trusted adapter results or authenticated provider callbacks supply confirmation. Merchant imports keep their own provenance.",
      ],
    ],
    lesson: "reconciliation",
  },
  "/products/invoicing": {
    name: "Invoicing & receivables",
    summary:
      "An invoice asks a customer to pay. A receivable is the amount still owed. Keep the reference, due date, payment allocations and remaining balance together.",
    audience:
      "Contractors, freelancers and suppliers allowing customers time to pay.",
    problem:
      "An invoice can be mistaken for money already received, while its due date is forgotten.",
    steps: [
      [
        "Create the invoice",
        "Add customer, line items, currency, payment terms and due date.",
      ],
      ["Issue and share", "Issue the draft, then print or save a PDF."],
      ["Track payments", "Review full or partial allocations, credit notes and retained return adjustments."],
      [
        "Follow up",
        "Filter drafts, outstanding, overdue, paid and credited invoices. Record a collection follow-up without sending unconfigured customer email.",
      ],
    ],
    example:
      "A fictional contractor invoices KSh 50,000. A confirmed test payment of KSh 30,000 leaves KSh 20,000 owed; a second KSh 20,000 settles the invoice. A credit note reduces debt without recording an incoming payment. After the due date, that unpaid balance is overdue.",
    outcome: "A clear amount owed, due date and history for each customer.",
    limit:
      "Ordinary AfriCore invoices are not automatically KRA-validated eTIMS invoices. External email/messaging delivery is not configured. " +
      sandbox,
    related: ["/products/pay", "/products/cash-flow", "/products/automations"],
    faqs: [
      [
        "Is an unpaid invoice lost revenue?",
        "It remains an amount owed, subject to collection uncertainty. Issuing it does not mean cash was received.",
      ],
      [
        "Can I download it?",
        "The invoice view supports browser printing or saving to PDF.",
      ],
      [
        "What is aging?",
        "Grouping unpaid balances by how long they have been overdue, to prioritize follow-up.",
      ],
      [
        "Does this satisfy eTIMS requirements?",
        "No eTIMS integration is enabled. Consult current KRA guidance and qualified advice for tax-invoicing obligations.",
      ],
    ],
    lesson: "receivables",
  },
  "/products/cash-flow": {
    name: "Cash flow & reporting",
    summary:
      "Cash flow is money moving into and out of a business. Review confirmed collections, recorded outflows and unpaid invoices in separate currency buckets.",
    audience:
      "Owners planning stock purchases, rent, wages and customer follow-up.",
    problem:
      "Sales can look healthy while customers pay late. Missing expense records also distort the picture.",
    steps: [
      [
        "Gather covered records",
        "Use confirmed collections and record relevant expenses.",
      ],
      [
        "Choose a currency",
        "Keep currencies separate and inspect source coverage.",
      ],
      [
        "Compare movement",
        "Compare collections less confirmed returns with effective recorded expenses, outstanding invoices and aging, using 7D through All or custom dates.",
      ],
      [
        "Plan with assumptions",
        "Record dated recurring obligations separately from paid expenses; handle an occurrence explicitly and retain its history.",
      ],
    ],
    example:
      "A fictional business receives KSh 300,000 and records KSh 220,000 of outflows. Net recorded movement is KSh 80,000, not automatically profit or a bank balance: opening cash, missing activity and accounting adjustments are not included.",
    outcome:
      "A source-aware view of money movement and obligations for planning.",
    limit:
      "No verified opening bank balance or complete profit calculation is available. Forecasts are estimates, not promised receipts.",
    related: [
      "/products/intelligence",
      "/products/invoicing",
      "/products/connect",
    ],
    faqs: [
      [
        "Is cash flow profit?",
        "No. Profit follows accounting recognition of income and costs; cash flow follows money movement. Their scope and timing differ.",
      ],
      [
        "Is revenue cash received?",
        "Not necessarily. A sale or invoice may precede the customer’s payment.",
      ],
      [
        "Can a forecast be wrong?",
        "Yes. Delays, incomplete records and changed expenses can invalidate assumptions.",
      ],
      [
        "What about missing accounts?",
        "Missing activity does not appear automatically. Check coverage before relying on the report.",
      ],
    ],
    lesson: "cash-flow",
  },
  "/products/intelligence": {
    name: "AfriCore Intelligence",
    summary:
      "Calculated trends, receivables, payment patterns and scenario forecasts built from the records available to your workspace.",
    audience:
      "Owners and finance teams asking what needs attention and what affects expected receipts.",
    problem:
      "A sales total alone does not explain late payers, missing expenses or concentrated receivables.",
    steps: [
      [
        "Check coverage",
        "Review history, missing expenses and reconciliation exceptions.",
      ],
      [
        "Explore the numbers",
        "Inspect dates, currency, exact chart values and customer balances.",
      ],
      [
        "Compare scenarios",
        "Adjust collection timing and outflow assumptions for 7–90-day forecasts.",
      ],
      [
        "Request an explanation",
        "Optionally consent to a configured AI provider receiving minimized evidence. Financial totals are calculated by application code.",
      ],
    ],
    example:
      "A fictional supplier compares a conservative scenario that delays collections with its expected scenario. The difference shows the assumptions’ effect, not a probability that any customer will pay.",
    outcome: "Explainable indicators and labelled planning scenarios.",
    limit:
      "AI explanations require configuration, consent and provider availability, and remain read-only. Forecasts are not bank balances, credit decisions or statistical guarantees.",
    related: [
      "/products/cash-flow",
      "/products/invoicing",
      "/products/automations",
    ],
    faqs: [
      [
        "Does AI calculate the money?",
        "No. Application code performs financial arithmetic before optional language generation.",
      ],
      [
        "Why limited history?",
        "Payment-pattern summaries need enough settled invoices. Short history is a coverage limit, not proof of poor conduct.",
      ],
    ],
    lesson: "forecasts",
  },
  "/products/automations": {
    name: "Business automations",
    summary:
      "Rules that check conditions and create supported follow-ups, such as in-app notices or approval requests. Inspect what ran and pause it when needed.",
    audience:
      "Teams repeatedly checking due invoices, obligations and review queues.",
    problem:
      "Manual checks are easily forgotten, while unrestricted automatic actions can repeat mistakes.",
    steps: [
      ["Choose a template", "Select an implemented trigger and purpose."],
      [
        "Set conditions",
        "Choose the schedule, currency and supported thresholds.",
      ],
      ["Review the action", "Use only supported notices or approvals."],
      [
        "Inspect and control",
        "Review run history, retries, deduplication, pauses and preferences.",
      ],
    ],
    example:
      "A fictional supplier schedules an overdue-invoice check. A matching condition creates an in-app notification, not an unapproved WhatsApp message or funds transfer.",
    outcome: "A repeatable, visible follow-up with execution history.",
    limit:
      "External email/messaging is not configured. Automations do not settle funds or execute arbitrary external actions.",
    related: [
      "/products/invoicing",
      "/products/business",
      "/products/intelligence",
    ],
    faqs: [
      [
        "What starts a workflow?",
        "A supported event or schedule starts it; conditions determine whether its supported action runs.",
      ],
      [
        "Can I stop it?",
        "Pause or disable the workflow and manage notification preferences.",
      ],
      [
        "What if it fails?",
        "Inspect run and retry states instead of assuming the action completed.",
      ],
    ],
    lesson: "automation",
  },
};
Object.assign(guides, {
  "/products/business-passport": {
    name: "Business Passport",
    summary:
      "A private digital business profile containing selected credentials and supporting evidence. Choose which particular proof another business may see.",
    audience: "Suppliers and SMEs repeatedly asked to prove business facts.",
    problem:
      "Sending an entire folder to each new customer can reveal unrelated information.",
    steps: [
      [
        "Create your identity",
        "Add business details and distinguish self-reported information from reviewed facts.",
      ],
      ["Reference evidence", "Link permitted records for an explicit purpose."],
      [
        "Inspect credentials",
        "Check claims, issuer, assurance, expiry and status.",
      ],
      [
        "Share selectively",
        "Choose minimal claims, a named recipient and expiry.",
      ],
      [
        "Review access",
        "Inspect sharing history and keep unrelated evidence private.",
      ],
    ],
    example:
      "A fictional supplier shares a delivery-completion claim with a named customer. Unrelated invoices and private evidence stay outside that disclosure.",
    outcome: "An inspectable profile and a controlled proof-sharing history.",
    limit:
      trust +
      " A Passport is not government ID, financing approval or a universal rating.",
    related: [
      "/products/verifiable-credentials",
      "/products/passport-privacy",
      "/products/business-verification",
    ],
    faqs: [
      [
        "Is my Passport public?",
        "Private by default. Public profile visibility is a separate deliberate choice.",
      ],
      [
        "Is every detail independently verified?",
        "No. Each claim has its own source, issuer and assurance level.",
      ],
      [
        "Do I need cryptocurrency?",
        "No cryptocurrency purchase is required for ordinary demo Passport use.",
      ],
    ],
    lesson: "business-passport",
  },
  "/products/trust-network": {
    name: "Trust Network",
    summary:
      "Specific commercial relationships and evidence-backed confirmations between businesses. Each connection says who confirmed what, from which source and for what purpose.",
    audience: "Businesses documenting supplier or customer relationships.",
    problem:
      "A connection count or badge can be mistaken for an independent endorsement.",
    steps: [
      [
        "Name the relationship",
        "Identify the counterparty and commercial context.",
      ],
      [
        "Request confirmation",
        "Ask the appropriate counterparty to review a specific statement.",
      ],
      [
        "Inspect its source",
        "Keep the confirmer’s role and evidence assurance visible.",
      ],
      [
        "Correct inaccuracies",
        "Use correction and dispute paths rather than silently rewriting history.",
      ],
    ],
    example:
      "A fictional supplier asks a customer to confirm a completed supply relationship. That record is about this relationship, not a guarantee of future performance.",
    outcome:
      "Contextual relationship evidence rather than a blanket trusted-business label.",
    limit:
      trust + " Counterparty confirmation alone is not proof of independence.",
    related: [
      "/products/business-passport",
      "/products/business-verification",
      "/products/verifiable-credentials",
    ],
    faqs: [
      [
        "Is this a social network?",
        "The purpose is controlled commercial confirmation, not followers.",
      ],
      [
        "Is it a credit score?",
        "No universal credit score or financing eligibility is produced.",
      ],
      [
        "What if my business is new?",
        "Limited history is a coverage limitation, not proof of misconduct.",
      ],
    ],
    lesson: "business-trust",
  },
  "/products/verifiable-credentials": {
    name: "Verifiable credentials",
    summary:
      "A digitally signed statement from an issuer about a specific subject. A verifier checks whether it changed, then separately assesses the issuer and claim.",
    audience: "Businesses issuing, holding or reviewing particular proofs.",
    problem:
      "A document can be altered; a valid signature can also belong to an issuer you do not recognize.",
    steps: [
      [
        "Issuer reviews evidence",
        "An authorized issuer evaluates the claim and permitted assurance level.",
      ],
      [
        "Holder receives the statement",
        "Inspect its exact claims and validity period.",
      ],
      [
        "Holder chooses disclosure",
        "Share only the authorized proof for its intended purpose.",
      ],
      [
        "Verifier checks each layer",
        "Check signature, issuer policy, expiry, current status and assurance separately.",
      ],
    ],
    example:
      "A fictional logistics issuer signs one delivery claim. A recipient checks integrity and current status, then decides whether that issuer’s evidence is suitable.",
    outcome:
      "A signed claim with detailed verification results, not a universal truth badge.",
    limit: trust,
    related: [
      "/products/business-passport",
      "/products/verification-api",
      "/products/blockchain-verification",
    ],
    faqs: [
      [
        "Who are issuer, holder and verifier?",
        "The issuer signs; the holder presents; the verifier checks for a specific purpose.",
      ],
      [
        "Can a credential expire or be revoked?",
        "Yes. Current status and validity dates must be checked alongside the signature.",
      ],
      [
        "Does a valid signature prove the claim?",
        "No. Integrity, issuer recognition and claim assurance are distinct.",
      ],
    ],
    lesson: "digital-credentials",
  },
  "/products/blockchain-verification": {
    name: "Blockchain verification",
    summary:
      "An independently checkable record that a credential commitment was included in an anchored batch. Private documents stay off-chain.",
    audience:
      "Businesses and technical verifiers who need to understand what a proof establishes.",
    problem:
      "“On blockchain” can sound like a guarantee of truth. It provides a specific technical check, not real-world verification by itself.",
    steps: [
      ["Sign the claim", "Use an issuer signature to protect integrity."],
      [
        "Create commitments",
        "Randomized commitments represent credentials without publishing documents.",
      ],
      ["Anchor a batch", "The local EVM sandbox records a shared root."],
      [
        "Verify independently",
        "Check inclusion, signature, current status and issuer/evidence policy.",
      ],
    ],
    example:
      "A fictional delivery credential is included in a batch. Its inclusion proof is checked against the local registry. That does not establish whether the delivery actually happened.",
    outcome:
      "A technical inclusion result beside separate integrity, status and assurance checks.",
    limit:
      "Local EVM sandbox only. No public testnet/mainnet deployment or production issuer authority is claimed. No tokens, custody or lending.",
    related: [
      "/products/verifiable-credentials",
      "/products/verification-api",
      "/products/passport-privacy",
    ],
    faqs: [
      [
        "Are documents stored on-chain?",
        "No. Commitments are anchored; source records stay off-chain.",
      ],
      [
        "Does anchoring prove truth?",
        "No. Inclusion and tamper evidence do not establish real-world source quality.",
      ],
      [
        "Can I verify independently?",
        "The repository includes an independent CLI for the supported local proof format.",
      ],
    ],
    lesson: "blockchain-proof",
  },
  "/products/business-verification": {
    name: "Business verification",
    summary:
      "Review specific business facts and label how each fact was obtained.",
    audience:
      "Businesses reviewing identity details, documents and commercial evidence.",
    problem:
      "Self-reported, document-reviewed and independently corroborated information can be wrongly grouped under one green check.",
    steps: [
      [
        "Collect permitted information",
        "Record its purpose and processing basis.",
      ],
      [
        "Identify the source",
        "Separate business statements, document reviews and independent evidence.",
      ],
      [
        "Record a bounded review",
        "An authorized reviewer states what was checked and its limits.",
      ],
      ["Challenge errors", "Use correction requests while preserving history."],
    ],
    example:
      "A fictional new shop has self-reported details and little trading history. Its coverage is shown explicitly rather than interpreted as fraud or poor credit.",
    outcome:
      "A review record explaining what is supported and what is uncertain.",
    limit: trust + " No direct government source integration is operational.",
    related: [
      "/products/business-passport",
      "/products/trust-network",
      "/products/verifiable-credentials",
    ],
    faqs: [
      [
        "What is self-reported?",
        "Information provided by the business without independent corroboration.",
      ],
      [
        "Is document review source verification?",
        "No. Reviewing an upload differs from checking its authorized originating source.",
      ],
      [
        "Can I challenge an error?",
        "Use a correction request with a reason and supporting statement.",
      ],
    ],
    lesson: "business-trust",
  },
  "/products/passport-privacy": {
    name: "Passport privacy",
    summary:
      "Choose which claims a named recipient can access, for which purpose and for how long.",
    audience:
      "Businesses asked to disclose credentials or operational records.",
    problem:
      "A useful proof can expose unrelated financial information when an entire folder is shared.",
    steps: [
      [
        "Inspect the request",
        "Check recipient, purpose and requested claim types.",
      ],
      [
        "Minimize disclosure",
        "Keep unrelated credentials and source evidence out.",
      ],
      ["Set access limits", "Use supported expiry and recipient-bound access."],
      [
        "Review access history",
        "Inspect access and available revocation controls.",
      ],
    ],
    example:
      "A fictional supplier shares a delivery credential while keeping invoice totals private. Its customer sees the selected proof, not every workspace record.",
    outcome: "A purpose-specific disclosure with an access record.",
    limit:
      "Expiry limits service access; it cannot erase copies a recipient already received. Production privacy and retention procedures still need qualified review.",
    related: [
      "/products/business-passport",
      "/products/verifiable-credentials",
      "/privacy",
    ],
    faqs: [
      [
        "Is the one-time link enough?",
        "No. The supported flow also checks membership of the named recipient business.",
      ],
      [
        "Does expiry delete downloaded copies?",
        "No. Access expiry does not make a recipient forget information already received.",
      ],
    ],
    lesson: "private-sharing",
  },
  "/products/protected-payments": {
    name: "Protected Payments",
    summary:
      "A sandbox workflow for purchase terms, partner payment evidence, delivery, inspection and reviewed release or dispute decisions.",
    audience:
      "Buyers and sellers needing a clear record of a higher-trust transaction.",
    problem:
      "Paid, delivered, accepted and released describe different things.",
    steps: [
      ["Agree terms", "Record goods, delivery terms and inspection period."],
      [
        "Wait for partner evidence",
        "The sandbox partner simulator confirms its payment state.",
      ],
      ["Deliver and inspect", "Keep item-level evidence and buyer response."],
      [
        "Review the outcome",
        "Release/refund requests follow approval and dispute rules.",
      ],
      [
        "Confirm separately",
        "Only the partner simulator confirms the sandbox settlement state.",
      ],
    ],
    example:
      "A fictional buyer receives only part of an order. Delivery history and evidence support a review; seller assertions alone cannot force release.",
    outcome:
      "A traceable agreement and explicit evidence, review and settlement states.",
    limit:
      "Sandbox only. AfriCore holds no funds and offers no live regulated escrow. Production requires an authorized financial partner, contracts and operational/regulatory review.",
    related: [
      "/products/pay",
      "/solutions/contractors",
      "/products/business-passport",
    ],
    faqs: [
      [
        "Who holds funds?",
        "There are no real funds in sandbox. No live partner arrangement is offered.",
      ],
      [
        "Does delivery release payment?",
        "No. Delivery, acceptance, approval and partner confirmation are separate states.",
      ],
      [
        "Is a dispute outcome guaranteed?",
        "No. Evidence and agreed terms need review; a simulator is not a legal guarantee.",
      ],
    ],
    lesson: "protected-payments",
  },
  "/products/connect": {
    name: "AfriCore Connect",
    summary:
      "Brings permitted records from supported sources into AfriCore and exposes import/synchronization status and retries.",
    audience:
      "Businesses with records spread between tools and authorized developers.",
    problem: "A failed or unavailable import leaves gaps in reporting inputs.",
    steps: [
      [
        "Choose a supported source",
        "Inspect availability and authorization requirements.",
      ],
      [
        "Supply permitted records",
        "Import a supported CSV or use an available sandbox connector.",
      ],
      ["Inspect the run", "Review errors, retries and freshness."],
      [
        "Use structured records",
        "Data normalizes them while preserving provenance.",
      ],
    ],
    example:
      "A fictional business imports transactions from a supported CSV. An imported credit stays a merchant-supplied record, not provider-confirmed payment proof.",
    outcome:
      "A visible import history and records available to permitted tools.",
    limit:
      "Bank, accounting and private-chat integrations are not automatically active. Current paths are CSV and documented sandbox connectors.",
    related: ["/products/data", "/products/reconciliation", "/developers"],
    faqs: [
      [
        "Does it read WhatsApp?",
        "No private-chat integration is implemented. Sellers manually share links.",
      ],
      [
        "What if a source is unavailable?",
        "It remains a coverage gap. Reports must not invent missing records.",
      ],
    ],
    lesson: "connect-and-data",
  },
  "/products/data": {
    name: "AfriCore Data",
    summary:
      "Organizes permitted source records into consistent fields while preserving where each came from. Connect brings them in; Data makes their structure usable.",
    audience: "Owners and developers working across supported sources.",
    problem:
      "Different dates, amounts and references make matching and comparison difficult.",
    steps: [
      ["Retain the source", "Keep its original reference and provenance."],
      [
        "Normalize fields",
        "Use consistent amounts, currencies, dates and types.",
      ],
      [
        "Keep assurance distinct",
        "Separate imported claims from provider confirmations.",
      ],
      [
        "Use authorized records",
        "Apply them to reconciliation, reporting or a permitted API workflow.",
      ],
    ],
    example:
      "A fictional invoice file and transaction file use different field names. Structured records can be reviewed together, while payment confirmation still needs appropriate evidence.",
    outcome:
      "Consistent, traceable records rather than an unexplained combined total.",
    limit:
      "Normalization does not independently verify truth or connect unsupported systems.",
    related: ["/products/connect", "/products/intelligence", "/developers"],
    faqs: [
      [
        "How is this different from Connect?",
        "Connect handles supported inputs. Data handles structure and provenance.",
      ],
      [
        "Can currencies be combined?",
        "No implicit conversion is performed; currency buckets remain separate.",
      ],
    ],
    lesson: "connect-and-data",
  },
});
function solution(
  path: string,
  base: string,
  name: string,
  audience: string,
  problem: string,
  example: string,
  outcome: string,
) {
  guides[path] = { ...guides[base], name, audience, problem, example, outcome };
}
solution(
  "/solutions/social-commerce",
  "/products/pay",
  "Social commerce",
  "WhatsApp, Instagram and TikTok sellers taking orders through conversations.",
  "Chat details, order records and payment evidence can become disconnected.",
  "A fictional seller agrees a KSh 12,000 sale, records its order and manually shares a sandbox checkout link. A provider confirmation updates payment status before fulfillment. AfriCore does not read the private chat.",
  "An organized journey from conversation to order, confirmation and fulfillment.",
);
solution(
  "/solutions/smes",
  "/products/business",
  "Growing SMEs",
  "Retailers, wholesalers and service businesses with employees.",
  "Separate notebooks and spreadsheets obscure who should act on an invoice or customer.",
  "A fictional shop assigns operations staff to orders and finance staff to invoices. Both see the same customer history with different permissions.",
  "Shared visibility with clear responsibilities.",
);
solution(
  "/solutions/contractors",
  "/products/invoicing",
  "Contractors & suppliers",
  "Businesses handling goods, delivery notes and long payment terms.",
  "Delivered goods can still be unpaid 60 days later. An invoice is not available cash.",
  "A fictional contractor supplies KSh 250,000 of goods on 60-day terms. A confirmed KSh 100,000 payment leaves KSh 150,000 due. Delivery evidence supports follow-up; no advance or loan is provided.",
  "Connected delivery evidence, receivables and planning.",
);
solution(
  "/solutions/fintechs",
  "/products/data",
  "Fintechs & software teams",
  "Developers integrating authorized operational or verification workflows.",
  "Retries and inconsistent sources can create duplicated actions or incorrect records.",
  "A fictional team sends a scoped sandbox request with an idempotency key, then verifies signed webhook notifications before updating its own order system.",
  "A bounded integration with explicit sources and failure handling.",
);
guides["/developers"] = {
  ...guides["/solutions/fintechs"],
  name: "AfriCore Developers",
  summary:
    "Use scoped APIs for business records, payment requests and trust workflows. Build in sandbox and handle failures explicitly.",
  steps: [
    [
      "Create a workspace and application",
      "Use a role allowed to manage developer access.",
    ],
    [
      "Create a scoped key",
      "Keep it server-side and choose the sandbox environment.",
    ],
    [
      "Send a documented request",
      "Use explicit currency, integer minor units and idempotency where supported.",
    ],
    [
      "Verify events",
      "Check HTTP status, signatures, timestamps and delivery IDs.",
    ],
  ],
  related: ["/docs", "/sandbox", "/products/verification-api"],
  faqs: [
    [
      "What is idempotency?",
      "A supported retry with the same key is recognized instead of creating another action. Different input with that key is rejected.",
    ],
    [
      "What is a webhook?",
      "A server-to-server notification. Validate its signature, timestamp and delivery ID before accepting it.",
    ],
  ],
  lesson: "api-basics",
};
guides["/products/verification-api"] = {
  ...guides["/products/verifiable-credentials"],
  name: "Verification APIs",
  summary:
    "APIs for inspecting signed claims and recipient-bound presentations. Results separate integrity, status, inclusion and assurance.",
  audience:
    "Developers implementing credential inspection and controlled disclosure.",
  related: ["/docs", "/developers", "/products/blockchain-verification"],
};
guides["/sandbox"] = {
  ...guides["/developers"],
  name: "Sandbox",
  summary:
    "A safe evaluation environment with synthetic records and simulated payment outcomes.",
  limit: sandbox,
  related: ["/demo", "/docs", "/products/pay"],
  lesson: "sandbox",
};
export function demoLink(path: string) {
  const views: Record<string, string> = {
    "/products/pay": "Payments",
    "/products/invoicing": "Invoices",
    "/products/reconciliation": "Reconciliation",
    "/products/cash-flow": "Cash Flow",
    "/products/intelligence": "Intelligence",
    "/products/automations": "Automations",
    "/products/connect": "Connect",
    "/products/data": "Transactions",
    "/products/business-passport": "Business Passport",
    "/products/trust-network": "Business Passport",
    "/products/verifiable-credentials": "Business Passport",
    "/products/blockchain-verification": "Business Passport",
    "/products/passport-privacy": "Business Passport",
    "/products/business-verification": "Business Passport",
    "/products/protected-payments": "Protected Payments",
    "/solutions/contractors": "Invoices",
    "/solutions/social-commerce": "Orders",
    "/developers": "Developers",
  };
  return "/demo?view=" + encodeURIComponent(views[path] || "Overview");
}
