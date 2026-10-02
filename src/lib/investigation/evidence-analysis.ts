import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { FROZEN_DEMO_PATHS } from "@/lib/cross-room/incident-profile";
import { loadRuntimeToolAliases } from "@/lib/localization-room/load-artifact";

const MUTATION_TOOL_RE =
  /create|book|reschedule|cancel|update|refund|payment|pause|subscribe|transfer|reserve|appointment|callback/i;
const DOWNSTREAM_TOOL_RE =
  /confirm|sms|email|notify|^send_|notification|webhook/i;
const AGENT_OUTCOME_RE =
  /booked|confirmed|bestätigt|buche|buchung|rückruf|rescheduled|correct|refund|ticket|scheduled|you'll get|veranlasst|morgen|tomorrow|approved|eingetragen|verschieb/i;

export type FailedToolCall =
  VoiceIncidentEvidence["layer2_execution"]["function_calls"][number];

function toolFailureScore(call: FailedToolCall): number {
  let score = 0;
  if (MUTATION_TOOL_RE.test(call.name)) score += 12;
  if (DOWNSTREAM_TOOL_RE.test(call.name)) score -= 8;
  if (call.status === "timeout") score += 4;
  if (call.http_status != null && call.http_status >= 500) score += 3;
  if (call.http_status != null && call.http_status >= 400) score += 1;
  return score;
}

export function listFailedTools(
  evidence: VoiceIncidentEvidence,
): FailedToolCall[] {
  return evidence.layer2_execution.function_calls
    .filter(
      (c) =>
        c.status === "error" ||
        c.status === "timeout" ||
        Boolean(c.error_message),
    )
    .sort((a, b) => toolFailureScore(b) - toolFailureScore(a));
}

export function primaryFailedTool(
  evidence: VoiceIncidentEvidence,
): FailedToolCall | undefined {
  return listFailedTools(evidence)[0];
}

export function agentOutcomeTurn(evidence: VoiceIncidentEvidence) {
  const hint = evidence.layer1_conversation.behavioral_hints?.find(
    (h) => h.type === "premature_closure" && h.turn_ref,
  );
  if (hint?.turn_ref) {
    const linked = evidence.layer1_conversation.segments.find(
      (s) => s.turn_id === hint.turn_ref,
    );
    if (linked) return linked;
  }

  return (
    [...evidence.layer1_conversation.segments]
      .reverse()
      .find(
        (s) => s.speaker === "agent" && AGENT_OUTCOME_RE.test(s.text),
      ) ?? undefined
  );
}

export function customerIntentTurn(evidence: VoiceIncidentEvidence) {
  return evidence.layer1_conversation.segments.find(
    (s) => s.speaker === "customer" && s.text.trim().length > 12,
  );
}

export function customerAckTurn(
  evidence: VoiceIncidentEvidence,
  afterTurnId?: string,
) {
  const segments = evidence.layer1_conversation.segments;
  const startIdx = afterTurnId
    ? segments.findIndex((s) => s.turn_id === afterTurnId)
    : -1;

  const pool =
    startIdx >= 0 ? segments.slice(startIdx + 1) : [...segments].reverse();

  return pool.find((s) => s.speaker === "customer");
}

export function customerBeliefNarrative(evidence: VoiceIncidentEvidence): string {
  const agentTurn = agentOutcomeTurn(evidence);
  const intent = customerIntentTurn(evidence);
  const ack = agentTurn
    ? customerAckTurn(evidence, agentTurn.turn_id)
    : customerAckTurn(evidence);

  if (agentTurn && ack) {
    return `After the agent said "${agentTurn.text}" (${agentTurn.turn_id}), the customer responded "${ack.text}" (${ack.turn_id}) — treating the outcome as settled.`;
  }
  if (agentTurn) {
    return `Customer likely believed the agent's assurance: "${agentTurn.text}" (${agentTurn.turn_id}).`;
  }
  if (intent) {
    return `Customer stated: "${intent.text}" (${intent.turn_id}).`;
  }
  return "Customer formed belief from agent assurance without verified backend action.";
}

export function formatToolFailure(call: FailedToolCall): string {
  const http =
    call.http_status != null ? `HTTP ${call.http_status}` : call.status ?? "error";
  const detail =
    call.error_message?.trim() ||
    (typeof call.result === "object" && call.result != null
      ? JSON.stringify(call.result)
      : String(call.result ?? ""));
  return `${call.name} → ${http}${detail ? `: ${detail}` : ""}`;
}

export function computeVerdict(evidence: VoiceIncidentEvidence): {
  verdict: "NOT_JUSTIFIED" | "INSUFFICIENT_EVIDENCE" | "JUSTIFIED";
  failures: FailedToolCall[];
  agentLine: string;
} {
  const failures = listFailedTools(evidence);
  const agentTurn = agentOutcomeTurn(evidence);
  const agentLine =
    agentTurn?.text ?? "Agent communicated success without verified backend action.";
  const hasCustomerSpeech = evidence.layer1_conversation.segments.some(
    (s) => s.speaker === "customer",
  );

  if (
    failures.length === 0 &&
    !AGENT_OUTCOME_RE.test(agentLine) &&
    evidence.layer2_execution.side_effects.appointment_created !== false
  ) {
    return { verdict: "INSUFFICIENT_EVIDENCE", failures, agentLine };
  }

  if (
    hasCustomerSpeech &&
    (failures.length > 0 || AGENT_OUTCOME_RE.test(agentLine))
  ) {
    return { verdict: "NOT_JUSTIFIED", failures, agentLine };
  }

  if (failures.length > 0) {
    return { verdict: "NOT_JUSTIFIED", failures, agentLine };
  }

  return { verdict: "INSUFFICIENT_EVIDENCE", failures, agentLine };
}

export type FixSurfaceHint = {
  workflow_surface?: string;
  workflow_binding?: string;
  mechanism?: string;
};

export function resolveFixSurface(
  incidentId: string,
  primaryToolName?: string,
): FixSurfaceHint {
  const frozen = Object.values(FROZEN_DEMO_PATHS).find(
    (p) => p.incident_id === incidentId,
  );
  const aliases = loadRuntimeToolAliases(incidentId);

  const hint: FixSurfaceHint = {};

  if (frozen && "surface" in frozen) {
    hint.workflow_surface = frozen.surface;
  }
  if (frozen && "mechanism" in frozen) {
    hint.mechanism = frozen.mechanism;
  }
  if (aliases && primaryToolName && aliases.aliases[primaryToolName]) {
    hint.workflow_binding = `${primaryToolName} → ${aliases.aliases[primaryToolName]}`;
  }

  return hint;
}

export function buildFixRecommendation(
  evidence: VoiceIncidentEvidence,
  primaryTool?: FailedToolCall,
): { fix_target: string; fix_detail: string } {
  const toolName = primaryTool?.name ?? "backing mutation tool";
  const surface = resolveFixSurface(evidence.incident_id, toolName);

  const fix_target = `Block success language unless ${toolName} succeeds.`;
  const parts = [
    `Do not route to customer confirmation after ${toolName} returns error or timeout.`,
  ];
  if (surface.workflow_surface) {
    parts.push(`Workflow surface: ${surface.workflow_surface}.`);
  }
  if (surface.workflow_binding) {
    parts.push(`Tool binding: ${surface.workflow_binding}.`);
  }
  if (surface.mechanism) {
    parts.push(`Mechanism: ${surface.mechanism.replace(/_/g, " ")}.`);
  }

  return {
    fix_target,
    fix_detail: parts.join(" "),
  };
}
