import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  CustomerRealityVerdict,
  InvestigationVerdict,
  SystemRealityVerdict,
  REALITY_COLLISION_INCIDENT_ID,
} from "@/lib/reality/types";

/** Transcript + customer-facing language only — no tool logs. */
export function buildCustomerRealityVerdict(
  evidence: VoiceIncidentEvidence,
): CustomerRealityVerdict {
  if (evidence.incident_id === REALITY_COLLISION_INCIDENT_ID) {
    return {
      type: "CustomerRealityVerdict",
      belief: "Redelivery confirmed for tomorrow",
      promise_made: true,
      promise_type: "fulfillment_promise",
      evidence: [
        'T05: "I\'ve arranged a priority redelivery for tomorrow morning..."',
        'T07: "Yes — it\'s confirmed on my side. You\'ll receive an SMS shortly."',
        'T06: Customer asks "So they\'re definitely coming tomorrow?"',
      ],
      confidence: "HIGH",
    };
  }

  const hints = evidence.layer1_conversation.behavioral_hints ?? [];
  const closure = hints.find((h) =>
    /premature|confirm|closure|direct_fix|fulfillment/i.test(h.type),
  );
  const agentLines = evidence.layer1_conversation.segments.filter(
    (s) => s.speaker === "agent" && s.text.length > 20,
  );
  const quote = agentLines.at(-1)?.text ?? agentLines[0]?.text;

  return {
    type: "CustomerRealityVerdict",
    belief: closure?.note?.split(".")[0] ?? "Customer believed the issue was resolved",
    promise_made: Boolean(closure || quote),
    promise_type: "fulfillment_promise",
    evidence: agentLines.slice(-2).map((s) => `${s.turn_id}: "${s.text.slice(0, 80)}…"`),
    confidence: agentLines.length > 0 ? "HIGH" : "LOW",
  };
}

/** Tool calls + side effects only — no transcript wording. */
export function buildSystemRealityVerdict(
  evidence: VoiceIncidentEvidence,
): SystemRealityVerdict {
  if (evidence.incident_id === REALITY_COLLISION_INCIDENT_ID) {
    return {
      type: "SystemRealityVerdict",
      actual_state: "Redelivery was not scheduled",
      side_effect_created: false,
      failed_or_missing_action: "schedule_redelivery",
      evidence: [
        "schedule_redelivery → error (workflow_branch_not_reached)",
        "send_confirmation_sms → skipped (no_redelivery_id)",
        "side_effects: sms_sent=false",
      ],
      confidence: "HIGH",
    };
  }

  const calls = evidence.layer2_execution.function_calls;
  const side = evidence.layer2_execution.side_effects;
  const failed = calls.filter(
    (c) =>
      c.status === "error" ||
      c.status === "timeout" ||
      (c.result &&
        typeof c.result === "object" &&
        c.result !== null &&
        ("error" in c.result || "skipped" in c.result)),
  );
  const primary = failed[0] ?? calls.at(-1);

  return {
    type: "SystemRealityVerdict",
    actual_state: primary
      ? `${primary.name} did not complete successfully`
      : "Promised side effect not created",
    side_effect_created: Boolean(
      side.appointment_created || side.crm_record_exists,
    ),
    failed_or_missing_action: primary?.name ?? "unknown_action",
    evidence: failed.slice(0, 3).map((c) => `${c.name} → ${c.status ?? "failed"}`),
    confidence: failed.length > 0 ? "HIGH" : "MEDIUM",
  };
}

export function realitiesConflict(
  customer: CustomerRealityVerdict,
  system: SystemRealityVerdict,
): boolean {
  return customer.promise_made && !system.side_effect_created;
}

export function buildInvestigationVerdict(input: {
  evidence: VoiceIncidentEvidence;
  customer: CustomerRealityVerdict;
  system: SystemRealityVerdict;
}): InvestigationVerdict {
  if (input.evidence.incident_id === REALITY_COLLISION_INCIDENT_ID) {
    return {
      type: "InvestigationVerdict",
      finding: "The agent made an unverified customer promise.",
      customer_reality: input.customer.belief,
      system_reality: input.system.actual_state,
      architecture_reason:
        "Fulfillment language continued after schedule_redelivery failed.",
      fix_target: "Block redelivery promises until schedule_redelivery succeeds.",
      where_to_fix: "schedule_redelivery · fulfillment confirmation gate",
    };
  }

  return {
    type: "InvestigationVerdict",
    finding: "The agent made an unverified customer promise.",
    customer_reality: input.customer.belief,
    system_reality: input.system.actual_state,
    architecture_reason:
      "Success language was reachable without proof the backend action succeeded.",
    fix_target: `Block customer promises until ${input.system.failed_or_missing_action} succeeds.`,
    where_to_fix: input.system.failed_or_missing_action,
  };
}

export function reconciliationQuestion(
  customer: CustomerRealityVerdict,
  system: SystemRealityVerdict,
): string {
  return `Why did the customer believe "${customer.belief}" when the system shows "${system.actual_state}"?`;
}
