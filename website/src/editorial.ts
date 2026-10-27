import type { Media } from "./components/Media";
const illustration = (name: string, alt: string): Media => ({
  kind: "svg",
  src: "/media/editorial/" + name + ".svg",
  alt,
  aspectRatio: "10 / 7",
  fit: "contain",
  transparent: true,
  animate: true,
});
export const editorial: Record<string, Media> = {
  business: illustration(
    "business",
    "An African business owner brings orders, invoices and payments together at a shop counter.",
  ),
  payments: illustration(
    "payments",
    "A customer and merchant use a phone, with a conceptual verified-payment indicator.",
  ),
  reconciliation: illustration(
    "reconciliation",
    "An invoice for KSh 2,500, a receipt of KSh 1,500 and the KSh 1,000 remainder.",
  ),
  invoicing: illustration(
    "invoicing",
    "A contractor prepares an invoice and follows a payment timeline.",
  ),
  cashflow: illustration(
    "cashflow",
    "Recorded inflows, recorded outflows and net movement are distinct stages.",
  ),
  protection: illustration(
    "protected-payments",
    "Agreement and confirmation lead to delivery inspection and a reviewed outcome in sandbox.",
  ),
  integrations: illustration(
    "integrations",
    "Permitted source records pass through import review into structured records.",
  ),
  automation: illustration(
    "automation",
    "A trigger leads to a condition check and a supported in-app follow-up.",
  ),
  developers: illustration(
    "developers",
    "A scoped request is validated before updating an external system.",
  ),
  education: illustration(
    "education",
    "Understand the terms, inspect records and choose a next step.",
  ),
};
export const publicPageMedia: Record<string, Media> = {
  "/products/business": editorial.business,
  "/products/pay": editorial.payments,
  "/products/invoicing": editorial.invoicing,
  "/products/reconciliation": editorial.reconciliation,
  "/products/cash-flow": editorial.cashflow,
  "/products/connect": editorial.integrations,
  "/products/data": editorial.education,
  "/products/intelligence": editorial.cashflow,
  "/products/automations": editorial.automation,
  "/products/protected-payments": editorial.protection,
  "/solutions/social-commerce": editorial.payments,
  "/solutions/smes": editorial.business,
  "/solutions/contractors": editorial.invoicing,
  "/solutions/fintechs": editorial.developers,
  "/support": editorial.education,
};

Object.assign(publicPageMedia, {
  "/products/business-passport": illustration(
    "passport",
    "An African business owner presents a private business passport.",
  ),
  "/products/business-verification": illustration(
    "credibility",
    "Self-reported, document-reviewed and source-assured information are distinct evidence levels.",
  ),
  "/products/trust-network": illustration(
    "trust-network",
    "Commercial counterparties review a relationship.",
  ),
  "/products/verifiable-credentials": illustration(
    "credential-issuance",
    "An issuer reviews a claim, a holder receives it and a verifier checks it.",
  ),
  "/products/blockchain-verification": illustration(
    "anchoring",
    "Private document commitments join a common root without exposing records.",
  ),
  "/products/verification-api": illustration(
    "verification",
    "A verifier inspects a signed business credential.",
  ),
  "/products/passport-privacy": illustration(
    "privacy",
    "Name the recipient, select minimal claims and inspect expiry and access history.",
  ),
});

const human = (name: string, alt: string): Media => ({
  kind: "image",
  src: "/media/editorial-v2/" + name + ".webp",
  alt,
  aspectRatio: "3 / 2",
  fit: "cover",
  animate: false,
});
editorial.business = human(
  "growing-business",
  "Two business owners review invoices and customer records together at a desk.",
);
editorial.payments = human(
  "social-commerce",
  "A shop owner shares a checkout with a buyer; a parcel and matching invoice connect the sale.",
);
editorial.invoicing = human(
  "contractors",
  "A supplier and contractor review a delivery note and invoice beside supplied goods.",
);
editorial.onboarding = illustration(
  "onboarding",
  "Open the demo, inspect one sale, then plan the business setup.",
);
editorial.receivables = illustration(
  "receivables",
  "Follow an amount owed through its due date to overdue review.",
);
editorial.empty = illustration(
  "empty-records",
  "Add a customer, create an order and follow its history.",
);
Object.assign(publicPageMedia, {
  "/products/business": editorial.business,
  "/products/pay": editorial.payments,
  "/products/invoicing": editorial.invoicing,
  "/solutions/social-commerce": editorial.payments,
  "/solutions/smes": editorial.business,
  "/solutions/contractors": editorial.invoicing,
  "/products/business-passport": human(
    "business-passport",
    "A business owner chooses one document to share while keeping other records private.",
  ),
});

editorial.developers = human(
  "developer",
  "Conceptual illustration: a developer connects permitted business records through an API workflow.",
);
editorial.cashflow = human(
  "financial-review",
  "Conceptual illustration: two business owners compare due invoices and recorded expenses.",
);
editorial.protection = human(
  "protected-delivery",
  "Conceptual illustration: a buyer inspects goods with a courier and reviews a delivery note.",
);
Object.assign(publicPageMedia, {
  "/developers": editorial.developers,
  "/solutions/fintechs": editorial.developers,
  "/products/cash-flow": editorial.cashflow,
  "/products/intelligence": editorial.cashflow,
  "/products/protected-payments": editorial.protection,
});

const scene = (name:string,alt:string): Media => ({kind:'image',src:'/media/editorial-v3/'+name+'.webp',alt,aspectRatio:'3 / 2',fit:'cover',animate:false});
editorial.personal = scene('personal-planning','An independent professional organizes invoice slips at her studio desk.');
editorial.automation = scene('automation-follow-up','A shop owner checks a scheduled follow-up beside a packed order and calendar.');
editorial.reconciliation = scene('reconciliation-review','An accountant compares a receipt with an invoice, keeping unmatched papers separate.');
publicPageMedia['/products/automations'] = editorial.automation;
publicPageMedia['/products/reconciliation'] = editorial.reconciliation;
