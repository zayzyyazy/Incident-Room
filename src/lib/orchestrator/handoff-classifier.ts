import { FunctionCallSchema } from "@/lib/evidence/types";
import { z } from "zod";

type FunctionCall = z.infer<typeof FunctionCallSchema>;

export type ResolutionMode =
  | "direct_action"
  | "handoff_to_colleagues"
  | "mixed"
  | "unclear";

export type HandoffReason =
  | "capability_by_design"
  | "failure_driven_escalation"
  | "policy_constraint"
  | "customer_requested_human"
  | "not_applicable"
  | "unknown";

const HANDOFF_TOOLS = new Set([
  "send_email",
  "create_ticket",
  "escalate_to_colleagues",
  "forward_to_human",
  "create_support_ticket",
]);

const DIRECT_ACTION_TOOLS = new Set([
  "update_crm_address",
  "create_callback_appointment",
  "create_appointment",
  "update_order",
  "submit_order_change",
  "change_delivery_items",
  "book_callback",
]);

const IDENTITY_OR_LOOKUP_TOOLS = new Set([
  "check_birthday",
  "get_customer_by_phone",
  "lookup_customer",
  "verify_customer",
  "get_customer_by_id",
]);

function isToolError(call: FunctionCall): boolean {
  return (
    call.status === "error" ||
    call.status === "timeout" ||
    call.result === "False" ||
    call.result === false ||
    (typeof call.result === "object" &&
      call.result !== null &&
      "error" in call.result)
  );
}

function isToolSuccess(call: FunctionCall): boolean {
  if (call.status === "error" || call.status === "timeout") {
    return false;
  }
  if (call.result === "False" || call.result === false) {
    return false;
  }
  if (
    typeof call.result === "object" &&
    call.result !== null &&
    "error" in call.result
  ) {
    return false;
  }
  return call.status === "success" || call.result != null;
}

export function classifyResolutionPath(functionCalls: FunctionCall[]): {
  resolution_mode: ResolutionMode;
  handoff_reason: HandoffReason;
  handoff_detail_en: string | null;
} {
  if (functionCalls.length === 0) {
    return {
      resolution_mode: "unclear",
      handoff_reason: "unknown",
      handoff_detail_en: "No tool execution data available.",
    };
  }

  const directAttempts = functionCalls.filter((call) =>
    DIRECT_ACTION_TOOLS.has(call.name),
  );
  const handoffAttempts = functionCalls.filter((call) =>
    HANDOFF_TOOLS.has(call.name),
  );
  const identityAttempts = functionCalls.filter((call) =>
    IDENTITY_OR_LOOKUP_TOOLS.has(call.name),
  );

  const directSuccess = directAttempts.some(isToolSuccess);
  const directFailed = directAttempts.some(isToolError);
  const handoffSuccess = handoffAttempts.some(isToolSuccess);
  const identityFailed = identityAttempts.some(isToolError);

  const failuresBeforeHandoff = functionCalls.some((call, index) => {
    const laterHandoff = functionCalls
      .slice(index + 1)
      .some((next) => HANDOFF_TOOLS.has(next.name) && isToolSuccess(next));
    return laterHandoff && isToolError(call);
  });

  if (directSuccess && !directFailed) {
    return {
      resolution_mode: handoffSuccess ? "mixed" : "direct_action",
      handoff_reason: handoffSuccess ? "unknown" : "not_applicable",
      handoff_detail_en: handoffSuccess
        ? "Direct action succeeded but a colleague handoff also ran."
        : "Voice agent executed the intended backend action directly.",
    };
  }

  if (directFailed && !directSuccess) {
    return {
      resolution_mode: handoffSuccess ? "mixed" : "direct_action",
      handoff_reason: handoffSuccess
        ? failuresBeforeHandoff
          ? "failure_driven_escalation"
          : "capability_by_design"
        : "not_applicable",
      handoff_detail_en: handoffSuccess
        ? failuresBeforeHandoff
          ? "Direct action failed; colleague handoff ran after an earlier execution failure."
          : "Direct action failed; colleague handoff ran as the workflow fallback."
        : "Voice agent attempted a direct backend action but it failed.",
    };
  }

  if (handoffSuccess) {
    const reason: HandoffReason = failuresBeforeHandoff
      ? identityFailed
        ? "failure_driven_escalation"
        : "failure_driven_escalation"
      : "capability_by_design";

    return {
      resolution_mode: "handoff_to_colleagues",
      handoff_reason: reason,
      handoff_detail_en:
        reason === "failure_driven_escalation"
          ? "Colleague handoff (e.g. email/ticket) ran after a prior tool or identity failure — not the primary happy path."
          : "Colleague handoff appears to be the designed resolution path for this workflow (no failed direct-action attempt before handoff).",
    };
  }

  if (identityFailed && !handoffSuccess) {
    return {
      resolution_mode: "unclear",
      handoff_reason: "failure_driven_escalation",
      handoff_detail_en:
        "Identity or lookup failed and no successful handoff tool was recorded.",
    };
  }

  return {
    resolution_mode: "unclear",
    handoff_reason: "unknown",
    handoff_detail_en: null,
  };
}
