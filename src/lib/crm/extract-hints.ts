import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { CrmLookupHints } from "@/lib/crm/types";

function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function extractCrmLookupHints(
  evidence: VoiceIncidentEvidence,
): CrmLookupHints {
  const hints: CrmLookupHints = {};
  const layer3 = evidence.layer3_customer ?? {};

  if (typeof layer3.customer_id === "string") {
    hints.customer_id = layer3.customer_id;
  }
  if (typeof layer3.crm_id === "string") {
    hints.customer_id = layer3.crm_id;
  }
  if (typeof layer3.phone === "string") {
    hints.phone = normalizePhone(layer3.phone);
  }
  if (typeof layer3.email === "string") {
    hints.email = layer3.email.toLowerCase();
  }
  if (typeof layer3.vnr_last4 === "string") {
    hints.vnr_last4 = layer3.vnr_last4;
  }
  if (typeof layer3.name === "string") {
    hints.name = layer3.name;
  }

  for (const call of evidence.layer2_execution.function_calls) {
    const args = call.args ?? {};
    if (typeof args.phone === "string" && !hints.phone) {
      hints.phone = normalizePhone(args.phone);
    }
    if (typeof args.customer_id === "string" && !hints.customer_id) {
      hints.customer_id = String(args.customer_id);
    }
    if (typeof args.vnr_last4 === "string" && !hints.vnr_last4) {
      hints.vnr_last4 = String(args.vnr_last4);
    }
    if (call.name === "get_customer_by_phone" && call.result) {
      const result = call.result as Record<string, unknown>;
      if (typeof result.id === "string" && !hints.customer_id) {
        hints.customer_id = result.id;
      }
    }
  }

  for (const segment of evidence.layer1_conversation.segments) {
    const text = segment.text;
    if (!hints.phone) {
      const phoneMatch = text.match(/\+49[\d\s]{8,}/);
      if (phoneMatch) {
        hints.phone = normalizePhone(phoneMatch[0]);
      }
    }
    if (!hints.vnr_last4) {
      const vnrMatch = text.match(/ending in (\d{4})/i);
      if (vnrMatch) {
        hints.vnr_last4 = vnrMatch[1];
      }
    }
  }

  if (hints.phone) {
    hints.phone = normalizePhone(hints.phone);
  }
  if (hints.vnr_last4) {
    hints.vnr_last4 = digitsOnly(hints.vnr_last4).slice(-4);
  }

  return hints;
}
