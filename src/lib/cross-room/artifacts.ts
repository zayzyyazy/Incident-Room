import { z } from "zod";
import { CausalHypothesisClassSchema } from "@/lib/cause-room/hypothesis-classes";
import { LocalizationFinding } from "@/lib/localization-room/types";

/** Band-native artifact posted when Room 1 completes — consumed by Room 2. */
export const CauseFindingArtifactSchema = z.object({
  type: z.literal("CauseFinding"),
  room: z.literal("cause"),
  version: z.number().int().min(1),
  incident_id: z.string(),
  cause_class: CausalHypothesisClassSchema,
  cause_statement: z.string(),
  band_room_id: z.string(),
  cites_band_message_ids: z.array(z.string()),
  recurrence_hint_request: z.boolean(),
  hypothesis_lifecycle: z.array(
    z.object({
      class: CausalHypothesisClassSchema,
      introduced_by: z.enum(["claim_tracer", "backend_witness", "causal_judge"]),
      status: z.string(),
      rejected_by: z.string().optional(),
      preserved_facts: z.array(z.string()),
      cites_band_message_id: z.string().optional(),
    }),
  ),
});

export type CauseFindingArtifact = z.infer<typeof CauseFindingArtifactSchema>;

/** Room 2 → Room 1 when implementation evidence contradicts cause. */
export const CauseRevisionRequestSchema = z.object({
  type: z.literal("CauseRevisionRequest"),
  from_room: z.literal("localization_room"),
  to_room: z.literal("cause_room"),
  incident_id: z.string(),
  current_cause_class: CausalHypothesisClassSchema,
  contradiction: z.string(),
  localization_evidence: z.array(
    z.object({
      surface: z.string(),
      finding: z.string(),
    }),
  ),
  requested_action: z.literal("REOPEN_CAUSE_ROOM"),
  cited_localization_message_ids: z.array(z.string()),
});

export type CauseRevisionRequest = z.infer<typeof CauseRevisionRequestSchema>;

export const CauseRevisionDecisionSchema = z.object({
  type: z.literal("CauseRevisionDecision"),
  decision: z.enum(["DEFEND", "REVISE", "INSUFFICIENT_EVIDENCE"]),
  old_cause_class: CausalHypothesisClassSchema,
  new_cause_class: CausalHypothesisClassSchema.optional(),
  reason: z.string(),
  cited_cause_message_ids: z.array(z.string()),
  cited_localization_message_ids: z.array(z.string()),
});

export type CauseRevisionDecision = z.infer<typeof CauseRevisionDecisionSchema>;

/** Room 1 → Room 2 when cause facts invalidate a localization mechanism. */
export const LocalizationRevisionRequestSchema = z.object({
  type: z.literal("LocalizationRevisionRequest"),
  from_room: z.literal("cause"),
  to_room: z.literal("localization"),
  incident_id: z.string(),
  requested_by: z.string(),
  contradicts_mechanism_id: z.string(),
  contradiction_en: z.string(),
  cites_band_message_ids: z.array(z.string()),
  cites_cause_artifacts: z.array(z.string()),
});

export type LocalizationRevisionRequest = z.infer<
  typeof LocalizationRevisionRequestSchema
>;

export const LocalizationRevisionDecisionSchema = z.object({
  type: z.literal("LocalizationRevisionDecision"),
  decision: z.enum(["HOLD", "REVISE"]),
  prior_mechanism_id: z.string(),
  revised_mechanism_id: z.string().optional(),
  rationale_en: z.string(),
  cites_band_message_ids: z.array(z.string()),
});

export type LocalizationRevisionDecision = z.infer<
  typeof LocalizationRevisionDecisionSchema
>;

/** Union of cross-room artifacts exchanged between rooms. */
export type CrossRoomArtifact =
  | CauseFindingArtifact
  | LocalizationFindingArtifact
  | CauseRevisionRequest
  | CauseRevisionDecision
  | LocalizationRevisionRequest
  | LocalizationRevisionDecision
  | import("@/lib/localization-room/types").InvestigationBreakthrough
  | import("@/lib/cross-room/cause-defense").CauseDefenseRequest
  | import("@/lib/cross-room/cause-defense").CauseDefenseDecision
  | import("@/lib/cross-room/localization-defense-verdict").LocalizationDefenseVerdict
  | import("@/lib/localization-room/types").LocalizationConfidenceChallenge;

export const LocalizationFindingArtifactSchema = z.object({
  type: z.literal("LocalizationFinding"),
  room: z.literal("localization"),
  version: z.number().int().min(1),
  incident_id: z.string(),
  input_cause_class: z.string(),
  input_cause_finding_artifact_id: z.string(),
  input_cause_band_room_id: z.string(),
  implementation_mechanism: z.object({
    canonical_id: z.string(),
    statement: z.string(),
    required_guard_missing: z.string().optional(),
  }),
  mechanism_explanation: z.string(),
  investigation_breakthrough: z
    .object({
      headline: z.string(),
      human_sentence: z.string(),
      mechanism_id: z.string(),
      discovered_by: z.string(),
    })
    .optional(),
  primary_surface: z.object({
    surface_id: z.string(),
    pointer: z.string(),
    surface_type: z.string(),
    label: z.string().optional(),
  }),
  supporting_surfaces: z
    .array(
      z.object({
        surface_id: z.string(),
        label: z.string(),
        role: z.string().optional(),
      }),
    )
    .optional(),
  band_room_id: z.string(),
  cites_band_message_ids: z.array(z.string()),
});

export type LocalizationFindingArtifact = z.infer<
  typeof LocalizationFindingArtifactSchema
>;

export function toLocalizationFindingArtifact(input: {
  incidentId: string;
  localizationRoomId: string;
  causeBandRoomId: string;
  causeFindingArtifactMessageId: string;
  finding: LocalizationFinding;
  breakthrough?: import("@/lib/localization-room/types").InvestigationBreakthrough;
}): LocalizationFindingArtifact {
  const f = input.finding;
  return {
    type: "LocalizationFinding",
    room: "localization",
    version: 1,
    incident_id: input.incidentId,
    input_cause_class: f.input_cause_class,
    input_cause_finding_artifact_id: input.causeFindingArtifactMessageId,
    input_cause_band_room_id: input.causeBandRoomId,
    implementation_mechanism: f.implementation_mechanism,
    mechanism_explanation: f.mechanism_explanation,
    investigation_breakthrough: input.breakthrough
      ? {
          headline: input.breakthrough.headline,
          human_sentence: input.breakthrough.human_sentence,
          mechanism_id: input.breakthrough.mechanism_id,
          discovered_by: input.breakthrough.discovered_by,
        }
      : undefined,
    primary_surface: {
      surface_id: f.primary_surface.surface_id,
      pointer: f.primary_surface.pointer.native_pointer,
      surface_type: f.primary_surface.surface_type,
      label: f.primary_surface.pointer.native_label,
    },
    supporting_surfaces: f.supporting_surfaces.map((s) => ({
      surface_id: s.surface_id,
      label: s.pointer.native_label,
      role: s.mechanism_fit_en,
    })),
    band_room_id: input.localizationRoomId,
    cites_band_message_ids: f.cites_band_message_ids,
  };
}

export function toCauseFindingArtifact(input: {
  incidentId: string;
  roomId: string;
  finding: {
    cause_class: string;
    cause: string;
    recurrence_hint_request: boolean;
    cites_band_message_ids: string[];
    hypothesis_lifecycle?: CauseFindingArtifact["hypothesis_lifecycle"];
  };
}): CauseFindingArtifact {
  return {
    type: "CauseFinding",
    room: "cause",
    version: 1,
    incident_id: input.incidentId,
    cause_class: input.finding.cause_class as CauseFindingArtifact["cause_class"],
    cause_statement: input.finding.cause,
    band_room_id: input.roomId,
    cites_band_message_ids: input.finding.cites_band_message_ids,
    recurrence_hint_request: input.finding.recurrence_hint_request,
    hypothesis_lifecycle: input.finding.hypothesis_lifecycle ?? [],
  };
}
