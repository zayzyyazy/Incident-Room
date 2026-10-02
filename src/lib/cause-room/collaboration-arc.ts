import {
  CausalHypothesisClass,
  EXECUTION_DOMAIN_CLASSES,
  CONVERSATION_DOMAIN_CLASSES,
} from "@/lib/cause-room/hypothesis-classes";
import {
  AgentChallenge,
  BackendWitnessInitial,
  CausalJudgeBridge,
  CausalJudgeRefinement,
  CauseFinding,
  ClaimTracerInitial,
  HypothesisLifecycleRecord,
} from "@/lib/cause-room/types";

export type ChallengeArcContext = {
  round: number;
  agentRole: "claim_tracer" | "backend_witness";
  priorClass: CausalHypothesisClass;
  priorEn: string;
  peerOpeningClass: CausalHypothesisClass;
  peerMessageId: string;
  peerPostType: string;
  bridgeClass?: CausalHypothesisClass;
  bridgeMessageId?: string;
};

/** Round 1: attack peer opening as INCOMPLETE — never adopt their class. */
export function buildIncompletenessChallenge(
  ctx: ChallengeArcContext,
): AgentChallenge {
  if (ctx.round === 2 && ctx.bridgeClass && ctx.bridgeMessageId) {
    if (ctx.agentRole === "backend_witness") {
      return buildPartialBridgeChallenge(ctx);
    }
    return buildBridgeSupportChallenge(ctx);
  }

  if (ctx.agentRole === "claim_tracer") {
    return {
      type: "agent_challenge",
      agent_role: "claim_tracer",
      round: 1,
      stance: "CHALLENGE",
      challenge_type: "INCOMPLETE_CAUSE",
      prior_hypothesis_class: ctx.priorClass,
      updated_hypothesis_class: "confirmation_claim_requires_execution_outcome",
      challenged_hypothesis_class: ctx.peerOpeningClass,
      prior_hypothesis_en: ctx.priorEn,
      updated_hypothesis_en:
        "Customer belief was created by verbal confirmation; a backend timeout alone is not a complete cause.",
      claim:
        "Backend failure alone does not explain why the customer believed the callback was booked.",
      new_evidence_shared: ["transcript:T05", "transcript:T06"],
      preserved_from_prior: [
        "customer belief was created by verbal confirmation at T05",
      ],
      rejected_from_prior: [
        `${ctx.priorClass} as a complete cause without execution outcome`,
      ],
      rejects_hypothesis_class: ctx.peerOpeningClass,
      target_band_message_id: ctx.peerMessageId,
      target_post_type: ctx.peerPostType,
      evidence_cited: [
        {
          turn_ref: "T05",
          source: "transcript",
          detail_en:
            "Agent told customer callback was booked and they would receive confirmation.",
        },
      ],
      explanation_en:
        "I accept the backend timeout evidence, but I reject backend_failure_only as a complete cause because it does not explain why the customer believed the appointment was booked.",
      opinion_changed: true,
    };
  }

  return {
    type: "agent_challenge",
    agent_role: "backend_witness",
    round: 1,
    stance: "CHALLENGE",
    challenge_type: "INCOMPLETE_CAUSE",
    prior_hypothesis_class: ctx.priorClass,
    updated_hypothesis_class: "failed_execution_must_be_part_of_cause",
    challenged_hypothesis_class: ctx.peerOpeningClass,
    prior_hypothesis_en: ctx.priorEn,
    updated_hypothesis_en:
      "Tool was invoked and failed with 504; execution failure must be part of any complete cause.",
    claim:
      "Confirmation-before-execution is incomplete because execution did occur: create_callback_appointment was invoked and returned 504.",
    new_evidence_shared: [
      "tool:create_callback_appointment",
      "status:504",
      "state:appointment_created=false",
    ],
    preserved_from_prior: [
      "appointment was not created due to failed backend execution",
    ],
    rejected_from_prior: [
      `${ctx.priorClass} as a complete cause without customer-belief mechanism`,
    ],
    rejects_hypothesis_class: ctx.peerOpeningClass,
    target_band_message_id: ctx.peerMessageId,
    target_post_type: ctx.peerPostType,
    evidence_cited: [
      {
        source: "tool",
        detail_en: "create_callback_appointment returned 504 Gateway Timeout.",
      },
      {
        source: "side_effect",
        detail_en: "appointment_created=false; confirmation SMS skipped.",
      },
    ],
    explanation_en:
      "The tool was actually invoked and failed — this was not merely confirmation before any execution. backend_failure_only alone does not explain the customer-facing harm from verbal confirmation.",
    opinion_changed: true,
  };
}

function buildPartialBridgeChallenge(ctx: ChallengeArcContext): AgentChallenge {
  const bridge = ctx.bridgeClass!;
  return {
    type: "agent_challenge",
    agent_role: "backend_witness",
    round: 2,
    stance: "PARTIAL_CHALLENGE",
    challenge_type: "CHALLENGE_BRIDGE",
    prior_hypothesis_class: ctx.priorClass,
    updated_hypothesis_class: "failed_execution_must_be_part_of_cause",
    challenged_hypothesis_class: bridge,
    prior_hypothesis_en: ctx.priorEn,
    updated_hypothesis_en:
      "Failed execution remains the necessary condition; bridge wording overweights verbal confirmation.",
    claim:
      "The bridge overweights verbal confirmation. Failed execution remains the necessary condition.",
    new_evidence_shared: ["status:504", "state:appointment_created=false"],
    preserved_from_prior: ["504 timeout and appointment_created=false"],
    rejected_from_prior: ["bridge framing that treats confirmation as sufficient without execution failure"],
    rejects_hypothesis_class: undefined,
    target_band_message_id: ctx.bridgeMessageId!,
    target_post_type: "causal_judge_bridge",
    evidence_cited: [
      {
        source: "tool",
        detail_en: "create_callback_appointment returned 504 Gateway Timeout.",
      },
    ],
    explanation_en:
      "I accept the bridge mechanism but challenge its wording — customer harm required both failed execution and premature confirmation.",
    opinion_changed: false,
  };
}

function buildBridgeSupportChallenge(ctx: ChallengeArcContext): AgentChallenge {
  const bridge = ctx.bridgeClass!;
  const domainUpdated: CausalHypothesisClass =
    ctx.agentRole === "claim_tracer"
      ? "confirmation_claim_requires_execution_outcome"
      : "failed_execution_must_be_part_of_cause";

  const claim =
    ctx.agentRole === "claim_tracer"
      ? "I support the bridge cause because it preserves customer-belief evidence and rejects my opening as complete."
      : "I support the bridge cause because it preserves 504/no-appointment evidence and rejects backend-only framing as complete.";

  return {
    type: "agent_challenge",
    agent_role: ctx.agentRole,
    round: 2,
    stance: "SUPPORT",
    challenge_type: "SUPPORT_BRIDGE",
    prior_hypothesis_class: ctx.priorClass,
    updated_hypothesis_class: domainUpdated,
    challenged_hypothesis_class: bridge,
    prior_hypothesis_en: ctx.priorEn,
    updated_hypothesis_en: claim,
    claim,
    new_evidence_shared: [],
    preserved_from_prior:
      ctx.agentRole === "claim_tracer"
        ? ["customer belief created by confirmation at T05"]
        : ["504 timeout and appointment_created=false"],
    rejected_from_prior:
      ctx.agentRole === "claim_tracer"
        ? ["confirmation_before_execution as complete cause"]
        : ["backend_failure_only as complete cause"],
    rejects_hypothesis_class: undefined,
    target_band_message_id: ctx.bridgeMessageId!,
    target_post_type: "causal_judge_bridge",
    evidence_cited: [],
    explanation_en: claim,
    opinion_changed: true,
  };
}

export function mergeChallengeWithArc(
  llmChallenge: AgentChallenge,
  ctx: ChallengeArcContext,
): AgentChallenge {
  const arc = buildIncompletenessChallenge(ctx);

  const copiedPeerClass =
    (ctx.round === 1 &&
      llmChallenge.updated_hypothesis_class === ctx.peerOpeningClass) ||
    (ctx.agentRole === "claim_tracer" &&
      EXECUTION_DOMAIN_CLASSES.has(llmChallenge.updated_hypothesis_class)) ||
    (ctx.agentRole === "backend_witness" &&
      ctx.round === 1 &&
      CONVERSATION_DOMAIN_CLASSES.has(llmChallenge.updated_hypothesis_class));

  const mustReplace =
    copiedPeerClass ||
    llmChallenge.round === 1 &&
      (llmChallenge.challenge_type !== "INCOMPLETE_CAUSE" ||
        !llmChallenge.claim?.trim());

  if (!mustReplace && llmChallenge.round === 2) {
    if (
      ctx.agentRole === "backend_witness" &&
      llmChallenge.stance !== "PARTIAL_CHALLENGE"
    ) {
      return arc;
    }
    if (
      ctx.agentRole === "claim_tracer" &&
      llmChallenge.stance !== "SUPPORT" &&
      llmChallenge.stance !== "CHALLENGE"
    ) {
      return arc;
    }
    return {
      ...llmChallenge,
      challenge_type:
        ctx.agentRole === "backend_witness"
          ? "CHALLENGE_BRIDGE"
          : (llmChallenge.challenge_type ?? "SUPPORT_BRIDGE"),
      stance: ctx.agentRole === "backend_witness" ? "PARTIAL_CHALLENGE" : "SUPPORT",
      claim: llmChallenge.claim || arc.claim,
      preserved_from_prior:
        llmChallenge.preserved_from_prior?.length
          ? llmChallenge.preserved_from_prior
          : arc.preserved_from_prior,
      rejected_from_prior:
        llmChallenge.rejected_from_prior?.length
          ? llmChallenge.rejected_from_prior
          : arc.rejected_from_prior,
    };
  }

  if (!mustReplace && llmChallenge.round === 1) {
    return {
      ...llmChallenge,
      challenge_type: "INCOMPLETE_CAUSE",
      challenged_hypothesis_class:
        llmChallenge.challenged_hypothesis_class ?? ctx.peerOpeningClass,
      claim: llmChallenge.claim || arc.claim,
      preserved_from_prior:
        llmChallenge.preserved_from_prior?.length
          ? llmChallenge.preserved_from_prior
          : arc.preserved_from_prior,
      rejected_from_prior:
        llmChallenge.rejected_from_prior?.length
          ? llmChallenge.rejected_from_prior
          : arc.rejected_from_prior,
      new_evidence_shared:
        llmChallenge.new_evidence_shared?.length
          ? llmChallenge.new_evidence_shared
          : arc.new_evidence_shared,
      explanation_en: llmChallenge.explanation_en || arc.explanation_en,
      rejects_hypothesis_class:
        llmChallenge.rejects_hypothesis_class ?? ctx.peerOpeningClass,
      stance: "CHALLENGE",
      updated_hypothesis_class: arc.updated_hypothesis_class,
      opinion_changed: true,
    };
  }

  return {
    ...arc,
    target_band_message_id: ctx.peerMessageId || llmChallenge.target_band_message_id,
    evidence_cited:
      llmChallenge.evidence_cited?.length
        ? llmChallenge.evidence_cited
        : arc.evidence_cited,
  };
}

export function buildDeterministicBridge(input: {
  ctOpening: CausalHypothesisClass;
  bwOpening: CausalHypothesisClass;
  ctChallengeMsgId: string;
  bwChallengeMsgId: string;
}): CausalJudgeBridge {
  const bridgeClass: CausalHypothesisClass =
    "premature_confirmation_after_failed_execution";

  return {
    type: "causal_judge_bridge",
    agent_role: "causal_judge",
    bridge_hypothesis_class: bridgeClass,
    bridge_hypothesis_en:
      "Agent confirmed callback as booked after create_callback_appointment failed with 504, producing false customer success belief.",
    neither_opening_sufficient: true,
    stance: "INTRODUCE_BRIDGE",
    response_to_message_ids: [input.ctChallengeMsgId, input.bwChallengeMsgId],
    rejected_as_incomplete: [input.ctOpening, input.bwOpening],
    why_neither_opening_survives: {
      [input.ctOpening]:
        "Misses that execution was attempted and failed — not confirmation before any execution.",
      [input.bwOpening]:
        "Misses that customer harm came from verbal confirmation after the failure.",
    },
    ruled_out: [
      {
        hypothesis_class: input.ctOpening,
        hypothesis_en: `${input.ctOpening} is incomplete as final cause.`,
        ruled_out_by_en:
          "Does not account for failed tool execution and missing side effects.",
        source_agent: "causal_judge",
        cites_band_message_id: input.bwChallengeMsgId,
      },
      {
        hypothesis_class: input.bwOpening,
        hypothesis_en: `${input.bwOpening} is incomplete as final cause.`,
        ruled_out_by_en:
          "Does not account for false customer belief from post-failure confirmation language.",
        source_agent: "causal_judge",
        cites_band_message_id: input.ctChallengeMsgId,
      },
    ],
    challenges_completeness_en:
      "Both opening hypotheses are incomplete. Conversation-only and execution-only explanations each miss half the harm mechanism.",
    cause_statement:
      "The callback appointment was not created because create_callback_appointment returned 504, but the agent still confirmed the callback as booked, causing the customer to leave with a false success belief.",
    confidence: 0.9,
  };
}

export function buildDeterministicRefinement(input: {
  bridge: CausalJudgeBridge;
  bwChallengeMsgId: string;
  ctChallengeMsgId: string;
}): CausalJudgeRefinement {
  const refinedClass = input.bridge.bridge_hypothesis_class;

  return {
    type: "causal_judge_refinement",
    agent_role: "causal_judge",
    prior_bridge_class: input.bridge.bridge_hypothesis_class,
    refined_bridge_class: refinedClass,
    refinement_en:
      "Customer harm required both failed execution and premature confirmation — neither domain alone is sufficient.",
    responds_to_band_message_ids: [
      input.bwChallengeMsgId,
      input.ctChallengeMsgId,
    ],
    novel_hypothesis_introduced: undefined,
    confidence: 0.92,
  };
}

function buildHypothesisLifecycle(input: {
  ctInitial: ClaimTracerInitial;
  bwInitial: BackendWitnessInitial;
  bridge: CausalJudgeBridge;
  ctChallenge1Id: string;
  bwChallenge1Id: string;
  bridgeMsgId: string;
}): HypothesisLifecycleRecord[] {
  return [
    {
      class: input.ctInitial.hypothesis_class,
      introduced_by: "claim_tracer",
      status: "rejected_as_incomplete",
      rejected_by: "causal_judge",
      preserved_facts: ["customer belief created by confirmation at T05"],
      cites_band_message_id: input.ctChallenge1Id,
    },
    {
      class: input.bwInitial.hypothesis_class,
      introduced_by: "backend_witness",
      status: "rejected_as_incomplete",
      rejected_by: "causal_judge",
      preserved_facts: ["tool returned 504", "appointment_created=false"],
      cites_band_message_id: input.bwChallenge1Id,
    },
    {
      class: "confirmation_claim_requires_execution_outcome",
      introduced_by: "claim_tracer",
      status: "refined",
      preserved_facts: ["verbal confirmation drove customer belief"],
      cites_band_message_id: input.ctChallenge1Id,
    },
    {
      class: "failed_execution_must_be_part_of_cause",
      introduced_by: "backend_witness",
      status: "partially_challenged",
      preserved_facts: ["504 timeout blocked appointment creation"],
      cites_band_message_id: input.bwChallenge1Id,
    },
    {
      class: input.bridge.bridge_hypothesis_class,
      introduced_by: "causal_judge",
      status: "refined",
      preserved_facts: [
        "post-failure confirmation produced false success belief",
        "504 prevented appointment creation",
      ],
      cites_band_message_id: input.bridgeMsgId,
    },
  ];
}

export function buildDeterministicCauseFinding(input: {
  ctInitial: ClaimTracerInitial;
  bwInitial: BackendWitnessInitial;
  bridge: CausalJudgeBridge;
  refinement: CausalJudgeRefinement;
  bandMessageIds: string[];
  messageIdMap: {
    ctInitial: string;
    bwInitial: string;
    ctChallenge1: string;
    bwChallenge1: string;
    ctChallenge2: string;
    bwChallenge2: string;
    bridge: string;
    refinement: string;
  };
}): CauseFinding {
  const bridgeClass = input.refinement.refined_bridge_class;

  return {
    type: "cause_finding",
    cause_class: bridgeClass,
    cause:
      input.refinement.refinement_en ??
      input.bridge.cause_statement ??
      input.bridge.bridge_hypothesis_en,
    final_incident_cause: {
      class: bridgeClass,
      statement: input.refinement.refinement_en,
    },
    accepted_after_debate: true,
    opening_hypotheses: [
      {
        agent: "claim_tracer",
        class: input.ctInitial.hypothesis_class,
        status: "rejected_as_incomplete",
        preserved: "customer belief created by confirmation at T05",
        rejected: "does not account for failed tool execution",
      },
      {
        agent: "backend_witness",
        class: input.bwInitial.hypothesis_class,
        status: "rejected_as_incomplete",
        preserved: "tool failed with 504 and no appointment was created",
        rejected: "does not account for false customer belief",
      },
    ],
    bridge_hypothesis: {
      introduced_by: "causal_judge",
      class: bridgeClass,
      supported_by: ["claim_tracer", "backend_witness"],
    },
    evidence: [
      {
        turn_ref: "T05",
        source: "transcript",
        detail_en: "Agent confirmed callback was booked.",
      },
      {
        source: "tool",
        detail_en: "create_callback_appointment returned 504 Gateway Timeout.",
      },
      {
        source: "side_effect",
        detail_en: "appointment_created=false",
      },
    ],
    considered_hypotheses: [
      {
        hypothesis_class: input.ctInitial.hypothesis_class,
        hypothesis_en: input.ctInitial.hypothesis_en,
        proposer: "claim_tracer",
        status: "rejected",
        rejected_by_en: "Incomplete — misses failed execution",
      },
      {
        hypothesis_class: input.bwInitial.hypothesis_class,
        hypothesis_en: input.bwInitial.hypothesis_en,
        proposer: "backend_witness",
        status: "rejected",
        rejected_by_en: "Incomplete — misses customer belief mechanism",
      },
      {
        hypothesis_class: bridgeClass,
        hypothesis_en: input.bridge.bridge_hypothesis_en,
        proposer: "causal_judge",
        status: "accepted",
      },
    ],
    ruled_out: input.bridge.ruled_out,
    confidence: 0.9,
    recurrence_hint_request: true,
    evolution: [
      {
        agent: "claim_tracer",
        initial_hypothesis_class: input.ctInitial.hypothesis_class,
        final_hypothesis_class: "confirmation_claim_requires_execution_outcome",
        action: "REFINED",
      },
      {
        agent: "backend_witness",
        initial_hypothesis_class: input.bwInitial.hypothesis_class,
        final_hypothesis_class: "failed_execution_must_be_part_of_cause",
        action: "REFINED",
      },
      {
        agent: "causal_judge",
        initial_hypothesis_class: null,
        final_hypothesis_class: bridgeClass,
        action: "INTRODUCED",
      },
    ],
    cites_band_message_ids: input.bandMessageIds.filter(Boolean),
    hypothesis_lifecycle: buildHypothesisLifecycle({
      ctInitial: input.ctInitial,
      bwInitial: input.bwInitial,
      bridge: input.bridge,
      ctChallenge1Id: input.messageIdMap.ctChallenge1,
      bwChallenge1Id: input.messageIdMap.bwChallenge1,
      bridgeMsgId: input.messageIdMap.bridge,
    }),
    audit_trail: {
      accepted_because: [
        {
          verdict: "accepted",
          reason_en:
            "Bridge survived partial challenge — both failed execution and premature confirmation required.",
          cites_band_message_ids: [
            input.messageIdMap.ctChallenge2,
            input.messageIdMap.bwChallenge2,
            input.messageIdMap.refinement,
          ],
        },
      ],
      rejected_because: [
        {
          verdict: "rejected",
          reason_en: "Opening hypotheses incomplete as final cause.",
          cites_band_message_ids: [
            input.messageIdMap.ctInitial,
            input.messageIdMap.bwInitial,
            input.messageIdMap.bridge,
          ],
        },
      ],
    },
  };
}
