import { randomUUID } from "node:crypto";
import { dbGet, dbAll, dbRun, dbTransaction } from "../db";
import { getBusiness } from "./businessService";
import { getPerson } from "./personService";
import { appendEvent, getLedger, verifyChainIntegrity } from "./ledgerService";
import { redactLedgerEvents } from "./redaction";

/**
 * Dual-mode linked profiles.
 *
 * A person and a business are separate subjects with separate ledgers,
 * separate consent grants and separate scores. Linking is explicit and
 * opt-in; it records an auditable link on BOTH subject ledgers and never
 * merges transaction streams, metrics or scores. With no link the two are
 * fully isolated, which is the default.
 */

export interface BusinessLink {
  id: string;
  person_id: string;
  business_id: string;
  requested_by: string | null;
  created_at: string;
}

export type LinkErrorCode = "business_not_found" | "person_not_found" | "link_not_found";

export class LinkError extends Error {
  readonly code: LinkErrorCode;

  constructor(code: LinkErrorCode, message: string) {
    super(message);
    this.name = "LinkError";
    this.code = code;
  }
}

export async function linkProfiles(
  businessId: string,
  personId: string,
  requestedBy?: string
): Promise<{ link: BusinessLink; created: boolean }> {
  const business = await getBusiness(businessId);
  if (!business) throw new LinkError("business_not_found", "Business not found.");
  const person = await getPerson(personId);
  if (!person) throw new LinkError("person_not_found", "Person not found.");

  const existing = await dbGet<BusinessLink>(
    `SELECT * FROM business_links WHERE business_id = ? AND person_id = ?`,
    [businessId, personId]
  );
  if (existing) return { link: existing, created: false };

  const link: BusinessLink = {
    id: randomUUID(),
    person_id: personId,
    business_id: businessId,
    requested_by: requestedBy ?? null,
    created_at: new Date().toISOString(),
  };

  await dbTransaction(async () => {
    await dbRun(
      `INSERT INTO business_links (id, person_id, business_id, requested_by, created_at)
       VALUES (@id, @person_id, @business_id, @requested_by, @created_at)`,
      link
    );
    await appendEvent("business", businessId, "business.linked_to_person", {
      link_id: link.id,
      person_id: personId,
      requested_by: link.requested_by,
    });
    await appendEvent("person", personId, "person.linked_to_business", {
      link_id: link.id,
      business_id: businessId,
      requested_by: link.requested_by,
    });
  });

  return { link, created: true };
}

export async function unlinkProfiles(businessId: string, personId: string): Promise<boolean> {
  const existing = await dbGet<BusinessLink>(
    `SELECT * FROM business_links WHERE business_id = ? AND person_id = ?`,
    [businessId, personId]
  );
  if (!existing) throw new LinkError("link_not_found", "No link exists between these profiles.");

  await dbTransaction(async () => {
    await dbRun(`DELETE FROM business_links WHERE id = ?`, [existing.id]);
    await appendEvent("business", businessId, "business.unlinked_from_person", {
      link_id: existing.id,
      person_id: personId,
    });
    await appendEvent("person", personId, "person.unlinked_from_business", {
      link_id: existing.id,
      business_id: businessId,
    });
  });

  return true;
}

export async function listLinksForBusiness(businessId: string): Promise<BusinessLink[]> {
  return dbAll<BusinessLink>(`SELECT * FROM business_links WHERE business_id = ? ORDER BY created_at ASC`, [businessId]);
}

export async function listLinksForPerson(personId: string): Promise<BusinessLink[]> {
  return dbAll<BusinessLink>(`SELECT * FROM business_links WHERE person_id = ? ORDER BY created_at ASC`, [personId]);
}

export interface LinkedProfilesView {
  business: {
    id: string;
    legal_name: string;
    status: string;
    trust_score: number;
    is_sandbox: boolean;
  };
  persons: Array<{
    id: string;
    status: string;
    is_sandbox: boolean;
    identifiers: { national_id_present: boolean; phone_present: boolean };
    integrity: { valid: boolean; entry_count: number };
  }>;
  linked: boolean;
  isolation_note: string;
}

/**
 * Explicit "linked profiles" view: requested only when a link exists. It
 * presents the two subjects side by side without merging their data.
 */
export async function getLinkedProfilesView(businessId: string): Promise<LinkedProfilesView | undefined> {
  const business = await getBusiness(businessId);
  if (!business) return undefined;

  const links = await listLinksForBusiness(businessId);
  const persons: LinkedProfilesView["persons"] = [];
  for (const link of links) {
    const person = await getPerson(link.person_id);
    if (!person) continue;
    const ledger = await getLedger("person", person.id);
    const integrity = await verifyChainIntegrity("person", person.id);
    persons.push({
      id: person.id,
      status: person.status,
      is_sandbox: person.is_sandbox,
      identifiers: {
        national_id_present: !!person.national_id_hash,
        phone_present: !!person.phone_hash,
      },
      integrity: { valid: integrity.valid, entry_count: ledger.length },
    });
  }

  return {
    business: {
      id: business.id,
      legal_name: business.legal_name,
      status: business.status,
      trust_score: business.trust_score,
      is_sandbox: business.is_sandbox,
    },
    persons,
    linked: links.length > 0,
    isolation_note:
      "Business and person profiles keep separate ledgers, scores and consent grants. Linking creates an auditable reference only; it never merges transaction streams or scores.",
  };
}

/** Redacted person ledger projection, exposed for completeness/tests. */
export async function getPersonLedgerProjection(personId: string) {
  return redactLedgerEvents(await getLedger("person", personId));
}
