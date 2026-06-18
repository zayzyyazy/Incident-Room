import { postCauseRoomEvent, resolveCauseRoomAgents } from "@/lib/band/multi-agent";
import { CauseFindingArtifact, CauseRevisionDecision, CauseRevisionRequest, toCauseFindingArtifact } from "@/lib/cross-room/artifacts";
import { CauseFinding, CauseRoomFeedEntry } from "@/lib/cause-room/types";
import { hypothesisClassLabel, CausalHypothesisClass } from "@/lib/cause-room/hypothesis-classes";

export function buildRevisionCauseRevisionRequest(input: {
  incidentId: string;
  currentCauseClass: CausalHypothesisClass;
  localizationMessageIds: string[];
}): CauseRevisionRequest {
  return {
    type: "CauseRevisionRequest",
    from_room: "localization_room",
    to_room: "cause_room",
    incident_id: input.incidentId,
    current_cause_class: input.currentCauseClass,
    contradiction:
      "Your cause predicts failed execution is necessary. Implementation shows cancel_subscription was never reachable on this path. Revise the cause or mark insufficient evidence.",
    localization_evidence: [
      {
        surface: "workflow.intent_router.cancel_subscription",
        finding:
          "Path routes directly to confirmation message without cancel_subscription tool node.",
      },
    ],
    requested_action: "REOPEN_CAUSE_ROOM",
    cited_localization_message_ids: input.localizationMessageIds,
  };
}

export function buildRevisionCauseRevisionDecision(input: {
  request: CauseRevisionRequest;
  citedCauseMessageIds: string[];
  revisionRequestMessageId: string;
}): CauseRevisionDecision {
  return {
    type: "CauseRevisionDecision",
    decision: "REVISE",
    old_cause_class: input.request.current_cause_class,
    new_cause_class: "confirmation_without_tool_execution",
    reason:
      "Customer-facing success was proven, but execution failure was not. Localization shows the cancellation tool was unreachable on this workflow path.",
    cited_cause_message_ids: input.citedCauseMessageIds,
    cited_localization_message_ids: [
      input.revisionRequestMessageId,
      ...input.request.cited_localization_message_ids,
    ],
  };
}

export async function runCauseRoomRevisionCycle(input: {
  causeRoomId: string;
  evidenceIncidentId: string;
  revisionRequest: CauseRevisionRequest;
  revisionRequestMessageId: string;
  priorCauseArtifact: CauseFindingArtifact;
}): Promise<{
  decision: CauseRevisionDecision;
  revisedCauseFinding: CauseFinding;
  revisedCauseFindingArtifact: CauseFindingArtifact;
  feedTimeline: CauseRoomFeedEntry[];
  bandMessageIds: Record<string, string>;
}> {
  const agents = await resolveCauseRoomAgents();
  const feedTimeline: CauseRoomFeedEntry[] = [];
  const bandMessageIds: Record<string, string> = {};

  const intakePost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: "@LocalizationRoom CauseRevisionRequest received — reopening cause with architecture evidence.",
    metadata: {
      type: "CauseRevisionRequest",
      artifact: input.revisionRequest,
      source_message_id: input.revisionRequestMessageId,
    },
  });
  bandMessageIds.revisionIntake = intakePost.id;
  feedTimeline.push({
    agentId: "causal_judge",
    messageId: intakePost.id,
    bandEventKind: "task",
    content: intakePost.content ?? "",
    payload: input.revisionRequest,
  });

  const bwPost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "backend_witness",
    agents,
    messageType: "thought",
    content: "cancel_subscription never invoked · subscription still active.",
    metadata: { type: "revision_backend_witness", revision: true },
  });
  bandMessageIds.revisionBackendWitness = bwPost.id;
  feedTimeline.push({
    agentId: "backend_witness",
    messageId: bwPost.id,
    bandEventKind: "thought",
    content: bwPost.content ?? "",
  });

  const ctPost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "claim_tracer",
    agents,
    messageType: "thought",
    content:
      "@ControlFlow Evidence T03 implies successful cancellation language. Withdrawing execution-failure hypothesis pending architecture review.",
    metadata: { type: "revision_claim_tracer", revision: true },
  });
  bandMessageIds.revisionClaimTracer = ctPost.id;
  feedTimeline.push({
    agentId: "claim_tracer",
    messageId: ctPost.id,
    bandEventKind: "thought",
    content: ctPost.content ?? "",
  });

  const decision = buildRevisionCauseRevisionDecision({
    request: input.revisionRequest,
    citedCauseMessageIds: [
      ...input.priorCauseArtifact.cites_band_message_ids,
      bwPost.id,
      ctPost.id,
    ],
    revisionRequestMessageId: input.revisionRequestMessageId,
  });

  const decisionPost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: `Revision accepted. REVISE → ${hypothesisClassLabel(decision.new_cause_class ?? "")}`,
    metadata: {
      type: "CauseRevisionDecision",
      artifact: decision,
    },
  });
  bandMessageIds.revisionDecision = decisionPost.id;
  feedTimeline.push({
    agentId: "causal_judge",
    messageId: decisionPost.id,
    bandEventKind: "task",
    content: decisionPost.content ?? "",
    payload: decision,
  });

  const revisedCauseClass =
    decision.new_cause_class ?? "confirmation_without_tool_execution";

  const revisedCauseFinding: CauseFinding = {
    type: "cause_finding",
    cause_class: revisedCauseClass,
    cause:
      "The agent confirmed cancellation even though the cancellation tool was never called.",
    evidence: [],
    considered_hypotheses: [],
    ruled_out: [],
    confidence: 0.88,
    recurrence_hint_request: false,
    evolution: [
      {
        agent: "causal_judge",
        initial_hypothesis_class: decision.old_cause_class,
        final_hypothesis_class: revisedCauseClass,
        action: "REFINED",
      },
    ],
    cites_band_message_ids: [
      ...input.priorCauseArtifact.cites_band_message_ids,
      intakePost.id,
      bwPost.id,
      ctPost.id,
      decisionPost.id,
    ],
  };

  const revisedArtifact = toCauseFindingArtifact({
    incidentId: input.evidenceIncidentId,
    roomId: input.causeRoomId,
    finding: revisedCauseFinding,
  });

  const artifactPost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: `Revised CauseFinding · ${hypothesisClassLabel(revisedArtifact.cause_class)}`,
    metadata: {
      type: "CauseFinding",
      artifact: revisedArtifact,
      revised: true,
    },
  });
  bandMessageIds.revisedCauseFindingArtifact = artifactPost.id;
  feedTimeline.push({
    agentId: "causal_judge",
    messageId: artifactPost.id,
    bandEventKind: "task",
    content: artifactPost.content ?? "",
    payload: revisedArtifact,
  });

  return {
    decision,
    revisedCauseFinding,
    revisedCauseFindingArtifact: revisedArtifact,
    feedTimeline,
    bandMessageIds,
  };
}
