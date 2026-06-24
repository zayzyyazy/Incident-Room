import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { InvestigationRun } from "@/lib/incidents/types";
import {
  agentOutcomeTurn,
  customerAckTurn,
  customerIntentTurn,
  listFailedTools,
} from "@/lib/investigation/evidence-analysis";
import { EvidencePoolItem } from "@/lib/report/types";

function nextId(n: number) {
  return `E${n}`;
}

function formatToolArgs(args?: Record<string, unknown>): string | undefined {
  if (!args || !Object.keys(args).length) return undefined;
  try {
    const compact = JSON.stringify(args);
    return compact.length > 160 ? `${compact.slice(0, 157)}…` : compact;
  } catch {
    return undefined;
  }
}

function formatToolResult(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  try {
    const s = JSON.stringify(result);
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  } catch {
    return String(result);
  }
}

export function buildEvidencePool(
  evidence: VoiceIncidentEvidence,
  run?: InvestigationRun | null,
): EvidencePoolItem[] {
  const items: EvidencePoolItem[] = [];
  let n = 1;

  const push = (item: Omit<EvidencePoolItem, "id">) => {
    items.push({ id: nextId(n++), ...item });
  };

  const intentTurn = customerIntentTurn(evidence);
  if (intentTurn) {
    push({
      kind: "transcript",
      ref: intentTurn.turn_id,
      speaker: "customer",
      quote: intentTurn.text.trim(),
      label: "Customer request",
    });
  }

  const agentTurn = agentOutcomeTurn(evidence);
  if (agentTurn) {
    push({
      kind: "transcript",
      ref: agentTurn.turn_id,
      speaker: "agent",
      quote: agentTurn.text.trim(),
      label: "Agent outcome communication",
    });
  }

  const ackTurn = agentTurn
    ? customerAckTurn(evidence, agentTurn.turn_id)
    : customerAckTurn(evidence);
  if (ackTurn && ackTurn.turn_id !== intentTurn?.turn_id) {
    push({
      kind: "transcript",
      ref: ackTurn.turn_id,
      speaker: "customer",
      quote: ackTurn.text.trim(),
      label: "Customer acceptance",
    });
  }

  const premature = evidence.layer1_conversation.behavioral_hints?.find(
    (h) => h.type === "premature_closure",
  );
  if (premature) {
    push({
      kind: "transcript",
      ref: premature.turn_ref,
      speaker: "system",
      quote: premature.note,
      label: "Behavioral hint · premature_closure",
    });
  }

  const rankedFailed = listFailedTools(evidence);
  for (const call of rankedFailed) {
    const quote =
      call.error_message?.trim() ||
      formatToolResult(call.result) ||
      `${call.status ?? "error"} with no recorded message`;
    push({
      kind: "tool_call",
      ref: call.name,
      quote,
      status: call.status === "timeout" ? "timeout" : "error",
      http_status: call.http_status,
      detail: formatToolArgs(call.args),
      label:
        call === rankedFailed[0]
          ? "Primary failed mutation"
          : "Downstream failure",
    });
  }

  if (rankedFailed.length > 0) {
    const priorSuccess = evidence.layer2_execution.function_calls.find(
      (c) => c.status === "success",
    );
    if (priorSuccess) {
      push({
        kind: "tool_call",
        ref: priorSuccess.name,
        quote: formatToolResult(priorSuccess.result) || "success",
        status: "success",
        detail: formatToolArgs(priorSuccess.args),
        label: "Prior successful tool step",
      });
    }
  }

  const side = evidence.layer2_execution.side_effects;
  if (
    side.appointment_created === false ||
    side.appointment_id === null ||
    side.sms_sent === false
  ) {
    const parts: string[] = [];
    if (side.appointment_created === false) parts.push("appointment_created: false");
    if (side.appointment_id === null) parts.push("appointment_id: null");
    if (side.sms_sent === false) parts.push("sms_sent: false");
    push({
      kind: "side_effect",
      ref: "layer2_execution.side_effects",
      quote: parts.join("; "),
      label: "Recorded side effects",
    });
  }

  const beatKinds = new Set([
    "EvidenceReturned",
    "TheoryProposed",
    "TheorySupported",
    "TheoryChallenged",
    "ConfidenceChanged",
    "TheoryRefined",
    "TheoryWithdrawn",
    "TheoryAccepted",
    "VerdictIssued",
    "RoomChallenge",
  ]);
  for (const entry of run?.earnedInvestigation?.feedTimeline ?? []) {
    const kind = entry.payload?.type;
    if (typeof kind !== "string" || !beatKinds.has(kind)) continue;
    const line =
      (typeof entry.content === "string" && entry.content.trim()) ||
      (typeof entry.payload?.line === "string" && entry.payload.line.trim()) ||
      "";
    if (!line) continue;
    push({
      kind: "investigation_beat",
      ref: kind,
      quote: line,
      label: entry.agentId,
    });
  }

  return items;
}

export function defaultCitationSignificance(item: EvidencePoolItem): string {
  if (item.kind === "transcript" && item.speaker === "customer") {
    if (item.label?.includes("acceptance")) {
      return "Customer treated the agent's promise as complete.";
    }
    return "Establishes the customer's stated intent for the interaction.";
  }
  if (item.kind === "transcript" && item.speaker === "agent") {
    return "Agent communicated an outcome as settled before backend success was verified.";
  }
  if (item.kind === "transcript" && item.speaker === "system") {
    return "Recorded behavioral signal linking premature closure to a specific turn.";
  }
  if (item.kind === "tool_call" && item.label?.includes("Primary")) {
    const http =
      item.http_status != null ? ` (HTTP ${item.http_status})` : "";
    return `Primary backend mutation failed${http}; this is the root execution break.`;
  }
  if (item.kind === "tool_call" && (item.status === "error" || item.status === "timeout")) {
    const http =
      item.http_status != null ? ` (HTTP ${item.http_status})` : "";
    return `Downstream tool failed${http} because the primary mutation did not succeed.`;
  }
  if (item.kind === "tool_call" && item.status === "success") {
    return "Earlier step succeeded; the failure is localized to a later mutation.";
  }
  if (item.kind === "side_effect") {
    return "System-of-record flags show no confirming side effect for the promised outcome.";
  }
  if (item.kind === "investigation_beat") {
    return "Multi-agent investigation beat supporting the verdict.";
  }
  return "Relevant evidence for the trust gap.";
}
