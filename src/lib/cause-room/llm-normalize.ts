import { z } from "zod";
import {
  CausalHypothesisClass,
  pickBridgeClassForOpenings,
} from "@/lib/cause-room/hypothesis-classes";
import { EvidenceCitationSchema } from "@/lib/cause-room/types";

const NESTED_PAYLOAD_KEYS = [
  "agent_challenge",
  "causal_judge_bridge",
  "causal_judge_task",
  "cause_finding",
] as const;

function unwrapNestedPayload(record: Record<string, unknown>): Record<string, unknown> {
  for (const key of NESTED_PAYLOAD_KEYS) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return { ...(nested as Record<string, unknown>) };
    }
  }
  return record;
}

/** LLMs often return evidence as plain strings; normalize to citation objects. */
export const EvidenceCitationInputSchema = z.union([
  EvidenceCitationSchema,
  z.string().transform((detail_en) => ({
    detail_en,
    source: "transcript" as const,
  })),
]);

export function normalizeEvidenceList(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((item) => {
    if (typeof item === "string") {
      return { detail_en: item, source: "transcript" as const };
    }
    return item;
  });
}

export function injectCauseRoomEnvelope(
  raw: unknown,
  envelope: { type: string; agent_role?: string },
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  let record = raw as Record<string, unknown>;
  record = unwrapNestedPayload(record);

  if (
    record.agent_challenge &&
    typeof record.agent_challenge === "object" &&
    !Array.isArray(record.agent_challenge)
  ) {
    record = { ...(record.agent_challenge as Record<string, unknown>) };
  }

  const normalized: Record<string, unknown> = {
    type: record.type ?? envelope.type,
    ...(envelope.agent_role
      ? { agent_role: record.agent_role ?? envelope.agent_role }
      : {}),
    ...record,
  };

  for (const key of [
    "supporting_evidence",
    "evidence_cited",
    "evidence",
  ] as const) {
    if (key in normalized) {
      normalized[key] = normalizeEvidenceList(normalized[key]);
    }
  }

  return normalized;
}

export type AgentChallengeNormalizeContext = {
  challenge_round?: number;
  your_prior_post?: {
    hypothesis_class?: string;
    hypothesis_en?: string;
  };
  peer_opening_hypothesis_class?: string;
  required_target_band_message_id?: string;
  required_target_post_type?: string;
  bridge_hypothesis_class?: string;
  bridge_band_message_id?: string;
};

function normalizeStance(value: unknown): "CHALLENGE" | "SUPPORT" | "YIELD" {
  if (typeof value !== "string") {
    return "CHALLENGE";
  }
  const upper = value.toUpperCase();
  if (upper === "CHALLENGE" || upper === "SUPPORT" || upper === "YIELD") {
    return upper;
  }
  if (upper.includes("YIELD") || upper.includes("WITHDRAW")) {
    return "YIELD";
  }
  if (upper.includes("SUPPORT") || upper.includes("AGREE")) {
    return "SUPPORT";
  }
  return "CHALLENGE";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Map common LLM field aliases to agent_challenge schema. */
export function normalizeAgentChallenge(
  raw: unknown,
  context: AgentChallengeNormalizeContext,
  agentRole: "claim_tracer" | "backend_witness",
): unknown {
  const base = injectCauseRoomEnvelope(raw, {
    type: "agent_challenge",
    agent_role: agentRole,
  });

  if (!base || typeof base !== "object" || Array.isArray(base)) {
    return base;
  }

  const record = base as Record<string, unknown>;
  const prior = context.your_prior_post ?? {};

  const priorClass =
    asString(record.prior_hypothesis_class) ??
    asString(prior.hypothesis_class) ??
    "ungrounded_success_claim";

  const priorEn =
    asString(record.prior_hypothesis_en) ??
    asString(prior.hypothesis_en) ??
    "Prior hypothesis";

  const updatedEn =
    asString(record.updated_hypothesis_en) ??
    asString(record.hypothesis_en) ??
    priorEn;

  const evidence =
    record.evidence_cited ??
    record.supporting_evidence ??
    record.evidence ??
    [];

  const stance = normalizeStance(record.stance ?? record.action);

  const round =
    typeof record.round === "number"
      ? record.round
      : typeof record.challenge_round === "number"
        ? record.challenge_round
        : (context.challenge_round ?? 1);

  const challengeTypeRaw = asString(record.challenge_type);
  const challenge_type =
    challengeTypeRaw === "INCOMPLETE_CAUSE" ||
    challengeTypeRaw === "SUPPORT_BRIDGE" ||
    challengeTypeRaw === "CHALLENGE_BRIDGE"
      ? challengeTypeRaw
      : round === 2
        ? "SUPPORT_BRIDGE"
        : "INCOMPLETE_CAUSE";

  const peerClass =
    asString(record.challenged_hypothesis_class) ??
    context.peer_opening_hypothesis_class ??
    "backend_failure_only";

  const updatedClass =
    asString(record.updated_hypothesis_class) ??
    asString(record.updated_hypothesis) ??
    asString(record.hypothesis_class) ??
    priorClass;

  const preserved = Array.isArray(record.preserved_from_prior)
    ? record.preserved_from_prior.map(String)
    : [];
  const rejected = Array.isArray(record.rejected_from_prior)
    ? record.rejected_from_prior.map(String)
    : [];
  const newEvidence = Array.isArray(record.new_evidence_shared)
    ? record.new_evidence_shared.map(String)
    : [];

  const targetId =
    asString(record.target_band_message_id) ??
    context.required_target_band_message_id ??
    "";

  const targetPostType =
    asString(record.target_post_type) ??
    context.required_target_post_type ??
    "backend_witness_initial";

  const explanation =
    asString(record.explanation_en) ??
    asString(record.explanation) ??
    updatedEn;

  const opinionChanged =
    typeof record.opinion_changed === "boolean"
      ? record.opinion_changed
      : priorClass !== updatedClass || stance === "YIELD";

  return {
    type: "agent_challenge",
    agent_role: agentRole,
    round,
    stance,
    challenge_type,
    prior_hypothesis_class: priorClass as CausalHypothesisClass,
    updated_hypothesis_class: updatedClass as CausalHypothesisClass,
    challenged_hypothesis_class: peerClass as CausalHypothesisClass,
    prior_hypothesis_en: priorEn,
    updated_hypothesis_en: updatedEn,
    claim:
      asString(record.claim) ??
      explanation ??
      "Peer hypothesis is incomplete as a complete cause.",
    new_evidence_shared: newEvidence,
    preserved_from_prior: preserved,
    rejected_from_prior: rejected,
    rejects_hypothesis_class:
      (asString(record.rejects_hypothesis_class) as CausalHypothesisClass | undefined) ??
      (round === 1 ? (peerClass as CausalHypothesisClass) : undefined),
    target_band_message_id: targetId,
    target_post_type: targetPostType,
    evidence_cited: normalizeEvidenceList(evidence),
    explanation_en: explanation,
    opinion_changed: opinionChanged,
  };
}

export type CausalJudgeBridgeContext = {
  opening_hypothesis_classes?: {
    claim_tracer?: string;
    backend_witness?: string;
  };
  band_thread?: Array<{ band_message_id?: string; post_type?: string }>;
};

export function normalizeCausalJudgeTask(raw: unknown): unknown {
  const base = injectCauseRoomEnvelope(raw, {
    type: "causal_judge_task",
    agent_role: "causal_judge",
  });
  if (!base || typeof base !== "object" || Array.isArray(base)) {
    return base;
  }
  const record = base as Record<string, unknown>;
  const openQuestions = Array.isArray(record.open_questions)
    ? record.open_questions.map(String)
    : Array.isArray(record.questions)
      ? (record.questions as unknown[]).map(String)
      : [
          "Can conversation-only class explain missing side effects?",
          "Can execution-only class explain customer belief at T05?",
        ];

  return {
    type: "causal_judge_task",
    agent_role: "causal_judge",
    task_en:
      asString(record.task_en) ??
      asString(record.task) ??
      "Resolve whether conversation-only or execution-only opening classes fully explain customer harm.",
    open_questions: openQuestions,
    conversation_alone_sufficient:
      typeof record.conversation_alone_sufficient === "boolean"
        ? record.conversation_alone_sufficient
        : false,
    execution_alone_sufficient:
      typeof record.execution_alone_sufficient === "boolean"
        ? record.execution_alone_sufficient
        : false,
  };
}

export function normalizeCausalJudgeBridge(
  raw: unknown,
  context: CausalJudgeBridgeContext,
): unknown {
  const base = injectCauseRoomEnvelope(raw, {
    type: "causal_judge_bridge",
    agent_role: "causal_judge",
  });
  if (!base || typeof base !== "object" || Array.isArray(base)) {
    return base;
  }

  const record = base as Record<string, unknown>;
  const ctOpening =
    (context.opening_hypothesis_classes?.claim_tracer as CausalHypothesisClass) ??
    "confirmation_before_execution";
  const bwOpening =
    (context.opening_hypothesis_classes?.backend_witness as CausalHypothesisClass) ??
    "backend_failure_only";

  const forbidden = new Set([ctOpening, bwOpening]);
  let bridgeClass =
    asString(record.bridge_hypothesis_class) ??
    asString(record.hypothesis_class) ??
    asString(record.cause_class);

  if (!bridgeClass || forbidden.has(bridgeClass as CausalHypothesisClass)) {
    bridgeClass = pickBridgeClassForOpenings(ctOpening, bwOpening);
  }

  const thread = context.band_thread ?? [];
  const ctMsg = thread.find((p) => p.post_type === "claim_tracer_initial");
  const bwMsg = thread.find((p) => p.post_type === "backend_witness_initial");

  const ruledOutRaw = record.ruled_out ?? record.ruled_out_hypotheses ?? [];
  const ruled_out = Array.isArray(ruledOutRaw)
    ? ruledOutRaw
    : [
        {
          hypothesis_class: ctOpening,
          hypothesis_en: `Opening class ${ctOpening} alone cannot explain missing side effects.`,
          ruled_out_by_en:
            "Conversation-only explanation fails completeness once execution shows failed or skipped side effects.",
          source_agent: "causal_judge",
          cites_band_message_id: ctMsg?.band_message_id,
        },
        {
          hypothesis_class: bwOpening,
          hypothesis_en: `Opening class ${bwOpening} alone cannot explain customer belief.`,
          ruled_out_by_en:
            "Execution-only explanation fails completeness — customer heard explicit confirmation language.",
          source_agent: "causal_judge",
          cites_band_message_id: bwMsg?.band_message_id,
        },
      ];

  return {
    type: "causal_judge_bridge",
    agent_role: "causal_judge",
    stance: "INTRODUCE_BRIDGE" as const,
    bridge_hypothesis_class: bridgeClass as CausalHypothesisClass,
    bridge_hypothesis_en:
      asString(record.bridge_hypothesis_en) ??
      asString(record.hypothesis_en) ??
      asString(record.bridge_hypothesis) ??
      "Bridge class requires both customer-facing confirmation signal and failed/skipped execution.",
    neither_opening_sufficient:
      typeof record.neither_opening_sufficient === "boolean"
        ? record.neither_opening_sufficient
        : true,
    response_to_message_ids: Array.isArray(record.response_to_message_ids)
      ? record.response_to_message_ids.map(String)
      : undefined,
    rejected_as_incomplete: Array.isArray(record.rejected_as_incomplete)
      ? (record.rejected_as_incomplete as CausalHypothesisClass[])
      : [ctOpening, bwOpening],
    why_neither_opening_survives:
      record.why_neither_opening_survives &&
      typeof record.why_neither_opening_survives === "object"
        ? (record.why_neither_opening_survives as Record<string, string>)
        : {
            [ctOpening]:
              "Misses that execution was attempted and failed.",
            [bwOpening]:
              "Misses that customer harm came from verbal confirmation.",
          },
    ruled_out,
    challenges_completeness_en:
      asString(record.challenges_completeness_en) ??
      asString(record.completeness_challenge) ??
      "Conversation-only and execution-only opening classes each fail alone.",
    cause_statement:
      asString(record.cause_statement) ??
      asString(record.cause) ??
      undefined,
    confidence:
      typeof record.confidence === "number"
        ? record.confidence
        : 0.85,
  };
}

export type CauseFindingContext = {
  opening_hypothesis_classes?: {
    claim_tracer?: string;
    backend_witness?: string;
  };
  bridge_hypothesis_class?: string;
  band_message_ids?: string[];
};

export function normalizeCauseFinding(
  raw: unknown,
  context: CauseFindingContext,
): unknown {
  const base = injectCauseRoomEnvelope(raw, { type: "cause_finding" });
  if (!base || typeof base !== "object" || Array.isArray(base)) {
    return base;
  }

  const record = base as Record<string, unknown>;
  const bridgeClass =
    context.bridge_hypothesis_class ??
    asString(record.cause_class) ??
    "false_completion_signal_after_missing_execution";

  const consideredRaw =
    record.considered_hypotheses ?? record.hypotheses_considered ?? [];
  const considered = Array.isArray(consideredRaw) ? consideredRaw : [];

  const ruledOutRaw = record.ruled_out ?? [];
  const ruled_out = Array.isArray(ruledOutRaw) ? ruledOutRaw : [];

  const bandIds = context.band_message_ids ?? [];

  return {
    type: "cause_finding",
    cause_class: bridgeClass,
    cause:
      asString(record.cause) ??
      asString(record.cause_en) ??
      asString(record.summary_en) ??
      "Runtime cause requires cross-domain bridge class.",
    evidence: normalizeEvidenceList(record.evidence ?? record.supporting_evidence ?? []),
    considered_hypotheses: considered.length
      ? considered
      : [
          {
            hypothesis_class: context.opening_hypothesis_classes?.claim_tracer,
            hypothesis_en: "Opening conversation class",
            proposer: "claim_tracer",
            status: "refined",
          },
          {
            hypothesis_class: context.opening_hypothesis_classes?.backend_witness,
            hypothesis_en: "Opening execution class",
            proposer: "backend_witness",
            status: "refined",
          },
          {
            hypothesis_class: bridgeClass,
            hypothesis_en: "Bridge class after peer conflict",
            proposer: "causal_judge",
            status: "accepted",
          },
        ],
    ruled_out,
    confidence:
      typeof record.confidence === "number" ? record.confidence : 0.85,
    recurrence_hint_request:
      typeof record.recurrence_hint_request === "boolean"
        ? record.recurrence_hint_request
        : true,
    evolution: Array.isArray(record.evolution) ? record.evolution : [],
    cites_band_message_ids: Array.isArray(record.cites_band_message_ids)
      ? record.cites_band_message_ids
      : bandIds.slice(-5),
  };
}
