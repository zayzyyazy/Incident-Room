import { postCauseRoomEvent, resolveCauseRoomAgents } from "@/lib/band/multi-agent";
import {
  CauseDefenseDecision,
  CauseDefenseRequest,
  buildCauseDefenseDecision,
} from "@/lib/cross-room/cause-defense";
import { CauseFindingArtifact } from "@/lib/cross-room/artifacts";
import { CauseRoomFeedEntry } from "@/lib/cause-room/types";
import {
  FrozenDemoPath,
  resolveFrozenDemoPath,
} from "@/lib/cross-room/incident-profile";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { analyzeEvidenceForLocalization } from "@/lib/localization-room/evidence-analysis";

export async function runCauseRoomDefenseCycle(input: {
  causeRoomId: string;
  causeArtifact: CauseFindingArtifact;
  defenseRequest: CauseDefenseRequest;
  defenseRequestMessageId: string;
  evidence?: VoiceIncidentEvidence;
}): Promise<{
  decision: CauseDefenseDecision;
  feedTimeline: CauseRoomFeedEntry[];
  decisionMessageId: string;
}> {
  const agents = await resolveCauseRoomAgents();
  const path: FrozenDemoPath = resolveFrozenDemoPath(
    input.causeArtifact.incident_id,
  );
  const profile = input.evidence
    ? analyzeEvidenceForLocalization(input.evidence)
    : undefined;
  const feedTimeline: CauseRoomFeedEntry[] = [];

  const intakePost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: "CauseDefenseRequest received.",
    metadata: {
      type: "CauseDefenseRequest",
      artifact: input.defenseRequest,
      source_message_id: input.defenseRequestMessageId,
    },
  });
  feedTimeline.push({
    agentId: "causal_judge",
    messageId: intakePost.id,
    bandEventKind: "task",
    content: intakePost.content ?? "",
    payload: input.defenseRequest,
  });

  const bwContent =
    path === "live"
      ? (profile?.bwDefenseLine ?? "Runtime trace reviewed.")
      : path === "klaus"
        ? "@ControlFlow 504 returned from create_callback_appointment. appointment_created=false."
        : "cancel_subscription never invoked · subscription still active.";

  const bwPost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "backend_witness",
    agents,
    messageType: "thought",
    content: bwContent,
    metadata: { type: "defense_backend_witness" },
  });
  feedTimeline.push({
    agentId: "backend_witness",
    messageId: bwPost.id,
    bandEventKind: "thought",
    content: bwPost.content ?? "",
    payload: { type: "defense_backend_witness" },
  });

  const ctContent =
    path === "live"
      ? (profile?.ctDefenseLine ?? "Customer belief reviewed from transcript.")
      : path === "klaus"
        ? "Customer believed callback booked at T05."
        : "Customer believed cancellation processed at T05.";

  const ctPost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "claim_tracer",
    agents,
    messageType: "thought",
    content: ctContent,
    metadata: { type: "defense_claim_tracer" },
  });
  feedTimeline.push({
    agentId: "claim_tracer",
    messageId: ctPost.id,
    bandEventKind: "thought",
    content: ctPost.content ?? "",
    payload: { type: "defense_claim_tracer" },
  });

  const citedCauseMessageIds = [
    ...input.causeArtifact.cites_band_message_ids,
    bwPost.id,
    ctPost.id,
  ];

  const decision = buildCauseDefenseDecision({
    path,
    request: input.defenseRequest,
    causeArtifact: input.causeArtifact,
    defenseRequestMessageId: input.defenseRequestMessageId,
    citedCauseMessageIds,
    profile,
  });

  const decisionContent =
    path === "klaus"
      ? "Accepted. Both are required: failed write and confirmation language before verification."
      : `${decision.decision} · ${decision.defense.split(".")[0]}.`;

  const decisionPost = await postCauseRoomEvent({
    roomId: input.causeRoomId,
    role: "causal_judge",
    agents,
    messageType: "task",
    content: decisionContent,
    metadata: {
      type: "CauseDefenseDecision",
      artifact: decision,
      defense_request_id: input.defenseRequestMessageId,
    },
  });
  feedTimeline.push({
    agentId: "causal_judge",
    messageId: decisionPost.id,
    bandEventKind: "task",
    content: decisionPost.content ?? "",
    payload: decision,
  });

  return {
    decision,
    feedTimeline,
    decisionMessageId: decisionPost.id,
  };
}

/** @deprecated Use runCauseRoomDefenseCycle */
export async function postCauseDefenseDecision(input: {
  causeRoomId: string;
  causeArtifact: CauseFindingArtifact;
  defenseRequest: CauseDefenseRequest;
  defenseRequestMessageId: string;
}): Promise<{
  decision: CauseDefenseDecision;
  messageId: string;
  feedEntry: CauseRoomFeedEntry;
}> {
  const result = await runCauseRoomDefenseCycle(input);
  const last = result.feedTimeline[result.feedTimeline.length - 1]!;
  return {
    decision: result.decision,
    messageId: result.decisionMessageId,
    feedEntry: last,
  };
}
