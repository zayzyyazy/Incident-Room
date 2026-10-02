import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  claimTracerEvidenceView,
  backendWitnessEvidenceView,
  bandThreadForRole,
} from "@/lib/cause-room/access-walls";
import { RoutedEvidence } from "@/lib/normalizer/types";
import {
  AgentChallenge,
  BackendWitnessInitial,
  BandPostContext,
  CausalJudgeBridge,
  ClaimTracerInitial,
} from "@/lib/cause-room/types";

export function forClaimTracer(
  evidence: VoiceIncidentEvidence,
  routed?: RoutedEvidence,
) {
  return {
    ...claimTracerEvidenceView(evidence, routed),
    instruction:
      "Propose a CAUSAL HYPOTHESIS CLASS from transcript_packet only — not a summary. @mention @backend_witness to challenge execution-only theories. @mention @evidence_normalizer to request transcript slices.",
  };
}

export function forBackendWitness(
  evidence: VoiceIncidentEvidence,
  routed?: RoutedEvidence,
) {
  return {
    ...backendWitnessEvidenceView(evidence, routed),
    instruction:
      "Propose a CAUSAL HYPOTHESIS CLASS from tool_trace_packet only. @mention @claim_tracer to challenge belief-only theories. @mention @evidence_normalizer to request tool execution slices.",
  };
}

export function forClaimTracerChallenge(input: {
  evidence: VoiceIncidentEvidence;
  routed?: RoutedEvidence;
  prior: ClaimTracerInitial;
  bandThread: BandPostContext[];
  round: number;
  peerMessageId: string;
  peerOpeningClass: string;
}) {
  return {
    ...forClaimTracer(input.evidence, input.routed),
    challenge_round: input.round,
    your_prior_post: input.prior,
    peer_opening_hypothesis_class: input.peerOpeningClass,
    band_thread: bandThreadForRole(input.bandThread, "claim_tracer"),
    required_target_band_message_id: input.peerMessageId,
    required_target_post_type:
      input.round === 1 ? "backend_witness_initial" : "causal_judge_bridge",
    instruction:
      input.round === 1
        ? "CHALLENGE backend_failure_only as INCOMPLETE. Do NOT adopt it. Narrow to confirmation_claim_requires_execution_outcome."
        : "SUPPORT bridge hypothesis. Preserve customer-belief evidence. Stance must be SUPPORT.",
  };
}

export function forBackendWitnessChallenge(input: {
  evidence: VoiceIncidentEvidence;
  routed?: RoutedEvidence;
  prior: BackendWitnessInitial;
  bandThread: BandPostContext[];
  round: number;
  peerMessageId: string;
  peerOpeningClass: string;
  bridgeHypothesisClass?: string;
  bridgeMessageId?: string;
}) {
  return {
    ...forBackendWitness(input.evidence, input.routed),
    challenge_round: input.round,
    your_prior_post: input.prior,
    peer_opening_hypothesis_class: input.peerOpeningClass,
    bridge_hypothesis_class: input.bridgeHypothesisClass,
    bridge_band_message_id: input.bridgeMessageId,
    band_thread: bandThreadForRole(input.bandThread, "backend_witness"),
    required_target_band_message_id: input.peerMessageId,
    required_target_post_type:
      input.round === 1 ? "claim_tracer_initial" : "causal_judge_bridge",
    instruction:
      input.round === 1
        ? "CHALLENGE confirmation_before_execution as INCOMPLETE. Tool was invoked and failed. Narrow to failed_execution_must_be_part_of_cause."
        : "PARTIAL_CHALLENGE the bridge wording — support the mechanism but challenge over-weighting verbal confirmation. Failed execution remains the necessary condition.",
  };
}

export function forCausalJudgeTask(input: {
  incident_id: string;
  title: string;
  bandThread: BandPostContext[];
}) {
  return {
    incident_id: input.incident_id,
    title: input.title,
    band_thread: bandThreadForRole(input.bandThread, "causal_judge"),
    instruction:
      "You enter AFTER peer conflict round 1. Do NOT summarize. Post task: what causal class survives? Challenge completeness of conversation-only AND execution-only explanations.",
    access_note:
      "You receive peer claims and evidence refs only — fetch raw evidence only when a cited ref requires it.",
  };
}

export function forCausalJudgeBridge(input: {
  incident_id: string;
  title: string;
  bandThread: BandPostContext[];
  openingHypothesisClasses: {
    claim_tracer: string;
    backend_witness: string;
  };
}) {
  return {
    ...forCausalJudgeTask(input),
    opening_hypothesis_classes: input.openingHypothesisClasses,
    forbidden_bridge_classes: [
      input.openingHypothesisClasses.claim_tracer,
      input.openingHypothesisClasses.backend_witness,
    ],
    instruction:
      "Introduce bridge_hypothesis_class that NEITHER opening class can be. You may introduce surprising classes nobody proposed: silent_failure_after_tool_invocation, partial_workflow_completion, stale_state_assumption.",
  };
}

export function forCauseFindingSynthesis(input: {
  incident_id: string;
  title: string;
  bandThread: BandPostContext[];
  claimTracerInitial: ClaimTracerInitial;
  backendWitnessInitial: BackendWitnessInitial;
  claimTracerFinal: AgentChallenge;
  backendWitnessFinal: AgentChallenge;
  causalJudgeBridge: CausalJudgeBridge;
  causalJudgeRefinement?: { refinement_en: string; refined_bridge_class: string };
  bandMessageIds: string[];
}) {
  return {
    incident_id: input.incident_id,
    title: input.title,
    band_thread: bandThreadForRole(input.bandThread, "causal_judge"),
    opening_hypothesis_classes: {
      claim_tracer: input.claimTracerInitial.hypothesis_class,
      backend_witness: input.backendWitnessInitial.hypothesis_class,
    },
    final_hypothesis_classes: {
      claim_tracer: input.claimTracerFinal.updated_hypothesis_class,
      backend_witness: input.backendWitnessFinal.updated_hypothesis_class,
      causal_judge:
        input.causalJudgeRefinement?.refined_bridge_class ??
        input.causalJudgeBridge.bridge_hypothesis_class,
    },
    bridge_hypothesis_class: input.causalJudgeBridge.bridge_hypothesis_class,
    refined_bridge: input.causalJudgeRefinement,
    band_message_ids: input.bandMessageIds,
    rules: [
      "cause_class must differ from both opening classes",
      "Include hypothesis_lifecycle for every hypothesis with status and preserved_facts",
      "Include audit_trail with accepted_because and rejected_because citing Band message ids",
      "Final cause must be causal class + explanation — not transcript+logs narration",
    ],
  };
}
