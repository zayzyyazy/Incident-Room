import { CanonicalSuspectSurface } from "@/lib/canonical/surface-types";
import { CauseFindingArtifact } from "@/lib/cross-room/artifacts";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  analyzeEvidenceForLocalization,
  LocalizationEvidenceProfile,
} from "@/lib/localization-room/evidence-analysis";
import {
  EliminatedExplanation,
  InvestigatorAdmission,
  InvestigatorYield,
  InvestigationBreakthrough,
  LocalizationFinding,
  LocalizationInvestigationArc,
  LocalizationConfidenceChallenge,
  MechanismDiscovery,
  MechanismFormalization,
  SurfaceAttack,
  SurfaceCandidate,
  SurfaceConfidenceDefense,
  SurfaceCounterattack,
  SurfaceOpening,
} from "@/lib/localization-room/types";

function surfaceFromTool(
  profile: LocalizationEvidenceProfile,
  toolName: string,
  role: string,
  fit: string,
  confidence: number,
  surfaceType: CanonicalSuspectSurface["surface_type"] = "tool_contract",
): CanonicalSuspectSurface {
  return {
    surface_id: `function.${toolName}.runtime`,
    surface_type: surfaceType,
    canonical_mechanism_id: profile.mechanismId,
    mechanism_fit_en: fit,
    fit_to_cause_class: profile.mechanismId,
    confidence,
    supported_by: [role],
    pointer: {
      platform: "leaping",
      native_pointer: `/functions[name=${toolName}]`,
      native_label: toolName,
      native_kind: "api_call",
    },
    evidence: profile.primaryFailureTool?.name === toolName
      ? [
          {
            kind: "runtime_trace",
            observed: profile.implementationShows,
            missing: profile.requiredGuardMissing,
          },
        ]
      : undefined,
  };
}

function buildLiveSurfaces(
  profile: LocalizationEvidenceProfile,
  causeClass: string,
): {
  failureSurface: CanonicalSuspectSurface;
  handoffSurface?: CanonicalSuspectSurface;
  routingSurface: CanonicalSuspectSurface;
} {
  const failureTool = profile.primaryFailureTool?.name ?? "get_customer_by_phone";
  const handoffTool = profile.primaryHandoffTool?.name ?? "send_email";

  const failureSurface: CanonicalSuspectSurface = {
    ...surfaceFromTool(
      profile,
      failureTool,
      "guard_investigator",
      `Runtime trace shows ${failureTool} failed or returned negative — primary evidence pointer`,
      profile.insufficientForLocalization ? 0.72 : 0.9,
    ),
    fit_to_cause_class: causeClass,
  };

  const handoffSurface = profile.handoffTools.length
    ? {
        ...surfaceFromTool(
          profile,
          handoffTool,
          "policy_investigator",
          profile.handoffSucceeded
            ? `${handoffTool} succeeded — explains why success language could appear`
            : `${handoffTool} on path but not the root failure`,
          profile.handoffSucceeded ? 0.78 : 0.55,
          "confirmation_guard" as const,
        ),
        fit_to_cause_class: causeClass,
      }
    : undefined;

  const routingSurface: CanonicalSuspectSurface = {
    surface_id: "workflow.intent_routing",
    surface_type: "workflow_branch",
    canonical_mechanism_id: profile.mechanismId,
    mechanism_fit_en:
      "Intent routing sent the call down a path that did not block on prerequisite failures",
    fit_to_cause_class: causeClass,
    confidence: 0.65,
    supported_by: ["control_flow_investigator"],
    pointer: {
      platform: "leaping",
      native_pointer: `/workflow/intent/${profile.intent ?? "unknown"}`,
      native_label: profile.intent
        ? `Intent · ${profile.intent}`
        : "Intent routing",
      native_kind: "transition",
    },
  };

  return { failureSurface, handoffSurface, routingSurface };
}

export function buildEvidenceDrivenLocalizationArc(input: {
  evidence: VoiceIncidentEvidence;
  causeArtifact: CauseFindingArtifact;
}): LocalizationInvestigationArc {
  const profile = analyzeEvidenceForLocalization(input.evidence);
  const causeClass = input.causeArtifact.cause_class;
  const { failureSurface, handoffSurface, routingSurface } = buildLiveSurfaces(
    profile,
    causeClass,
  );
  const primarySurface = failureSurface;

  const opening: SurfaceOpening = {
    type: "surface_opening",
    investigator_role: "control_flow_investigator",
    claim_en: profile.insufficientForLocalization
      ? `Control flow: call ${profile.callStatus ?? "ended early"} after ${profile.primaryFailureTool?.name ?? "a prerequisite tool"} failed — we may not have enough surface to localize.`
      : `Control flow: ${profile.primaryFailureTool?.name ?? "A prerequisite tool"} failed but the workflow did not hard-stop before customer-facing language.`,
    suspected_surface: routingSurface,
  };

  const attacks: SurfaceAttack[] = [
    {
      type: "surface_attack",
      attacker_role: "guard_investigator",
      challenged_role: "control_flow_investigator",
      challenged_surface_id: routingSurface.surface_id,
      claim_en: `No — routing is context. The runtime trace points at ${failureSurface.pointer.native_label}: ${profile.implementationShows.split(".")[0]}.`,
      rejects_as_complete_cause: true,
      redirect_surface_id: failureSurface.surface_id,
      cites_band_message_id: "pending-cfi-opening",
    },
  ];

  if (handoffSurface && profile.handoffSucceeded) {
    attacks.push({
      type: "surface_attack",
      attacker_role: "policy_investigator",
      challenged_role: "guard_investigator",
      challenged_surface_id: failureSurface.surface_id,
      claim_en: `Partial — ${handoffSurface.pointer.native_label} succeeded, so the harmful language may be a success utterance after a failed identity gate, not the lookup alone.`,
      rejects_as_complete_cause: true,
      redirect_surface_id: handoffSurface.surface_id,
      cites_band_message_id: "pending-gi-attack",
    });
  }

  const counterattack: SurfaceCounterattack = {
    type: "surface_counterattack",
    attacker_role: "control_flow_investigator",
    challenged_role: handoffSurface
      ? "policy_investigator"
      : "guard_investigator",
    claim_en: profile.identityCheckFailed
      ? "Counter — handoff success does not erase the failed identity check. The mechanism is confirming handoff while verification failed."
      : "Counter — the failed prerequisite still shaped what the customer heard; routing alone cannot explain it.",
    cites_band_message_id: "pending-last-attack",
  };

  const investigatorAdmission: InvestigatorAdmission = {
    type: "investigator_admission",
    investigator_role: handoffSurface ? "policy_investigator" : "guard_investigator",
    admission_kind: "I_WAS_WRONG",
    admission_en: profile.insufficientForLocalization
      ? "I was wrong to expect a full workflow surface — the call dropped before intent. The best pointer is the failed prerequisite tool."
      : profile.identityCheckFailed && profile.handoffSucceeded
        ? "I was wrong to treat lookup alone as sufficient. The mechanism is success language after a failed identity gate."
        : `I was wrong to blame routing alone. ${failureSurface.pointer.native_label} is the primary evidence pointer.`,
    rejected_prior_surface_id: routingSurface.surface_id,
    cites_band_message_id: "pending-cfi-counterattack",
  };

  const eliminations: EliminatedExplanation[] = [
    {
      type: "eliminated_explanation",
      ruled_out_surface_id: routingSurface.surface_id,
      ruled_out_label: routingSurface.pointer.native_label,
      reason_en: "Intent routing is necessary context but cannot alone explain the customer-facing failure mode.",
      ruled_out_by: "guard_investigator",
    },
  ];

  if (handoffSurface) {
    eliminations.push({
      type: "eliminated_explanation",
      ruled_out_surface_id: handoffSurface.surface_id,
      ruled_out_label: handoffSurface.pointer.native_label,
      reason_en:
        profile.identityCheckFailed
          ? "Handoff tool success is real but insufficient — identity gate failed first."
          : "Handoff tool alone does not explain prerequisite failure handling.",
      ruled_out_by: "policy_investigator",
    });
  }

  const mechanism = {
    canonical_id: profile.mechanismId,
    statement: profile.mechanismStatement,
    required_guard_missing: profile.requiredGuardMissing,
  };

  const mechanismDiscovery: MechanismDiscovery = {
    type: "mechanism_discovery",
    discovered_by: "guard_investigator",
    discovery_en: profile.insufficientForLocalization
      ? `${failureSurface.pointer.native_label} failed and the call never reached a complete intent path — mechanism inferred with limited confidence.`
      : `${profile.mechanismStatement} — surfaced from ${failureSurface.pointer.native_label} in the runtime trace.`,
    mechanism,
    emerged_from_conflict:
      "Investigators disagreed on routing vs tool contract; runtime trace broke the tie.",
    none_proposed_initially: true,
    cites_band_message_ids: [],
  };

  const investigationBreakthrough: InvestigationBreakthrough = {
    type: "InvestigationBreakthrough",
    room: "localization",
    headline: profile.insufficientForLocalization
      ? "Best-effort localization on incomplete call"
      : profile.mechanismId.replace(/_/g, " "),
    human_sentence: profile.mechanismStatement,
    mechanism_id: profile.mechanismId,
    discovered_by: "guard_investigator",
    cites_band_message_ids: [],
  };

  const investigatorYields: InvestigatorYield[] = [
    {
      type: "investigator_yield",
      investigator_role: "control_flow_investigator",
      yield_en: "Yielding — routing cannot explain the runtime failure pointer.",
      accepts_mechanism_id: profile.mechanismId,
      cites_discovery_message_id: "pending-discovery",
    },
  ];

  const judgeFormalization: MechanismFormalization = {
    type: "mechanism_formalization",
    role: "localization_judge",
    formalization_en: profile.insufficientForLocalization
      ? "Arbitration: evidence incomplete — formalizing best-effort mechanism at failed prerequisite tool."
      : "Arbitration: mechanism survives challenge — localizing to primary runtime evidence pointer.",
    cites_discovery_message_id: "pending-discovery",
    cites_band_message_ids: [],
  };

  const confidenceChallenge: LocalizationConfidenceChallenge = {
    type: "LocalizationConfidenceChallenge",
    challenger_role: "control_flow_investigator",
    challenged_surface_id: primarySurface.surface_id,
    question_en: profile.insufficientForLocalization
      ? "Is this localization reliable when the customer never spoke and the call dropped?"
      : `Could ${profile.mechanismId} manifest without ${primarySurface.pointer.native_label} being the fix surface?`,
    cites_band_message_id: "pending-breakthrough",
  };

  const confidenceDefense: SurfaceConfidenceDefense = {
    type: "surface_confidence_defense",
    defender_role: "guard_investigator",
    claim_en: profile.insufficientForLocalization
      ? "Limited confidence acknowledged — still the strongest pointer in the trace we have."
      : `Yes — ${primarySurface.pointer.native_label} is where the missing guard belongs in this trace.`,
    cites_challenge_message_id: "pending-confidence-challenge",
  };

  const supportingSurfaces = [
    routingSurface,
    ...(handoffSurface ? [handoffSurface] : []),
  ];

  const finding: LocalizationFinding = {
    type: "localization_finding",
    incident_id: input.causeArtifact.incident_id,
    input_cause_class: causeClass,
    implementation_mechanism: mechanism,
    mechanism_explanation: profile.mechanismStatement,
    mechanism_emerged_from: mechanismDiscovery.emerged_from_conflict,
    primary_surface: primarySurface,
    supporting_surfaces: supportingSurfaces,
    eliminated_explanations: eliminations,
    ranked_suspect_surfaces: [primarySurface, ...supportingSurfaces],
    recommended_investigation_target: primarySurface.surface_id,
    cites_band_message_ids: [],
  };

  const surfaceCandidates: SurfaceCandidate[] = [
    {
      type: "surface_candidate",
      investigator_role: "control_flow_investigator",
      surface: routingSurface,
    },
    {
      type: "surface_candidate",
      investigator_role: "guard_investigator",
      surface: failureSurface,
    },
  ];

  if (handoffSurface) {
    surfaceCandidates.push({
      type: "surface_candidate",
      investigator_role: "policy_investigator",
      surface: handoffSurface,
    });
  }

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

export function buildEvidenceCauseDefenseRequest(input: {
  profile: LocalizationEvidenceProfile;
  causeArtifact: CauseFindingArtifact;
  causeFindingArtifactMessageId: string;
}): import("@/lib/cross-room/cause-defense").CauseDefenseRequest {
  const challenge = `Your cause predicts ${input.profile.causePredicts} Implementation shows ${input.profile.implementationShows} Show why this evidence is necessary, revise the cause, or mark insufficient evidence.`;
  return {
    type: "CauseDefenseRequest",
    from_room: "localization_room",
    to_room: "cause_room",
    incident_id: input.causeArtifact.incident_id,
    challenged_cause_class: input.causeArtifact.cause_class,
    challenge,
    cause_predicts: input.profile.causePredicts,
    implementation_shows: input.profile.implementationShows,
    allowed_outcomes: ["DEFEND", "REVISE", "INSUFFICIENT_EVIDENCE"],
    cited_localization_message_ids: [],
    cites_cause_finding_artifact_id: input.causeFindingArtifactMessageId,
  };
}
