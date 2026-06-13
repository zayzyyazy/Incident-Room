import { z } from "zod";

export const TranscriptSegmentSchema = z.object({
  turn_id: z.string(),
  speaker: z.enum(["agent", "customer", "system"]),
  text: z.string(),
  start_sec: z.number().optional(),
});

export const BehavioralHintSchema = z.object({
  type: z.string(),
  turn_ref: z.string(),
  note: z.string(),
});

export const FunctionCallSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
  result: z.unknown().optional(),
  status: z.enum(["success", "error", "timeout"]).optional(),
  turn_ref: z.string().optional(),
  http_status: z.number().optional(),
  error_message: z.string().optional(),
});

export const SideEffectsSchema = z.object({
  appointment_created: z.boolean(),
  appointment_id: z.string().nullable(),
  sms_sent: z.boolean().optional(),
  crm_record_exists: z.boolean().optional(),
});

export const VoiceIncidentEvidenceSchema = z.object({
  incident_id: z.string(),
  source_platform: z.enum([
    "leaping",
    "vapi",
    "retell",
    "bland",
    "synthetic",
  ]),
  title: z.string(),
  call_metadata: z
    .object({
      duration_sec: z.number(),
      status: z.string(),
      agent_id: z.string().optional(),
      recording_url: z.string().optional(),
      leaping_call_id: z.string().optional(),
    })
    .optional(),
  layer1_conversation: z.object({
    transcript: z.string(),
    segments: z.array(TranscriptSegmentSchema),
    intent: z.string().optional(),
    behavioral_hints: z.array(BehavioralHintSchema).optional(),
  }),
  layer2_execution: z.object({
    function_calls: z.array(FunctionCallSchema),
    side_effects: SideEffectsSchema,
    transitions: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
  layer3_customer: z.record(z.string(), z.unknown()).optional(),
});

export type VoiceIncidentEvidence = z.infer<typeof VoiceIncidentEvidenceSchema>;
