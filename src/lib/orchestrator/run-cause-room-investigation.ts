import { createRoom, getRoomHistory } from "@/lib/band/client";
import { bandRoomTitle } from "@/lib/band/room-titles";
import {
  agentsAreDistinct,
  postCauseRoomEvent,
  resolveCauseRoomAgents,
  setupCauseRoomParticipants,
} from "@/lib/band/multi-agent";
import {
  runBackendWitnessChallenge,
  runBackendWitnessInitial,
  runCausalJudgeBridge,
  runCausalJudgeTask,
  runCauseFinding,
  runClaimTracerChallenge,
  runClaimTracerInitial,
} from "@/lib/cause-room/agents";
import {
  forBackendWitness,
  forBackendWitnessChallenge,
  forCausalJudgeBridge,
  forCausalJudgeTask,
  forClaimTracer,
  forClaimTracerChallenge,
  forCauseFindingSynthesis,
} from "@/lib/cause-room/context-filter";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";
import { toolEventType } from "@/lib/cause-room/tool-artifacts";
import {
  AgentChallenge,
  BackendWitnessInitial,
  BandPostContext,
  CausalJudgeBridge,
  CausalJudgeRefinement,
  CausalJudgeTask,
  CauseFinding,
  CauseRoomBandMessageIds,
  CauseRoomFeedEntry,
  ClaimTracerInitial,
} from "@/lib/cause-room/types";
import { toCauseFindingArtifact } from "@/lib/cross-room/artifacts";
import {
  buildDeterministicBridge,
  buildDeterministicCauseFinding,
  buildDeterministicRefinement,
  mergeChallengeWithArc,
} from "@/lib/cause-room/collaboration-arc";
import {
  assertNoCrossDomainCopy,
  enforceChallengeIntegrity,
  ensureCauseFindingIntegrity,
  mergeBridgeWithArc,
  openingDiffersFromFinal,
} from "@/lib/cause-room/validation";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  createStepSink,
  InvestigationStep,
  stepFromFeedEntry,
} from "@/lib/demo/investigation-steps";
import { runEvidenceNormalizer } from "@/lib/normalizer/run-normalizer";
import { RoutedEvidence } from "@/lib/normalizer/types";

export type CauseRoomInvestigationResult = {
  roomId: string;
  distinctBandAgents: boolean;
  claimTracerInitial: ClaimTracerInitial;
  backendWitnessInitial: BackendWitnessInitial;
  claimTracerChallenge1: AgentChallenge;
  backendWitnessChallenge1: AgentChallenge;
  causalJudgeTask: CausalJudgeTask;
  causalJudgeBridge: CausalJudgeBridge;
  claimTracerChallenge2: AgentChallenge;
  backendWitnessChallenge2: AgentChallenge;
  causalJudgeRefinement: CausalJudgeRefinement;
  causeFinding: CauseFinding;
  causeFindingArtifact: ReturnType<typeof toCauseFindingArtifact>;
  bandMessageIds: CauseRoomBandMessageIds;
  feedTimeline: CauseRoomFeedEntry[];
  history: Awaited<ReturnType<typeof getRoomHistory>>;
};

function pushThread(
  thread: BandPostContext[],
  post: BandPostContext,
): BandPostContext[] {
  return [...thread, post];
}

async function recordFeed(
  timeline: CauseRoomFeedEntry[],
  entry: Omit<CauseRoomFeedEntry, "content"> & { content?: string },
  stepSink?: ReturnType<typeof createStepSink>,
): Promise<void> {
  const row = { ...entry, content: entry.content ?? "" };
  timeline.push(row);
  if (stepSink) {
    const step = stepFromFeedEntry({
      room: "cause",
      agentId: row.agentId,
      messageId: row.messageId,
      bandEventKind: row.bandEventKind,
      content: row.content,
      payload: row.payload,
    });
    if (step) await stepSink.push(step);
  }
}

function formatCompactChallenge(challenge: AgentChallenge): string {
  const pointer =
    challenge.new_evidence_shared[0] ??
    `msg ${challenge.target_band_message_id.slice(0, 8)}`;
  return [
    `${hypothesisClassLabel(challenge.updated_hypothesis_class)}`,
    challenge.claim.split(".")[0] + ".",
    `Pointer: ${pointer}`,
  ].join("\n");
}

function formatCompactInitial(
  label: string,
  hypothesisClass: string,
  hypothesisEn: string,
  pointer: string,
): string {
  return [
    `${label}: ${hypothesisClassLabel(hypothesisClass)}`,
    hypothesisEn.split(".")[0] + ".",
    `Pointer: ${pointer}`,
  ].join("\n");
}

function applyChallengeArc(
  llmChallenge: AgentChallenge,
  ctx: Parameters<typeof mergeChallengeWithArc>[1],
): AgentChallenge {
  const merged = mergeChallengeWithArc(llmChallenge, ctx);
  assertNoCrossDomainCopy(merged, ctx.peerOpeningClass);
  return enforceChallengeIntegrity(merged, ctx.priorClass);
}

export async function runCauseRoomInvestigation(
  evidence: VoiceIncidentEvidence,
  options?: {
    taskId?: string;
    onStep?: (step: InvestigationStep) => void | Promise<void>;
    routed?: RoutedEvidence;
    skipNormalizer?: boolean;
  },
): Promise<CauseRoomInvestigationResult> {
  const stepSink = createStepSink(options?.onStep);
  const emit = async (
    timeline: CauseRoomFeedEntry[],
    entry: Parameters<typeof recordFeed>[1],
  ) => recordFeed(timeline, entry, stepSink);

  const routed =
    options?.routed ??
    (
      await runEvidenceNormalizer({
        evidence,
        onStep: options?.onStep,
        postToBand: false,
      })
    ).routed;

  const agents = await resolveCauseRoomAgents();
  const distinctBandAgents = agentsAreDistinct(agents);

  const roomCreatorKey = distinctBandAgents
    ? agents.claim_tracer.apiKey
    : process.env.BAND_API_KEY!;

  const room = await createRoom({
    taskId: options?.taskId,
    title: bandRoomTitle(evidence, "Cause Room"),
    apiKey: roomCreatorKey,
  });

  await setupCauseRoomParticipants(room.id, roomCreatorKey, agents);

  // #region agent log
  fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "aca1d4",
    },
    body: JSON.stringify({
      sessionId: "aca1d4",
      hypothesisId: "C",
      location: "run-cause-room-investigation.ts:setup",
      message: "room ready",
      data: {
        roomId: room.id.slice(0, 8),
        distinctBandAgents,
        roomCreatorKeyPrefix: roomCreatorKey.slice(0, 12),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  let thread: BandPostContext[] = [];
  const allMessageIds: string[] = [];
  const feedTimeline: CauseRoomFeedEntry[] = [];

  const claimTracerInitial = await runClaimTracerInitial(
    forClaimTracer(evidence, routed),
  );

  const ctInitialPost = await postCauseRoomEvent({
    roomId: room.id,
    role: "claim_tracer",
    agents,
    messageType: "thought",
    content: formatCompactInitial(
      "Hypothesis",
      claimTracerInitial.hypothesis_class,
      claimTracerInitial.hypothesis_en,
      "T05 · customer belief",
    ),
    metadata: {
      type: "claim_tracer_initial",
      payload: claimTracerInitial,
    },
  });

  thread = pushThread(thread, {
    messageId: ctInitialPost.id,
    agentRole: "claim_tracer",
    postType: "claim_tracer_initial",
    bandEventKind: "thought",
    payload: claimTracerInitial,
  });
  await emit(feedTimeline, {
    agentId: "claim_tracer",
    messageId: ctInitialPost.id,
    bandEventKind: "thought",
    content: ctInitialPost.content,
    payload: claimTracerInitial,
  });
  allMessageIds.push(ctInitialPost.id);

  const backendWitnessToolEvents: string[] = [];

  for (const call of evidence.layer2_execution.function_calls) {
    const callPost = await postCauseRoomEvent({
      roomId: room.id,
      role: "backend_witness",
      agents,
      messageType: "tool_call",
        content: `${call.name} → ${call.status}${call.http_status ? ` ${call.http_status}` : ""}`,
      metadata: { tool_name: call.name, turn_ref: call.turn_ref },
    });
    backendWitnessToolEvents.push(callPost.id);
    allMessageIds.push(callPost.id);
    await emit(feedTimeline, {
      agentId: "backend_witness",
      messageId: callPost.id,
      bandEventKind: "tool_call",
      content: callPost.content,
    });

    const resultPost = await postCauseRoomEvent({
      roomId: room.id,
      role: "backend_witness",
      agents,
      messageType: toolEventType(call),
      content: `${call.name} → ${call.status}${call.http_status ? ` (${call.http_status})` : ""}`,
      metadata: {
        tool_name: call.name,
        status: call.status,
        http_status: call.http_status,
        turn_ref: call.turn_ref,
      },
    });
    backendWitnessToolEvents.push(resultPost.id);
    allMessageIds.push(resultPost.id);
    await emit(feedTimeline, {
      agentId: "backend_witness",
      messageId: resultPost.id,
      bandEventKind: toolEventType(call),
      content: resultPost.content,
    });

    if (call.status === "timeout" || call.status === "error") {
      const errPost = await postCauseRoomEvent({
        roomId: room.id,
        role: "backend_witness",
        agents,
        messageType: "error",
        content: `${call.name} failed · appointment_created=false`,
        metadata: {
          tool_name: call.name,
          error_type: "appointment_not_created",
          turn_ref: call.turn_ref,
        },
      });
      backendWitnessToolEvents.push(errPost.id);
      allMessageIds.push(errPost.id);
      await emit(feedTimeline, {
        agentId: "backend_witness",
        messageId: errPost.id,
        bandEventKind: "error",
        content: errPost.content,
      });
    }
  }

  const sideEffectsPost = await postCauseRoomEvent({
    roomId: room.id,
    role: "backend_witness",
    agents,
    messageType: "tool_result",
    content: `Side effects: appointment_created=${String(evidence.layer2_execution.side_effects.appointment_created)}`,
    metadata: { type: "side_effects_snapshot" },
  });
  await emit(feedTimeline, {
    agentId: "backend_witness",
    messageId: sideEffectsPost.id,
    bandEventKind: "tool_result",
    content: sideEffectsPost.content,
  });

  const backendWitnessInitial = await runBackendWitnessInitial(
    forBackendWitness(evidence, routed),
  );

  const bwInitialPost = await postCauseRoomEvent({
    roomId: room.id,
    role: "backend_witness",
    agents,
    messageType: "thought",
    content: formatCompactInitial(
      "Hypothesis",
      backendWitnessInitial.hypothesis_class,
      backendWitnessInitial.hypothesis_en,
      "create_callback_appointment · 504",
    ),
    metadata: {
      type: "backend_witness_initial",
      payload: backendWitnessInitial,
      tool_event_ids: backendWitnessToolEvents,
    },
  });

  thread = pushThread(thread, {
    messageId: bwInitialPost.id,
    agentRole: "backend_witness",
    postType: "backend_witness_initial",
    bandEventKind: "thought",
    payload: backendWitnessInitial,
  });
  await emit(feedTimeline, {
    agentId: "backend_witness",
    messageId: bwInitialPost.id,
    bandEventKind: "thought",
    content: bwInitialPost.content,
    payload: backendWitnessInitial,
  });
  allMessageIds.push(bwInitialPost.id);

  let claimTracerChallenge1 = applyChallengeArc(
    await runClaimTracerChallenge(
      forClaimTracerChallenge({
        evidence,
        routed,
        prior: claimTracerInitial,
        bandThread: thread,
        round: 1,
        peerMessageId: bwInitialPost.id,
        peerOpeningClass: backendWitnessInitial.hypothesis_class,
      }),
    ),
    {
      round: 1,
      agentRole: "claim_tracer",
      priorClass: claimTracerInitial.hypothesis_class,
      priorEn: claimTracerInitial.hypothesis_en,
      peerOpeningClass: backendWitnessInitial.hypothesis_class,
      peerMessageId: bwInitialPost.id,
      peerPostType: "backend_witness_initial",
    },
  );
  claimTracerChallenge1 = {
    ...claimTracerChallenge1,
    target_band_message_id: bwInitialPost.id,
  };

  const ctChallenge1Post = await postCauseRoomEvent({
    roomId: room.id,
    role: "claim_tracer",
    agents,
    messageType: "thought",
    content: formatCompactChallenge(claimTracerChallenge1),
    metadata: { type: "agent_challenge", payload: claimTracerChallenge1 },
  });

  thread = pushThread(thread, {
    messageId: ctChallenge1Post.id,
    agentRole: "claim_tracer",
    postType: "agent_challenge",
    bandEventKind: "thought",
    payload: claimTracerChallenge1,
  });
  await emit(feedTimeline, {
    agentId: "claim_tracer",
    messageId: ctChallenge1Post.id,
    bandEventKind: "thought",
    content: ctChallenge1Post.content,
    payload: claimTracerChallenge1,
  });
  allMessageIds.push(ctChallenge1Post.id);

  let backendWitnessChallenge1 = applyChallengeArc(
    await runBackendWitnessChallenge(
      forBackendWitnessChallenge({
        evidence,
        routed,
        prior: backendWitnessInitial,
        bandThread: thread,
        round: 1,
        peerMessageId: ctInitialPost.id,
        peerOpeningClass: claimTracerInitial.hypothesis_class,
      }),
    ),
    {
      round: 1,
      agentRole: "backend_witness",
      priorClass: backendWitnessInitial.hypothesis_class,
      priorEn: backendWitnessInitial.hypothesis_en,
      peerOpeningClass: claimTracerInitial.hypothesis_class,
      peerMessageId: ctInitialPost.id,
      peerPostType: "claim_tracer_initial",
    },
  );
  backendWitnessChallenge1 = {
    ...backendWitnessChallenge1,
    target_band_message_id: ctInitialPost.id,
  };

  const bwChallenge1Post = await postCauseRoomEvent({
    roomId: room.id,
    role: "backend_witness",
    agents,
    messageType: "thought",
    content: formatCompactChallenge(backendWitnessChallenge1),
    metadata: { type: "agent_challenge", payload: backendWitnessChallenge1 },
  });

  thread = pushThread(thread, {
    messageId: bwChallenge1Post.id,
    agentRole: "backend_witness",
    postType: "agent_challenge",
    bandEventKind: "thought",
    payload: backendWitnessChallenge1,
  });
  await emit(feedTimeline, {
    agentId: "backend_witness",
    messageId: bwChallenge1Post.id,
    bandEventKind: "thought",
    content: bwChallenge1Post.content,
    payload: backendWitnessChallenge1,
  });
  allMessageIds.push(bwChallenge1Post.id);

  const causalJudgeTask = await runCausalJudgeTask(
    forCausalJudgeTask({
      incident_id: evidence.incident_id,
      title: evidence.title,
      bandThread: thread,
    }),
  );

  const cjTaskPost = await postCauseRoomEvent({
    roomId: room.id,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: "Arbitrate: resolve opening hypothesis conflict.",
    metadata: { type: "causal_judge_task", payload: causalJudgeTask },
  });

  thread = pushThread(thread, {
    messageId: cjTaskPost.id,
    agentRole: "causal_judge",
    postType: "causal_judge_task",
    bandEventKind: "task",
    payload: causalJudgeTask,
  });
  await emit(feedTimeline, {
    agentId: "causal_judge",
    messageId: cjTaskPost.id,
    bandEventKind: "task",
    content: cjTaskPost.content,
    payload: causalJudgeTask,
  });
  allMessageIds.push(cjTaskPost.id);

  let causalJudgeBridge = mergeBridgeWithArc(
    await runCausalJudgeBridge(
      forCausalJudgeBridge({
        incident_id: evidence.incident_id,
        title: evidence.title,
        bandThread: thread,
        openingHypothesisClasses: {
          claim_tracer: claimTracerInitial.hypothesis_class,
          backend_witness: backendWitnessInitial.hypothesis_class,
        },
      }),
    ),
    buildDeterministicBridge({
      ctOpening: claimTracerInitial.hypothesis_class,
      bwOpening: backendWitnessInitial.hypothesis_class,
      ctChallengeMsgId: ctChallenge1Post.id,
      bwChallengeMsgId: bwChallenge1Post.id,
    }),
  );
  causalJudgeBridge = {
    ...causalJudgeBridge,
    response_to_message_ids: [
      ctChallenge1Post.id,
      bwChallenge1Post.id,
    ],
  };

  const cjBridgePost = await postCauseRoomEvent({
    roomId: room.id,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: `${hypothesisClassLabel(causalJudgeBridge.bridge_hypothesis_class)} · ${(causalJudgeBridge.cause_statement ?? causalJudgeBridge.bridge_hypothesis_en).split(".")[0]}.`,
    metadata: { type: "causal_judge_bridge", payload: causalJudgeBridge },
  });

  thread = pushThread(thread, {
    messageId: cjBridgePost.id,
    agentRole: "causal_judge",
    postType: "causal_judge_bridge",
    bandEventKind: "task",
    payload: causalJudgeBridge,
  });
  await emit(feedTimeline, {
    agentId: "causal_judge",
    messageId: cjBridgePost.id,
    bandEventKind: "task",
    content: cjBridgePost.content,
    payload: causalJudgeBridge,
  });
  allMessageIds.push(cjBridgePost.id);

  let claimTracerChallenge2 = applyChallengeArc(
    await runClaimTracerChallenge(
      forClaimTracerChallenge({
        evidence,
        routed,
        prior: {
          ...claimTracerInitial,
          hypothesis_class: claimTracerChallenge1.updated_hypothesis_class,
          hypothesis_en: claimTracerChallenge1.updated_hypothesis_en,
        },
        bandThread: thread,
        round: 2,
        peerMessageId: cjBridgePost.id,
        peerOpeningClass: causalJudgeBridge.bridge_hypothesis_class,
      }),
    ),
    {
      round: 2,
      agentRole: "claim_tracer",
      priorClass: claimTracerChallenge1.updated_hypothesis_class,
      priorEn: claimTracerChallenge1.updated_hypothesis_en,
      peerOpeningClass: causalJudgeBridge.bridge_hypothesis_class,
      peerMessageId: cjBridgePost.id,
      peerPostType: "causal_judge_bridge",
      bridgeClass: causalJudgeBridge.bridge_hypothesis_class,
      bridgeMessageId: cjBridgePost.id,
    },
  );
  claimTracerChallenge2 = {
    ...claimTracerChallenge2,
    target_band_message_id: cjBridgePost.id,
    round: 2,
  };

  const ctChallenge2Post = await postCauseRoomEvent({
    roomId: room.id,
    role: "claim_tracer",
    agents,
    messageType: "thought",
    content: formatCompactChallenge(claimTracerChallenge2),
    metadata: { type: "agent_challenge", payload: claimTracerChallenge2 },
  });

  thread = pushThread(thread, {
    messageId: ctChallenge2Post.id,
    agentRole: "claim_tracer",
    postType: "agent_challenge",
    bandEventKind: "thought",
    payload: claimTracerChallenge2,
  });
  await emit(feedTimeline, {
    agentId: "claim_tracer",
    messageId: ctChallenge2Post.id,
    bandEventKind: "thought",
    content: ctChallenge2Post.content,
    payload: claimTracerChallenge2,
  });
  allMessageIds.push(ctChallenge2Post.id);

  let backendWitnessChallenge2 = applyChallengeArc(
    await runBackendWitnessChallenge(
      forBackendWitnessChallenge({
        evidence,
        routed,
        prior: {
          ...backendWitnessInitial,
          hypothesis_class: backendWitnessChallenge1.updated_hypothesis_class,
          hypothesis_en: backendWitnessChallenge1.updated_hypothesis_en,
        },
        bandThread: thread,
        round: 2,
        peerMessageId: cjBridgePost.id,
        peerOpeningClass: causalJudgeBridge.bridge_hypothesis_class,
        bridgeHypothesisClass: causalJudgeBridge.bridge_hypothesis_class,
        bridgeMessageId: cjBridgePost.id,
      }),
    ),
    {
      round: 2,
      agentRole: "backend_witness",
      priorClass: backendWitnessChallenge1.updated_hypothesis_class,
      priorEn: backendWitnessChallenge1.updated_hypothesis_en,
      peerOpeningClass: causalJudgeBridge.bridge_hypothesis_class,
      peerMessageId: cjBridgePost.id,
      peerPostType: "causal_judge_bridge",
      bridgeClass: causalJudgeBridge.bridge_hypothesis_class,
      bridgeMessageId: cjBridgePost.id,
    },
  );
  backendWitnessChallenge2 = {
    ...backendWitnessChallenge2,
    target_band_message_id: cjBridgePost.id,
    round: 2,
  };

  const bwChallenge2Post = await postCauseRoomEvent({
    roomId: room.id,
    role: "backend_witness",
    agents,
    messageType: "thought",
    content: formatCompactChallenge(backendWitnessChallenge2),
    metadata: { type: "agent_challenge", payload: backendWitnessChallenge2 },
  });

  thread = pushThread(thread, {
    messageId: bwChallenge2Post.id,
    agentRole: "backend_witness",
    postType: "agent_challenge",
    bandEventKind: "thought",
    payload: backendWitnessChallenge2,
  });
  await emit(feedTimeline, {
    agentId: "backend_witness",
    messageId: bwChallenge2Post.id,
    bandEventKind: "thought",
    content: bwChallenge2Post.content,
    payload: backendWitnessChallenge2,
  });
  allMessageIds.push(bwChallenge2Post.id);

  const causalJudgeRefinement = buildDeterministicRefinement({
    bridge: causalJudgeBridge,
    bwChallengeMsgId: bwChallenge2Post.id,
    ctChallengeMsgId: ctChallenge2Post.id,
  });

  const cjRefinementPost = await postCauseRoomEvent({
    roomId: room.id,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: `Refinement · ${causalJudgeRefinement.refinement_en.split(".")[0]}.`,
    metadata: {
      type: "causal_judge_refinement",
      payload: causalJudgeRefinement,
    },
  });

  thread = pushThread(thread, {
    messageId: cjRefinementPost.id,
    agentRole: "causal_judge",
    postType: "causal_judge_refinement",
    bandEventKind: "task",
    payload: causalJudgeRefinement,
  });
  allMessageIds.push(cjRefinementPost.id);
  await emit(feedTimeline, {
    agentId: "causal_judge",
    messageId: cjRefinementPost.id,
    bandEventKind: "task",
    content: cjRefinementPost.content,
    payload: causalJudgeRefinement,
  });

  const deterministicFinding = buildDeterministicCauseFinding({
    ctInitial: claimTracerInitial,
    bwInitial: backendWitnessInitial,
    bridge: causalJudgeBridge,
    refinement: causalJudgeRefinement,
    bandMessageIds: allMessageIds,
    messageIdMap: {
      ctInitial: ctInitialPost.id,
      bwInitial: bwInitialPost.id,
      ctChallenge1: ctChallenge1Post.id,
      bwChallenge1: bwChallenge1Post.id,
      ctChallenge2: ctChallenge2Post.id,
      bwChallenge2: bwChallenge2Post.id,
      bridge: cjBridgePost.id,
      refinement: cjRefinementPost.id,
    },
  });

  let causeFinding = ensureCauseFindingIntegrity(
    await runCauseFinding(
      forCauseFindingSynthesis({
        incident_id: evidence.incident_id,
        title: evidence.title,
        bandThread: thread,
        claimTracerInitial,
        backendWitnessInitial,
        claimTracerFinal: claimTracerChallenge2,
        backendWitnessFinal: backendWitnessChallenge2,
        causalJudgeBridge,
        causalJudgeRefinement,
        bandMessageIds: allMessageIds,
      }),
    ),
    {
      claimTracer: claimTracerInitial.hypothesis_class,
      backendWitness: backendWitnessInitial.hypothesis_class,
    },
    causalJudgeBridge,
    allMessageIds,
    deterministicFinding,
  );

  if (!openingDiffersFromFinal(claimTracerInitial, backendWitnessInitial, causeFinding)) {
    causeFinding = {
      ...causeFinding,
      cause_class: causalJudgeBridge.bridge_hypothesis_class,
      cause: causalJudgeBridge.bridge_hypothesis_en,
    };
  }

  const causeFindingPost = await postCauseRoomEvent({
    roomId: room.id,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: `${hypothesisClassLabel(causeFinding.cause_class)} · ${causeFinding.cause.split(".")[0]}.`,
    metadata: { type: "cause_finding", payload: causeFinding },
  });

  allMessageIds.push(causeFindingPost.id);
  await emit(feedTimeline, {
    agentId: "causal_judge",
    messageId: causeFindingPost.id,
    bandEventKind: "task",
    content: causeFindingPost.content,
    payload: causeFinding,
  });

  const causeFindingArtifact = toCauseFindingArtifact({
    incidentId: evidence.incident_id,
    roomId: room.id,
    finding: causeFinding,
  });

  const artifactPost = await postCauseRoomEvent({
    roomId: room.id,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: `Artifact: CauseFinding · ${hypothesisClassLabel(causeFindingArtifact.cause_class)}`,
    metadata: {
      type: "CauseFinding",
      artifact: causeFindingArtifact,
    },
  });
  allMessageIds.push(artifactPost.id);
  await emit(feedTimeline, {
    agentId: "causal_judge",
    messageId: artifactPost.id,
    bandEventKind: "task",
    content: artifactPost.content,
    payload: causeFindingArtifact,
  });

  const history = await getRoomHistory(room.id);

  return {
    roomId: room.id,
    distinctBandAgents,
    claimTracerInitial,
    backendWitnessInitial,
    claimTracerChallenge1,
    backendWitnessChallenge1,
    causalJudgeTask,
    causalJudgeBridge,
    claimTracerChallenge2,
    backendWitnessChallenge2,
    causalJudgeRefinement,
    causeFinding,
    causeFindingArtifact,
    bandMessageIds: {
      claimTracerInitial: ctInitialPost.id,
      backendWitnessToolEvents,
      backendWitnessInitial: bwInitialPost.id,
      claimTracerChallenge1: ctChallenge1Post.id,
      backendWitnessChallenge1: bwChallenge1Post.id,
      causalJudgeTask: cjTaskPost.id,
      causalJudgeBridge: cjBridgePost.id,
      claimTracerChallenge2: ctChallenge2Post.id,
      backendWitnessChallenge2: bwChallenge2Post.id,
      causalJudgeRefinement: cjRefinementPost.id,
      causeFinding: causeFindingPost.id,
      causeFindingArtifact: artifactPost.id,
    },
    feedTimeline,
    history,
  };
}
