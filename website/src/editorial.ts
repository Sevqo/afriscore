import type { Media } from './components/Media';
const illustration = (name: string, alt: string): Media => ({
  kind: 'svg',
  src: '/media/editorial/' + name + '.svg',
  alt,
  aspectRatio: '10 / 7',
  fit: 'contain',
  transparent: true,
  animate: true,
});
export const editorial: Record<string, Media> = {
  business: illustration(
    'business',
    'An African business owner brings orders, invoices and payments together at a shop counter.',
  ),
  payments: illustration(
    'payments',
    'A customer and merchant use a phone, with a conceptual verified-payment indicator.',
  ),
  reconciliation: illustration(
    'reconciliation',
    'An owner pairs payment records with their matching invoices.',
  ),
  invoicing: illustration(
    'invoicing',
    'A contractor prepares an invoice and follows a payment timeline.',
  ),
  cashflow: illustration(
    'cashflow',
    'A business owner reviews money movement and upcoming obligations; no growth is guaranteed.',
  ),
  protection: illustration(
    'protected-payments',
    'A courier hands a parcel to a buyer inspecting delivery details, illustrating sandbox partner protection.',
  ),
  integrations: illustration(
    'integrations',
    'Business software, records, a shop and logistics connect through AfriCore.',
  ),
  automation: illustration(
    'automation',
    'A business owner works while reminders follow a controlled sequence.',
  ),
  developers: illustration(
    'developers',
    'A developer connects API blocks to business workflows from a laptop.',
  ),
  education: illustration(
    'education',
    'Two colleagues discuss a financial report and its meaning.',
  ),
};
export const publicPageMedia: Record<string, Media> = {
  '/products/business': editorial.business,
  '/products/pay': editorial.payments,
  '/products/invoicing': editorial.invoicing,
  '/products/reconciliation': editorial.reconciliation,
  '/products/cash-flow': editorial.cashflow,
  '/products/connect': editorial.integrations,
  '/products/data': editorial.education,
  '/products/intelligence': editorial.cashflow,
  '/products/automations': editorial.automation,
  '/products/protected-payments': editorial.protection,
  '/solutions/social-commerce': editorial.payments,
  '/solutions/smes': editorial.business,
  '/solutions/contractors': editorial.invoicing,
  '/solutions/fintechs': editorial.developers,
  '/support': editorial.education,
};

Object.assign(publicPageMedia, {
  '/products/business-passport': illustration(
    'passport',
    'An African business owner presents a private business passport.',
  ),
  '/products/business-verification': illustration(
    'credibility',
    'A business owner maintains an evidence-backed commercial history.',
  ),
  '/products/trust-network': illustration(
    'trust-network',
    'Commercial counterparties review a relationship.',
  ),
  '/products/verifiable-credentials': illustration(
    'credential-issuance',
    'A reviewed issuer hands over a signed minimal credential.',
  ),
  '/products/blockchain-verification': illustration(
    'anchoring',
    'Private document commitments join a common root without exposing records.',
  ),
  '/products/verification-api': illustration(
    'verification',
    'A verifier inspects a signed business credential.',
  ),
  '/products/passport-privacy': illustration(
    'privacy',
    'A business owner chooses which records to disclose.',
  ),
});
