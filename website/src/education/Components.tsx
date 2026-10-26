import { DeveloperTutorial } from "./DeveloperTutorial";
import { useState } from "react";
import { Icon } from "../components/Icon";
import { MediaBlock } from "../components/Media";
import { publicPageMedia } from "../editorial";
import { guides, demoLink, type Guide } from "./guides";
export function ProcessTimeline({ steps }: { steps: Guide["steps"] }) {
  return (
    <ol className="process-timeline">
      {steps.map(([title, text], i) => (
        <li key={title}>
          <span className="step-number">{String(i + 1).padStart(2, "0")}</span>
          <h3>{title}</h3>
          <p>{text}</p>
        </li>
      ))}
    </ol>
  );
}
export function ProductFAQ({ items }: { items: Guide["faqs"] }) {
  return (
    <section className="product-faq">
      <span className="eyebrow">Questions, answered</span>
      <h2>Before you get started</h2>
      <div>
        {items.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <Icon name="down" />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
export function AnnotatedProductVisual({ lesson }: { lesson: string }) {
  const records =
    lesson === "reconciliation" ||
    lesson === "receivables" ||
    lesson === "payment-links";
  const trust = [
    "business-passport",
    "private-sharing",
    "digital-credentials",
    "blockchain-proof",
    "business-trust",
  ].includes(lesson);
  const cells = records
    ? [
        [
          "document",
          "Invoice INV-104",
          "KSh 2,500 requested",
          "The amount the customer owes.",
        ],
        [
          "payment",
          "Confirmed receipt",
          "KSh 1,500 allocated",
          "A trusted event reduces the balance.",
        ],
        [
          "document",
          "Still outstanding",
          "KSh 1,000 remaining",
          "Partial payment does not mean fully paid.",
        ],
      ]
    : trust
      ? [
          [
            "user",
            "Business profile",
            "Specific business details",
            "Self-reported and reviewed facts stay distinct.",
          ],
          [
            "shield",
            "Signed credential",
            "One claim, one issuer",
            "Signature and assurance are checked separately.",
          ],
          [
            "network",
            "Authorized disclosure",
            "Selected claims only",
            "A named recipient sees the permitted proof.",
          ],
        ]
      : [
          [
            "document",
            "Permitted records",
            "Explicit source & currency",
            "Start with records you are authorized to use.",
          ],
          [
            "settings",
            "Review & organize",
            "Traceable processing",
            "Retain provenance and inspect exceptions.",
          ],
          [
            "chart",
            "Actionable view",
            "Coverage stays visible",
            "Use the result with its limitations in view.",
          ],
        ];
  return (
    <figure className="annotated-visual">
      <figcaption>
        Follow the records{" "}
        <span>Illustrative explanation · not live business data</span>
      </figcaption>
      <div>
        {cells.map(([icon, title, value, note], i) => (
          <article key={title}>
            <div>
              <span>0{i + 1}</span>
              <Icon name={icon as any} />
            </div>
            <h3>{title}</h3>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </div>
    </figure>
  );
}
export function InteractiveExample({
  kind = "reconciliation",
}: {
  kind?: string;
}) {
  const [amount, setAmount] = useState(1500),
    [reference, setReference] = useState(true),
    [day, setDay] = useState(5),
    [claims, setClaims] = useState(["Business name", "Delivery completion"]),
    [checks, setChecks] = useState(["Signature", "Current status"]);
  const privacy = ["business-passport", "private-sharing"].includes(kind),
    cash = ["cash-flow", "forecasts"].includes(kind),
    credential = [
      "digital-credentials",
      "blockchain-proof",
      "business-trust",
    ].includes(kind);
  return (
    <section className="interactive-example">
      <div>
        <span className="eyebrow">Try an explanation</span>
        <h2>
          {privacy
            ? "Choose what a recipient sees"
            : cash
              ? "What changes when a customer pays late?"
              : credential
                ? "A valid signature is only one check"
                : "Match a payment to its invoice"}
        </h2>
        <p>
          Learning simulation only. Nothing is sent to an API, no merchant
          record changes, and no money moves.
        </p>
      </div>
      <div className="example-controls">
        {privacy ? (
          <fieldset>
            <legend>Illustrative claims to disclose</legend>
            {["Business name", "Delivery completion", "Invoice totals"].map(
              (c) => (
                <label key={c}>
                  <input
                    type="checkbox"
                    checked={claims.includes(c)}
                    onChange={() =>
                      setClaims(
                        claims.includes(c)
                          ? claims.filter((x) => x !== c)
                          : [...claims, c],
                      )
                    }
                  />
                  {c}
                </label>
              ),
            )}
          </fieldset>
        ) : cash ? (
          <label>
            Expected receipt day: {day}
            <input
              type="range"
              min="1"
              max="30"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
            <small>
              KSh 12,000 receipt; KSh 8,000 expense due on day 10. Illustrative
              opening cash: KSh 0.
            </small>
          </label>
        ) : credential ? (
          <fieldset>
            <legend>Which checks have evidence?</legend>
            {[
              "Signature",
              "Current status",
              "Recognized issuer",
              "Independent evidence",
            ].map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={checks.includes(c)}
                  onChange={() =>
                    setChecks(
                      checks.includes(c)
                        ? checks.filter((x) => x !== c)
                        : [...checks, c],
                    )
                  }
                />
                {c}
              </label>
            ))}
          </fieldset>
        ) : (
          <>
            <label>
              Confirmed receipt amount
              <select
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              >
                <option value="1500">KSh 1,500</option>
                <option value="2500">KSh 2,500</option>
                <option value="3000">KSh 3,000</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={reference}
                onChange={(e) => setReference(e.target.checked)}
              />
              Reference matches invoice INV-104
            </label>
          </>
        )}
      </div>
      <div className="example-result" role="status" aria-live="polite">
        <span>
          {privacy
            ? "Recipient preview"
            : cash
              ? "Illustrative planning result"
              : credential
                ? "Separate verification layers"
                : "Invoice INV-104 · KSh 2,500"}
        </span>
        <h3>
          {privacy
            ? claims.length +
              (claims.length === 1 ? " selected claim" : " selected claims")
            : cash
              ? day > 10
                ? "Receipt arrives after the expense"
                : "Receipt arrives before the expense"
              : credential
                ? checks.length === 4
                  ? "All four example checks supplied"
                  : "Some checks remain uncertain"
                : !reference
                  ? "Unmatched: review required"
                  : amount > 2500
                    ? "Amount mismatch: review required"
                    : amount === 2500
                      ? "Fully paid in this example"
                      : "Partially paid in this example"}
        </h3>
        {privacy ? (
          <>
            <ul>
              {claims.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p>
              Unselected claims stay out of this preview. Real sharing
              additionally requires purpose, recipient authorization and expiry
              controls.
            </p>
          </>
        ) : cash ? (
          <p>
            {day > 10
              ? "The day-10 expense creates an illustrative KSh 8,000 gap until the receipt arrives."
              : "After the expense, illustrative movement is KSh 4,000."}{" "}
            The month’s net movement is still KSh 4,000. Timing changes the
            temporary gap; this is not your bank balance.
          </p>
        ) : credential ? (
          <ul>
            {[
              "Signature",
              "Current status",
              "Recognized issuer",
              "Independent evidence",
            ].map((c) => (
              <li key={c}>
                {c}:{" "}
                {checks.includes(c)
                  ? "supplied in this example"
                  : "not established"}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {!reference || amount > 2500
              ? "No automatic allocation is made in this example. Inspect the reference and amount rather than forcing a match."
              : "Outstanding: KSh " +
                (2500 - amount).toLocaleString("en-KE") +
                ". Only the confirmed allocated amount reduces what is owed."}
          </p>
        )}
      </div>
    </section>
  );
}
export function ProductEducation({ path }: { path: string }) {
  const guide = guides[path];
  if (!guide) return null;
  return (
    <div className="product-education">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <Icon name="right" />
        <span>{guide.name}</span>
      </nav>
      <section className="product-introduction">
        <div>
          <span className="eyebrow">What this solves</span>
          <h2>{guide.problem}</h2>
          <p>{guide.summary}</p>
          <h3>Who it is for</h3>
          <p>{guide.audience}</p>
        </div>
        {publicPageMedia[path] && <MediaBlock media={publicPageMedia[path]} />}
      </section>
      <section className="how-product-works">
        <span className="eyebrow">A practical workflow</span>
        <h2>How {guide.name} works</h2>
        <ProcessTimeline steps={guide.steps} />
      </section>
      <AnnotatedProductVisual lesson={guide.lesson} />
      <section className="business-scenario">
        <span className="eyebrow">An illustrative business story</span>
        <h2>What using it could look like</h2>
        <p>{guide.example}</p>
        <div className="before-after">
          <article>
            <h3>The manual work</h3>
            <p>{guide.problem}</p>
          </article>
          <article>
            <h3>The operational result</h3>
            <p>{guide.outcome}</p>
          </article>
        </div>
        <p className="content-limitation">
          <strong>What is available today:</strong> {guide.limit}
        </p>
      </section>
      {[
        "reconciliation",
        "receivables",
        "payment-links",
        "cash-flow",
        "forecasts",
        "business-passport",
        "private-sharing",
        "digital-credentials",
        "blockchain-proof",
        "business-trust",
      ].includes(guide.lesson) && <InteractiveExample kind={guide.lesson} />}
      {path === "/developers" && <DeveloperTutorial />}
      <ProductFAQ items={guide.faqs} />
      <section className="product-connections">
        <h2>Use it with</h2>
        <div>
          {guide.related.map((href) => (
            <a key={href} href={href}>
              {guides[href]?.name ||
                (
                  {
                    "/docs": "API documentation",
                    "/demo": "Interactive demo",
                    "/privacy": "Privacy notice",
                  } as Record<string, string>
                )[href] ||
                "Explore the related tool"}
              <Icon name="right" />
            </a>
          ))}
        </div>
        <a className="text-link" href={"/learn/" + guide.lesson}>
          Read the plain-language guide
          <Icon name="right" />
        </a>
      </section>
      <section className="product-next">
        <h2>Start with one workflow.</h2>
        <p>
          Try the synthetic demo first. You do not need a database or a real
          payment provider to explore it.
        </p>
        <div className="actions">
          <a className="button" href={demoLink(path)}>
            Try this workflow
            <Icon name="right" />
          </a>
          <a className="text-link" href="/learn">
            Visit AfriCore Learn
            <Icon name="right" />
          </a>
        </div>
      </section>
    </div>
  );
}
export function Ecosystem() {
  return (
    <section className="ecosystem">
      <span className="eyebrow">One platform, distinct jobs</span>
      <h2>Start with the work you need to do.</h2>
      <div>
        {[
          [
            "Run your business",
            "Customers, orders and invoices in one shared workspace.",
            "/products/business",
          ],
          [
            "Follow the money",
            "Request payments, match trusted events and review what is still owed.",
            "/products/reconciliation",
          ],
          [
            "Plan the next step",
            "Understand recorded movement and compare forecast assumptions.",
            "/products/intelligence",
          ],
          [
            "Share business proof",
            "Present particular claims while keeping unrelated information private.",
            "/products/business-passport",
          ],
        ].map(([name, text, href]) => (
          <a key={href} href={href}>
            <h3>
              {name}
              <Icon name="right" />
            </h3>
            <p>{text}</p>
          </a>
        ))}
      </div>
      <p>
        Current payment workflows are sandbox demonstrations. Production
        collection and partner-dependent protection remain disabled.
      </p>
    </section>
  );
}
export function GettingStarted() {
  return (
    <section className="getting-started">
      <span className="eyebrow">Your first ten minutes</span>
      <h2>Learn the workflow before connecting real data.</h2>
      <ProcessTimeline
        steps={[
          [
            "Open the demo",
            "Use its fictional business, orders and payments. No database is needed.",
          ],
          [
            "Inspect an invoice",
            "Find the customer, due date, confirmed allocations and remaining balance.",
          ],
          [
            "Explore a scenario",
            "Compare payment outcomes, forecast assumptions or a minimal credential disclosure.",
          ],
          [
            "Plan your setup",
            "For a connected deployment, arrange your business details, team roles, permitted sources and required provider configuration.",
          ],
        ]}
      />
      <a className="button" href="/demo">
        Open the demo workspace
        <Icon name="right" />
      </a>
    </section>
  );
}
export function HeroWorkflow() {
  return (
    <figure className="hero-workflow">
      <figcaption>One sale. A traceable payment record.</figcaption>
      <article>
        <span>01 · Invoice INV-104</span>
        <strong>KSh 2,500</strong>
        <p>The amount requested from your customer.</p>
      </article>
      <div className="workflow-connector">
        <Icon name="down" />
        <span>Trusted provider confirmation</span>
      </div>
      <article>
        <span>02 · Receipt allocated</span>
        <strong>KSh 1,500</strong>
        <p>Recorded against this invoice, not guessed from a screenshot.</p>
      </article>
      <div className="workflow-connector">
        <Icon name="down" />
        <span>The unpaid remainder stays visible</span>
      </div>
      <article>
        <span>03 · Still owed</span>
        <strong>KSh 1,000</strong>
        <p>A partial payment leaves an outstanding receivable.</p>
      </article>
      <small>Illustrative figures · Sandbox only · No real funds</small>
    </figure>
  );
}
