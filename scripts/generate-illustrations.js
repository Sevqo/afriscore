// Original editable AfriCore process illustrations. Human artwork is maintained separately in editorial-v2.
const fs = require('node:fs');
const scenes = {
  business: ['Customer & order', 'Invoice & request', 'Confirmed record'],
  payments: ['Create request', 'Provider confirms', 'Order updated'],
  reconciliation: [
    'Invoice: KSh 2,500',
    'Receipt: KSh 1,500',
    'Balance: KSh 1,000',
  ],
  invoicing: ['Issue invoice', 'Track due date', 'Review balance'],
  cashflow: ['Recorded inflows', 'Recorded outflows', 'Net movement'],
  'protected-payments': [
    'Agree & confirm',
    'Deliver & inspect',
    'Review outcome',
  ],
  integrations: ['Permitted source', 'Inspect import', 'Structured record'],
  automation: ['Trigger', 'Check condition', 'In-app follow-up'],
  developers: ['Scoped request', 'Validate event', 'Update your system'],
  education: ['Understand terms', 'Inspect records', 'Choose next step'],
  passport: ['Business identity', 'Signed claim', 'Selected disclosure'],
  'credential-issuance': [
    'Issuer reviews',
    'Holder receives',
    'Verifier checks',
  ],
  'trust-network': ['Name relationship', 'Ask counterparty', 'Review evidence'],
  privacy: ['Named recipient', 'Minimal claims', 'Expiry & history'],
  verification: ['Signature & status', 'Issuer policy', 'Evidence quality'],
  anchoring: ['Private records', 'Batch commitment', 'Inclusion proof'],
  credibility: ['Self-reported', 'Document review', 'Source assurance'],
  'social-commerce': [
    'Record chat order',
    'Share payment link',
    'Inspect confirmation',
  ],
  contractors: ['Delivery evidence', 'Invoice on terms', 'Follow receivable'],
  onboarding: ['Open demo', 'Inspect one sale', 'Plan your setup'],
  'empty-records': ['Add a customer', 'Create an order', 'Follow its history'],
  receivables: ['Amount owed', 'Due date', 'Overdue review'],
  'cash-timing': ['Receipt expected', 'Expense due', 'Timing matters'],
  'selective-sharing': [
    'Choose claim',
    'Exclude private data',
    'Preview recipient',
  ],
};
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
function glyph(name, i) {
  const common =
    'fill="none" stroke="#242424" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  let d = 'M76 82h82v108H76zM94 107h46M94 129h35M94 151h42';
  if (/cash|receivable/.test(name))
    d =
      i === 0
        ? 'M117 77v78m-25-25 25 25 25-25M72 171v20h90v-20'
        : i === 1
          ? 'M117 155V77m-25 25 25-25 25 25M72 171v20h90v-20'
          : 'M72 80v111h94M88 164l23-35 20 12 30-43';
  else if (/privacy|sharing/.test(name))
    d =
      i === 0
        ? 'M87 126v-21a30 30 0 0 1 60 0v21M78 126h78v65H78zM117 148v20'
        : i === 1
          ? 'M72 88h90v30H72zM72 137h90v30H72zM84 103l7 7 14-16'
          : 'M80 100h67v85H80zM95 85h67v85M95 124h36M95 145h27';
  else if (/trust-network|integrations/.test(name))
    d =
      'M117 85v45m0 0-42 45m42-45 42 45M100 72h34v28h-34zM58 174h34v28H58zM142 174h34v28h-34z';
  else if (/passport|credibility/.test(name) && i === 0)
    d =
      'M65 85h104v100H65zM87 113a12 12 0 1 0 24 0 12 12 0 1 0-24 0M80 165q18-40 38 0M131 111h22M131 132h22M131 153h17';
  else if (/credential|verification|anchoring/.test(name) && i > 0)
    d =
      i === 1
        ? 'm117 75 43 17v43q0 38-43 62-43-24-43-62V92zM95 132l16 16 29-37'
        : 'M76 83h82v110H76zM94 106h46M94 128h34M96 163l16 16 29-37';
  else if (/developers|automation/.test(name))
    d =
      i === 0
        ? 'm97 94-30 40 30 39m40-79 30 40-30 39M127 86l-20 96'
        : i === 1
          ? 'M75 97h84v76H75zM90 115h51M90 136h35M143 152l10 10 18-26'
          : 'M68 83h98v80H68zM101 163v24M82 187h70M83 105h60M83 124h42';
  else if (/payments|social-commerce/.test(name) && i === 0)
    d = 'M88 76h60v123H88zM101 88h34M101 176h34M100 113h36v43h-36z';
  return (
    '<g ' +
    common +
    '><path d="' +
    d +
    '"/><path d="m166 202 8 8 16-21" stroke="#426900"/></g>'
  );
}
for (const [name, steps] of Object.entries(scenes)) {
  const cards = steps
    .map((label, i) => {
      const x = 28 + i * 255;
      return (
        '<g transform="translate(' +
        x +
        ' 115)"><rect width="234" height="300" rx="8" fill="white" stroke="#d1d1d1"/><text x="22" y="38" fill="#666" font-size="16">0' +
        (i + 1) +
        '</text>' +
        glyph(name, i) +
        '<text x="117" y="239" text-anchor="middle" fill="#111" font-size="18" font-weight="700">' +
        esc(label) +
        '</text><text x="117" y="269" text-anchor="middle" fill="#666" font-size="13">' +
        ['Input / context', 'Action / evidence', 'Result / review'][i] +
        '</text></g>'
      );
    })
    .join('');
  fs.writeFileSync(
    'website/public/media/editorial/' + name + '.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" font-family="Arial,sans-serif"><title>' +
      esc(steps.join(' → ')) +
      '</title><desc>Original conceptual process visual; not a live transaction or universal assurance claim.</desc><rect width="800" height="500" fill="#f7f7f7"/><text x="28" y="66" font-size="16" fill="#666">AFRICORE · FOLLOW THE WORKFLOW</text>' +
      cards +
      '<text x="28" y="467" font-size="13" fill="#666">Illustrative sequence · Check source, permissions and availability</text></svg>',
  );
}
console.log(
  'Generated ' +
    Object.keys(scenes).length +
    ' original process illustrations.',
);
