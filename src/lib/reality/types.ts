import { z } from "zod";
import { IncidentReportSchema } from "@/lib/reality/theory-script";

export const ConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type VerdictConfidence = z.infer<typeof ConfidenceSchema>;

export const CustomerRealityVerdictSchema = z.object({
  type: z.literal("CustomerRealityVerdict"),
  belief: z.string(),
  promise_made: z.boolean(),
  promise_type: z.string(),
  evidence: z.array(z.string()),
  confidence: ConfidenceSchema,
});

export type CustomerRealityVerdict = z.infer<typeof CustomerRealityVerdictSchema>;

export const SystemRealityVerdictSchema = z.object({
  type: z.literal("SystemRealityVerdict"),
  actual_state: z.string(),
  side_effect_created: z.boolean(),
  failed_or_missing_action: z.string(),
  evidence: z.array(z.string()),
  confidence: ConfidenceSchema,
});

export type SystemRealityVerdict = z.infer<typeof SystemRealityVerdictSchema>;

export const InvestigationVerdictSchema = z.object({
  type: z.literal("InvestigationVerdict"),
  finding: z.string(),
  customer_reality: z.string(),
  system_reality: z.string(),
  architecture_reason: z.string(),
  fix_target: z.string(),
  where_to_fix: z.string(),
});

export type InvestigationVerdict = z.infer<typeof InvestigationVerdictSchema>;

export type IncidentReport = z.infer<typeof IncidentReportSchema>;

export type RealityFeedEntry = {
  agentId: string;
  messageId: string;
  bandEventKind?: string;
  content?: string;
  payload?: unknown;
  room: "theory_investigation" | "customer_reality" | "system_reality" | "reconciliation";
};

export type RealityCollisionResult = {
  /** Primary Band room for theory debate */
  investigationRoomId: string;
  customerRealityRoomId: string;
  systemRealityRoomId: string;
  reconciliationRoomId: string;
  customerReality: CustomerRealityVerdict;
  systemReality: SystemRealityVerdict;
  investigationVerdict: InvestigationVerdict;
  incidentReport: IncidentReport;
  conflicts: boolean;
  feedTimeline: RealityFeedEntry[];
  bandMessageIds: Record<string, string>;
  distinctBandAgents: boolean;
};

export const THEORY_DEMO_INCIDENT_IDS = new Set([
  "SYN-2026-0615-priya",
  "LEAP-2026-0614-7c9e2a1b",
]);

/** @deprecated use usesTheoryInvestigationPath */
export const REALITY_COLLISION_INCIDENT_ID = "SYN-2026-0615-priya";

export function usesTheoryInvestigationPath(incidentId: string): boolean {
  if (THEORY_DEMO_INCIDENT_IDS.has(incidentId)) return true;
  return false;
}

export function usesRealityCollisionPath(incidentId: string): boolean {
  return usesTheoryInvestigationPath(incidentId);
}

export function detectRedeliveryTheoryCase(evidence: {
  layer2_execution: { function_calls: { name: string; status?: string }[] };
  layer1_conversation: { segments: { speaker: string; text: string }[] };
}): boolean {
  const failedRedelivery = evidence.layer2_execution.function_calls.some(
    (c) => c.name === "schedule_redelivery" && c.status === "error",
  );
  const agentPromise = evidence.layer1_conversation.segments.some(
    (s) =>
      s.speaker === "agent" &&
      /bestätigt|confirmed|veranlasst|arranged|morgen|tomorrow|SMS/i.test(s.text),
  );
  return failedRedelivery && agentPromise;
}

export function shouldUseTheoryInvestigation(
  incidentId: string,
  evidence: Parameters<typeof detectRedeliveryTheoryCase>[0],
): boolean {
  if (usesTheoryInvestigationPath(incidentId)) return true;
  return detectRedeliveryTheoryCase(evidence);
}
