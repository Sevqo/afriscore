import type { Media } from './components/Media';
export const media: Record<string, Media> = {
  hero: {
    kind: 'svg',
    src: '/media/connected-platform.svg',
    alt: 'Business activity, invoices, payments and financial intelligence connected through AfriCore',
    aspectRatio: '1 / 1',
    eager: true,
  },
  workspace: {
    kind: 'screenshot',
    src: '/media/workspace.svg',
    alt: 'Illustrative AfriCore workspace with example sandbox figures',
    aspectRatio: '24 / 17',
    background: '#eef2ef',
  },
  reconciliation: {
    kind: 'svg',
    src: '/media/reconciliation.svg',
    alt: 'An invoice and verified payment join into a reconciled record',
    aspectRatio: '10 / 7',
    transparent: true,
  },
};
export const pages: Record<
  string,
  {
    category: string;
    title: string;
    description: string;
    points: string[];
    availability?: string;
  }
> = {
  '/products/business': {
    category: 'AfriCore Business',
    title: 'Less administration. More business.',
    description:
      'Bring customers, orders, invoices and incoming payments into one workspace built for how African businesses operate.',
    points: [
      'Create your business and invite a team with defined permissions.',
      'Track customer relationships, orders and receivables.',
      'Understand verified collections without confusing them with bank balances.',
    ],
  },
  '/products/pay': {
    category: 'AfriCore Pay',
    title: 'From payment request to verified record.',
    description:
      'Generate a hosted checkout from an issued invoice or order. Test collection, confirmation and reconciliation in an isolated sandbox.',
    points: [
      'Opaque, expiring checkout links.',
      'Deterministic success, failure and delayed payment scenarios.',
      'Provider-confirmed events and auditable allocations.',
    ],
    availability: 'Sandbox available. Live M-Pesa collection is not enabled.',
  },
  '/products/invoicing': {
    category: 'Invoicing & receivables',
    title: 'Know what is owed. And what comes next.',
    description:
      'Create itemized invoices, define tax and discounts, track partial payments and export receivables.',
    points: [
      'Draft and issue invoices with explicit state transitions.',
      'Print or save invoices as PDF from your browser.',
      'Track aging in the currency of the invoice.',
    ],
    availability:
      'Ordinary commercial invoices; not KRA-validated eTIMS invoices.',
  },
  '/products/reconciliation': {
    category: 'Payment reconciliation',
    title: 'Every payment needs a clear destination.',
    description:
      'Match trusted provider transactions by payment request reference. Route mismatches and reversals to a review queue.',
    points: [
      'Duplicate events do not allocate money twice.',
      'Currency and amount mismatches require review.',
      'Preserve the original event and every adjustment.',
    ],
  },
  '/products/cash-flow': {
    category: 'Cash flow & reporting',
    title: 'Clarity you can act on.',
    description:
      'See confirmed inflows, recorded outflows and outstanding receivables with transparent definitions.',
    points: [
      'Separate receivables from received payments.',
      'View invoice aging and filter reports by date and currency.',
      'Export CSV records for your own analysis.',
    ],
    availability:
      'Reports reflect available records; they are not complete profit statements or bank balances.',
  },
  '/products/connect': {
    category: 'AfriCore Connect',
    title: 'Connect the systems behind your business.',
    description:
      'A common integration framework for imported records, sandbox transactions and AfriCore Pay.',
    points: [
      'Import transaction CSV files with source identifiers.',
      'Deduplicate imports and preserve provenance.',
      'Prepare for future authorized bank, accounting and tax connectors.',
    ],
    availability:
      'CSV and sandbox sources available. Institutional connectors are not live.',
  },
  '/products/data': {
    category: 'AfriCore Data',
    title: 'A consistent language for business.',
    description:
      'Normalize customers, invoices, transactions and financial events into an organization-owned, versioned data model.',
    points: [
      'Retain source references and timestamps.',
      'Keep sandbox and production records separate.',
      'Build on the same services used by AfriCore Business.',
    ],
  },
  '/developers': {
    category: 'AfriCore Developers',
    title: 'Infrastructure you can build on.',
    description:
      'Scoped credentials, predictable APIs and signed events. Start in sandbox and build around explicit financial states.',
    points: [
      'Create an application inside your business workspace.',
      'Generate scoped credentials shown once and stored as hashes.',
      'Register HTTPS webhooks and inspect delivery attempts.',
    ],
  },
  '/sandbox': {
    category: 'API sandbox',
    title: 'Test the difficult cases before they matter.',
    description:
      'Exercise payment success, failure, delays, duplicate delivery and partial collection without moving funds.',
    points: [
      'Start with a sandbox organization and an invoice.',
      'Create a checkout and choose a deterministic test scenario.',
      'Inspect allocations, reconciliation and webhook deliveries.',
    ],
    availability: 'All sandbox activity is simulated. No real funds move.',
  },
  '/solutions/social-commerce': {
    category: 'Social commerce',
    title: 'Turn a conversation into a clear transaction.',
    description:
      'Create an order from a customer conversation and share a checkout link with a reliable reference.',
    points: [
      'Keep customer contacts in one place.',
      'Share a hosted payment request.',
      'Track payment and fulfillment separately.',
    ],
  },
  '/solutions/smes': {
    category: 'Small & medium businesses',
    title: 'A clearer view of your working day.',
    description:
      'Move from scattered records to connected business operations.',
    points: [
      'One workspace for your team.',
      'Invoices and customer histories.',
      'Visible receivables and incoming collections.',
    ],
  },
  '/solutions/contractors': {
    category: 'Contractors & suppliers',
    title: 'Keep delivery and payment in view.',
    description:
      'Track itemized orders, invoice customers and monitor overdue receivables.',
    points: [
      'Record scope, quantities and prices.',
      'Separate fulfillment from provider payment confirmation.',
      'Export aging reports for follow-up.',
    ],
  },
  '/solutions/fintechs': {
    category: 'Fintechs & SaaS',
    title: 'Build on shared business infrastructure.',
    description:
      'Integrate through scoped APIs and reliable events instead of duplicating merchant workflows.',
    points: [
      'Environment-specific applications and credentials.',
      'Consistent API error envelopes.',
      'Signed delivery with durable retry history.',
    ],
  },
  '/security': {
    category: 'Security & trust',
    title: 'Trust starts with explicit boundaries.',
    description:
      'Organization authorization, restricted credentials and auditable financial state changes are core platform concerns.',
    points: [
      'Server-side membership and role checks.',
      'Hashed sessions and API keys; encrypted webhook signing secrets.',
      'No claim of regulatory approval, custody or live institutional access.',
    ],
  },
  '/about': {
    category: 'About AfriCore',
    title: 'Built around the realities of African business.',
    description:
      'Our mission is to make fragmented business and financial systems work together, starting in Kenya.',
    points: [
      'Business tools and developer infrastructure share one foundation.',
      'Kenya first, with explicit currency and country data.',
      'Financing and protected payments remain future capabilities.',
    ],
  },
  '/contact': {
    category: 'Contact',
    title: 'Let’s understand your business.',
    description:
      'AfriCore is preparing for controlled SME sandbox pilots. Contact details will be published when a support channel is staffed.',
    points: [
      'Pilot access: create a sandbox workspace.',
      'Integration questions: review the API documentation.',
      'Support channel: not yet published. Do not send personal or financial information through unverified channels.',
    ],
  },
  '/support': {
    category: 'Help & support',
    title: 'A clear place to start.',
    description: 'Use the sandbox to learn the complete workflow safely.',
    points: [
      'Create a workspace, then add a customer and order.',
      'Issue an invoice before generating checkout.',
      'Use reconciliation to inspect payment exceptions. For operational assistance, use the deployment runbooks.',
    ],
  },
  '/pricing': {
    category: 'Pricing',
    title: 'Start with understanding. Scale with confidence.',
    description:
      'Commercial pricing has not been published. Sandbox use is for evaluation; no production service commitment is implied.',
    points: [
      'Business workspace: sandbox evaluation.',
      'Developer APIs: sandbox evaluation.',
      'Production pricing and service terms: to be agreed before launch.',
    ],
  },
  '/privacy': {
    category: 'Privacy',
    title: 'Privacy notice — publication pending.',
    description:
      'Legally reviewed privacy terms are not yet available. This evaluation platform must not be used for sensitive production information.',
    points: [
      'Evaluation data is stored in the configured deployment database.',
      'Operators must establish retention, deletion, lawful processing and contact procedures before a real-data pilot.',
      'This page is a publication status notice, not legally reviewed policy text.',
    ],
  },
  '/terms': {
    category: 'Terms',
    title: 'Service terms — legal review pending.',
    description:
      'Production service terms have not been published. Current capabilities are intended for controlled sandbox evaluation.',
    points: [
      'Sandbox transactions do not move funds.',
      'Live payment access depends on provider agreements and testing.',
      'Financing, protected payments and regulatory authorization are not offered or represented as available.',
    ],
  },
};
// QA replacement switch: same FeatureSection, different centralized media descriptor.
if (new URLSearchParams(window.location.search).get('media-test') === 'svg') {
  media.workspace = {
    ...media.reconciliation,
    aspectRatio: '24 / 17',
    background: '#eef2ef',
  };
}
pages['/products/intelligence'] = {
  category: 'AfriCore Intelligence',
  title: 'Understand your records. Plan with context.',
  description:
    'See financial activity, data coverage, customer payment patterns and transparent scenario forecasts from your authorized records.',
  points: [
    'Forecast 7, 30, 60 or 90 days with explicit assumptions.',
    'Distinguish verified collections from merchant-recorded expenses.',
    'Ask the assistant to explain minimized evidence when its provider is configured.',
  ],
  availability:
    'Forecasts are estimates. AI explanations require configured API access and available provider credits.',
};
pages['/products/automations'] = {
  category: 'Business automations',
  title: 'Give routine reviews a reliable rhythm.',
  description:
    'Set up controlled triggers, conditions and in-app notifications for everyday business follow-up.',
  points: [
    'Choose from ten structured workflow templates.',
    'Inspect run history, retries and deduplicated triggers.',
    'Pause workflows and manage personal notification preferences.',
  ],
  availability:
    'In-app notifications are available. External email and messaging are not configured; no financial action is automated.',
};
pages['/products/protected-payments'] = {
  category: 'Protected Payments · Sandbox',
  title: 'Make each step visible.',
  description:
    'Test purchase agreements, partner payment evidence, delivery, buyer inspection and reviewed settlement through a realistic sandbox workflow.',
  points: [
    'Buyers use an opaque purchase link without a business workspace.',
    'Evidence retains seller, buyer and partner provenance.',
    'Disputes and releases require authorized review before the partner simulator confirms an outcome.',
  ],
  availability:
    'Sandbox only. AfriCore does not hold funds. Production protection requires an authorized partner, contracts, operational controls and regulatory review.',
};

const passportPages = [
  [
    'business-passport',
    'Business Passport',
    'Your business, represented with evidence.',
    'Create a private business identity, inspect signed credentials and choose exactly which minimal claims to share.',
  ],
  [
    'business-verification',
    'Business Verification',
    'Be precise about what was checked.',
    'Separate self-reported information, manual document review and independently verified sources.',
  ],
  [
    'trust-network',
    'Trust Network',
    'Commercial relationships, confirmed by choice.',
    'Request counterparty confirmation and review source provenance without inventing universal trust or credit scores.',
  ],
  [
    'verifiable-credentials',
    'Verifiable Credentials',
    'Signed claims you can inspect and export.',
    'Verify integrity, issuer authority, expiry and current status as separate checks.',
  ],
  [
    'blockchain-verification',
    'Blockchain Verification',
    'A shared root. Private records.',
    'Batch randomized credential commitments on a local EVM chain while keeping personal and financial records off-chain.',
  ],
  [
    'verification-api',
    'Developer Verification APIs',
    'Make verification a clear, bounded API.',
    'Build recipient-bound requests, signed presentations and independently checkable credential workflows.',
  ],
  [
    'passport-privacy',
    'Privacy and Security',
    'Share a specific proof for a specific purpose.',
    'Named-recipient authorization, expiring one-time access and transparent access history help keep disclosures deliberate.',
  ],
];
for (const [slug, category, title, description] of passportPages)
  pages['/products/' + slug] = {
    category: category + ' · Sandbox Beta',
    title,
    description,
    points: [
      'Inspect evidence assurance independently of signature validity.',
      'Use minimal signed claims and purpose-specific authorization.',
      'Explore with the database-free demo or run the local backend and EVM chain.',
    ],
    availability:
      'Sandbox beta. No institutional or government partners are claimed. Production signing, public testnet deployment and OpenID wallet conformance remain gated.',
  };
