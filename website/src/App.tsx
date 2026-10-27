import { RefinedHome } from './education/RefinedHome';
import {AccountApp,AccountChooser} from './accounts/Accounts';
import { DeveloperTutorial } from './education/DeveloperTutorial';
import { ProductEducation } from './education/Components';
import { Learn } from './education/Learn';
import { guides, demoLink } from './education/guides';
import { usePageMetadata } from './education/metadata';
import { groups, productSections } from './navigation';
import { TrustPublic } from './stage3/TrustPublic';
import { startDemo } from './demo/transport';
import { publicPageMedia } from './editorial';
import { BuyerPortal } from './stage2/BuyerPortal';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { useFocusScope } from './components/useFocusScope';
import { pages, media } from './content';
import { FeatureSection } from './components/Media';
import { AuthPage, Checkout } from './BusinessApp';
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
          Customers, invoices and payment records.
          <br />
          One connected business workspace.
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
  return <RefinedHome />;
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
      <DeveloperTutorial />
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
const headlines: Record<string, string> = {
  '/products/business': 'Customers, orders and payment records. Together.',
  '/products/pay': 'Send a payment link. Follow a trusted result.',
  '/products/reconciliation': 'Know which payment belongs to which order.',
  '/products/invoicing': 'Send invoices. Track what you’re owed.',
  '/products/cash-flow': 'Understand money in, money out and what is missing.',
  '/products/intelligence': 'Turn covered records into clearer decisions.',
  '/products/automations': 'Give repeatable work a visible follow-up.',
  '/products/business-passport':
    'Give your business a profile you can share by choice.',
  '/products/trust-network': 'See who confirmed which business relationship.',
  '/products/verifiable-credentials':
    'A signed statement. Separate checks for trust.',
  '/products/blockchain-verification':
    'Check a proof without publishing private records.',
  '/solutions/social-commerce': 'Turn conversations into organized orders.',
  '/solutions/contractors': 'Keep deliveries, invoices and payments connected.',
};
export function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  usePageMetadata(path);
  if (path === '/verify-credential') return <TrustPublic mode="verify" />;
  if (path.startsWith('/trust/share/')) return <TrustPublic mode="share" />;
  if (path.startsWith('/passport/')) return <TrustPublic mode="profile" />;
  if (path.startsWith('/buyer/')) return <BuyerPortal />;
  if (path.startsWith('/app')||path==='/auth/callback') return <AccountApp />;
  if(path==='/get-started'||path==='/signup') return <AccountChooser/>;
  if(path.startsWith('/sign-up/')) return ['personal','business','developer'].includes(path.split('/')[2]) ? <AuthPage mode="signup" kind={path.split('/')[2]}/> : <AccountChooser/>;
  if(path==='/login') return <AuthPage mode="signin"/>;
  if(path==='/forgot-password') return <AuthPage mode="recover"/>;
  if (path.startsWith('/checkout/')) return <Checkout />;
  if (path === '/demo') {
    startDemo();
    const view = new URLSearchParams(location.search).get('view') || 'Overview';
    location.replace('/app#' + encodeURIComponent(view));
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
        ) : path === '/learn' || path.startsWith('/learn/') ? (
          <Learn slug={path.split('/')[2]} />
        ) : path === '/docs' ? (
          <Docs />
        ) : page ? (
          <>
            <section className="page-hero">
              <span className="eyebrow">{page.category}</span>
              <h1>{headlines[path] || page.title}</h1>
              <p>{guides[path]?.summary || page.description}</p>
              <div className="actions">
                <a
                  className="button"
                  href={guides[path] ? demoLink(path) : '/signup'}
                >
                  {guides[path] ? 'Try this workflow' : 'Get started'}{' '}
                  <Icon name="right" />
                </a>
                <a className="text-link light" href="/docs">
                  Explore documentation <Icon name="right" />
                </a>
              </div>
              {page.availability && (
                <p className="availability">{page.availability}</p>
              )}
            </section>
            {guides[path] ? (
              <ProductEducation path={path} />
            ) : (
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
            )}
            {!guides[path] && <CTA />}
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
