import { groups, productSections } from './navigation';
import { TrustPublic } from './stage3/TrustPublic';
import { startDemo } from './demo/transport';
import { editorial, publicPageMedia } from './editorial';
import { EducationalFlow } from './EducationalFlow';
import { BuyerPortal } from './stage2/BuyerPortal';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { useFocusScope } from './components/useFocusScope';
import { pages, media } from './content';
import {
  FeatureSection,
  EditorialCard,
  HeroMedia,
  MediaCarousel,
} from './components/Media';
import { BusinessApp, AuthPage, Checkout } from './BusinessApp';
export function Logo() {
  return (
    <a href="/" className="logo" aria-label="AfriCore home">
      <span className="brand-mark" aria-hidden="true">
        A
      </span>
      AfriCore<span className="logo-period">.</span>
    </a>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLElement>(null);
  const close = () => {
    setOpen(false);
    setCategory('');
    setSearching(false);
  };
  useFocusScope(open || searching, close, root);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    function outside(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setCategory('');
    }
    function resize() {
      if (window.innerWidth > 1024) setOpen(false);
    }
    document.addEventListener('keydown', key);
    document.addEventListener('click', outside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('click', outside);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <header className="site-header" ref={root}>
      <Logo />
      <div className="header-tools">
        <button
          className="icon-button"
          aria-label={searching ? 'Close search' : 'Search AfriCore'}
          aria-expanded={searching}
          onClick={() => {
            setSearching(!searching);
            setOpen(false);
          }}
        >
          <Icon name={searching ? 'close' : 'search'} />
        </button>
        <a
          className="icon-button mobile-account"
          href="/signin"
          aria-label="Sign in"
        >
          <Icon name="user" />
        </a>
        <button
          className="menu-toggle icon-button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => {
            setOpen(!open);
            setSearching(false);
          }}
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
      <nav
        id="main-nav"
        className={open ? 'open' : ''}
        aria-label="Main navigation"
      >
        {Object.entries(groups).map(([label, links]) => (
          <div className="nav-group" key={label}>
            <button
              className="nav-category"
              data-autofocus={open && label === 'Products' ? true : undefined}
              aria-expanded={category === label}
              aria-controls={'nav-' + label}
              onClick={() => setCategory(category === label ? '' : label)}
            >
              {label}
              <Icon name="down" />
            </button>
            {
              <div
                className="nav-menu"
                id={'nav-' + label}
                hidden={category !== label}
              >
                <span className="nav-caption">
                  Explore {label.toLowerCase()}
                </span>
                {(label === 'Products'
                  ? productSections.map((section) => ({
                      title: section.title,
                      links: section.paths.map((path) =>
                        links.find(([, url]) => url === path)!,
                      ),
                    }))
                  : [{ title: '', links }]
                ).map((section) => (
                  <div className="nav-column" key={section.title}>
                    {section.title && <h3>{section.title}</h3>}
                    {section.links.map(([text, url]) => (
                      <a
                        href={url}
                        key={url}
                        aria-current={
                          location.pathname === url ? 'page' : undefined
                        }
                        onClick={close}
                      >
                        {text}
                        <Icon name="right" />
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            }
          </div>
        ))}
        <a className="support-link" href="/support">
          Support
        </a>
        <a className="signin-link" href="/signin">
          Sign in
        </a>
        <a className="button small" href="/demo">
          Explore demo
        </a>
      </nav>
      {searching && (
        <section
          className="site-search"
          role="search"
          aria-label="Search AfriCore pages"
        >
          <label htmlFor="site-query">Find a product or resource</label>
          <input
            id="site-query"
            data-autofocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search payments, Passport, developers…"
          />
          <div className="search-results">
            {Object.values(groups)
              .flat()
              .filter(([title]) =>
                title.toLowerCase().includes(query.toLowerCase()),
              )
              .map(([title, url]) => (
                <a key={url} href={url}>
                  {title}
                  <Icon name="right" />
                </a>
              ))}
          </div>
        </section>
      )}
    </header>
  );
}
function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <Logo />
        <p>
          The programmable infrastructure
          <br />
          layer for African business.
        </p>
      </div>
      <div className="footer-links">
        {Object.entries(groups).map(([label, links]) => (
          <div key={label}>
            <h3>{label}</h3>
            {links.map(([text, url]) => (
              <a key={url} href={url}>
                {text}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} AfriCore · Built for what comes next.
        </span>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <span>Kenya · Africa/Nairobi</span>
      </div>
    </footer>
  );
}
function CTA() {
  return (
    <section className="final-cta">
      <span className="eyebrow">Your next chapter starts here</span>
      <h2>
        Build a more
        <br />
        connected business.
      </h2>
      <a className="button" href="/signup">
        Create your sandbox workspace <Icon name="right" />
      </a>
      <p>Explore the platform safely. No real funds move in sandbox.</p>
    </section>
  );
}
function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">The connected business platform</span>
          <h1>
            Powering the next <br />
            chapter of African <br />
            business.
          </h1>
          <p>
            Bring payments, operations and business trust together. One
            foundation for everything you’re building.
          </p>
          <div className="actions">
            <a className="button" href="/demo">
              Explore AfriCore
              <Icon name="right" />
            </a>
            <a className="text-link light" href="#platform">
              Discover the platform
              <Icon name="down" />
            </a>
          </div>
          <div className="hero-caption">
            Kenya first. Built for the continent.
          </div>
        </div>
        <HeroMedia media={media.hero} />
        <div className="hero-bottom">
          <span>Business infrastructure</span>
          <span>Payments. Intelligence. Trust.</span>
          <a href="/products/business">
            Discover what’s possible
            <Icon name="right" />
          </a>
        </div>
      </section>
      <section className="quick-links" aria-label="Platform quick links">
        <h2>Explore AfriCore</h2>
        <div>
          {[
            ['Business', '/products/business'],
            ['Payments', '/products/pay'],
            ['Intelligence', '/products/intelligence'],
            ['Business Passport', '/products/business-passport'],
            ['Trust Network', '/products/trust-network'],
            ['Developers', '/developers'],
          ].map(([label, href]) => (
            <a key={href} href={href}>
              {label}
              <Icon name="right" />
            </a>
          ))}
        </div>
      </section>
      <section className="mission">
        <span className="eyebrow">ONE MISSION. A STRONGER FOUNDATION.</span>
        <h2>
          Big ambition shouldn’t
          <br />
          get lost in small tasks.
        </h2>
        <p>
          African businesses move fast. Their systems don’t always move
          together. We’re building the common layer that connects daily
          operations with financial infrastructure — so businesses can focus on
          what they do best.
        </p>
        <a className="text-link" href="/about">
          Meet AfriCore <Icon name="right" />
        </a>
      </section>
      <div className="section-heading" id="platform">
        <div>
          <span className="eyebrow">AFRICORE BUSINESS</span>
          <h2>
            Your business.
            <br />
            One clear picture.
          </h2>
        </div>
        <a className="text-link" href="/products/business">
          Explore Business <Icon name="right" />
        </a>
      </div>
      <FeatureSection
        eyebrow="BUILT FOR YOUR WORKING DAY"
        title="From the first order to the final payment."
        description="Customers, orders, invoices and collections belong together. Give your team a shared workspace with clear permissions and a reliable view of what needs attention."
        media={media.workspace}
      >
        <a className="text-link" href="/products/business">
          See the workspace <Icon name="right" />
        </a>
      </FeatureSection>
      <section className="product-strip">
        <a href="/products/pay">
          <span>01 / COLLECT</span>
          <h3>
            Payments with
            <br />a clear destination.
          </h3>
          <p>
            Create a payment request. Share a checkout link. Track a verified
            result.
          </p>
          <b>
            Explore AfriCore Pay <Icon name="right" />
          </b>
        </a>
        <a href="/products/invoicing">
          <span>02 / ORGANIZE</span>
          <h3>
            Send the invoice.
            <br />
            Keep the visibility.
          </h3>
          <p>
            Track what’s due, what’s overdue and what has been partially paid.
          </p>
          <b>
            Explore invoicing <Icon name="right" />
          </b>
        </a>
        <a href="/products/cash-flow">
          <span>03 / UNDERSTAND</span>
          <h3>
            Know what’s moving.
            <br />
            Plan what’s next.
          </h3>
          <p>
            See incoming collections and receivables with transparent data
            sources.
          </p>
          <b>
            Explore reporting <Icon name="right" />
          </b>
        </a>
      </section>
      <FeatureSection
        eyebrow="PAYMENT RECONCILIATION"
        title="A payment received. A record resolved."
        description="Connect confirmed transactions to the right request, order or invoice. Keep exceptions visible, duplicate events harmless and financial history intact."
        media={editorial.reconciliation}
        reverse
      >
        <a className="text-link" href="/products/reconciliation">
          Connect the dots <Icon name="right" />
        </a>
      </FeatureSection>
      <section className="developer-feature dark">
        <div>
          <span className="eyebrow">AFRICORE DEVELOPERS</span>
          <h2>
            Your next product.
            <br />
            Our shared foundation.
          </h2>
          <p>
            Build business workflows with scoped APIs, isolated environments and
            signed webhook events. The same infrastructure behind AfriCore
            Business, ready for your integration.
          </p>
          <div className="actions">
            <a href="/docs" className="button">
              Read the docs <Icon name="right" />
            </a>
            <a href="/sandbox" className="text-link light">
              Explore sandbox <Icon name="right" />
            </a>
          </div>
        </div>
        <div className="code-window">
          <div>
            <i />
            <i />
            <i />
            <span>create-payment-request.ts</span>
          </div>
          <pre>
            <code>{`// Start safely in sandbox\nconst payment = await fetch(\n  '/api/v1/organizations/{org}/payment-requests',\n  {\n    method: 'POST',\n    headers: {\n      Authorization: 'Bearer <your-key>',\n      'Content-Type': 'application/json',\n      'X-Environment': 'sandbox',\n      'Idempotency-Key': 'order-2026-001'\n    },\n    body: JSON.stringify({\n      document_id: '<issued-invoice-id>'\n    })\n  }\n);`}</code>
          </pre>
          <span className="code-note">
            One API. Explicit states. Auditable events.
          </span>
        </div>
      </section>
      <section className="integration-section">
        <span className="eyebrow">AFRICORE CONNECT + DATA</span>
        <h2>
          Many sources.
          <br />
          One consistent language.
        </h2>
        <p>
          Start with CSV imports, sandbox transactions and AfriCore Pay.
          Preserve source records and normalize the information your business
          needs.
        </p>
        <div className="connector-row">
          {['CSV imports', 'Sandbox provider', 'AfriCore Pay'].map((v) => (
            <span key={v}>
              {v}
              <small>Available in sandbox</small>
            </span>
          ))}
          <span className="future-connector">
            Banks & accounting<small>Future authorized integrations</small>
          </span>
        </div>
        <a className="text-link" href="/products/connect">
          Explore integrations <Icon name="right" />
        </a>
      </section>
      <section className="solutions-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BUILT AROUND YOUR BUSINESS</span>
            <h2>
              Different ambitions.
              <br />A common foundation.
            </h2>
          </div>
          <span className="scroll-hint">Swipe or use the controls</span>
        </div>
        <MediaCarousel>
          {[
            [
              'Social commerce',
              'Turn the conversation into an order.',
              'social-commerce',
            ],
            ['Growing SMEs', 'Make daily operations work together.', 'smes'],
            [
              'Contractors & suppliers',
              'Keep delivery and receivables in view.',
              'contractors',
            ],
            ['Fintechs & SaaS', 'Build on shared infrastructure.', 'fintechs'],
          ].map(([title, text, slug], i) => (
            <EditorialCard
              key={slug}
              title={title}
              text={text}
              href={'/solutions/' + slug}
              media={{
                ...editorial[
                  ['payments', 'business', 'invoicing', 'developers'][i]
                ],
                background: ['#eeeeee', '#f3f3f3', '#e9e9e9', '#f1f1f1'][i],
              }}
            />
          ))}
        </MediaCarousel>
      </section>
      <section className="trust-band">
        <span className="eyebrow">SECURITY IS PART OF THE FOUNDATION</span>
        <h2>
          Clear permissions.
          <br />
          Traceable decisions.
        </h2>
        <p>
          Organization isolation, scoped credentials and auditable financial
          events. Production collection remains disabled until provider access
          and verification are complete.
        </p>
        <a className="text-link" href="/security">
          Our approach to trust <Icon name="right" />
        </a>
      </section>
      <section className="how-section">
        <div>
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>
            From fragmented
            <br />
            to connected.
          </h2>
        </div>
        <ol>
          <li>
            <b>01</b>
            <div>
              <h3>Bring your business together</h3>
              <p>
                Create a workspace, invite your team and add your customers.
              </p>
            </div>
          </li>
          <li>
            <b>02</b>
            <div>
              <h3>Connect activity to payment</h3>
              <p>
                Create orders, issue invoices and share sandbox checkout links.
              </p>
            </div>
          </li>
          <li>
            <b>03</b>
            <div>
              <h3>Make the records work for you</h3>
              <p>
                Reconcile verified events and understand outstanding
                receivables.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <EducationalFlow />
      <section className="future-section">
        <span className="eyebrow">PLATFORM AVAILABILITY</span>
        <h2>Built today. Clear about what’s next.</h2>
        <div>
          <article>
            <h3>Financial intelligence</h3>
            <p>Scenario forecasting and financial analysis in sandbox.</p>
            <span className="badge">Sandbox · Available</span>
          </article>
          <article>
            <h3>AfriCore Capital</h3>
            <p>Financing is deferred and outside this release.</p>
            <span className="badge">Future · Not offered</span>
          </article>
          <article>
            <h3>Protected payments</h3>
            <p>
              Partner-orchestrated purchase and dispute workflows in sandbox.
            </p>
            <span className="badge">Sandbox · No real funds</span>
          </article>
        </div>
      </section>
      <CTA />
    </>
  );
}
function Docs() {
  return (
    <main className="docs-page">
      <span className="eyebrow">DEVELOPER DOCUMENTATION · V1</span>
      <h1>Build with clarity.</h1>
      <p>
        The workspace API is served at <code>/api/v1</code>. Existing
        consent-gated infrastructure APIs remain at <code>/v1</code>.
      </p>
      <a className="button" href="/api/openapi.json">
        Download OpenAPI <Icon name="right" />
      </a>
      <div className="docs-grid">
        {[
          [
            'Getting started',
            'Create a sandbox workspace, add a customer, create an invoice and issue it. Create an application under Developers and generate a credential.',
          ],
          [
            'Authentication',
            'Send Authorization: Bearer <key> and X-Environment: sandbox. Keys are organization-bound, scoped and shown once. Revoke an old key after issuing its replacement. Browser sessions use HttpOnly cookies.',
          ],
          [
            'Payment requests',
            'POST /api/v1/organizations/{org}/payment-requests with {document_id}. Supply a unique Idempotency-Key header. Save the returned checkout URL; its secret is shown once.',
          ],
          [
            'Data & pagination',
            'GET /api/v1/organizations/{org}/records/{kind}?limit=50&offset=0. Supported kinds: customers, orders, invoices, applications, transactions, integrations. Filters: q and status.',
          ],
          [
            'Money & environments',
            'All new workspace amounts use integer minor units and an explicit currency. KES 100.00 is 10000 minor units. Never sum different currencies. Production payment initiation is disabled.',
          ],
          [
            'Errors & rate limits',
            'Errors include error, message and request_id. Validation errors include issues. HTTP 401 requires sign-in; 403 means missing permission; 409 means conflicting state; 429 means rate limited. Global limit: 600 requests per IP per minute. Authentication has a stricter limit.',
          ],
          [
            'Signed webhooks',
            'AfriCore-Signature contains t=<unix seconds>,v1=<hex HMAC-SHA256>. Verify HMAC(secret, timestamp + "." + raw body), reject timestamps older than 5 minutes and deduplicate by AfriCore-Delivery. Never parse and reserialize before verification.',
          ],
          [
            'Retries & replay',
            'Persist delivery attempts with exponential retry (5 attempts), dead-letter status and authorized replay. Delivery is at least once. Replay and retries retain the delivery ID. Poll processing runs every 10 seconds in the API process.',
          ],
          [
            'Sandbox testing',
            'Checkout scenarios: success, failed, delayed, partial, duplicate and reversed. Delayed stays pending; retry success to complete it. Partial and reversal are separate test cases; reversals enter review.',
          ],
          [
            'Changelog · 2026-10-25',
            'Added workspace authentication, organization membership, business records, sandbox checkout, scoped credentials and durable delivery infrastructure. No live payment provider enabled.',
          ],
        ].map(([title, text]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
export function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/verify-credential') return <TrustPublic mode="verify" />;
  if (path.startsWith('/trust/share/')) return <TrustPublic mode="share" />;
  if (path.startsWith('/passport/')) return <TrustPublic mode="profile" />;
  if (path.startsWith('/buyer/')) return <BuyerPortal />;
  if (path.startsWith('/app')) return <BusinessApp />;
  if (path.startsWith('/checkout/')) return <Checkout />;
  if (path === '/demo') {
    startDemo();
    location.replace('/app');
    return <p>Opening demo workspace…</p>;
  }
  if (['/signin', '/signup', '/recover', '/verify', '/reset'].includes(path))
    return <AuthPage mode={path.slice(1)} />;
  const page = pages[path];
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main">
        {path === '/' ? (
          <Home />
        ) : path === '/docs' ? (
          <Docs />
        ) : page ? (
          <>
            <section className="page-hero">
              <span className="eyebrow">{page.category}</span>
              <h1>{page.title}</h1>
              <p>{page.description}</p>
              <div className="actions">
                <a className="button" href="/signup">
                  Get started <Icon name="right" />
                </a>
                <a className="text-link light" href="/docs">
                  Explore documentation <Icon name="right" />
                </a>
              </div>
              {page.availability && (
                <p className="availability">{page.availability}</p>
              )}
            </section>
            <FeatureSection
              eyebrow="CONNECTED BY DESIGN"
              title="A stronger way to work."
              description={page.description}
              media={publicPageMedia[path] || media.workspace}
            >
              <ul className="feature-points">
                {page.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </FeatureSection>
            <CTA />
          </>
        ) : (
          <section className="mission">
            <h1>Page not found.</h1>
            <a className="button" href="/">
              Return home
            </a>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
