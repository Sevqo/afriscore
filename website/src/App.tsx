import { useEffect, useRef, useState } from 'react'

const repo = 'https://github.com/Sevqo/afriscore'
const steps = [
  { number: '01', label: 'Connect', title: 'Meet the data where it lives.', body: 'Financial activity is spread across mobile money, bank records and operational systems. AfriScore provides a common entry point for authorized sources. Today, our sandbox and provider-shaped sample feeds let builders test the full flow.', note: 'AUTHORIZED SOURCES / SYNTHETIC SANDBOX', color: 'mint' },
  { number: '02', label: 'Normalize', title: 'Give every record the same language.', body: 'Different providers describe the same event in different ways. We standardize direction, amount, status, counterparty and time, then deduplicate imports so downstream applications can rely on a consistent transaction model.', note: 'RAW INPUT → CONSISTENT MODEL', color: 'blue' },
  { number: '03', label: 'Permission', title: 'Access should be earned, not assumed.', body: 'An application key identifies the caller. A separate, purpose-specific consent grant controls which subject and capability it may access. Revoking that grant immediately removes access.', note: 'IDENTITY + SCOPE + REVOCATION', color: 'orange' },
  { number: '04', label: 'Understand', title: 'Move from records to decisions.', body: 'Build explainable financial profiles, reconcile invoices, inspect cash-flow signals and verify an append-only trust history. AfriScore answers grounded questions from available data—and declines what it cannot support.', note: 'EVIDENCE IN / USEFUL SIGNAL OUT', color: 'lime' },
]

const cases = [
  { name: 'For fintech builders', mark: '01', title: 'Build better financial experiences.', text: 'Use normalized, permissioned business data as a starting point for underwriting support, cash-flow products and merchant tools. Every sensitive read has a clear access boundary.' },
  { name: 'For business platforms', mark: '02', title: 'Make operations easier to understand.', text: 'Connect transaction history to invoices, payment status and customer concentration. Bring financial context into the products operators already use.' },
  { name: 'For developers', mark: '03', title: 'Prototype the hard parts early.', text: 'Test success, failure and duplicate transaction paths in a synthetic sandbox. Explore the API, consent model, signed webhooks and reconciliation before connecting live partners.' },
]

function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      nodes.forEach(n => n.classList.add('visible'))
      return
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target) }
    }), { threshold: .08 })
    nodes.forEach(n => observer.observe(n))
    return () => observer.disconnect()
  }, [])
}

function Brand() {
  return <a className="brand" href="#top" aria-label="AfriScore home"><span className="brand-glyph" aria-hidden="true"><i /><i /><i /></span><span>afri<span>score</span><b>.</b></span></a>
}

function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const links = [['Platform', 'platform'], ['How it works', 'how-it-works'], ['Use cases', 'use-cases'], ['Developers', 'developers']]
  return <header className={`header ${scrolled ? 'header-scrolled' : ''}`}><div className="container header-inner"><Brand /><nav className="desktop-nav" aria-label="Primary navigation">{links.map(([name, id]) => <a href={`#${id}`} key={id}>{name}</a>)}</nav><div className="header-actions"><a className="header-link" href={repo} target="_blank" rel="noreferrer">View the API <span aria-hidden="true">↗</span></a><button ref={button} className="menu-button" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? '×' : '☰'}</button></div></div><nav id="mobile-nav" className={`mobile-nav ${open ? 'open' : ''}`} aria-label="Mobile navigation" inert={!open}>{links.map(([name, id]) => <a href={`#${id}`} key={id} onClick={() => setOpen(false)}>{name}<span>↗</span></a>)}<a href={repo} target="_blank" rel="noreferrer">View the API <span>↗</span></a></nav></header>
}

function Button({ href, children, light = false }: { href: string; children: React.ReactNode; light?: boolean }) {
  return <a className={`pill-button ${light ? 'pill-light' : ''}`} href={href}><span>{children}</span><b aria-hidden="true">↗</b></a>
}

function HeroGraphic() {
  return <div className="hero-graphic" role="img" aria-label="Fragmented business sources becoming one permissioned financial intelligence layer"><div className="graphic-noise" /><div className="graphic-top"><span>AFRISCORE / LIVE MODEL</span><span>001—004</span></div><div className="graph-source source-one"><span className="source-icon">⌁</span><span>MOBILE MONEY<small>Provider-shaped records</small></span></div><div className="graph-source source-two"><span className="source-icon">≋</span><span>BANK DATA<small>Authorized inputs</small></span></div><div className="graph-source source-three"><span className="source-icon">▤</span><span>BUSINESS OPS<small>Invoices & activity</small></span></div><div className="flow-track"><i /><i /><i /></div><div className="graph-core"><div className="core-ring ring-a" /><div className="core-ring ring-b" /><span className="core-label">THE INTELLIGENCE LAYER</span><strong>A<span>↗</span></strong><small>One model.<br />More possibility.</small></div><div className="graph-result"><span>OUTPUT / 01</span><strong>Clearer context for every decision.</strong><div><i /> Permissioned <i /> Explainable</div></div><div className="graphic-bottom"><span>SOURCE → SIGNAL → ACTION</span><span>SCROLL TO EXPLORE ↓</span></div></div>
}

function Hero() {
  return <section className="hero" id="top"><div className="container hero-grid"><div className="hero-copy"><div className="eyebrow"><i /> BUILT BY SEVQO / AFRICAN BUSINESS INFRASTRUCTURE</div><h1>Business data,<br /><em>made useful.</em></h1><p>One programmable layer for fragmented financial records, meaningful consent and intelligence you can actually build on.</p><div className="hero-actions"><Button href="#how-it-works">Explore the platform</Button><a className="text-link" href="#developers">See the developer layer <span>↗</span></a></div><div className="hero-foot"><span>01 / CONNECT</span><span>02 / UNDERSTAND</span><span>03 / BUILD</span></div></div><HeroGraphic /></div></section>
}

function Manifesto() {
  return <section id="platform" className="manifesto section-pad"><div className="container"><div className="section-line"><span>01 / THE OPPORTUNITY</span><span>BUSINESS SHOULD NOT BE INVISIBLE TO ITS OWN DATA</span></div><div className="manifesto-grid"><h2 data-reveal>Too much signal.<br /><em>Too many silos.</em></h2><div data-reveal><p className="lead">A business can be thriving and still look like a blank page to the tools meant to serve it.</p><p>Payments, invoices and operating records often live in separate places and speak different formats. AfriScore is building the infrastructure that turns those fragments into a coherent, permissioned picture—so the next generation of business products can start with context.</p><a className="inline-link" href="#how-it-works">See how the layer works <span>↗</span></a></div></div><div className="principle-grid"><article data-reveal><span>01 / CLARITY</span><div className="principle-symbol">◎</div><h3>Make records legible.</h3><p>A consistent transaction model gives teams a reliable foundation across different sources.</p></article><article data-reveal><span>02 / CONTROL</span><div className="principle-symbol">⟡</div><h3>Keep permission explicit.</h3><p>Developer identity and granular consent are separate by design.</p></article><article data-reveal><span>03 / UTILITY</span><div className="principle-symbol">↗</div><h3>Build from evidence.</h3><p>Profiles, reconciliation and insights should trace back to data—not a black box.</p></article></div></div></section>
}

function StageVisual({ active }: { active: number }) {
  const step = steps[active]
  return <div className={`stage-visual stage-${step.color}`} aria-live="polite"><div className="stage-top"><span>AFRISCORE / SYSTEM MAP</span><span>{step.number} — 04</span></div><div className="stage-diagram"><div className="diagram-source"><span>INPUT LAYER</span><div className="source-pill">M-PESA*</div><div className="source-pill">BANK*</div><div className="source-pill">INVOICE</div></div><div className="diagram-path"><i /><i /><i /></div><div className="diagram-engine"><div className="engine-orbit" /><strong>{['⌁', '≋', '◈', '↗'][active]}</strong><span>{step.label.toUpperCase()}</span></div><div className="diagram-path"><i /><i /><i /></div><div className="diagram-output"><span>OUTPUT LAYER</span><div className="output-card"><small>TRUSTED SIGNAL</small><strong>{['Ready to ingest', 'One record model', 'Access granted', 'Useful insight'][active]}</strong><div className="output-bars"><i /><i /><i /><i /><i /></div></div></div></div><div className="stage-foot"><span>{step.note}</span><span>* SYNTHETIC PROVIDER-SHAPED DATA TODAY</span></div></div>
}

function Story() {
  const [active, setActive] = useState(0)
  const nodes = useRef<(HTMLElement | null)[]>([])
  useEffect(() => {
    const update = () => {
      if (window.innerWidth <= 900) return
      const target = window.innerHeight * .48
      let best = 0, distance = Infinity
      nodes.current.forEach((node, index) => { if (!node) return; const rect = node.getBoundingClientRect(); const d = Math.abs(rect.top + rect.height / 2 - target); if (d < distance) { best = index; distance = d } })
      setActive(best)
    }
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  return <section id="how-it-works" className="story section-pad"><div className="container"><div className="section-line"><span>02 / HOW IT WORKS</span><span>FROM FRAGMENTED ACTIVITY TO USEFUL INFRASTRUCTURE</span></div><div className="story-heading"><h2 data-reveal>A clearer picture,<br /><em>one layer at a time.</em></h2><p data-reveal>Follow the path from an authorized source to an actionable signal. The story moves as you scroll; choose a stage to explore it directly.</p></div><div className="story-grid"><div className="stage-sticky"><StageVisual active={active} /><div className="stage-dots" aria-label="Select a platform stage">{steps.map((step, i) => <button key={step.number} aria-label={`Show ${step.label} stage`} aria-pressed={active === i} onClick={() => setActive(i)} />)}</div></div><div className="story-steps">{steps.map((step, i) => <article key={step.number} ref={el => { nodes.current[i] = el }} className={`story-step ${active === i ? 'active' : ''}`} onClick={() => setActive(i)}><span>{step.number} / {step.label.toUpperCase()}</span><h3>{step.title}</h3><p>{step.body}</p><small>{step.note} <b>↗</b></small></article>)}</div></div></div></section>
}

function Capabilities() {
  return <section className="capabilities section-pad"><div className="container"><div className="section-line"><span>03 / CAPABILITIES</span><span>A FOUNDATION THAT EARNS ITS PLACE</span></div><div className="cap-heading"><h2 data-reveal>Real building blocks.<br /><em>Not another data dump.</em></h2><p data-reveal>AfriScore combines practical primitives that work together: data ingestion, identity and consent, explainable analysis, and tools for builders.</p></div><div className="cap-grid"><article className="cap-large" data-reveal><div className="cap-number">01 / FINANCIAL ACTIVITY</div><div className="transaction-card"><div><span>MONDAY, 09:41</span><b>+ KES 24,500</b></div><div><span>TUESDAY, 12:18</span><b>− KES 8,200</b></div><div><span>WEDNESDAY, 16:02</span><b>+ KES 18,600</b></div><div className="transaction-base"><span>3 normalized events</span><span>1 consistent model ↗</span></div></div><h3>One way to read financial activity.</h3><p>Provider-shaped events become structured records, with deduplication and source context preserved.</p></article><article data-reveal><div className="cap-number">02 / TRUST & CONSENT</div><div className="consent-art"><div className="consent-lock">◈</div><div className="consent-path"><i /><i /><i /></div><span>SPECIFIC • REVOCABLE • AUDITABLE</span></div><h3>Permission is part of the product.</h3><p>Scope-specific grants and a verifiable event chain keep access and changes visible.</p></article><article data-reveal><div className="cap-number">03 / BUSINESS INTELLIGENCE</div><div className="chart-art"><div className="chart-line"><i /><i /><i /><i /><i /><i /></div><span>REVENUE SIGNAL / EXPLAINED</span></div><h3>Insight with a paper trail.</h3><p>Financial profiles, cash-flow indicators and invoice reconciliation grounded in real records.</p></article></div></div></section>
}

function UseCases() {
  const [selected, setSelected] = useState(0)
  return <section id="use-cases" className="use-cases section-pad"><div className="container"><div className="section-line"><span>04 / WHO IT'S FOR</span><span>BUILT TO ENABLE OTHER BUILDERS</span></div><div className="use-heading"><h2 data-reveal>One foundation.<br /><em>Many directions.</em></h2><p data-reveal>Infrastructure matters most when it makes the next product possible.</p></div><div className="use-layout"><div className="use-nav" role="tablist" aria-label="Use cases">{cases.map((item, i) => <button key={item.mark} role="tab" id={`case-tab-${i}`} aria-controls="case-panel" aria-selected={i === selected} onClick={() => setSelected(i)}><small>{item.mark}</small>{item.name}<span aria-hidden="true">↗</span></button>)}</div><div className="use-panel" role="tabpanel" id="case-panel" aria-labelledby={`case-tab-${selected}`} key={selected}><div className="use-orbit"><span>{cases[selected].mark}</span></div><div className="use-panel-copy"><span>USE CASE / {cases[selected].mark}</span><h3>{cases[selected].title}</h3><p>{cases[selected].text}</p><a className="inline-link" href="#developers">Explore the developer layer <span>↗</span></a></div></div></div></div></section>
}

function Developers() {
  const [copied, setCopied] = useState(false)
  const command = `curl -H "x-api-key: <your-key>" http://localhost:4000/v1/businesses/<id>/financial-profile`
  async function copy() { try { await navigator.clipboard.writeText(command); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) } }
  return <section id="developers" className="developers section-pad"><div className="container"><div className="section-line"><span>05 / FOR DEVELOPERS</span><span>AN API TO BUILD WITH</span></div><div className="dev-grid"><div className="dev-copy"><div className="eyebrow"><i /> BUILD WITH CONTEXT</div><h2 data-reveal>From first request<br /><em>to real utility.</em></h2><p data-reveal>Explore a documented REST API, synthetic sandbox scenarios, scoped consent and signed webhooks. The public repository includes the OpenAPI specification and runnable tests.</p><div className="dev-links"><Button href={repo}>Explore on GitHub</Button><a href={`${repo}/blob/main/openapi.json`} target="_blank" rel="noreferrer">View OpenAPI specification ↗</a></div></div><div className="code-window" data-reveal><div className="code-head"><span><i /><i /><i /></span><span>API / QUICK LOOK</span><span>REST · JSON</span></div><div className="code-tabs"><span>01 / REQUEST</span><span>02 / CONSENT</span><span>03 / RESPONSE</span></div><pre><code><span className="code-comment">// A consent-scoped financial profile</span>{'\n'}<span className="code-method">GET</span> /v1/businesses/:id/financial-profile{'\n'}<span className="code-key">x-api-key</span>: ak_••••••••••••••••{'\n\n'}<span className="code-comment">// Only with active financial_profile consent</span>{'\n'}{'{'}{'\n'}  <span className="code-key">"total_revenue"</span>: 854000,{'\n'}  <span className="code-key">"transaction_count"</span>: 128,{'\n'}  <span className="code-key">"currency"</span>: <span className="code-string">"KES"</span>{'\n'}{'}'}</code></pre><button className="copy-button" onClick={copy}>{copied ? 'Copied example request ✓' : 'Copy example request ↗'}</button><div className="code-foot">Illustrative response • sandbox values only</div></div></div><div className="dev-rail"><div><strong>01</strong><span>Synthetic sandbox</span><p>Test success, failure, duplicate and mixed transaction scenarios.</p></div><div><strong>02</strong><span>Purpose-specific consent</span><p>Keep application identity separate from a business's permission.</p></div><div><strong>03</strong><span>Signed event delivery</span><p>Receive webhook events with per-subscription signing secrets.</p></div></div></div></section>
}

function Status() {
  return <section className="status-section section-pad"><div className="container"><div className="section-line"><span>06 / WHERE WE ARE</span><span>BUILDING IN THE OPEN</span></div><div className="status-grid"><div><h2 data-reveal>Useful today.<br /><em>Honest about tomorrow.</em></h2><p data-reveal>AfriScore is a working platform foundation and a place to prototype with synthetic data. Live integrations with payment providers, banks and public registries depend on partner access, credentials, compliance and production deployment. We do not present simulated feeds as live connections.</p></div><div className="status-list"><div><i className="done">✓</i><span><strong>Working foundation</strong><small>API, normalization, consent, reconciliation, trust ledger, insights and sandbox</small></span></div><div><i className="progress">↗</i><span><strong>Next production milestones</strong><small>Institutional connectors, partner onboarding, operational monitoring and security review</small></span></div><div><i className="future">○</i><span><strong>Longer-term ambition</strong><small>A trusted, programmable infrastructure layer for many African markets</small></span></div></div></div></div></section>
}

function Footer() {
  return <><section className="final-section"><div className="container final-inner"><span>AFRISCORE / BY SEVQO</span><h2>See the full picture.<br /><em>Build what comes next.</em></h2><p>Good infrastructure makes possibility practical. Start with the API, explore the sandbox, and help shape a better foundation for African business.</p><div><Button href={repo} light>Explore the project</Button><a href="https://github.com/Sevqo/sevqo" target="_blank" rel="noreferrer">Meet Sevqo ↗</a></div><div className="final-rings" /></div></section><footer className="footer"><div className="container"><div className="footer-grid"><div><Brand /><p>Programmable infrastructure for clearer business decisions.</p></div><div><span>EXPLORE</span><a href="#platform">Platform</a><a href="#how-it-works">How it works</a><a href="#use-cases">Use cases</a></div><div><span>BUILD</span><a href={repo} target="_blank" rel="noreferrer">GitHub repository</a><a href={`${repo}/blob/main/openapi.json`} target="_blank" rel="noreferrer">OpenAPI</a><a href="#developers">Developer layer</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} AFRISCORE, A SEVQO VENTURE</span><span>BUILT FOR AFRICAN BUSINESS ↗</span></div></div></footer></>
}

export function App() {
  useReveal()
  return <><a className="skip" href="#platform">Skip to content</a><Header /><main><Hero /><div className="ticker" aria-hidden="true"><div>CLARITY IN THE COMPLEXITY <b>✳</b> CONSENT BY DESIGN <b>✳</b> BUSINESS DATA, MADE USEFUL <b>✳</b> CLARITY IN THE COMPLEXITY <b>✳</b> CONSENT BY DESIGN <b>✳</b> BUSINESS DATA, MADE USEFUL <b>✳</b></div></div><Manifesto /><Story /><Capabilities /><UseCases /><Developers /><Status /><Footer /></main></>
}
