import { CauseFindingArtifact } from "@/lib/cross-room/artifacts";
import { CrossRoomOutcome } from "@/lib/cross-room/outcomes";
import { FrozenDemoPath } from "@/lib/cross-room/incident-profile";
import { LocalizationEvidenceProfile } from "@/lib/localization-room/evidence-analysis";

export type CauseDefenseRequest = {
  type: "CauseDefenseRequest";
  from_room: "localization_room";
  to_room: "cause_room";
  challenged_cause_class: string;
  /** Causal attack — never a question. */
  challenge: string;
  cause_predicts: string;
  implementation_shows: string;
  allowed_outcomes: readonly CrossRoomOutcome[];
  cited_localization_message_ids: string[];
  cites_cause_finding_artifact_id: string;
  incident_id: string;
};

export type CauseDefenseDecision = {
  type: "CauseDefenseDecision";
  decision: CrossRoomOutcome;
  cause_class: string;
  defense: string;
  cited_cause_message_ids: string[];
  effect_on_localization: string;
  old_cause_class?: string;
  new_cause_class?: string;
  reason?: string;
  cites_defense_request_id: string;
  incident_id: string;
};

function buildCausalAttackRequest(input: {
  causeArtifact: CauseFindingArtifact;
  causeFindingArtifactMessageId: string;
  localizationMessageIds?: string[];
  cause_predicts: string;
  implementation_shows: string;
  humanChallenge?: string;
}): CauseDefenseRequest {
  const challenge =
    input.humanChallenge ??
    `Your cause predicts ${input.cause_predicts} Implementation shows ${input.implementation_shows} Show why this evidence is necessary, revise the cause, or mark insufficient evidence.`;
  return {
    type: "CauseDefenseRequest",
    from_room: "localization_room",
    to_room: "cause_room",
    incident_id: input.causeArtifact.incident_id,
    challenged_cause_class: input.causeArtifact.cause_class,
    challenge,
    cause_predicts: input.cause_predicts,
    implementation_shows: input.implementation_shows,
    allowed_outcomes: ["DEFEND", "REVISE", "INSUFFICIENT_EVIDENCE"],
    cited_localization_message_ids: input.localizationMessageIds ?? [],
    cites_cause_finding_artifact_id: input.causeFindingArtifactMessageId,
  };
}

export function buildKlausCauseDefenseRequest(input: {
  causeArtifact: CauseFindingArtifact;
  causeFindingArtifactMessageId: string;
  localizationMessageIds?: string[];
}): CauseDefenseRequest {
  return buildCausalAttackRequest({
    ...input,
    cause_predicts:
      "failed execution (504) is necessary before the customer was misled.",
    implementation_shows:
      "confirmation language can appear before any backend-success check on the handoff path.",
    humanChallenge:
      "@CausalJudge A backend failure alone cannot explain the customer's belief. This workflow can tell customers the callback is booked before success is verified.",
  });
}

export function buildStefanCauseDefenseRequest(input: {
  causeArtifact: CauseFindingArtifact;
  causeFindingArtifactMessageId: string;
  localizationMessageIds?: string[];
}): CauseDefenseRequest {
  return buildCausalAttackRequest({
    ...input,
    cause_predicts:
      "a failed cancel_subscription execution explains the customer outcome.",
    implementation_shows:
      "cancel_subscription was never invoked — only lookup_customer and a downstream email error.",
  });
}

export function buildCauseDefenseDecision(input: {
  path: FrozenDemoPath;
  request: CauseDefenseRequest;
  causeArtifact: CauseFindingArtifact;
  defenseRequestMessageId: string;
  citedCauseMessageIds: string[];
  profile?: LocalizationEvidenceProfile;
}): CauseDefenseDecision {
  if (input.path === "live") {
    return buildLiveCauseDefenseDecision(input);
  }

  if (input.path === "klaus") {
    return {
      type: "CauseDefenseDecision",
      decision: "DEFEND",
      cause_class: input.causeArtifact.cause_class,
      defense:
        "504 on create_callback_appointment · appointment_created=false — failed execution is necessary.",
      cited_cause_message_ids: input.citedCauseMessageIds,
      effect_on_localization:
        "Localization must accept or reject this defense before proceeding.",
      cites_defense_request_id: input.defenseRequestMessageId,
      incident_id: input.causeArtifact.incident_id,
    };
  }

  if (input.path === "stefan") {
    return {
      type: "CauseDefenseDecision",
      decision: "INSUFFICIENT_EVIDENCE",
      cause_class: input.causeArtifact.cause_class,
      defense:
        "Customer belief at T05 stands · failed execution not proven — cancel_subscription absent from runtime.",
      cited_cause_message_ids: input.citedCauseMessageIds,
      effect_on_localization:
        "Neither side proved its case — Localization must rule defense insufficient or rejected.",
      cites_defense_request_id: input.defenseRequestMessageId,
      incident_id: input.causeArtifact.incident_id,
    };
  }

  return {
    type: "CauseDefenseDecision",
    decision: "INSUFFICIENT_EVIDENCE",
    cause_class: input.causeArtifact.cause_class,
    defense: "CauseFinding withdrawn pending implementation proof.",
    cited_cause_message_ids: input.citedCauseMessageIds,
    effect_on_localization: "Localization must reject and request revision.",
    cites_defense_request_id: input.defenseRequestMessageId,
    incident_id: input.causeArtifact.incident_id,
  };
}

export function buildLiveCauseDefenseDecision(input: {
  request: CauseDefenseRequest;
  causeArtifact: CauseFindingArtifact;
  defenseRequestMessageId: string;
  citedCauseMessageIds: string[];
  profile?: LocalizationEvidenceProfile;
}): CauseDefenseDecision {
  const profile = input.profile;
  let decision: CrossRoomOutcome = "DEFEND";
  let defense = input.profile?.bwDefenseLine ?? "Runtime trace supports the proposed cause.";

  if (profile?.insufficientForLocalization && profile.customerTurnCount === 0) {
    decision = "INSUFFICIENT_EVIDENCE";
    defense =
      `${profile.primaryFailureTool?.name ?? "Prerequisite tool"} failed · no customer utterance captured · call ${profile.callStatus ?? "incomplete"}.`;
  } else if (
    profile?.identityCheckFailed &&
    profile.handoffSucceeded &&
    input.causeArtifact.cause_class.includes("premature")
  ) {
    decision = "DEFEND";
    defense = `${profile.bwDefenseLine} Agent success language after failed identity check.`;
  } else if (profile?.failedTools.length && profile.customerTurnCount > 0) {
    decision = "DEFEND";
    defense = `${profile.bwDefenseLine} Customer spoke ${profile.customerTurnCount} time(s).`;
  } else if (!profile?.failedTools.length && profile?.customerTurnCount === 0) {
    decision = "INSUFFICIENT_EVIDENCE";
    defense = "No failed tools and no customer speech — cause necessity cannot be established.";
  }

  return {
    type: "CauseDefenseDecision",
    decision,
    cause_class: input.causeArtifact.cause_class,
    defense,
    cited_cause_message_ids: input.citedCauseMessageIds,
    effect_on_localization:
      decision === "INSUFFICIENT_EVIDENCE"
        ? "Localization proceeds with best-effort surfaces under open cause."
        : "Localization may accept defense and localize from runtime trace.",
    cites_defense_request_id: input.defenseRequestMessageId,
    incident_id: input.causeArtifact.incident_id,
  };
}
