import { CanonicalSuspectSurface } from "@/lib/canonical/surface-types";
import { CauseFindingArtifact } from "@/lib/cross-room/artifacts";
import {
  InvestigatorAdmission,
  LocalizationFinding,
  LocalizationInvestigationArc,
  MechanismDiscovery,
  SurfaceAttack,
  SurfaceOpening,
  SurfaceCounterattack,
  InvestigationBreakthrough,
  InvestigatorYield,
} from "@/lib/localization-room/types";

const INTENT_ROUTER_SURFACE = "workflow.intent_router.cancel_subscription";
const FALLBACK_DIALOGUE = "workflow.general_support_fallback.dialogue";

function revisionSurfaces(causeClass: string): {
  intentRouter: CanonicalSuspectSurface;
  fallbackDialogue: CanonicalSuspectSurface;
  emailGuard: CanonicalSuspectSurface;
} {
  return {
    intentRouter: {
      surface_id: INTENT_ROUTER_SURFACE,
      surface_type: "workflow_branch",
      mechanism_fit_en:
        "cancel_subscription intent routes to fallback — tool never reachable",
      fit_to_cause_class: causeClass,
      confidence: 0.91,
      supported_by: ["control_flow_investigator"],
      pointer: {
        platform: "custom",
        native_pointer: `/workflow/nodes[intent_router]/cases/cancel_subscription`,
        native_label: "Intent Router · cancel_subscription",
        native_kind: "switch_case",
      },
    },
    fallbackDialogue: {
      surface_id: FALLBACK_DIALOGUE,
      surface_type: "dialogue_stage",
      mechanism_fit_en:
        "Fallback dialogue confirms cancellation without invoking cancel_subscription",
      fit_to_cause_class: causeClass,
      confidence: 0.87,
      supported_by: ["policy_investigator"],
      pointer: {
        platform: "custom",
        native_pointer: `/workflow/nodes[general_support_fallback]/prompt`,
        native_label: "General Support Fallback",
        native_kind: "dialogue",
      },
    },
    emailGuard: {
      surface_id: "function.send_confirmation_email.missing_record_guard",
      surface_type: "confirmation_guard",
      mechanism_fit_en:
        "send_confirmation_email failed because no cancellation_record_id exists",
      fit_to_cause_class: causeClass,
      confidence: 0.84,
      supported_by: ["guard_investigator"],
      pointer: {
        platform: "custom",
        native_pointer: `/workflow/nodes[send_confirmation_email]/guard`,
        native_label: "send_confirmation_email",
        native_kind: "api_call",
      },
    },
  };
}

/** Pre-revision phase — ends with pendingCauseRevision before breakthrough. */
export function buildRevisionPreRevisionArc(input: {
  causeArtifact: CauseFindingArtifact;
}): LocalizationInvestigationArc {
  const causeClass = input.causeArtifact.cause_class;
  const surfaces = revisionSurfaces(causeClass);

  const opening: SurfaceOpening = {
    type: "surface_opening",
    investigator_role: "control_flow_investigator",
    claim_en:
      "cancel_subscription routes to general_support_fallback — cancel_subscription tool is never on this path.",
    suspected_surface: surfaces.intentRouter,
  };

  const attacks: SurfaceAttack[] = [
    {
      type: "surface_attack",
      attacker_role: "guard_investigator",
      challenged_role: "control_flow_investigator",
      challenged_surface_id: surfaces.intentRouter.surface_id,
      claim_en:
        "Routing alone is incomplete — send_confirmation_email still failed because no cancellation record existed.",
      rejects_as_complete_cause: true,
      redirect_surface_id: surfaces.emailGuard.surface_id,
      cites_band_message_id: "pending-cfi-opening",
    },
  ];

  const counterattack: SurfaceCounterattack = {
    type: "surface_counterattack",
    attacker_role: "control_flow_investigator",
    challenged_role: "guard_investigator",
    claim_en:
      "Counter — guard failure is downstream. Root issue is unreachable cancel_subscription on this branch.",
    cites_band_message_id: "pending-gi-attack",
  };

  const investigatorAdmission: InvestigatorAdmission = {
    type: "investigator_admission",
    investigator_role: "control_flow_investigator",
    admission_kind: "REJECTED_MY_PRIOR",
    admission_en:
      "I was wrong — failed execution cannot be primary cause if cancel_subscription was never reachable.",
    cites_band_message_id: "pending-gi-counterattack",
  };

  const mechanism = {
    canonical_id: "success_confirmation_on_unreachable_tool_path" as const,
    statement:
      "Customer-facing success confirmation can occur on a workflow path that never invokes the required write tool",
    required_guard_missing:
      "block confirm language when required write tool is unreachable on routed path",
  };

  const mechanismDiscovery: MechanismDiscovery = {
    type: "mechanism_discovery",
    discovered_by: "control_flow_investigator",
    discovery_en:
      "Cancellation intent routes to fallback dialogue, not cancel_subscription — confirmation precedes any tool write.",
    mechanism,
    emerged_from_conflict:
      "Guard showed email guard failure; Control Flow proved tool unreachable — execution failure was not primary.",
    none_proposed_initially: true,
    cites_band_message_ids: [],
  };

  const investigationBreakthrough: InvestigationBreakthrough = {
    type: "InvestigationBreakthrough",
    room: "localization",
    headline: "Confirmation on unreachable tool path",
    human_sentence:
      "The cancellation intent routes to fallback dialogue, not the cancel_subscription tool.",
    mechanism_id: mechanism.canonical_id,
    discovered_by: "control_flow_investigator",
    cites_band_message_ids: [],
  };

  const placeholderFinding: LocalizationFinding = {
    type: "localization_finding",
    incident_id: input.causeArtifact.incident_id,
    input_cause_class: causeClass,
    implementation_mechanism: mechanism,
    mechanism_explanation: investigationBreakthrough.human_sentence,
    mechanism_emerged_from: mechanismDiscovery.emerged_from_conflict,
    primary_surface: surfaces.intentRouter,
    supporting_surfaces: [surfaces.fallbackDialogue, surfaces.emailGuard],
    eliminated_explanations: [],
    recommended_investigation_target: surfaces.intentRouter.surface_id,
    cites_band_message_ids: [],
  };

  return {
    opening,
    attacks,
    counterattack,
    investigatorAdmission,
    eliminations: [],
    mechanismDiscovery,
    investigationBreakthrough,
    investigatorYields: [],
    confidenceChallenge: {
      type: "LocalizationConfidenceChallenge",
      challenger_role: "guard_investigator",
      challenged_surface_id: surfaces.intentRouter.surface_id,
      question_en:
        "Could the same mechanism exist on billing_question path alone?",
      cites_band_message_id: "pending",
    },
    confidenceDefense: {
      type: "surface_confidence_defense",
      defender_role: "control_flow_investigator",
      claim_en: "No — cancel_subscription case is the unreachable write path.",
      cites_challenge_message_id: "pending",
    },
    judgeFormalization: {
      type: "mechanism_formalization",
      role: "localization_judge",
      formalization_en: "Pending Cause Room revision before formalization.",
      cites_discovery_message_id: "pending",
      cites_band_message_ids: [],
    },
    finding: placeholderFinding,
    surfaceCandidates: [
      {
        type: "surface_candidate",
        investigator_role: "control_flow_investigator",
        surface: surfaces.intentRouter,
      },
    ],
    pendingCauseRevision: true,
  };
}

/** Post-revision localization arc after Cause Room revises cause. */
export function buildRevisionPostRevisionArc(input: {
  causeArtifact: CauseFindingArtifact;
}): LocalizationInvestigationArc {
  const causeClass = input.causeArtifact.cause_class;
  const surfaces = revisionSurfaces(causeClass);

  const mechanism = {
    canonical_id: "success_confirmation_on_unreachable_tool_path" as const,
    statement:
      "Agent confirmed cancellation on a path where cancel_subscription was never invoked",
    required_guard_missing:
      "block confirm language when required write tool is unreachable on routed path",
  };

  const investigatorAdmission: InvestigatorAdmission = {
    type: "investigator_admission",
    investigator_role: "policy_investigator",
    admission_kind: "I_WAS_WRONG",
    admission_en:
      "I was wrong to treat send_confirmation_email failure as proof of execution failure — the write tool was never reachable.",
    rejected_prior_surface_id: surfaces.emailGuard.surface_id,
    cites_band_message_id: "pending-revised-intake",
  };

  const mechanismDiscovery: MechanismDiscovery = {
    type: "mechanism_discovery",
    discovered_by: "policy_investigator",
    discovery_en:
      "Fallback dialogue emits cancellation language without cancel_subscription on the routed path.",
    mechanism,
    emerged_from_conflict:
      "Revised cause removes execution failure; mechanism is unreachable write tool on routed path.",
    none_proposed_initially: true,
    cites_band_message_ids: [],
  };

  const investigationBreakthrough: InvestigationBreakthrough = {
    type: "InvestigationBreakthrough",
    room: "localization",
    headline: "Confirmation on unreachable tool path",
    human_sentence:
      "The cancellation intent routes to fallback dialogue, not the cancel_subscription tool.",
    mechanism_id: mechanism.canonical_id,
    discovered_by: "policy_investigator",
    cites_band_message_ids: [],
  };

  const investigatorYields: InvestigatorYield[] = [
    {
      type: "investigator_yield",
      investigator_role: "guard_investigator",
      yield_en:
        "Yielding — email guard failure is real but secondary; primary surface is intent router case.",
      accepts_mechanism_id: mechanism.canonical_id,
      cites_discovery_message_id: "pending-discovery",
    },
  ];

  const finding: LocalizationFinding = {
    type: "localization_finding",
    incident_id: input.causeArtifact.incident_id,
    input_cause_class: causeClass,
    implementation_mechanism: mechanism,
    mechanism_explanation: investigationBreakthrough.human_sentence,
    mechanism_emerged_from: mechanismDiscovery.emerged_from_conflict,
    primary_surface: surfaces.intentRouter,
    supporting_surfaces: [surfaces.fallbackDialogue, surfaces.emailGuard],
    eliminated_explanations: [],
    recommended_investigation_target: surfaces.intentRouter.surface_id,
    cites_band_message_ids: [],
  };

  return {
    opening: {
      type: "surface_opening",
      investigator_role: "control_flow_investigator",
      claim_en:
        "Restarting with revised cause — mapping unreachable cancel_subscription route.",
      suspected_surface: surfaces.intentRouter,
    },
    attacks: [],
    counterattack: {
      type: "surface_counterattack",
      attacker_role: "control_flow_investigator",
      challenged_role: "guard_investigator",
      claim_en: "N/A — post-revision restart.",
      cites_band_message_id: "pending",
    },
    investigatorAdmission,
    eliminations: [],
    mechanismDiscovery,
    investigationBreakthrough,
    investigatorYields,
    confidenceChallenge: {
      type: "LocalizationConfidenceChallenge",
      challenger_role: "guard_investigator",
      challenged_surface_id: surfaces.intentRouter.surface_id,
      question_en: "Could billing_question path show the same unreachable-tool pattern?",
      cites_band_message_id: "pending-breakthrough",
    },
    confidenceDefense: {
      type: "surface_confidence_defense",
      defender_role: "policy_investigator",
      claim_en:
        "No — cancel_subscription case uniquely routes to fallback without the write tool.",
      cites_challenge_message_id: "pending-challenge",
    },
    judgeFormalization: {
      type: "mechanism_formalization",
      role: "localization_judge",
      formalization_en:
        "Arbitration: unreachable-tool mechanism survives revised cause. Formalizing primary router surface.",
      cites_discovery_message_id: "pending-discovery",
      cites_band_message_ids: [],
    },
    finding,
    surfaceCandidates: [
      {
        type: "surface_candidate",
        investigator_role: "control_flow_investigator",
        surface: surfaces.intentRouter,
      },
    ],
  };
}
