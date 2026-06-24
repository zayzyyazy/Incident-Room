import { z } from "zod";

export const EvidenceCitationKindSchema = z.enum([
  "transcript",
  "tool_call",
  "side_effect",
  "investigation_beat",
]);

export type EvidenceCitationKind = z.infer<typeof EvidenceCitationKindSchema>;

export const EvidencePoolItemSchema = z.object({
  id: z.string(),
  kind: EvidenceCitationKindSchema,
  ref: z.string(),
  quote: z.string(),
  speaker: z.enum(["agent", "customer", "system"]).optional(),
  label: z.string().optional(),
  status: z.enum(["success", "error", "timeout"]).optional(),
  http_status: z.number().optional(),
  detail: z.string().optional(),
});

export type EvidencePoolItem = z.infer<typeof EvidencePoolItemSchema>;

export const EvidenceCitationSchema = z.object({
  id: z.string(),
  kind: EvidenceCitationKindSchema,
  ref: z.string(),
  quote: z.string(),
  significance: z.string(),
});

export type EvidenceCitation = z.infer<typeof EvidenceCitationSchema>;

export const IncidentPdfBriefSchema = z.object({
  executive_summary: z.string(),
  verdict_statement: z.string(),
  what_customer_believed: z.string(),
  what_agent_communicated: z.string(),
  what_backend_did: z.string(),
  the_gap: z.string(),
  evidence_citations: z.array(EvidenceCitationSchema).min(2).max(10),
  rejected_theory: z.object({
    label: z.string(),
    reason: z.string(),
  }),
  surviving_explanation: z.string(),
  fix_target: z.string(),
  fix_detail: z.string(),
  investigation_note: z.string().optional(),
  workflow_surface: z.string().optional(),
  workflow_binding: z.string().optional(),
  revision: z.number().optional(),
});

export type IncidentPdfBrief = z.infer<typeof IncidentPdfBriefSchema>;
