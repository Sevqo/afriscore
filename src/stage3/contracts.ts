import { z } from 'zod';
export const credentialTypes = [
  'BusinessIdentityCredential',
  'PaymentActivityCredential',
  'TradingHistoryCredential',
  'InvoiceSettlementCredential',
  'DeliveryCompletionCredential',
  'SupplierRelationshipCredential',
  'CustomerRelationshipCredential',
  'BusinessDataCoverageCredential',
  'BusinessRegistrationReviewCredential',
] as const;
export const passportInput = z
  .object({
    display_name: z.string().trim().min(2).max(160),
    category: z.string().min(2).max(100),
    industry: z.string().max(100),
    country: z.string().regex(/^[A-Z]{2}$/),
    public_profile: z.boolean().default(false),
  })
  .strict();
export const evidenceInput = z
  .object({
    source_kind: z.enum([
      'profile',
      'payment',
      'invoice',
      'order',
      'shipment',
      'relationship',
    ]),
    source_id: z.string().uuid(),
    lawful_basis: z.enum(['contract', 'consent', 'legitimate_interests']),
    purpose: z.string().trim().min(10).max(500),
  })
  .strict();
export const identityInput = z
  .object({
    legal_name: z.string().min(2).max(200),
    jurisdiction: z.string().min(2).max(100),
    registration_number: z.string().min(2).max(100),
    representative_statement: z.string().min(10).max(1000),
    evidence_ids: z.array(z.string().uuid()).max(10),
    consent: z.literal(true),
  })
  .strict();
export const issueInput = z
  .object({
    issuer_id: z.string().uuid(),
    holder_org: z.string().uuid(),
    type: z.enum(credentialTypes),
    evidence_ids: z
      .array(z.string().uuid())
      .min(1)
      .max(20)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Evidence IDs must be unique',
      ),
    valid_days: z.number().int().min(1).max(365).default(90),
    consent: z.literal(true),
  })
  .strict();
export const relationshipInput = z
  .object({
    counterparty_org: z.string().uuid(),
    relationship: z.enum([
      'supplier',
      'customer',
      'logistics',
      'commercial_partner',
    ]),
    statement: z.string().trim().min(10).max(1000),
    consent: z.literal(true),
  })
  .strict();
export const requestInput = z
  .object({
    holder_org: z.string().uuid(),
    types: z.array(z.enum(credentialTypes)).min(1).max(9),
    purpose: z.string().trim().min(10).max(500),
    expires_days: z.number().int().min(1).max(30).default(7),
  })
  .strict();
export const grantInput = z
  .object({
    recipient_org: z.string().uuid(),
    credential_ids: z
      .array(z.string().uuid())
      .min(1)
      .max(10)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Credential IDs must be unique',
      ),
    purpose: z.string().trim().min(10).max(500),
    expires_hours: z.number().int().min(1).max(720).default(168),
    one_time: z.boolean().default(true),
    request_id: z.string().uuid().optional(),
    consent: z.literal(true),
  })
  .strict();
export const schemaRegistry = credentialTypes.map((type) => ({
  id: 'https://africore.example/schemas/v1/' + type,
  version: '1.0',
  type,
  claims: [
    'claim_summary',
    'evidence_count',
    'source_categories',
    'assurance_level',
    'method',
    'limitations',
    'coverage',
  ],
  additional_claims: false,
  profile: 'VC2-JOSE-ES256-minimal-v1',
}));
export const trustEvents = [
  'passport.created',
  'credential.issued',
  'credential.expired',
  'credential.suspended',
  'credential.revoked',
  'verification.requested',
  'verification.completed',
  'verification.failed',
  'sharing.grant_created',
  'sharing.grant_revoked',
  'proof.anchor_confirmed',
] as const;
export const minimalCredential = z
  .object({
    '@context': z
      .array(z.union([z.string(), z.record(z.string(), z.unknown())]))
      .min(1),
    id: z.string().url(),
    type: z.array(z.string()).min(2),
    issuer: z.string().url(),
    validFrom: z.string().datetime({ offset: true }),
    validUntil: z.string().datetime({ offset: true }),
    credentialSubject: z
      .object({
        id: z.string().url(),
        displayName: z.string().min(1).max(160),
        country: z.string().regex(/^[A-Z]{2}$/),
        evidence: z
          .object({
            schema_version: z.literal('1.0'),
            claim_summary: z.record(z.string(), z.unknown()).optional(),
            evidence_count: z.number().int().min(1).max(20),
            source_categories: z
              .array(
                z.enum([
                  'profile',
                  'payment',
                  'invoice',
                  'order',
                  'shipment',
                  'relationship',
                ]),
              )
              .min(1)
              .max(6),
            assurance_level: z.number().int().min(0).max(3),
            method: z.string().max(1000),
            limitations: z.string().max(3000),
            coverage: z.string().max(1000),
          })
          .strict(),
      })
      .strict(),
    credentialSchema: z
      .object({ id: z.string().url(), type: z.literal('JsonSchema') })
      .strict(),
    credentialStatus: z
      .array(
        z
          .object({
            id: z.string().url(),
            type: z.literal('BitstringStatusListEntry'),
            statusPurpose: z.enum(['revocation', 'suspension']),
            statusListIndex: z.string().regex(/^\d+$/),
            statusListCredential: z.string().url(),
          })
          .strict(),
      )
      .length(2),
  })
  .strict();
