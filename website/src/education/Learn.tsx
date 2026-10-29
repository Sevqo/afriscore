import {ServiceFinder} from "./ServiceFinder";
import {LearningJourney} from "./LearningJourney";
import {learningPaths} from "./learningPaths";
import { AnnotatedProductVisual } from "./Components";
import { useState } from "react";
import { guides } from "./guides";
export type Lesson = {
  title: string;
  category: string;
  path: string;
  definition: string;
  explanation: string;
  mistake: string;
  source?: [string, string];
};
const ifrs: [string, string] = [
  "IFRS · IAS 7",
  "https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows.html",
];
const w3c: [string, string] = [
  "W3C · Verifiable Credentials overview",
  "https://www.w3.org/TR/vc-overview/",
];
export const lessons: Record<string, Lesson> = {
  "payment-links": {
    title: "Payment links, confirmation and settlement",
    category: "Payments",
    path: "/products/pay",
    definition:
      "A payment link is a request, not proof that a customer has paid.",
    explanation:
      "The checkout points to a particular request. A trusted provider reports a result such as pending, failed or successful. Reconciliation associates suitable confirmed records with the sale. Settlement is the financial provider’s transfer or release process; a checkout click does not establish it.",
    mistake:
      "Dispatching goods because a customer sent a screenshot or opened a link.",
  },
  reconciliation: {
    title: "What payment reconciliation actually means",
    category: "Payments",
    path: "/products/reconciliation",
    definition:
      "Reconciliation checks which payment belongs to which business record.",
    explanation:
      "A reference, amount, currency and document relationship are stronger evidence together than an amount alone. Partial payments leave a balance due. Ambiguous records belong in a review queue. Recording a review does not delete or rewrite the original financial event.",
    mistake:
      "Matching two records only because their amounts happen to be equal.",
  },
  receivables: {
    title: "Invoices, receivables and overdue balances",
    category: "Business finance",
    path: "/products/invoicing",
    definition:
      "An invoice asks for payment; its unpaid balance is a receivable.",
    explanation:
      "A draft has not been issued. An issued invoice can remain unpaid, be partially paid or be fully settled through allocations. An unpaid amount becomes overdue after its due date. Aging groups overdue balances by elapsed time so the owner can prioritize follow-up.",
    mistake: "Treating an issued invoice as cash already in the bank.",
    source: [
      "KRA · Current eTIMS guidance",
      "https://www.kra.go.ke/online-services/etims",
    ],
  },
  "cash-flow": {
    title: "Cash flow is not profit or a bank balance",
    category: "Business finance",
    path: "/products/cash-flow",
    definition: "Cash flow describes money moving into and out of a business.",
    explanation:
      "The timing of customer receipts can differ from the timing of sales and costs. Net recorded movement is covered inflows minus covered outflows. A current cash balance also needs a verified opening position and complete activity. AfriCore does not manufacture either missing account data or a profit calculation.",
    mistake:
      "Calling a positive recorded movement figure profit, or spending it as if it were a verified balance.",
    source: ifrs,
  },
  forecasts: {
    title: "Read a forecast as assumptions, not promises",
    category: "Business finance",
    path: "/products/intelligence",
    definition:
      "A forecast is an estimate of what could happen under stated assumptions.",
    explanation:
      "A customer’s due date does not guarantee receipt on that day. Scenario changes can alter collection rates, delays or outflows. Inspect the horizon and evidence coverage before comparing results. AfriCore scenarios are not statistical confidence intervals or financing eligibility decisions.",
    mistake:
      "Reading an optimistic scenario as a promise that customers will pay.",
  },
  "organize-business-records": {
    title: "Organize customers, orders and financial records",
    category: "Business operations",
    path: "/products/business",
    definition:
      "Related records should describe the same business activity without losing their different purposes.",
    explanation:
      "A customer identifies the buyer. An order records what was agreed. An invoice requests payment. A provider event records a payment result. Keeping them linked helps employees follow the journey without mistaking one record for another. Give each employee appropriate access rather than sharing passwords.",
    mistake:
      "Copying a sale into several tools and assuming every copy has the latest status.",
  },
  automation: {
    title: "Automation basics: trigger, condition, action",
    category: "Business operations",
    path: "/products/automations",
    definition:
      "A supported trigger starts a workflow; conditions decide whether its allowed action should run.",
    explanation:
      "A schedule might check for an overdue invoice. A threshold or currency condition narrows the records considered. The action may create an in-app notification or supported approval request. Inspect the execution history, pauses and retries. No unsupported external message or funds movement should be assumed.",
    mistake:
      "Assuming a configured workflow completed merely because it exists.",
  },
  "business-passport": {
    title: "A Business Passport in plain language",
    category: "Business trust",
    path: "/products/business-passport",
    definition:
      "A private profile holds selected business credentials and evidence, with controls for sharing particular claims.",
    explanation:
      "A customer may need a delivery-completion claim rather than your full invoice history. Review what each credential says and which issuer signed it. Sharing is a deliberate disclosure to a particular recipient and purpose, not a public stamp that every business fact is verified.",
    mistake:
      "Sharing an entire folder when one minimal claim would answer the request.",
  },
  "digital-credentials": {
    title: "Issuer, holder and verifier: three different roles",
    category: "Business trust",
    path: "/products/verifiable-credentials",
    definition:
      "The issuer signs a claim, the holder presents it, and the verifier checks it for a specific purpose.",
    explanation:
      "Signature verification detects changes and checks the signing key. Status and validity dates need separate checks. The verifier also decides whether the issuer is appropriate and whether the claim’s evidence meets its needs. A genuine signature alone does not establish independent truth.",
    mistake:
      "Turning “signature valid” into “all claims independently verified.”",
    source: w3c,
  },
  "blockchain-proof": {
    title: "What a blockchain proof does—and does not—show",
    category: "Business trust",
    path: "/products/blockchain-verification",
    definition:
      "An inclusion proof links a credential commitment to an anchored batch root.",
    explanation:
      "Source documents remain off-chain. The supported local-chain check concerns a technical commitment and registry state. It does not prove a delivery took place or that an issuer is independent. Signature, expiry, current status and source assurance still matter. The current platform is a local EVM sandbox.",
    mistake:
      "Assuming an on-chain reference guarantees the truth of the underlying business claim.",
  },
  "business-trust": {
    title: "Read evidence levels without inventing a score",
    category: "Business trust",
    path: "/products/business-verification",
    definition:
      "An assurance label explains how a particular fact was obtained or reviewed.",
    explanation:
      "Self-reported details come from the business. Document review concerns supplied documents. Source verification requires an appropriate originating source, and independent corroboration requires suitable independent evidence. A newly formed business can have limited coverage without being dishonest. Review context and use correction paths for inaccuracies.",
    mistake:
      "Treating missing evidence as fraud, a universal credit rating or an automatic lending decision.",
  },
  "private-sharing": {
    title: "Share business proof without sharing everything",
    category: "Business trust",
    path: "/products/passport-privacy",
    definition:
      "Minimal disclosure limits a presentation to the claims needed for its stated purpose.",
    explanation:
      "Check the named recipient and select the relevant credential types. Real access also depends on authorization and expiry. An expired link cannot erase a copy already received, so review the recipient and lawful purpose before disclosure. Public profile visibility is a separate choice.",
    mistake:
      "Believing a one-time URL or expiry can make a recipient forget already disclosed information.",
  },
  "connect-and-data": {
    title: "Connect brings records in; Data organizes them",
    category: "Business operations",
    path: "/products/connect",
    definition: "Source access and record structure are different jobs.",
    explanation:
      "Connect manages supported input paths, run status and retries. Data normalizes fields while retaining the original source and reference. That makes authorized records usable by reconciliation and reporting. An imported credit remains an imported record, not provider-confirmed payment proof. An unavailable connector remains a coverage gap.",
    mistake:
      "Assuming normalization turns merchant-supplied information into independent verification.",
  },
  "api-basics": {
    title: "APIs, webhooks and safe retries",
    category: "Developers",
    path: "/developers",
    definition:
      "An API accepts a request; a webhook later notifies your server about an event.",
    explanation:
      "Use a scoped server-side credential and the correct environment. Supported idempotency keys protect against duplicate actions when a request is retried. For webhooks, verify the timestamp and raw-body signature and deduplicate the delivery ID before updating your records. Handle failure codes and keep secrets off the browser.",
    mistake:
      "Retrying a financial write with a new key every time or trusting an unsigned callback.",
  },
  sandbox: {
    title: "What you can safely explore in the sandbox",
    category: "Developers",
    path: "/sandbox",
    definition:
      "The sandbox is an evaluation environment using synthetic records and simulated payment outcomes.",
    explanation:
      "The browser demo needs no database and stores its changes in your browser. A connected local backend supports additional authorized workflows. Production collection, institutional verification and partner-dependent protection are not made operational by completing a demo. Inspect availability labels and avoid sensitive production data.",
    mistake:
      "Describing a successful simulation as a live payment integration.",
  },
  "protected-payments": {
    title: "Protected payments: separate the agreement from settlement",
    category: "Payments",
    path: "/products/protected-payments",
    definition:
      "Agreement, partner evidence, delivery, inspection, approval and settlement are distinct states.",
    explanation:
      "Buyer acceptance and item evidence support a review. They do not let a seller assert that funds were released. The sandbox partner simulator records a separate confirmation. A production protected-payment arrangement would require authorized partners and reviewed operational and legal controls.",
    mistake: "Marketing a sandbox release as live regulated escrow.",
  },
};
export const glossary = [
  [
    "Invoice",
    "A document asking a customer to pay for specified goods or services.",
  ],
  ["Receivable", "An amount a customer still owes."],
  ["Overdue", "Unpaid after the due date."],
  [
    "Allocation",
    "The recorded association of a payment amount with a document.",
  ],
  [
    "Reconciliation",
    "Checking and matching payment records to their business context.",
  ],
  [
    "Net recorded movement",
    "Covered inflows minus covered outflows; not automatically profit or a bank balance.",
  ],
  ["Provider confirmation", "A trusted provider’s reported payment result."],
  [
    "Settlement",
    "The transfer or release process performed by the responsible financial provider.",
  ],
  [
    "Idempotency",
    "Recognizing a supported repeated request to avoid a duplicate action.",
  ],
  ["Credential", "A signed statement containing specific claims."],
  ["Assurance", "The stated basis and limits of the evidence behind a claim."],
  [
    "Commitment",
    "A cryptographic representation used in a proof without publishing the source record.",
  ],
];
export function Learn({ slug }: { slug?: string }) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All");
  const lesson = slug ? lessons[slug] : null;
  if (slug === "glossary")
    return (
      <article className="learn-article">
        <nav className="breadcrumbs">
          <a href="/">Home</a>
          <span>/</span>
          <a href="/learn">Learn</a>
        </nav>
        <h1>Financial and business terms, explained.</h1>
        <dl className="glossary">
          {glossary.map(([term, definition]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
        <a className="text-link" href="/learn">
          Explore practical guides
        </a>
      </article>
    );
  if (slug && learningPaths[slug]) return <article className="learn-article"><nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/learn">AfriCore Learn</a></nav><span className="eyebrow">Guided learning path</span><h1>{learningPaths[slug].title}</h1><LearningJourney key={slug} slug={slug} titles={Object.fromEntries(Object.entries(lessons).map(([id,l])=>[id,l.title]))}/></article>;
  if (slug && !lesson)
    return (
      <section className="learn-article">
        <h1>Guide not found</h1>
        <a href="/learn">Browse AfriCore Learn</a>
      </section>
    );
  if (lesson) {
    const guide = guides[lesson.path];
    return (
      <article className="learn-article">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span>/</span>
          <a href="/learn">AfriCore Learn</a>
          <span>/</span>
          <span>{lesson.category}</span>
        </nav>
        <span className="eyebrow">
          {lesson.category} · Plain-language guide
        </span>
        <h1>{lesson.title}</h1>
        <p className="article-deck">{lesson.definition}</p>
        <p className="article-meta">
          AfriCore product education · Content version 1 · Reviewed 29 October 2026 · General
          education
        </p>
        <h2>The idea in practice</h2>
        <p>{lesson.explanation}</p>
        <h2>Why it matters</h2>
        <p>{guide.problem}</p>
        <section className="article-example">
          <h2>A fictional business example</h2>
          <p>{guide.example}</p>
        </section>
        <AnnotatedProductVisual lesson={slug!} />
        <h2>Work through it</h2>
        <ol>
          {guide.steps.map(([name, detail]) => (
            <li key={name}>
              <strong>{name}.</strong> {detail}
            </li>
          ))}
        </ol>
        <h2>A common mistake</h2>
        <p>{lesson.mistake}</p>
        <h2>What AfriCore can do today</h2>
        <p>{guide.outcome}</p>
        <p className="content-limitation">{guide.limit}</p>
        {lesson.source && (
          <p className="article-source">
            Concept reference: <a href={lesson.source[1]}>{lesson.source[0]}</a>
            . Platform availability is based on the current implementation, not
            implied by this source.
          </p>
        )}
        <p>
          These examples explain product behavior. They are not personalized
          financial, legal or tax advice.
        </p>
        <a className="button" href={lesson.path}>
          Explore {guide.name}
        </a>
        <LearningJourney key={slug} slug={slug} titles={Object.fromEntries(Object.entries(lessons).map(([id,l])=>[id,l.title]))}/>
        <section className="related-learning">
          <h2>Keep learning</h2>
          {Object.entries(lessons)
            .filter(
              ([key, l]) => key !== slug && l.category === lesson.category,
            )
            .slice(0, 3)
            .map(([key, l]) => (
              <a key={key} href={"/learn/" + key}>
                {l.title}
              </a>
            ))}
          <a href="/learn/glossary">Look up a term in the glossary</a>
        </section>
      </article>
    );
  }
  const shown = Object.entries(lessons).filter(
    ([, l]) =>
      (category === "All" || l.category === category) &&
      (l.title + " " + l.definition)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="learn-home">
      <section className="learn-heading">
        <span className="eyebrow">AfriCore Learn</span>
        <h1>Understand the work behind the numbers.</h1>
        <p>
          Practical guides to payments, invoices, cash flow and business proof.
          Start with a familiar business question, then see the workflow.
        </p>
        <a className="text-link" href="/learn/glossary">
          Explore the financial glossary
        </a>
      </section>
      <LearningJourney titles={Object.fromEntries(Object.entries(lessons).map(([id,l])=>[id,l.title]))}/>
      <ServiceFinder/><section className="learn-library">
        <div className="learning-filters">
          <label>
            Find a guide
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try invoices, payments or business proof"
            />
          </label>
          <label>
            Topic
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "All",
                ...new Set(Object.values(lessons).map((l) => l.category)),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <p role="status">
          {shown.length} {shown.length === 1 ? "guide" : "guides"}
        </p>
        <div className="lesson-grid">
          {shown.map(([key, l]) => (
            <a key={key} href={"/learn/" + key}>
              <span>{l.category}</span>
              <h2>{l.title}</h2>
              <p>{l.definition}</p>
              <strong>Read the guide</strong>
            </a>
          ))}
        </div>
        {!shown.length && <p>No matching guide. Try another term or topic.</p>}
      </section>
      <section className="business-stories">
        <span className="eyebrow">
          Fictional examples, practical situations
        </span>
        <h2>Find a business story like yours.</h2>
        <div>
          {[
            "/solutions/social-commerce",
            "/solutions/smes",
            "/solutions/contractors",
            "/products/connect",
            "/products/automations",
            "/products/business-passport",
            "/developers",
          ].map((path) => (
            <details key={path}>
              <summary>{guides[path].name}</summary>
              <p>
                <strong>The situation:</strong> {guides[path].problem}
              </p>
              <p>{guides[path].example}</p>
              <p>
                <strong>The improvement:</strong> {guides[path].outcome}
              </p>
              <p>{guides[path].limit}</p>
              <a className="text-link" href={path}>
                See the complete workflow
              </a>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
