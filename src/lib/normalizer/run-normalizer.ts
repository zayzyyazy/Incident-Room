import { createRoom } from "@/lib/band/client";
import {
  postCauseRoomEvent,
  resolveCauseRoomAgents,
  setupCauseRoomParticipants,
} from "@/lib/band/multi-agent";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  buildRoutingArtifact,
  normalizeIncidentEvidence,
  routingSummaryLine,
} from "@/lib/normalizer/index";
import { RoutedEvidence } from "@/lib/normalizer/types";
import { LeapingAgentSlice } from "@/lib/localization-room/load-artifact";
import {
  createStepSink,
  InvestigationStep,
  stepFromFeedEntry,
} from "@/lib/demo/investigation-steps";

export type NormalizerRunResult = {
  routed: RoutedEvidence;
  roomId?: string;
  bandMessageId?: string;
};

export async function runEvidenceNormalizer(input: {
  evidence: VoiceIncidentEvidence;
  definitionArtifact?: LeapingAgentSlice | null;
  taskId?: string;
  onStep?: (step: InvestigationStep) => void | Promise<void>;
  postToBand?: boolean;
}): Promise<NormalizerRunResult> {
  const routed = normalizeIncidentEvidence({
    evidence: input.evidence,
    definitionArtifact: input.definitionArtifact,
  });
  const artifact = buildRoutingArtifact(routed);
  const stepSink = createStepSink(input.onStep);

  if (!input.postToBand) {
    const step = stepFromFeedEntry({
      room: "normalizer",
      agentId: "evidence_normalizer",
      messageId: `normalizer-${input.evidence.incident_id}`,
      bandEventKind: "task",
      content: routingSummaryLine(routed),
      payload: { type: "NormalizerRouting", artifact, routing_status: routed.routing_status },
    });
    if (step && stepSink) await stepSink.push(step);
    return { routed };
  }

  const agents = await resolveCauseRoomAgents();
  const room = await createRoom({
    taskId: input.taskId,
    title: `Evidence routing · ${input.evidence.incident_id}`,
    apiKey: agents.causal_judge.apiKey,
  });
  await setupCauseRoomParticipants(room.id, agents.causal_judge.apiKey, agents);

  const post = await postCauseRoomEvent({
    roomId: room.id,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: routingSummaryLine(routed),
    metadata: {
      type: "NormalizerRouting",
      agent_role: "evidence_normalizer",
      artifact,
      routing_status: routed.routing_status,
    },
  });

  const step = stepFromFeedEntry({
    room: "normalizer",
    agentId: "evidence_normalizer",
    messageId: post.id,
    bandEventKind: "task",
    content: post.content ?? routingSummaryLine(routed),
    payload: { type: "NormalizerRouting", artifact, routing_status: routed.routing_status },
  });
  if (step && stepSink) await stepSink.push(step);

  return { routed, roomId: room.id, bandMessageId: post.id };
}
