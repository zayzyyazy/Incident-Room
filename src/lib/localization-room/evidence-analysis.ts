import { CanonicalMechanismId } from "@/lib/canonical/surface-types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";

export type EvidenceToolCall = {
  name: string;
  status?: string;
  result?: unknown;
  error_message?: string;
  turn_ref?: string;
};

export type LocalizationEvidenceProfile = {
  incidentId: string;
  callStatus?: string;
  durationSec?: number;
  intent?: string;
  customerTurnCount: number;
  agentTurnCount: number;
  failedTools: EvidenceToolCall[];
  errorTools: EvidenceToolCall[];
  successTools: EvidenceToolCall[];
  identityTools: EvidenceToolCall[];
  handoffTools: EvidenceToolCall[];
  lookupFailed: boolean;
  identityCheckFailed: boolean;
  handoffSucceeded: boolean;
  droppedEarly: boolean;
  insufficientForLocalization: boolean;
  ungroundedHints: string[];
  primaryFailureTool?: EvidenceToolCall;
  primaryHandoffTool?: EvidenceToolCall;
  mechanismId: CanonicalMechanismId;
  mechanismStatement: string;
  requiredGuardMissing: string;
  causePredicts: string;
  implementationShows: string;
  bwDefenseLine: string;
  ctDefenseLine: string;
};

const IDENTITY_TOOL_NAMES = new Set([
  "get_customer_by_phone",
  "get_customer_by_insurance_number",
  "check_birthday",
  "check_insurance_number_format",
  "lookup_customer",
]);

const HANDOFF_TOOL_NAMES = new Set([
  "send_email",
  "create_callback_appointment",
  "cancel_subscription",
  "schedule_callback",
]);

function toolFailed(call: EvidenceToolCall): boolean {
  if (call.status === "error" || call.status === "timeout") return true;
  if (call.result && typeof call.result === "object" && call.result !== null) {
    const r = call.result as Record<string, unknown>;
    if ("error" in r) return true;
  }
  if (typeof call.result === "string" && call.result.toLowerCase() === "false") {
    return true;
  }
  return false;
}

function resultSummary(result: unknown): string {
  if (result == null) return "no result";
  if (typeof result === "string") return result;
  if (typeof result === "object" && result !== null && "error" in result) {
    return String((result as { error: unknown }).error);
  }
  return "success";
}

export function analyzeEvidenceForLocalization(
  evidence: VoiceIncidentEvidence,
): LocalizationEvidenceProfile {
  const calls = evidence.layer2_execution.function_calls as EvidenceToolCall[];
  const segments = evidence.layer1_conversation.segments;
  const customerTurnCount = segments.filter((s) => s.speaker === "customer").length;
  const agentTurnCount = segments.filter((s) => s.speaker === "agent").length;
  const callStatus = evidence.call_metadata?.status;
  const durationSec = evidence.call_metadata?.duration_sec;
  const hints =
    evidence.layer1_conversation.behavioral_hints?.map((h) => h.note) ?? [];

  const failedTools = calls.filter((c) => toolFailed(c));
  const errorTools = calls.filter((c) => c.status === "error" || c.status === "timeout");
  const successTools = calls.filter((c) => !toolFailed(c));
  const identityTools = calls.filter((c) => IDENTITY_TOOL_NAMES.has(c.name));
  const handoffTools = calls.filter((c) => HANDOFF_TOOL_NAMES.has(c.name));

  const lookupFailed = calls.some(
    (c) =>
      (c.name === "get_customer_by_phone" ||
        c.name === "get_customer_by_insurance_number" ||
        c.name === "lookup_customer") &&
      toolFailed(c),
  );
  const identityCheckFailed = calls.some(
    (c) => c.name === "check_birthday" && toolFailed(c),
  );
  const handoffSucceeded = handoffTools.some((c) => !toolFailed(c));
  const droppedEarly =
    callStatus === "dropped" ||
    (typeof durationSec === "number" && durationSec < 20 && customerTurnCount === 0);

  const insufficientForLocalization =
    droppedEarly ||
    (customerTurnCount === 0 && failedTools.length > 0 && !handoffSucceeded);

  const primaryFailureTool =
    errorTools[0] ??
    failedTools.find((c) => IDENTITY_TOOL_NAMES.has(c.name)) ??
    failedTools[0];
  const primaryHandoffTool =
    handoffTools.find((c) => !toolFailed(c)) ?? handoffTools[0];

  let mechanismId: CanonicalMechanismId;
  let mechanismStatement: string;
  let requiredGuardMissing: string;

  if (insufficientForLocalization) {
    mechanismId = "error_swallowed_without_customer_block";
    mechanismStatement =
      "Call ended before intent resolution — failure at identity lookup was not surfaced to the customer";
    requiredGuardMissing =
      "block or escalate when customer lookup fails before continuing the workflow";
  } else if (
    identityCheckFailed &&
    handoffSucceeded &&
    hints.some((h) => /handoff|closure|confirm|success|übermittelt/i.test(h))
  ) {
    mechanismId = "success_confirmation_on_unreachable_tool_path";
    mechanismStatement =
      "Agent confirmed successful handoff while identity verification had already failed";
    requiredGuardMissing =
      "handoff tools must require verified identity before success utterances";
  } else if (lookupFailed && handoffSucceeded) {
    mechanismId = "success_path_without_side_effect_guard";
    mechanismStatement =
      "Handoff completed despite failed or incomplete customer identification";
    requiredGuardMissing =
      "guard blocking handoff when lookup or identity checks fail";
  } else if (
    failedTools.some((c) => HANDOFF_TOOL_NAMES.has(c.name)) &&
    hints.some((h) => /premature|confirm|closure|success/i.test(h))
  ) {
    mechanismId = "confirmation_before_backend_success";
    mechanismStatement =
      "Customer-facing success language appeared while a handoff tool failed or timed out";
    requiredGuardMissing =
      "confirm utterances gated on handoff tool success";
  } else if (
    failedTools.length > 0 &&
    !handoffSucceeded &&
    customerTurnCount > 0
  ) {
    mechanismId = "dialogue_continues_after_tool_failure";
    mechanismStatement =
      "Conversation continued after a tool failure without blocking or correcting the customer-facing path";
    requiredGuardMissing =
      "hard stop or recovery branch when prerequisite tools fail";
  } else if (
    handoffTools.length === 0 &&
    hints.some((h) => /premature|confirm|closure|success|ungrounded/i.test(h))
  ) {
    mechanismId = "tool_never_invoked_on_intended_path";
    mechanismStatement =
      "Agent implied completion without invoking the expected backend handoff tool";
    requiredGuardMissing =
      "mandatory tool invocation before success confirmation";
  } else {
    mechanismId = "error_swallowed_without_customer_block";
    mechanismStatement =
      "Runtime errors or failed checks did not block the customer-facing workflow path";
    requiredGuardMissing =
      "explicit customer-facing error handling when prerequisite tools fail";
  }

  const failureName = primaryFailureTool?.name ?? "prerequisite tool";
  const failureDetail = primaryFailureTool
    ? `${failureName} → ${resultSummary(primaryFailureTool.result)}`
    : "tool trace incomplete";

  const causePredicts = insufficientForLocalization
    ? "the observed customer outcome is explained by a specific failed execution step."
    : identityCheckFailed
      ? "failed identity verification is necessary before the agent could honestly confirm handoff."
      : "failed or missing backend execution is necessary before the customer was misled.";

  const implementationShows = insufficientForLocalization
    ? `${failureDetail}; call ${callStatus ?? "ended"} with only ${customerTurnCount} customer turn(s).`
    : identityCheckFailed && handoffSucceeded
      ? `${failureDetail}; ${primaryHandoffTool?.name ?? "handoff tool"} still succeeded and agent used success language.`
      : `${failureDetail}; customer heard ${customerTurnCount} turn(s) while ${successTools.length} tool(s) succeeded.`;

  const bwDefenseLine = insufficientForLocalization
    ? `${failureDetail} · call ${callStatus ?? "incomplete"} · handoff not proven.`
    : `${failureDetail}${handoffSucceeded ? ` · ${primaryHandoffTool?.name ?? "handoff"} returned success` : ""}.`;

  const ctDefenseLine =
    customerTurnCount > 0
      ? `Customer spoke ${customerTurnCount} time(s)${hints[0] ? ` · ${hints[0].split(".")[0]}` : ""}.`
      : "No customer utterance captured — belief outcome unobservable.";

  return {
    incidentId: evidence.incident_id,
    callStatus,
    durationSec,
    intent: evidence.layer1_conversation.intent,
    customerTurnCount,
    agentTurnCount,
    failedTools,
    errorTools,
    successTools,
    identityTools,
    handoffTools,
    lookupFailed,
    identityCheckFailed,
    handoffSucceeded,
    droppedEarly,
    insufficientForLocalization,
    ungroundedHints: hints,
    primaryFailureTool,
    primaryHandoffTool,
    mechanismId,
    mechanismStatement,
    requiredGuardMissing,
    causePredicts,
    implementationShows,
    bwDefenseLine,
    ctDefenseLine,
  };
}
