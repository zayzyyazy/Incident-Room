import {
  AgentChallenge,
  BackendWitnessInitial,
  CauseFinding,
  CausalJudgeBridge,
  ClaimTracerInitial,
} from "@/lib/cause-room/types";
import {
  BRIDGE_HYPOTHESIS_CLASSES,
  CausalHypothesisClass,
  EXECUTION_DOMAIN_CLASSES,
  CONVERSATION_DOMAIN_CLASSES,
} from "@/lib/cause-room/hypothesis-classes";

export function enforceChallengeIntegrity(
  challenge: AgentChallenge,
  priorClass: CausalHypothesisClass,
): AgentChallenge {
  const classChanged = challenge.updated_hypothesis_class !== priorClass;
  return {
    ...challenge,
    opinion_changed: classChanged || challenge.stance === "YIELD",
    updated_hypothesis_en: challenge.updated_hypothesis_en || challenge.prior_hypothesis_en,
  };
}

export function assertNoCrossDomainCopy(
  challenge: AgentChallenge,
  peerOpeningClass: CausalHypothesisClass,
): void {
  if (challenge.updated_hypothesis_class === peerOpeningClass) {
    throw new Error(
      `${challenge.agent_role} copied peer opening class ${peerOpeningClass}`,
    );
  }
  if (
    challenge.agent_role === "claim_tracer" &&
    EXECUTION_DOMAIN_CLASSES.has(challenge.updated_hypothesis_class)
  ) {
    throw new Error(
      `Claim Tracer adopted execution class ${challenge.updated_hypothesis_class}`,
    );
  }
  if (
    challenge.agent_role === "backend_witness" &&
    CONVERSATION_DOMAIN_CLASSES.has(challenge.updated_hypothesis_class)
  ) {
    throw new Error(
      `Backend Witness adopted conversation class ${challenge.updated_hypothesis_class}`,
    );
  }
}

export function mergeBridgeWithArc(
  llmBridge: CausalJudgeBridge,
  deterministic: CausalJudgeBridge,
): CausalJudgeBridge {
  const bridgeClass = BRIDGE_HYPOTHESIS_CLASSES.has(
    llmBridge.bridge_hypothesis_class,
  )
    ? llmBridge.bridge_hypothesis_class
    : deterministic.bridge_hypothesis_class;

  if (
    bridgeClass === llmBridge.bridge_hypothesis_class &&
    llmBridge.ruled_out.length >= 2 &&
    llmBridge.cause_statement
  ) {
    return llmBridge;
  }

  return {
    ...deterministic,
    bridge_hypothesis_en:
      llmBridge.bridge_hypothesis_en || deterministic.bridge_hypothesis_en,
    confidence: llmBridge.confidence ?? deterministic.confidence,
  };
}

export function ensureCauseFindingIntegrity(
  finding: CauseFinding,
  opening: {
    claimTracer: CausalHypothesisClass;
    backendWitness: CausalHypothesisClass;
  },
  bridge: CausalJudgeBridge,
  bandMessageIds: string[],
  deterministic: CauseFinding,
): CauseFinding {
  const openingClasses = new Set([
    opening.claimTracer,
    opening.backendWitness,
  ]);

  let causeClass = finding.cause_class;
  if (openingClasses.has(causeClass)) {
    causeClass = bridge.bridge_hypothesis_class;
  }

  const rejectedCount = finding.considered_hypotheses.filter(
    (h) => h.status === "rejected",
  ).length;

  const merged: CauseFinding = {
    ...finding,
    cause_class: causeClass,
    cause: finding.cause || bridge.cause_statement || bridge.bridge_hypothesis_en,
    final_incident_cause:
      finding.final_incident_cause ??
      deterministic.final_incident_cause,
    opening_hypotheses:
      finding.opening_hypotheses?.length === 2
        ? finding.opening_hypotheses
        : deterministic.opening_hypotheses,
    bridge_hypothesis:
      finding.bridge_hypothesis ?? deterministic.bridge_hypothesis,
    evolution:
      finding.evolution.length >= 3 ? finding.evolution : deterministic.evolution,
    considered_hypotheses:
      rejectedCount >= 2
        ? finding.considered_hypotheses
        : deterministic.considered_hypotheses,
    cites_band_message_ids: Array.from(
      new Set([
        ...finding.cites_band_message_ids,
        ...bandMessageIds.filter(Boolean),
      ]),
    ),
    hypothesis_lifecycle:
      finding.hypothesis_lifecycle?.length
        ? finding.hypothesis_lifecycle
        : deterministic.hypothesis_lifecycle,
    audit_trail: finding.audit_trail ?? deterministic.audit_trail,
  };

  return merged;
}

export function openingDiffersFromFinal(
  ct: ClaimTracerInitial,
  bw: BackendWitnessInitial,
  finding: CauseFinding,
): boolean {
  return (
    finding.cause_class !== ct.hypothesis_class &&
    finding.cause_class !== bw.hypothesis_class
  );
}
