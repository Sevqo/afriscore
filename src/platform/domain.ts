import { z } from 'zod';
export const currencySchema = z.enum([
  'KES',
  'USD',
  'EUR',
  'GBP',
  'UGX',
  'TZS',
  'RWF',
]);
export const itemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(100000),
  unit_price_minor: z.number().int().min(0).max(10000000000),
});
export const documentSchema = z.object({
  customer_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
  currency: currencySchema.default('KES'),
  items: z.array(itemSchema).min(1).max(100),
  discount_minor: z.number().int().min(0).default(0),
  tax_bps: z.number().int().min(0).max(10000).default(0),
  due_date: z.string().date(),
  issue_date: z.string().date(),
  notes: z.string().max(3000).default(''),
  terms: z.string().max(3000).default(''),
  payment_instructions: z.string().max(3000).default(''),
});
export function totals(doc: z.infer<typeof documentSchema>) {
  const subtotal_minor = doc.items.reduce(
    (s, i) => s + i.quantity * i.unit_price_minor,
    0,
  );
  if (
    !Number.isSafeInteger(subtotal_minor) ||
    doc.discount_minor > subtotal_minor
  )
    throw Object.assign(new Error('Invalid total or discount'), {
      status: 400,
    });
  const tax_minor = Math.round(
    ((subtotal_minor - doc.discount_minor) * doc.tax_bps) / 10000,
  );
  const total_minor = subtotal_minor - doc.discount_minor + tax_minor;
  if (
    !Number.isSafeInteger(total_minor) ||
    total_minor <= 0 ||
    total_minor > 100000000000
  )
    throw Object.assign(new Error('Invalid total'), { status: 400 });
  if (doc.due_date < doc.issue_date)
    throw Object.assign(new Error('Due date precedes issue date'), {
      status: 400,
    });
  return { subtotal_minor, tax_minor, total_minor };
}
export const roles = [
  'owner',
  'admin',
  'finance',
  'operations',
  'viewer',
] as const;
export function permitted(role: string, capability: string) {
  if (role === 'owner' || role === 'admin') return true;
  if (capability === 'read') return roles.includes(role as any);
  if (capability === 'finance') return role === 'finance';
  if (capability === 'operations')
    return role === 'operations' || role === 'finance';
  return false;
}
