import { z } from "zod";
import {
  CanonicalSuspectSurfaceSchema,
  ImplementationMechanismSchema,
} from "@/lib/canonical/surface-types";

/** Room 2 Band roles — locked identities. */
export const LocalizationInvestigatorRoleSchema = z.enum([
  "control_flow_investigator",
  "policy_investigator",
  "guard_investigator",
  "localization_judge",
]);

export type LocalizationInvestigatorRole = z.infer<
  typeof LocalizationInvestigatorRoleSchema
>;

export const SurfaceInvestigatorRoleSchema = z.enum([
  "control_flow_investigator",
  "policy_investigator",
  "guard_investigator",
]);

export type SurfaceInvestigatorRole = z.infer<
  typeof SurfaceInvestigatorRoleSchema
>;

/** Round 1 — investigator opens with a suspected culprit surface (not a ranked answer). */
export const SurfaceOpeningSchema = z.object({
  type: z.literal("surface_opening"),
  investigator_role: SurfaceInvestigatorRoleSchema,
  claim_en: z.string(),
  suspected_surface: CanonicalSuspectSurfaceSchema,
});

export type SurfaceOpening = z.infer<typeof SurfaceOpeningSchema>;

/** Round 2 — investigator attacks another's surface as an incomplete explanation. */
export const SurfaceAttackSchema = z.object({
  type: z.literal("surface_attack"),
  attacker_role: SurfaceInvestigatorRoleSchema,
  challenged_role: SurfaceInvestigatorRoleSchema,
  challenged_surface_id: z.string(),
  claim_en: z.string(),
  rejects_as_complete_cause: z.boolean(),
  redirect_surface_id: z.string().optional(),
  cites_band_message_id: z.string(),
});

export type SurfaceAttack = z.infer<typeof SurfaceAttackSchema>;

/** Explicit wrong-theory admission — required before Breakthrough artifact. */
export const InvestigatorAdmissionSchema = z.object({
  type: z.literal("investigator_admission"),
  investigator_role: SurfaceInvestigatorRoleSchema,
  admission_kind: z.enum(["REJECTED_MY_PRIOR", "YIELD", "I_WAS_WRONG"]),
  admission_en: z.string(),
  rejected_prior_surface_id: z.string().optional(),
  cites_band_message_id: z.string(),
});

export type InvestigatorAdmission = z.infer<typeof InvestigatorAdmissionSchema>;

/** Round 2 — counterattack before breakthrough. */
export const SurfaceCounterattackSchema = z.object({
  type: z.literal("surface_counterattack"),
  attacker_role: SurfaceInvestigatorRoleSchema,
  challenged_role: SurfaceInvestigatorRoleSchema,
  claim_en: z.string(),
  cites_band_message_id: z.string(),
});

export type SurfaceCounterattack = z.infer<typeof SurfaceCounterattackSchema>;

/** Challenge that primary surface was earned, not guessed. */
export const LocalizationConfidenceChallengeSchema = z.object({
  type: z.literal("LocalizationConfidenceChallenge"),
  challenger_role: SurfaceInvestigatorRoleSchema,
  challenged_surface_id: z.string(),
  question_en: z.string(),
  cites_band_message_id: z.string(),
});

export type LocalizationConfidenceChallenge = z.infer<
  typeof LocalizationConfidenceChallengeSchema
>;

export const SurfaceConfidenceDefenseSchema = z.object({
  type: z.literal("surface_confidence_defense"),
  defender_role: SurfaceInvestigatorRoleSchema,
  claim_en: z.string(),
  cites_challenge_message_id: z.string(),
});

export type SurfaceConfidenceDefense = z.infer<
  typeof SurfaceConfidenceDefenseSchema
>;

/** Surfaces ruled out as sufficient explanations after cross-examination. */
export const EliminatedExplanationSchema = z.object({
  type: z.literal("eliminated_explanation"),
  ruled_out_surface_id: z.string(),
  ruled_out_label: z.string(),
  reason_en: z.string(),
  ruled_out_by: SurfaceInvestigatorRoleSchema.or(
    z.literal("localization_judge"),
  ),
});

export type EliminatedExplanation = z.infer<typeof EliminatedExplanationSchema>;

/** Investigator notices inconsistency and discovers the mechanism — not the judge. */
export const MechanismDiscoverySchema = z.object({
  type: z.literal("mechanism_discovery"),
  discovered_by: SurfaceInvestigatorRoleSchema,
  discovery_en: z.string(),
  mechanism: ImplementationMechanismSchema,
  emerged_from_conflict: z.string(),
  none_proposed_initially: z.literal(true),
  cites_band_message_ids: z.array(z.string()),
});

export type MechanismDiscovery = z.infer<typeof MechanismDiscoverySchema>;

/** Investigator updates theory after a peer discovers the mechanism. */
export const InvestigatorYieldSchema = z.object({
  type: z.literal("investigator_yield"),
  investigator_role: SurfaceInvestigatorRoleSchema,
  yield_en: z.string(),
  accepts_mechanism_id: z.string(),
  cites_discovery_message_id: z.string(),
});

export type InvestigatorYield = z.infer<typeof InvestigatorYieldSchema>;

/** Judge formalizes — referee only, cites investigator discovery. */
export const MechanismFormalizationSchema = z.object({
  type: z.literal("mechanism_formalization"),
  role: z.literal("localization_judge"),
  formalization_en: z.string(),
  cites_discovery_message_id: z.string(),
  cites_band_message_ids: z.array(z.string()),
});

export type MechanismFormalization = z.infer<
  typeof MechanismFormalizationSchema
>;

/** First-class demo artifact — the 3-second breakthrough moment. */
export const InvestigationBreakthroughSchema = z.object({
  type: z.literal("InvestigationBreakthrough"),
  room: z.literal("localization"),
  headline: z.string(),
  human_sentence: z.string(),
  mechanism_id: z.string(),
  discovered_by: SurfaceInvestigatorRoleSchema,
  cites_band_message_ids: z.array(z.string()),
});

export type InvestigationBreakthrough = z.infer<
  typeof InvestigationBreakthroughSchema
>;

/** @deprecated Legacy candidate shape — prefer surface_opening + surface_attack arc. */
export const SurfaceCandidateInvestigatorRoleSchema = z.enum([
  "control_flow_investigator",
  "policy_investigator",
  "guard_investigator",
]);

export type SurfaceCandidateInvestigatorRole = z.infer<
  typeof SurfaceCandidateInvestigatorRoleSchema
>;

export const SurfaceCandidateSchema = z.object({
  type: z.literal("surface_candidate"),
  investigator_role: SurfaceCandidateInvestigatorRoleSchema,
  surface: CanonicalSuspectSurfaceSchema,
});

export type SurfaceCandidate = z.infer<typeof SurfaceCandidateSchema>;

export const LocalizationFindingSchema = z.object({
  type: z.literal("localization_finding"),
  incident_id: z.string(),
  input_cause_class: z.string(),
  input_cause_finding_artifact_id: z.string().optional(),
  implementation_mechanism: ImplementationMechanismSchema,
  mechanism_explanation: z.string(),
  mechanism_emerged_from: z.string(),
  primary_surface: CanonicalSuspectSurfaceSchema,
  supporting_surfaces: z.array(CanonicalSuspectSurfaceSchema),
  eliminated_explanations: z.array(EliminatedExplanationSchema),
  /** @deprecated Use supporting_surfaces — kept for backward compatibility. */
  ranked_suspect_surfaces: z.array(CanonicalSuspectSurfaceSchema).optional(),
  recommended_investigation_target: z.string(),
  cites_band_message_ids: z.array(z.string()),
  cause_revision_request: z
    .object({
      warranted: z.boolean(),
      reason_en: z.string().optional(),
    })
    .optional(),
});

export type LocalizationFinding = z.infer<typeof LocalizationFindingSchema>;

export type LocalizationInvestigationArc = {
  opening: SurfaceOpening;
  attacks: SurfaceAttack[];
  counterattack: SurfaceCounterattack;
  investigatorAdmission: InvestigatorAdmission;
  eliminations: EliminatedExplanation[];
  mechanismDiscovery: MechanismDiscovery;
  investigationBreakthrough: InvestigationBreakthrough;
  investigatorYields: InvestigatorYield[];
  confidenceChallenge: LocalizationConfidenceChallenge;
  confidenceDefense: SurfaceConfidenceDefense;
  judgeFormalization: MechanismFormalization;
  finding: LocalizationFinding;
  surfaceCandidates: SurfaceCandidate[];
  /** When set, localization pauses for Cause Room revision before breakthrough. */
  pendingCauseRevision?: boolean;
};
