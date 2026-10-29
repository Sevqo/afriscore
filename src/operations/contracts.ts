import { z } from 'zod';
import { currencySchema } from '../platform/domain';
export const minor = z.number().int().min(1).max(100000000000);
export const expenseSchema = z
  .object({
    description: z.string().trim().min(1).max(300),
    amount_minor: minor,
    currency: currencySchema.default('KES'),
    occurred_on: z.string().date(),
    category: z
      .enum(['stock', 'rent', 'payroll', 'utilities', 'delivery', 'other'])
      .default('other'),
    transaction_id: z.string().max(100).optional(),
    obligation_id: z.string().uuid().optional(),
    supersedes_id: z.string().uuid().optional(),
    supplier:z.string().max(200).default(''),notes:z.string().max(3000).default(''),
    status:z.enum(['recorded','archived']).default('recorded'),
  })
  .strict();
export const obligationSchema = z
  .object({
    description: z.string().trim().min(1).max(300),
    amount_minor: minor,
    currency: currencySchema.default('KES'),
    next_due_date: z.string().date(),
    recurrence: z.enum(['once', 'weekly', 'monthly', 'quarterly', 'yearly']),
    anchor_day:z.number().int().min(1).max(31).optional(),
    category:z.enum(['stock','rent','payroll','utilities','delivery','other']).default('other'),
    supplier:z.string().max(200).default(''),
    timezone:z.string().max(100).default('Africa/Nairobi').refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone'),
    reminder_days:z.number().int().min(0).max(30).default(3),
    status: z.enum(['active', 'paused', 'completed', 'cancelled']).default('active'),
  })
  .strict();
export const analyticsQuery = z.object({
  range:z.enum(['all']).optional(),
  currency: currencySchema.default('KES'),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export const forecastSchema = z
  .object({
    currency: currencySchema.default('KES'),
    horizon: z
      .union([z.literal(7), z.literal(30), z.literal(60), z.literal(90)])
      .default(30),
    scenario: z
      .enum(['expected', 'optimistic', 'conservative', 'custom'])
      .default('expected'),
    collection_bps: z.number().int().min(0).max(10000).optional(),
    delay_days: z.number().int().min(0).max(120).optional(),
    outflow_bps: z.number().int().min(0).max(30000).optional(),
  })
  .strict();
export const automationTemplates = [
 {id:'obligation_due',name:'Upcoming obligation reminder',trigger:'schedule',category:'cash_flow'},
 {id:'credential_expiry',name:'Credential expiry reminder',trigger:'schedule',category:'security'},
 {id:'integration_failed',name:'Failed integration notification',trigger:'integration.sync_failed',category:'integrations'},
  {
    id: 'invoice_due_soon',
    name: 'Invoice due soon',
    trigger: 'schedule',
    category: 'invoices',
  },
  {
    id: 'invoice_overdue',
    name: 'Overdue invoice reminder',
    trigger: 'schedule',
    category: 'invoices',
  },
  {
    id: 'payment_confirmation',
    name: 'Payment confirmation',
    trigger: 'payment.succeeded',
    category: 'payments',
  },
  {
    id: 'daily_summary',
    name: 'Daily transaction summary',
    trigger: 'schedule',
    category: 'payments',
  },
  {
    id: 'weekly_cashflow',
    name: 'Weekly cash-flow review',
    trigger: 'schedule',
    category: 'cash_flow',
  },
  {
    id: 'reconciliation_exception',
    name: 'Reconciliation exception alert',
    trigger: 'reconciliation.exception_created',
    category: 'reconciliation',
  },
  {
    id: 'customer_follow_up',
    name: 'Customer payment follow-up',
    trigger: 'schedule',
    category: 'invoices',
  },
  {
    id: 'order_fulfillment',
    name: 'Order fulfillment update',
    trigger: 'shipment.shipped',
    category: 'orders',
  },
  {
    id: 'delivery_follow_up',
    name: 'Delivery confirmation follow-up',
    trigger: 'shipment.delivered',
    category: 'deliveries',
  },
  {
    id: 'payment_failed',
    name: 'Failed payment alert',
    trigger: 'payment.failed',
    category: 'payments',
  },
] as const;
export const automationSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    template: z.enum(
      automationTemplates.map((t) => t.id) as [string, ...string[]],
    ),
    enabled: z.boolean().default(false),
    conditions: z
      .object({
        currency: z.string().length(3).default('KES'),
        minimum_minor: z.number().int().min(0).max(100000000000).default(0),
        days_before_due: z.number().int().min(0).max(30).default(3),
      })
      .default({ currency: 'KES', minimum_minor: 0, days_before_due: 3 }),
    schedule: z
      .object({
        frequency: z.enum(['daily', 'weekly']).default('daily'),
        hour: z.number().int().min(0).max(23).default(9),
        timezone:z.string().max(100).default('Africa/Nairobi').refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone'),
      })
      .default({ frequency: 'daily', hour: 9, timezone:'Africa/Nairobi' }),
    delay_minutes:z.number().int().min(0).max(10080).default(0),
    action: z.literal('in_app_notification').default('in_app_notification'),
  })
  .strict();
export const evidenceSchema = z
  .object({
    statement: z.string().trim().min(5).max(3000),
    filename: z
      .string()
      .max(120)
      .regex(/^[a-zA-Z0-9 ._-]+$/)
      .optional(),
    content_type: z
      .enum(['text/plain', 'image/png', 'image/jpeg', 'application/pdf'])
      .optional(),
    content_base64: z.string().max(350000).optional(),
  })
  .strict()
  .refine(
    (d) => !d.content_base64 || (!!d.filename && !!d.content_type),
    'File name and content type are required',
  );
export const shipmentSchema = z
  .object({
    order_id: z.string().uuid(),
    courier: z.enum(['manual', 'sandbox_courier']),
    tracking_reference: z.string().trim().min(2).max(150),
    items: z
      .array(
        z.object({
          item_index: z.number().int().min(0).max(99),
          quantity: z.number().int().positive().max(100000),
        }),
      )
      .min(1)
      .max(100),
    estimated_delivery: z.string().date(),
    protected_sale_id: z.string().uuid().optional(),
  })
  .strict();
export const saleSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().max(2000).default(''),
    amount_minor: minor,
    currency: currencySchema.default('KES'),
    order_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),
    delivery_terms: z.string().trim().min(10).max(2000),
    inspection_hours: z.number().int().min(1).max(168).default(48),
    cancellation_terms: z.string().min(10).max(2000),
    support_contact: z.string().min(5).max(200),
    buyer_access_days: z.number().int().min(1).max(30).default(14),
  })
  .strict();
export const disputeSchema = z
  .object({
    reason: z.enum([
      'not_delivered',
      'incorrect_item',
      'damaged_item',
      'missing_items',
      'delivery_disagreement',
      'payment_discrepancy',
      'contract_issue',
    ]),
    statement: z.string().trim().min(10).max(3000),
  })
  .strict();
export const assistantInput = z
  .object({
    question: z.string().trim().min(3).max(1500).refine(v=>!(/\bsk-[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]*PRIVATE KEY/.test(v)),'Remove credentials and private keys before asking a question'),
    currency: z
      .enum(['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF'])
      .default('KES'),
    tool: z
      .enum(['auto','financial_summary', 'receivables', 'forecast', 'reconciliation','expenses','obligations','documentation'])
      .default('financial_summary'),
    horizon: z
      .union([z.literal(7), z.literal(30), z.literal(60), z.literal(90)])
      .default(30),
    scenario: z
      .enum(['expected', 'optimistic', 'conservative', 'custom'])
      .default('expected'),
    consent_to_provider: z.boolean().default(false),
  })
  .strict();

export const workflowEditInput=z.object({expected_version:z.number().int().positive(),configuration:automationSchema}).strict();
export const workflowControlInput=z.object({action:z.enum(['cancel','retry']),reason:z.string().trim().min(10).max(500)}).strict();
export const feedbackInput=z.object({rating:z.enum(['helpful','not_helpful'])}).strict();
export const approvalCancelInput=z.object({reason:z.string().trim().min(5).max(500)}).strict();
