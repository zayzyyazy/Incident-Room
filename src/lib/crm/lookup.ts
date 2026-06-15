import { extractCrmLookupHints } from "@/lib/crm/extract-hints";
import { listCrmCustomers } from "@/lib/crm/store";
import {
  CrmCustomer,
  CrmLookupHints,
  CrmLookupResult,
  IncidentCrmLink,
} from "@/lib/crm/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";

function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

function phoneMatches(a: string, b: string): boolean {
  const da = normalizePhone(a).replace(/\D/g, "");
  const db = normalizePhone(b).replace(/\D/g, "");
  return da === db || da.endsWith(db) || db.endsWith(da);
}

function tryMatch(
  customers: CrmCustomer[],
  predicate: (customer: CrmCustomer) => boolean,
  matchedOn: string,
  hints: CrmLookupHints,
): CrmLookupResult | null {
  const customer = customers.find(predicate);
  if (!customer) {
    return null;
  }
  return {
    matched: true,
    matched_on: matchedOn,
    customer,
    hints_used: hints,
  };
}

export function lookupCrmCustomer(hints: CrmLookupHints): CrmLookupResult {
  const customers = listCrmCustomers();

  if (hints.customer_id) {
    const match = tryMatch(
      customers,
      (c) =>
        c.customer_id === hints.customer_id ||
        c.customer_id.endsWith(hints.customer_id!),
      "customer_id",
      hints,
    );
    if (match) {
      return match;
    }
  }

  if (hints.phone) {
    const match = tryMatch(
      customers,
      (c) => Boolean(c.phone && phoneMatches(c.phone, hints.phone!)),
      "phone",
      hints,
    );
    if (match) {
      return match;
    }
  }

  if (hints.email) {
    const email = hints.email.toLowerCase();
    const match = tryMatch(
      customers,
      (c) => c.email?.toLowerCase() === email,
      "email",
      hints,
    );
    if (match) {
      return match;
    }
  }

  if (hints.vnr_last4) {
    const match = tryMatch(
      customers,
      (c) => c.vnr_last4 === hints.vnr_last4,
      "vnr_last4",
      hints,
    );
    if (match) {
      return match;
    }
  }

  if (hints.name) {
    const nameLower = hints.name.toLowerCase();
    const match = tryMatch(
      customers,
      (c) => c.name.toLowerCase().includes(nameLower),
      "name",
      hints,
    );
    if (match) {
      return match;
    }
  }

  return { matched: false, hints_used: hints };
}

export function resolveCrmForEvidence(
  evidence: VoiceIncidentEvidence,
): { lookup: CrmLookupResult; link?: IncidentCrmLink } {
  const hints = extractCrmLookupHints(evidence);
  const lookup = lookupCrmCustomer(hints);

  if (!lookup.matched || !lookup.customer || !lookup.matched_on) {
    return { lookup };
  }

  return {
    lookup,
    link: {
      customer_id: lookup.customer.customer_id,
      matched_on: lookup.matched_on,
      customer: lookup.customer,
      resolved_at: new Date().toISOString(),
    },
  };
}
