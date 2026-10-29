import {ServiceFinder} from "./ServiceFinder";
import { Icon } from '../components/Icon';
import { EditorialCard, MediaCarousel } from '../components/Media';
import { editorial } from '../editorial';
import { HeroWorkflow } from './Components';

export function ProductComposition() {
  return (
    <figure
      className="product-composition"
      aria-label="AfriCore workspace, hosted checkout and invoice together"
    >
      <div className="device-laptop">
        <div className="device-camera" />
        <img
          src="/media/product/workspace.webp"
          width="1200"
          height="800"
          alt="Actual AfriCore synthetic demo: customer and invoice navigation, confirmed inflows and outstanding amounts."
          fetchPriority="high"
        />
        <div className="device-base" />
      </div>
      <div className="device-phone">
        <img
          src="/media/product/checkout.webp"
          width="390"
          height="760"
          alt="Actual sandbox checkout showing the merchant, invoice reference, KSh 650 and pending status."
        />
      </div>
      <div className="device-invoice">
        <span>Invoice record</span>
        <strong>KSh 650</strong>
        <span>Issued · Awaiting payment</span>
      </div>
      <figcaption>
        Example interfaces · illustrative records
      </figcaption>
    </figure>
  );
}
const groups = [
  [
    'Run your business',
    'Customers, orders, invoices and team responsibilities.',
    '/products/business',
    'Explore the workspace',
  ],
  [
    'Manage your money',
    'Payment requests, receipt matching and recorded cash movement.',
    '/products/pay',
    'Follow a payment',
  ],
  [
    'Connect and automate',
    'Authorized sources, structured records and defined administrative rules.',
    '/products/connect',
    'Understand the connections',
  ],
  [
    'Build business credibility',
    'A private Passport, signed claims and corroborated relationships.',
    '/products/business-passport',
    'Explore Business Passport',
  ],
];
export function RefinedHome() {
  return (
    <>
      <section className="hero hero-compact">
        <div className="hero-copy">
          <span className="eyebrow">AfriCore Business</span>
          <h1>
            Your business,
            <br /> all connected.
          </h1>
          <p>
            Manage payments, invoices and business records in one place. Know
            what’s paid, what’s outstanding, and what needs your attention.
          </p>
          <div className="actions">
            <a className="button" href="/get-started">
              Get started <Icon name="right" />
            </a>
            <a className="text-link light" href="#how-it-works">
              See how it works <Icon name="down" />
            </a>
          </div>
        </div>
        <ProductComposition />
      </section>
      <section className="home-groups" aria-labelledby="product-groups">
        <span className="eyebrow">One workspace. Four jobs.</span>
        <h2 id="product-groups">Start with what your business needs.</h2>
        <div>
          {groups.map(([name, text, href, cta]) => (
            <article key={href}>
              <h3>{name}</h3>
              <p>{text}</p>
              <a className="text-link" href={href}>
                {cta}
                <Icon name="right" />
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="home-example" id="how-it-works">
        <div>
          <span className="eyebrow">One sale, followed through</span>
          <h2>A payment is part of a bigger record.</h2>
          <p>
            A fictional shop issues an invoice for KSh 2,500. A trusted receipt
            covers KSh 1,500. Matching the receipt leaves KSh 1,000 still owed.
          </p>
          <p>
            Requesting a payment, confirming it and allocating it are separate
            steps. Settlement depends on the payment provider.
          </p>
          <a className="text-link" href="/products/reconciliation">
            Try the matching exercise <Icon name="right" />
          </a>
        </div>
        <HeroWorkflow />
      </section>
      <section className="home-working-day">
        <span className="eyebrow">How the platform works</span>
        <h2>Keep the next action clear.</h2>
        <ol>
          <li>
            <b>01</b>
            <h3>Record the work</h3>
            <p>
              Add the customer, order and invoice with an amount and due date.
            </p>
          </li>
          <li>
            <b>02</b>
            <h3>Follow the evidence</h3>
            <p>
              Inspect confirmed payment events and review unmatched records.
            </p>
          </li>
          <li>
            <b>03</b>
            <h3>Decide what comes next</h3>
            <p>
              Follow unpaid invoices, plan expenses and share only the proof
              needed.
            </p>
          </li>
        </ol>
      </section>
      <section className="solutions-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Built around your working day</span>
            <h2>Find a familiar business situation.</h2>
          </div>
        </div>
        <MediaCarousel>
          {[
            [
              'Social commerce',
              'Follow a chat order through checkout and confirmation.',
              'social-commerce',
              'payments',
            ],
            [
              'Growing SMEs',
              'Coordinate customers, invoices and employee responsibilities.',
              'smes',
              'business',
            ],
            [
              'Contractors & suppliers',
              'Track deliveries, due dates and unpaid amounts.',
              'contractors',
              'invoicing',
            ],
          ].map(([title, text, slug, art]) => (
            <EditorialCard
              key={slug}
              title={title}
              text={text}
              href={'/solutions/' + slug}
              media={editorial[art]}
            />
          ))}
        </MediaCarousel>
      </section>
      <section className="home-assurance">
        <div>
          <span className="eyebrow">Trust and security</span>
          <h2>Know what a record can prove.</h2>
          <p>
            Workspace permissions control access. Source labels distinguish a
            merchant statement from provider evidence. Credential signatures,
            issuer recognition and claim quality remain separate checks.
          </p>
          <a className="text-link" href="/security">
            Review the safeguards <Icon name="right" />
          </a>
        </div>
        <div>
          <span className="eyebrow">Availability</span>
          <h3>Know what is available.</h3>
          <p>
            Payments and protected purchase outcomes are simulated. Live
            provider collection, regulated settlement and institutional
            connections are not enabled. Capital remains deferred.
          </p>
          <p>Kenya first. Built for the continent.</p>
        </div>
      </section>
      <ServiceFinder/><section className="home-resources">
        <article>
          <span className="eyebrow">For developers</span>
          <h2>Build against explicit records and states.</h2>
          <p>
            Start with a scoped sandbox request, then verify signed webhook
            events and safe retries.
          </p>
          <a className="text-link" href="/developers">
            Open the developer guide <Icon name="right" />
          </a>
        </article>
        <article>
          <span className="eyebrow">AfriCore Learn</span>
          <h2>Understand the work behind the numbers.</h2>
          <p>
            Learn what reconciliation, receivables, forecasts and business proof
            mean in everyday operations.
          </p>
          <a className="text-link" href="/learn">
            Find a practical guide <Icon name="right" />
          </a>
        </article>
      </section>
      <section className="final-cta">
        <span className="eyebrow">Start with one workflow</span>
        <h2>See your next working day.</h2>
        <a className="button" href="/get-started">
          Find your workspace <Icon name="right" />
        </a>
        <p>Start with your work, your customers and a clearer view of your business.</p>
      </section>
    </>
  );
}
