import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { FunctionCallSchema } from "@/lib/evidence/types";
import { z } from "zod";

type FunctionCall = z.infer<typeof FunctionCallSchema>;

export function formatToolCallContent(call: FunctionCall): string {
  return `Tool: ${call.name}\nArgs: ${JSON.stringify(call.args ?? {})}`;
}

export function formatToolResultContent(call: FunctionCall): string {
  const status = call.status ?? "unknown";
  const http = call.http_status ? ` HTTP ${call.http_status}` : "";
  const err = call.error_message ? `\nError: ${call.error_message}` : "";
  return `Tool result: ${call.name} → ${status}${http}\n${JSON.stringify(call.result ?? {})}${err}`;
}

export function toolEventType(
  call: FunctionCall,
): "tool_result" | "error" {
  if (call.status === "error" || call.status === "timeout") {
    return "error";
  }
  if (
    call.result &&
    typeof call.result === "object" &&
    call.result !== null &&
    ("error" in call.result || "skipped" in call.result)
  ) {
    return "error";
  }
  return "tool_result";
}

export function sideEffectsSummary(
  sideEffects: VoiceIncidentEvidence["layer2_execution"]["side_effects"],
): string {
  return Object.entries(sideEffects)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
}
