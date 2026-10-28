import { DeveloperTutorial } from "./DeveloperTutorial";
import { ProductExperience, experienceKinds } from "./ProductExperiences";
import { InteractiveExample } from "./InteractiveExample";
import { Icon } from "../components/Icon";
import { MediaBlock } from "../components/Media";
import { publicPageMedia } from "../editorial";
import { guides, demoLink, type Guide } from "./guides";
import {ServiceExplainer} from './ServiceExplainer';
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
export function ProductEducation({ path }: { path: string }) {
  const guide = guides[path];
  if (!guide) return null;
  if (path.startsWith("/products/") && experienceKinds[path.split("/").at(-1)!])
    return (
      <div className="product-education">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <Icon name="right" />
          <span>{guide.name}</span>
        </nav>
        <section className="product-introduction">
          <div>
            <span className="eyebrow">{guide.name}</span>
            <h2>{guide.problem}</h2>
            <h3>Who this helps</h3>
            <p>{guide.audience}</p>
          </div>
          {publicPageMedia[path] && (
            <MediaBlock media={publicPageMedia[path]} />
          )}
        </section>
        <ProductExperience path={path} />
        <ServiceExplainer path={path}/>
        <section className="compact-product-help">
          <p className="content-limitation">
            <strong>Current availability:</strong> {guide.limit}
          </p>
          <details>
            <summary>Questions about {guide.name}</summary>
            <ProductFAQ items={guide.faqs} />
          </details>
        </section>
        <section className="product-connections">
          <h2>Where to go next</h2>
          <div>
            <a href={demoLink(path)}>
              Explore this workspace section <Icon name="right" />
            </a>
            <a href={"/learn/" + guide.lesson}>
              Read the detailed learning guide <Icon name="right" />
            </a>
            {guide.related.slice(0, 2).map((href) => (
              <a key={href} href={href}>
                {guides[href]?.name || "API documentation"}
                <Icon name="right" />
              </a>
            ))}
          </div>
        </section>
      </div>
    );
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
        <ServiceExplainer path={path}/>
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
          Choose your workspace and begin with one customer, invoice or record.
        </p>
        <div className="actions">
          <a className="button" href="/get-started">
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
