import { z } from "zod";
import {
  CausalHypothesisClassSchema,
  HypothesisStatusSchema,
} from "@/lib/cause-room/hypothesis-classes";

export const EvidenceCitationSchema = z.object({
  turn_ref: z.string().optional(),
  quote: z.string().optional(),
  source: z
    .enum(["transcript", "tool", "side_effect", "workflow", "hint"])
    .optional(),
  detail_en: z.string(),
  band_message_id: z.string().optional(),
});

export const ConsideredHypothesisSchema = z.object({
  hypothesis_class: CausalHypothesisClassSchema,
  hypothesis_en: z.string(),
  proposer: z.enum(["claim_tracer", "backend_witness", "causal_judge"]),
  status: HypothesisStatusSchema,
  rejected_by_en: z.string().optional(),
  cites_band_message_id: z.string().optional(),
});

export type ConsideredHypothesis = z.infer<typeof ConsideredHypothesisSchema>;

export const ClaimTracerInitialSchema = z.object({
  type: z.literal("claim_tracer_initial"),
  agent_role: z.literal("claim_tracer"),
  hypothesis_class: CausalHypothesisClassSchema,
  hypothesis_en: z.string(),
  customer_belief: z.string(),
  supporting_evidence: z.array(EvidenceCitationSchema),
  confidence: z.number().min(0).max(1),
});

export type ClaimTracerInitial = z.infer<typeof ClaimTracerInitialSchema>;

export const BackendWitnessInitialSchema = z.object({
  type: z.literal("backend_witness_initial"),
  agent_role: z.literal("backend_witness"),
  hypothesis_class: CausalHypothesisClassSchema,
  hypothesis_en: z.string(),
  execution_summary_en: z.string(),
  supporting_evidence: z.array(EvidenceCitationSchema),
  confidence: z.number().min(0).max(1),
});

export type BackendWitnessInitial = z.infer<typeof BackendWitnessInitialSchema>;

export const RuledOutHypothesisSchema = z.object({
  hypothesis_class: CausalHypothesisClassSchema,
  hypothesis_en: z.string(),
  ruled_out_by_en: z.string(),
  source_agent: z.enum(["claim_tracer", "backend_witness", "causal_judge"]),
  cites_band_message_id: z.string().optional(),
});

export const CausalJudgeTaskSchema = z.object({
  type: z.literal("causal_judge_task"),
  agent_role: z.literal("causal_judge"),
  task_en: z.string(),
  open_questions: z.array(z.string()),
  conversation_alone_sufficient: z.boolean(),
  execution_alone_sufficient: z.boolean(),
});

export type CausalJudgeTask = z.infer<typeof CausalJudgeTaskSchema>;

export const ChallengeTypeSchema = z.enum([
  "INCOMPLETE_CAUSE",
  "SUPPORT_BRIDGE",
  "CHALLENGE_BRIDGE",
]);

export const CausalJudgeBridgeSchema = z.object({
  type: z.literal("causal_judge_bridge"),
  agent_role: z.literal("causal_judge"),
  bridge_hypothesis_class: CausalHypothesisClassSchema,
  bridge_hypothesis_en: z.string(),
  neither_opening_sufficient: z.boolean(),
  stance: z.literal("INTRODUCE_BRIDGE").optional(),
  response_to_message_ids: z.array(z.string()).optional(),
  rejected_as_incomplete: z.array(CausalHypothesisClassSchema).optional(),
  why_neither_opening_survives: z.record(z.string(), z.string()).optional(),
  ruled_out: z.array(RuledOutHypothesisSchema),
  challenges_completeness_en: z.string(),
  cause_statement: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type CausalJudgeBridge = z.infer<typeof CausalJudgeBridgeSchema>;

export const CausalJudgeRefinementSchema = z.object({
  type: z.literal("causal_judge_refinement"),
  agent_role: z.literal("causal_judge"),
  prior_bridge_class: CausalHypothesisClassSchema,
  refined_bridge_class: CausalHypothesisClassSchema,
  refinement_en: z.string(),
  responds_to_band_message_ids: z.array(z.string()),
  novel_hypothesis_introduced: CausalHypothesisClassSchema.optional(),
  confidence: z.number().min(0).max(1),
});

export type CausalJudgeRefinement = z.infer<typeof CausalJudgeRefinementSchema>;

export const AgentStanceSchema = z.enum([
  "CHALLENGE",
  "SUPPORT",
  "YIELD",
  "PARTIAL_CHALLENGE",
]);

export const HypothesisLifecycleRecordSchema = z.object({
  class: CausalHypothesisClassSchema,
  introduced_by: z.enum(["claim_tracer", "backend_witness", "causal_judge"]),
  status: z.enum([
    "proposed",
    "rejected_as_incomplete",
    "refined",
    "accepted",
    "partially_challenged",
  ]),
  rejected_by: z.string().optional(),
  preserved_facts: z.array(z.string()),
  cites_band_message_id: z.string().optional(),
});

export type HypothesisLifecycleRecord = z.infer<
  typeof HypothesisLifecycleRecordSchema
>;

export const AuditTrailEntrySchema = z.object({
  verdict: z.enum(["accepted", "rejected"]),
  reason_en: z.string(),
  cites_band_message_ids: z.array(z.string()),
});

export const AgentChallengeSchema = z.object({
  type: z.literal("agent_challenge"),
  agent_role: z.enum(["claim_tracer", "backend_witness"]),
  round: z.number().int().min(1),
  stance: AgentStanceSchema,
  challenge_type: ChallengeTypeSchema,
  prior_hypothesis_class: CausalHypothesisClassSchema,
  updated_hypothesis_class: CausalHypothesisClassSchema,
  challenged_hypothesis_class: CausalHypothesisClassSchema,
  prior_hypothesis_en: z.string(),
  updated_hypothesis_en: z.string(),
  claim: z.string(),
  new_evidence_shared: z.array(z.string()),
  preserved_from_prior: z.array(z.string()),
  rejected_from_prior: z.array(z.string()),
  rejects_hypothesis_class: CausalHypothesisClassSchema.optional(),
  target_band_message_id: z.string(),
  target_post_type: z.string(),
  evidence_cited: z.array(EvidenceCitationSchema),
  explanation_en: z.string(),
  opinion_changed: z.boolean(),
});

export type AgentChallenge = z.infer<typeof AgentChallengeSchema>;

export const EvolutionActionSchema = z
  .string()
  .transform((value) => {
    const normalized = value.toUpperCase();
    const map: Record<string, string> = {
      NARROW: "NARROWED",
      NARROWED: "NARROWED",
      REFINE: "REFINED",
      REFINED: "REFINED",
      INTRODUCE: "INTRODUCED",
      INTRODUCED: "INTRODUCED",
      YIELD: "YIELD",
      YIELDED: "YIELD",
      WITHDRAW: "YIELD",
      WITHDRAWN: "YIELD",
      REJECT: "REJECTED",
      REJECTED: "REJECTED",
      HELD: "HELD",
      HOLD: "HELD",
      CHANGED: "REFINED",
      UPDATED: "REFINED",
      REVISED: "REFINED",
      MODIFIED: "REFINED",
    };
    return map[normalized] ?? "REFINED";
  })
  .pipe(
    z.enum(["HELD", "NARROWED", "YIELD", "INTRODUCED", "REFINED", "REJECTED"]),
  );

export const EvolutionEntrySchema = z.object({
  agent: z.enum(["claim_tracer", "backend_witness", "causal_judge"]),
  initial_hypothesis_class: CausalHypothesisClassSchema.nullable(),
  final_hypothesis_class: CausalHypothesisClassSchema,
  action: EvolutionActionSchema,
});

export const OpeningHypothesisRecordSchema = z.object({
  agent: z.enum(["claim_tracer", "backend_witness"]),
  class: CausalHypothesisClassSchema,
  status: z.enum(["rejected_as_incomplete", "refined", "accepted"]),
  preserved: z.string(),
  rejected: z.string(),
});

export const CauseFindingSchema = z.object({
  type: z.literal("cause_finding"),
  cause_class: CausalHypothesisClassSchema,
  cause: z.string(),
  final_incident_cause: z
    .object({
      class: CausalHypothesisClassSchema,
      statement: z.string(),
    })
    .optional(),
  accepted_after_debate: z.boolean().optional(),
  opening_hypotheses: z.array(OpeningHypothesisRecordSchema).optional(),
  bridge_hypothesis: z
    .object({
      introduced_by: z.literal("causal_judge"),
      class: CausalHypothesisClassSchema,
      supported_by: z.array(z.enum(["claim_tracer", "backend_witness"])),
    })
    .optional(),
  evidence: z.array(EvidenceCitationSchema),
  considered_hypotheses: z.array(ConsideredHypothesisSchema),
  ruled_out: z.array(RuledOutHypothesisSchema),
  confidence: z.number().min(0).max(1),
  recurrence_hint_request: z.boolean(),
  evolution: z.array(EvolutionEntrySchema),
  cites_band_message_ids: z.array(z.string()),
  hypothesis_lifecycle: z.array(HypothesisLifecycleRecordSchema).optional(),
  audit_trail: z
    .object({
      accepted_because: z.array(AuditTrailEntrySchema),
      rejected_because: z.array(AuditTrailEntrySchema),
    })
    .optional(),
});

export type CauseFinding = z.infer<typeof CauseFindingSchema>;

export type RoomPost =
  | ClaimTracerInitial
  | BackendWitnessInitial
  | CausalJudgeTask
  | CausalJudgeBridge
  | CausalJudgeRefinement
  | AgentChallenge
  | CauseFinding;

export type CauseRoomFeedEntry = {
  agentId: string;
  messageId: string;
  bandEventKind: string;
  content: string;
  payload?: unknown;
};

export type CauseRoomBandMessageIds = {
  claimTracerInitial: string;
  backendWitnessToolEvents: string[];
  backendWitnessInitial: string;
  claimTracerChallenge1: string;
  backendWitnessChallenge1: string;
  causalJudgeTask: string;
  causalJudgeBridge: string;
  claimTracerChallenge2: string;
  backendWitnessChallenge2: string;
  causalJudgeRefinement: string;
  causeFinding: string;
  causeFindingArtifact: string;
};

export type BandPostContext = {
  messageId: string;
  agentRole: "claim_tracer" | "backend_witness" | "causal_judge";
  postType: string;
  bandEventKind?: string;
  payload?: unknown;
};

export function bandMetadataForCauseRoom(
  messageType: string,
  payload: RoomPost | Record<string, unknown>,
  options?: {
    replyToMessageId?: string;
    agentRole?: string;
    displayName?: string;
  },
) {
  const agentRole =
    options?.agentRole ??
    ("agent_role" in payload ? String(payload.agent_role) : "cause_room");

  return {
    agentRole,
    displayName: options?.displayName,
    type: messageType,
    replyToMessageId: options?.replyToMessageId,
    payload,
  };
}
