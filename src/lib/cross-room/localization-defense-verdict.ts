import { CauseDefenseDecision } from "@/lib/cross-room/cause-defense";
import { FrozenDemoPath } from "@/lib/cross-room/incident-profile";
import { LocalizationEvidenceProfile } from "@/lib/localization-room/evidence-analysis";

/** Localization explicitly judges whether Cause Room's defense changed the investigation. */
export type LocalizationDefenseVerdict = {
  type: "LocalizationDefenseVerdict";
  verdict: "ACCEPTED" | "REJECTED" | "INSUFFICIENT";
  rationale_en: string;
  cause_finding_status: "SUSTAINED" | "WITHDRAWN" | "OPEN";
  cites_cause_defense_decision_id: string;
  incident_id: string;
};

export function buildLocalizationDefenseVerdict(input: {
  path: FrozenDemoPath;
  defenseDecision: CauseDefenseDecision;
  defenseDecisionMessageId: string;
  profile?: LocalizationEvidenceProfile;
}): LocalizationDefenseVerdict {
  if (input.path === "klaus") {
    return {
      type: "LocalizationDefenseVerdict",
      verdict: "ACCEPTED",
      rationale_en:
        "504 + appointment_created=false proves failed execution is necessary — defense accepted.",
      cause_finding_status: "SUSTAINED",
      cites_cause_defense_decision_id: input.defenseDecisionMessageId,
      incident_id: input.defenseDecision.incident_id,
    };
  }

  if (input.path === "stefan") {
    return {
      type: "LocalizationDefenseVerdict",
      verdict: "INSUFFICIENT",
      rationale_en:
        "Neither side proved failed execution — customer belief holds, tool path unmapped. Proceed under open cause.",
      cause_finding_status: "OPEN",
      cites_cause_defense_decision_id: input.defenseDecisionMessageId,
      incident_id: input.defenseDecision.incident_id,
    };
  }

  if (input.path === "live") {
    return buildLiveLocalizationDefenseVerdict({
      defenseDecision: input.defenseDecision,
      defenseDecisionMessageId: input.defenseDecisionMessageId,
      profile: input.profile,
    });
  }

  return {
    type: "LocalizationDefenseVerdict",
    verdict: "REJECTED",
    rationale_en: "Defense rejected — implementation contradicts cause necessity.",
    cause_finding_status: "WITHDRAWN",
    cites_cause_defense_decision_id: input.defenseDecisionMessageId,
    incident_id: input.defenseDecision.incident_id,
  };
}

export function buildLiveLocalizationDefenseVerdict(input: {
  defenseDecision: CauseDefenseDecision;
  defenseDecisionMessageId: string;
  profile?: LocalizationEvidenceProfile;
}): LocalizationDefenseVerdict {
  const { defenseDecision } = input;

  if (defenseDecision.decision === "INSUFFICIENT_EVIDENCE") {
    return {
      type: "LocalizationDefenseVerdict",
      verdict: "INSUFFICIENT",
      rationale_en:
        input.profile?.insufficientForLocalization
          ? "Call trace too thin — localization proceeds with best-effort pointer at the failed prerequisite."
          : "Cause Room could not prove necessity — localization proceeds under open cause with runtime-derived surfaces.",
      cause_finding_status: "OPEN",
      cites_cause_defense_decision_id: input.defenseDecisionMessageId,
      incident_id: defenseDecision.incident_id,
    };
  }

  if (defenseDecision.decision === "REVISE") {
    return {
      type: "LocalizationDefenseVerdict",
      verdict: "REJECTED",
      rationale_en:
        "Implementation trace contradicts the current cause — CauseFinding must be revised before localization can finalize.",
      cause_finding_status: "WITHDRAWN",
      cites_cause_defense_decision_id: input.defenseDecisionMessageId,
      incident_id: defenseDecision.incident_id,
    };
  }

  return {
    type: "LocalizationDefenseVerdict",
    verdict: input.profile?.insufficientForLocalization ? "INSUFFICIENT" : "ACCEPTED",
    rationale_en: input.profile?.insufficientForLocalization
      ? `Defense accepted with caveats — ${input.profile.primaryFailureTool?.name ?? "prerequisite tool"} failure is necessary, but customer outcome is under-observed.`
      : `Defense accepted — ${defenseDecision.defense.split(".")[0]}.`,
    cause_finding_status: "SUSTAINED",
    cites_cause_defense_decision_id: input.defenseDecisionMessageId,
    incident_id: defenseDecision.incident_id,
  };
}

export function assertMayProceedAfterDefense(input: {
  defenseDecision: CauseDefenseDecision;
  verdict: LocalizationDefenseVerdict;
}): void {
  if (input.verdict.verdict === "REJECTED") {
    throw new Error(
      "Defense rejected — Localization cannot proceed until CauseFinding is revised.",
    );
  }
  if (
    input.defenseDecision.decision === "REVISE" &&
    input.verdict.verdict === "ACCEPTED"
  ) {
    throw new Error(
      "Cause Room marked REVISE but Localization accepted defense — inconsistent state.",
    );
  }
}
