import { CanonicalSuspectSurface } from "@/lib/canonical/surface-types";
import { CauseFindingArtifact } from "@/lib/cross-room/artifacts";
import {
  EliminatedExplanation,
  InvestigatorYield,
  InvestigationBreakthrough,
  LocalizationFinding,
  LocalizationInvestigationArc,
  MechanismDiscovery,
  MechanismFormalization,
  SurfaceAttack,
  SurfaceCandidate,
  SurfaceOpening,
  SurfaceCounterattack,
  SurfaceConfidenceDefense,
  LocalizationConfidenceChallenge,
  InvestigatorAdmission,
} from "@/lib/localization-room/types";

const ANLIEGEN_STAGE = "6e34730e-43f5-49ac-8e4b-571f1a6ce3f8";
const SWITCH_DEFAULT = "c6754cc3-030f-4f1b-96c2-b3797a00d10b-default";
const PRE_COMPLETE = "23075e2c-a16f-403a-8bbd-0356a093902d";

function buildSurfaces(input: {
  causeClass: string;
  handoffTool: string;
}): {
  handoffBranch: CanonicalSuspectSurface;
  dialogueStage: CanonicalSuspectSurface;
  toolContract: CanonicalSuspectSurface;
  preComplete: CanonicalSuspectSurface;
} {
  const { causeClass, handoffTool } = input;

  const handoffBranch: CanonicalSuspectSurface = {
    surface_id: "switch.sonstiges.default_handoff_path",
    surface_type: "workflow_branch",
    mechanism_fit_en:
      "Routes sonstiges intent to handoff — necessary context, not sufficient cause alone",
    fit_to_cause_class: causeClass,
    confidence: 0.82,
    supported_by: ["control_flow_investigator"],
    pointer: {
      platform: "leaping",
      native_pointer: `/stages[id=${SWITCH_DEFAULT}]`,
      native_label: "Switch Stage · Default (sonstiges)",
      native_kind: "transition",
    },
  };

  const dialogueStage: CanonicalSuspectSurface = {
    surface_id: "stage.anliegenaufnahme_email.schritt_split",
    surface_type: "dialogue_stage",
    mechanism_fit_en:
      "Primary evidence pointer — Schritt 1 / Schritt 3 ordering exposes the mechanism",
    fit_to_cause_class: causeClass,
    confidence: 0.88,
    supported_by: ["policy_investigator"],
    pointer: {
      platform: "leaping",
      native_pointer: `/stages[id=${ANLIEGEN_STAGE}]/stage_message`,
      native_label: "Anliegenaufnahme + Email",
      native_kind: "stage_message",
    },
    evidence: [
      {
        kind: "step_ordering",
        observed: "Schritt 1 dialogue precedes Schritt 3 Übermittlung gate",
        missing: "guard blocking confirm language before tool outcome",
      },
    ],
  };

  const toolContract: CanonicalSuspectSurface = {
    surface_id: `function.${handoffTool}.no_pre_utterance_block`,
    surface_type: "confirmation_guard",
    mechanism_fit_en:
      `${handoffTool} contract — Schritt 3 gate exists but does not cover Schritt 1 leakage`,
    fit_to_cause_class: causeClass,
    confidence: 0.76,
    supported_by: ["guard_investigator"],
    pointer: {
      platform: "leaping",
      native_pointer: `/functions[name=${handoffTool}]`,
      native_label: handoffTool,
      native_kind: "api_call",
    },
  };

  const preComplete: CanonicalSuspectSurface = {
    surface_id: "field_setter.pre_complete_before_handoff",
    surface_type: "state_transition",
    mechanism_fit_en:
      "Completion flag set before handoff finishes — supporting timing context",
    fit_to_cause_class: causeClass,
    confidence: 0.7,
    supported_by: ["control_flow_investigator"],
    pointer: {
      platform: "leaping",
      native_pointer: `/stages[id=${PRE_COMPLETE}]`,
      native_label: "pre_handoff_completed_flag",
      native_kind: "field_setter",
    },
  };

  return { handoffBranch, dialogueStage, toolContract, preComplete };
}

/**
 * Klaus Localization Room arc:
 * opening → attacks → eliminations → mechanism discovery → localization.
 * The mechanism emerges from conflict — nobody opens with it.
 */
export function buildLocalizationInvestigationArc(input: {
  causeArtifact: CauseFindingArtifact;
  runtimeToolAliases: Record<string, string>;
}): LocalizationInvestigationArc {
  const causeClass = input.causeArtifact.cause_class;
  const handoffTool =
    input.runtimeToolAliases.create_callback_appointment ?? "send_email";

  const surfaces = buildSurfaces({ causeClass, handoffTool });

  const opening: SurfaceOpening = {
    type: "surface_opening",
    investigator_role: "control_flow_investigator",
    claim_en:
      "The problem is the default handoff branch — sonstiges routes into handoff without any backend-success check.",
    suspected_surface: surfaces.handoffBranch,
  };

  const attacks: SurfaceAttack[] = [
    {
      type: "surface_attack",
      attacker_role: "policy_investigator",
      challenged_role: "control_flow_investigator",
      challenged_surface_id: surfaces.handoffBranch.surface_id,
      claim_en:
        "No. The branch only routes traffic. The harmful customer language appears later — in Anliegenaufnahme + Email dialogue.",
      rejects_as_complete_cause: true,
      redirect_surface_id: surfaces.dialogueStage.surface_id,
      cites_band_message_id: "pending-cfi-opening",
    },
    {
      type: "surface_attack",
      attacker_role: "guard_investigator",
      challenged_role: "policy_investigator",
      challenged_surface_id: surfaces.dialogueStage.surface_id,
      claim_en:
        "No. Schritt 3 already gates Übermittlung on send_email success. A guard exists — not where the leak happens.",
      rejects_as_complete_cause: true,
      redirect_surface_id: surfaces.toolContract.surface_id,
      cites_band_message_id: "pending-pi-attack",
    },
  ];

  const counterattack: SurfaceCounterattack = {
    type: "surface_counterattack",
    attacker_role: "control_flow_investigator",
    challenged_role: "guard_investigator",
    claim_en:
      "Counter — the branch still determines which stage emits language. Guard proves Schritt 3 gates transmission, not that routing is irrelevant.",
    cites_band_message_id: "pending-gi-attack",
  };

  const investigatorAdmission: InvestigatorAdmission = {
    type: "investigator_admission",
    investigator_role: "policy_investigator",
    admission_kind: "I_WAS_WRONG",
    admission_en:
      "I was wrong to blame stage policy alone. The real mechanism is ordering: Schritt 1 happens before Schritt 3.",
    rejected_prior_surface_id: surfaces.dialogueStage.surface_id,
    cites_band_message_id: "pending-cfi-counterattack",
  };

  const eliminations: EliminatedExplanation[] = [
    {
      type: "eliminated_explanation",
      ruled_out_surface_id: surfaces.handoffBranch.surface_id,
      ruled_out_label: surfaces.handoffBranch.pointer.native_label,
      reason_en:
        "Routing branch is necessary context but cannot alone explain customer-facing confirmation language.",
      ruled_out_by: "policy_investigator",
    },
    {
      type: "eliminated_explanation",
      ruled_out_surface_id: surfaces.dialogueStage.surface_id,
      ruled_out_label: surfaces.dialogueStage.pointer.native_label,
      reason_en:
        "Stage policy alone is incomplete — Schritt 3 already gates transmission on tool success.",
      ruled_out_by: "guard_investigator",
    },
    {
      type: "eliminated_explanation",
      ruled_out_surface_id: surfaces.toolContract.surface_id,
      ruled_out_label: surfaces.toolContract.pointer.native_label,
      reason_en:
        "Tool contract gap alone is incomplete — the gate applies to Schritt 3, not Schritt 1 dialogue order.",
      ruled_out_by: "guard_investigator",
    },
  ];

  const mechanism = {
    canonical_id: "confirmation_before_backend_success" as const,
    statement:
      "Customer-facing closure language can occur before backend handoff success is known",
    required_guard_missing:
      "handoff tool success required before confirm_utterance in prior dialogue steps",
  };

  const mechanismDiscovery: MechanismDiscovery = {
    type: "mechanism_discovery",
    discovered_by: "policy_investigator",
    discovery_en:
      "Schritt 1 runs before Schritt 3 — confirmation can leak before send_email is verified.",
    mechanism,
    emerged_from_conflict:
      "Guard exposed Schritt 3 gate; Policy found the ordering gap none of us opened with.",
    none_proposed_initially: true,
    cites_band_message_ids: [],
  };

  const investigationBreakthrough: InvestigationBreakthrough = {
    type: "InvestigationBreakthrough",
    room: "localization",
    headline: "Confirmation happens before success check",
    human_sentence:
      "Schritt 1 can reassure the customer before Schritt 3 verifies send_email succeeded.",
    mechanism_id: mechanism.canonical_id,
    discovered_by: "policy_investigator",
    cites_band_message_ids: [],
  };

  const investigatorYields: InvestigatorYield[] = [
    {
      type: "investigator_yield",
      investigator_role: "control_flow_investigator",
      yield_en:
        "Yielding — the branch routes traffic but cannot explain step ordering. Policy's ordering gap survives.",
      accepts_mechanism_id: mechanism.canonical_id,
      cites_discovery_message_id: "pending-discovery",
    },
    {
      type: "investigator_yield",
      investigator_role: "guard_investigator",
      yield_en:
        "Yielding — Schritt 3 gate is real but insufficient alone. The mechanism is step 1 leaking before step 3 checks tool success.",
      accepts_mechanism_id: mechanism.canonical_id,
      cites_discovery_message_id: "pending-discovery",
    },
  ];

  const judgeFormalization: MechanismFormalization = {
    type: "mechanism_formalization",
    role: "localization_judge",
    formalization_en:
      "Arbitration: Policy's ordering mechanism survives. Localizing to primary evidence pointer.",
    cites_discovery_message_id: "pending-discovery",
    cites_band_message_ids: [],
  };

  const confidenceChallenge: LocalizationConfidenceChallenge = {
    type: "LocalizationConfidenceChallenge",
    challenger_role: "control_flow_investigator",
    challenged_surface_id: surfaces.dialogueStage.surface_id,
    question_en:
      "Could confirmation_before_backend_success also manifest on the switch default path alone?",
    cites_band_message_id: "pending-breakthrough",
  };

  const confidenceDefense: SurfaceConfidenceDefense = {
    type: "surface_confidence_defense",
    defender_role: "policy_investigator",
    claim_en:
      "No — switch routes only. The mechanism requires step ordering inside Anliegenaufnahme + Email (Schritt 1 vs Schritt 3). Surface earned.",
    cites_challenge_message_id: "pending-confidence-challenge",
  };

  const supportingSurfaces = [
    surfaces.handoffBranch,
    surfaces.toolContract,
    surfaces.preComplete,
  ];

  const finding: LocalizationFinding = {
    type: "localization_finding",
    incident_id: input.causeArtifact.incident_id,
    input_cause_class: causeClass,
    implementation_mechanism: mechanism,
    mechanism_explanation:
      investigationBreakthrough.human_sentence,
    mechanism_emerged_from: mechanismDiscovery.emerged_from_conflict,
    primary_surface: surfaces.dialogueStage,
    supporting_surfaces: supportingSurfaces,
    eliminated_explanations: eliminations,
    ranked_suspect_surfaces: [
      surfaces.dialogueStage,
      ...supportingSurfaces,
    ],
    recommended_investigation_target: surfaces.dialogueStage.surface_id,
    cites_band_message_ids: [],
  };

  const surfaceCandidates: SurfaceCandidate[] = [
    {
      type: "surface_candidate",
      investigator_role: "control_flow_investigator",
      surface: surfaces.handoffBranch,
    },
    {
      type: "surface_candidate",
      investigator_role: "policy_investigator",
      surface: surfaces.dialogueStage,
    },
    {
      type: "surface_candidate",
      investigator_role: "guard_investigator",
      surface: surfaces.toolContract,
    },
  ];

  return {
    opening,
    attacks,
    counterattack,
    investigatorAdmission,
    eliminations,
    mechanismDiscovery,
    investigationBreakthrough,
    investigatorYields,
    confidenceChallenge,
    confidenceDefense,
    judgeFormalization,
    finding,
    surfaceCandidates,
  };
}

/** @deprecated Use buildLocalizationInvestigationArc */
export function buildDeterministicSurfaceCandidates(input: {
  causeArtifact: CauseFindingArtifact;
  runtimeToolAliases: Record<string, string>;
}): SurfaceCandidate[] {
  return buildLocalizationInvestigationArc(input).surfaceCandidates;
}

/** @deprecated Use buildLocalizationInvestigationArc */
export type SurfaceFitChallenge = {
  type: "surface_fit_challenge";
  challenger_role: "guard_investigator";
  challenged_surface_id: string;
  claim: string;
  partial_accept: boolean;
  cites_band_message_id: string;
};

export function assertBreakthroughAllowed(input: {
  admissionMessageId?: string;
  investigatorAdmission?: InvestigatorAdmission;
}): void {
  if (!input.admissionMessageId && !input.investigatorAdmission) {
    throw new Error(
      "Breakthrough artifact blocked: investigator must post I was wrong / YIELD / REJECTED_MY_PRIOR first.",
    );
  }
}

export function attachBandMessageIds(
  arc: LocalizationInvestigationArc,
  ids: {
    opening: string;
    attacks: string[];
    counterattack: string;
    admission: string;
    discovery: string;
    yields: string[];
    confidenceChallenge: string;
    confidenceDefense: string;
    formalization: string;
    finding: string;
  },
): LocalizationInvestigationArc {
  arc.attacks[0].cites_band_message_id = ids.opening;
  if (arc.attacks[1]) {
    arc.attacks[1].cites_band_message_id = ids.attacks[0] ?? ids.opening;
  }
  arc.counterattack.cites_band_message_id =
    ids.attacks[1] ?? ids.attacks[0] ?? ids.opening;
  arc.investigatorAdmission.cites_band_message_id = ids.counterattack;
  arc.mechanismDiscovery.cites_band_message_ids = [
    ids.opening,
    ...ids.attacks,
    ids.counterattack,
    ids.admission,
  ];
  arc.investigationBreakthrough.cites_band_message_ids = [
    ids.opening,
    ...ids.attacks,
    ids.admission,
    ids.discovery,
  ];
  for (const y of arc.investigatorYields) {
    y.cites_discovery_message_id = ids.discovery;
  }
  arc.confidenceChallenge.cites_band_message_id = ids.discovery;
  arc.confidenceDefense.cites_challenge_message_id = ids.confidenceChallenge;
  arc.judgeFormalization.cites_discovery_message_id = ids.discovery;
  arc.judgeFormalization.cites_band_message_ids = [
    ids.opening,
    ...ids.attacks,
    ids.counterattack,
    ids.discovery,
    ...ids.yields,
    ids.confidenceChallenge,
    ids.confidenceDefense,
  ];
  arc.finding.cites_band_message_ids = [
    ids.opening,
    ...ids.attacks,
    ids.counterattack,
    ids.admission,
    ids.discovery,
    ...ids.yields,
    ids.confidenceChallenge,
    ids.confidenceDefense,
    ids.formalization,
    ids.finding,
  ];
  return arc;
}

import {
  buildRevisionPreRevisionArc,
} from "@/lib/localization-room/collaboration-revision";
import { buildEvidenceDrivenLocalizationArc } from "@/lib/localization-room/collaboration-evidence";
import { resolveFrozenDemoPath } from "@/lib/cross-room/incident-profile";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";

export type LocalizationArcBuilderInput = {
  evidence: VoiceIncidentEvidence;
  causeArtifact: CauseFindingArtifact;
  runtimeToolAliases: Record<string, string>;
};

export function selectLocalizationArcBuilder(incidentId: string) {
  const path = resolveFrozenDemoPath(incidentId);
  if (path === "marta") {
    return (input: LocalizationArcBuilderInput) =>
      buildRevisionPreRevisionArc({ causeArtifact: input.causeArtifact });
  }
  if (path === "live") {
    return (input: LocalizationArcBuilderInput) =>
      buildEvidenceDrivenLocalizationArc({
        evidence: input.evidence,
        causeArtifact: input.causeArtifact,
      });
  }
  return (input: LocalizationArcBuilderInput) =>
    buildLocalizationInvestigationArc({
      causeArtifact: input.causeArtifact,
      runtimeToolAliases: input.runtimeToolAliases,
    });
}

/** @deprecated Use resolveCrossRoomDemoMode in incident-profile.ts */
export function shouldEmitCauseRevisionRequest(
  causeClass: string,
  incidentId: string,
): boolean {
  return (
    incidentId === "REV-2026-001" ||
    incidentId.includes("stefan") ||
    causeClass === "tool_not_called" ||
    causeClass === "partial_workflow_execution"
  );
}
