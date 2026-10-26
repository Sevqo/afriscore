export const groups: Record<string, [string, string][]> = {
  Products: [
    ['AfriCore Business', '/products/business'],
    ['Business Passport · Beta', '/products/business-passport'],
    ['Trust Network', '/products/trust-network'],
    ['Verifiable Credentials', '/products/verifiable-credentials'],
    ['Blockchain Verification', '/products/blockchain-verification'],
    ['Business Verification', '/products/business-verification'],
    ['Passport Privacy', '/products/passport-privacy'],
    ['AfriCore Pay', '/products/pay'],
    ['Invoicing & receivables', '/products/invoicing'],
    ['Payment reconciliation', '/products/reconciliation'],
    ['Cash flow & reporting', '/products/cash-flow'],
    ['AfriCore Connect', '/products/connect'],
    ['AfriCore Data', '/products/data'],
    ['AfriCore Intelligence', '/products/intelligence'],
    ['Business automations', '/products/automations'],
    ['Protected Payments · Sandbox', '/products/protected-payments'],
  ],
  Solutions: [
    ['Social commerce', '/solutions/social-commerce'],
    ['SMEs', '/solutions/smes'],
    ['Contractors & suppliers', '/solutions/contractors'],
    ['Fintechs & SaaS', '/solutions/fintechs'],
  ],
  Developers: [
    ['Developer platform', '/developers'],
    ['Verify a credential', '/verify-credential'],
    ['Verification APIs', '/products/verification-api'],
    ['Interactive demo', '/demo'],
    ['API documentation', '/docs'],
    ['API sandbox', '/sandbox'],
  ],
  Resources: [
    ['AfriCore Learn', '/learn'],
    ['Financial glossary', '/learn/glossary'],
    ['Help & support', '/support'],
    ['Security & trust', '/security'],
    ['Pricing', '/pricing'],
  ],
  Company: [
    ['About AfriCore', '/about'],
    ['Contact', '/contact'],
  ],
};

export const productSections = [
  {
    title: 'Run your business',
    paths: [
      '/products/business',
      '/products/pay',
      '/products/invoicing',
      '/products/reconciliation',
      '/products/cash-flow',
    ],
  },
  {
    title: 'Understand & connect',
    paths: [
      '/products/intelligence',
      '/products/automations',
      '/products/connect',
      '/products/data',
      '/products/protected-payments',
    ],
  },
  {
    title: 'Build business trust',
    paths: [
      '/products/business-passport',
      '/products/trust-network',
      '/products/verifiable-credentials',
      '/products/blockchain-verification',
      '/products/business-verification',
      '/products/passport-privacy',
    ],
  },
];
