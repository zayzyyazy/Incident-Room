import { z } from "zod";

export const ConversationVerdictSchema = z.enum([
  "appears_resolved",
  "appears_unresolved",
  "ambiguous",
]);

export const SpokenEntitySchema = z.object({
  key: z.string(),
  value_as_spoken: z.string(),
  turn_ref: z.string().optional(),
  quote_de: z.string().optional(),
});

export const ConversationAnalysisSchema = z.object({
  type: z.literal("conversation_analysis"),
  agent_role: z.literal("conversation_analyst"),
  conversation_verdict: ConversationVerdictSchema,
  summary_en: z.string(),
  customer_perception: z.string(),
  spoken_entities: z.array(SpokenEntitySchema),
  notable_turns: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ConversationAnalysis = z.infer<typeof ConversationAnalysisSchema>;

export const ExecutionVerdictSchema = z.enum([
  "outcome_achieved",
  "outcome_failed",
  "outcome_uncertain",
]);

export const FailureClassSchema = z.enum([
  "parameter_drift",
  "silent_tool_error",
  "backend_failure",
  "noop_side_effect",
  "workflow_continued_after_error",
]);

export const ToolFailureSchema = z.object({
  tool_name: z.string(),
  failure_class: FailureClassSchema,
  detail_en: z.string(),
  turn_ref: z.string().optional(),
});

export const OutcomeAnalysisSchema = z.object({
  type: z.literal("outcome_analysis"),
  agent_role: z.literal("outcome_investigator"),
  execution_verdict: ExecutionVerdictSchema,
  summary_en: z.string(),
  tool_failures: z.array(ToolFailureSchema),
  side_effects_observed: z.record(z.string(), z.unknown()),
  contradicts_msg_id: z.string().nullable(),
  contradiction_reason_en: z.string().nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

export type OutcomeAnalysis = z.infer<typeof OutcomeAnalysisSchema>;

export function bandMetadataForAnalysis(
  messageType: "conversation_analysis" | "outcome_analysis",
  payload: ConversationAnalysis | OutcomeAnalysis,
  bandMessageId?: string,
) {
  return {
    agentRole: payload.agent_role,
    type: messageType,
    bandMessageId,
    payload,
  };
}
