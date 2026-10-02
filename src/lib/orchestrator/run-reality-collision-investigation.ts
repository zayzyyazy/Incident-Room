import { createRoom } from "@/lib/band/client";
import {
  agentsAreDistinct,
  postCauseRoomEvent,
  resolveCauseRoomAgents,
  setupCauseRoomParticipants,
} from "@/lib/band/multi-agent";
import {
  postLocalizationRoomEvent,
  resolveLocalizationRoomAgents,
} from "@/lib/band/localization-multi-agent";
import {
  buildCustomerRealityVerdict,
  buildInvestigationVerdict,
  buildSystemRealityVerdict,
  realitiesConflict,
} from "@/lib/reality/build-verdicts";
import { buildTheoryScriptForEvidence } from "@/lib/reality/build-theory-script";
import {
  RealityCollisionResult,
  RealityFeedEntry,
} from "@/lib/reality/types";
import {
  THEORY_AGENT_IDS,
  TheoryAgentRole,
  TheoryBeatKind,
} from "@/lib/reality/theory-script";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  createStepSink,
  InvestigationStep,
  resetStepCounter,
  stepFromFeedEntry,
} from "@/lib/demo/investigation-steps";

function agentIdForRole(role: TheoryAgentRole): string {
  return THEORY_AGENT_IDS[role];
}

async function postTheoryBeat(input: {
  roomId: string;
  role: TheoryAgentRole;
  kind: TheoryBeatKind;
  line: string;
  causeAgents: Awaited<ReturnType<typeof resolveCauseRoomAgents>>;
  locAgents: Awaited<ReturnType<typeof resolveLocalizationRoomAgents>>;
}): Promise<{ id: string; content: string }> {
  const metadata = {
    type: input.kind,
    agent_role: input.role,
    artifact: { type: input.kind, line: input.line, agent_role: input.role },
  };

  if (input.role === "skeptic") {
    const post = await postLocalizationRoomEvent({
      roomId: input.roomId,
      role: "control_flow_investigator",
      agents: input.locAgents,
      messageType: input.kind === "TheoryChallenge" ? "thought" : "task",
      content: input.line,
      metadata,
    });
    return { id: post.id, content: post.content ?? input.line };
  }

  const causeRole =
    input.role === "customer_advocate"
      ? "claim_tracer"
      : input.role === "system_auditor"
        ? "backend_witness"
        : "causal_judge";

  const post = await postCauseRoomEvent({
    roomId: input.roomId,
    role: causeRole,
    agents: input.causeAgents,
    messageType:
      input.kind === "TheoryOpening" || input.kind === "TheoryWithdrawal"
        ? "thought"
        : "task",
    content: input.line,
    metadata,
  });
  return { id: post.id, content: post.content ?? input.line };
}

async function emitStep(
  stepSink: ReturnType<typeof createStepSink>,
  entry: RealityFeedEntry,
) {
  if (!stepSink) return;
  const step = stepFromFeedEntry({
    room: entry.room,
    agentId: entry.agentId,
    messageId: entry.messageId,
    bandEventKind: entry.bandEventKind,
    content: entry.content,
    payload: entry.payload,
  });
  if (step) await stepSink.push(step);
}

export async function runRealityCollisionInvestigation(
  evidence: VoiceIncidentEvidence,
  options?: {
    taskId?: string;
    onStep?: (step: InvestigationStep) => void | Promise<void>;
  },
): Promise<RealityCollisionResult> {
  const stepSink = createStepSink(options?.onStep);
  resetStepCounter();

  const { script, report: incidentReport } = buildTheoryScriptForEvidence(evidence);
  const customerReality = buildCustomerRealityVerdict(evidence);
  const systemReality = buildSystemRealityVerdict(evidence);
  const investigationVerdict = buildInvestigationVerdict({
    evidence,
    customer: customerReality,
    system: systemReality,
  });
  investigationVerdict.finding = incidentReport.finding;
  investigationVerdict.architecture_reason = incidentReport.surviving_explanation;
  investigationVerdict.fix_target = incidentReport.fix_target;
  investigationVerdict.where_to_fix = incidentReport.fix_detail ?? incidentReport.fix_target;

  const causeAgents = await resolveCauseRoomAgents();
  const locAgents = await resolveLocalizationRoomAgents();
  const feedTimeline: RealityFeedEntry[] = [];
  const bandMessageIds: Record<string, string> = {};

  const room = await createRoom({
    taskId: options?.taskId,
    title: `Theory investigation · ${evidence.incident_id}`,
    apiKey: causeAgents.causal_judge.apiKey,
  });
  await setupCauseRoomParticipants(room.id, causeAgents.causal_judge.apiKey, causeAgents);

  for (let i = 0; i < script.length; i++) {
    const beat = script[i]!;
    const post = await postTheoryBeat({
      roomId: room.id,
      role: beat.role,
      kind: beat.kind,
      line: beat.line,
      causeAgents,
      locAgents,
    });

    const agentId = agentIdForRole(beat.role);
    bandMessageIds[`theory${i}`] = post.id;

    const entry: RealityFeedEntry = {
      agentId,
      messageId: post.id,
      bandEventKind: beat.kind === "TheoryOpening" ? "thought" : "task",
      content: post.content,
      payload: {
        type: beat.kind,
        agent_role: beat.role,
        line: beat.line,
        ...(beat.kind === "IncidentFinding" ? { artifact: incidentReport } : {}),
      },
      room: "theory_investigation",
    };
    feedTimeline.push(entry);
    await emitStep(stepSink, entry);
  }

  const distinctBandAgents = agentsAreDistinct(causeAgents);

  return {
    investigationRoomId: room.id,
    customerRealityRoomId: room.id,
    systemRealityRoomId: room.id,
    reconciliationRoomId: room.id,
    customerReality,
    systemReality,
    investigationVerdict,
    incidentReport,
    conflicts: realitiesConflict(customerReality, systemReality),
    feedTimeline,
    bandMessageIds,
    distinctBandAgents,
  };
}
