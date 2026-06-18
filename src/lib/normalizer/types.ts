import { z } from "zod";

/** Structural split only — no interpretation, confidence, or verdict fields. */

export const TranscriptTurnSchema = z.object({
  turn_id: z.string(),
  speaker: z.string(),
  text: z.string(),
  start_sec: z.number().optional(),
});

export const TranscriptPacketSchema = z.object({
  turns: z.array(TranscriptTurnSchema),
  speaker_labels: z.array(z.string()),
  timestamps: z.array(z.number()),
});

export const ToolCallRecordSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
  turn_ref: z.string().optional(),
  http_status: z.number().optional(),
  error_message: z.string().optional(),
});

export const ToolResultRecordSchema = z.object({
  tool_name: z.string(),
  result: z.unknown().optional(),
  turn_ref: z.string().optional(),
});

export const ToolErrorRecordSchema = z.object({
  tool_name: z.string(),
  status: z.string().optional(),
  http_status: z.number().optional(),
  error_message: z.string().optional(),
  turn_ref: z.string().optional(),
});

export const SideEffectRecordSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export const ToolTracePacketSchema = z.object({
  tool_calls: z.array(ToolCallRecordSchema),
  tool_results: z.array(ToolResultRecordSchema),
  errors: z.array(ToolErrorRecordSchema),
  side_effects: z.array(SideEffectRecordSchema),
});

export const DefinitionNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const DefinitionEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export const ToolBindingSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  method: z.string().optional(),
  description: z.string().optional(),
});

export const PromptRecordSchema = z.object({
  scope: z.string(),
  ref: z.string().optional(),
  excerpt: z.string(),
});

export const GuardRecordSchema = z.object({
  ref: z.string(),
  kind: z.string().optional(),
  description: z.string().optional(),
});

export const DefinitionPacketSchema = z.object({
  nodes: z.array(DefinitionNodeSchema),
  edges: z.array(DefinitionEdgeSchema),
  tool_bindings: z.array(ToolBindingSchema),
  prompts: z.array(PromptRecordSchema),
  guards: z.array(GuardRecordSchema),
});

export const RoutingStatusSchema = z.object({
  has_transcript: z.boolean(),
  has_tool_trace: z.boolean(),
  has_definition: z.boolean(),
});

export const RoutedEvidenceSchema = z.object({
  transcript_packet: TranscriptPacketSchema,
  tool_trace_packet: ToolTracePacketSchema,
  definition_packet: DefinitionPacketSchema,
  routing_status: RoutingStatusSchema,
});

export type TranscriptPacket = z.infer<typeof TranscriptPacketSchema>;
export type ToolTracePacket = z.infer<typeof ToolTracePacketSchema>;
export type DefinitionPacket = z.infer<typeof DefinitionPacketSchema>;
export type RoutingStatus = z.infer<typeof RoutingStatusSchema>;
export type RoutedEvidence = z.infer<typeof RoutedEvidenceSchema>;

export const EvidencePacketKindSchema = z.enum([
  "transcript_packet",
  "tool_trace_packet",
  "definition_packet",
]);

export type EvidencePacketKind = z.infer<typeof EvidencePacketKindSchema>;

export const NormalizerRoutingArtifactSchema = z.object({
  type: z.literal("NormalizerRouting"),
  routing_status: RoutingStatusSchema,
  packet_counts: z.object({
    transcript_turns: z.number(),
    tool_calls: z.number(),
    definition_nodes: z.number(),
  }),
});

export type NormalizerRoutingArtifact = z.infer<
  typeof NormalizerRoutingArtifactSchema
>;

export const NormalizerEvidenceRequestSchema = z.object({
  type: z.literal("NormalizerEvidenceRequest"),
  requesting_agent: z.string(),
  requested_packet: EvidencePacketKindSchema,
  ref: z.string().optional(),
  mention: z.string(),
});

export type NormalizerEvidenceRequest = z.infer<
  typeof NormalizerEvidenceRequestSchema
>;

export const NormalizerEvidenceDeliverySchema = z.object({
  type: z.literal("NormalizerEvidenceDelivery"),
  requested_packet: EvidencePacketKindSchema,
  ref: z.string().optional(),
  payload: z.unknown(),
});

export type NormalizerEvidenceDelivery = z.infer<
  typeof NormalizerEvidenceDeliverySchema
>;
