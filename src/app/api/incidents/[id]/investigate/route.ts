import { NextResponse } from "next/server";
import { resolveCrmForEvidence } from "@/lib/crm/lookup";
import { runFullIncidentInvestigation } from "@/lib/orchestrator/run-full-incident-investigation";
import {
  completeInvestigation,
  failInvestigation,
  getIncident,
  startInvestigation,
} from "@/lib/incidents/store";
import { getIncidentForRequest } from "@/lib/incidents/resolve";
import { persistFailureIncidentRecordIfNeeded } from "@/lib/incidents/failures";
import { persistImportedIncidentRecordIfNeeded } from "@/lib/incidents/imported";

type RouteParams = { params: { id: string } };

export async function POST(_request: Request, { params }: RouteParams) {
  const incident = await getIncidentForRequest(params.id);

  if (!incident) {
    return NextResponse.json(
      { ok: false, error: "Incident not found" },
      { status: 404 },
    );
  }

  const run = startInvestigation(params.id);

  try {
    const crm = resolveCrmForEvidence(incident.evidence);
    const result = await runFullIncidentInvestigation(incident.evidence);

    const causeRoom = {
      distinctBandAgents: result.cause.distinctBandAgents,
      bandMessageIds: result.cause.bandMessageIds,
      claimTracerInitial: result.cause.claimTracerInitial,
      backendWitnessInitial: result.cause.backendWitnessInitial,
      claimTracerChallenge1: result.cause.claimTracerChallenge1,
      backendWitnessChallenge1: result.cause.backendWitnessChallenge1,
      causalJudgeTask: result.cause.causalJudgeTask,
      causalJudgeBridge: result.cause.causalJudgeBridge,
      claimTracerChallenge2: result.cause.claimTracerChallenge2,
      backendWitnessChallenge2: result.cause.backendWitnessChallenge2,
      causalJudgeRefinement: result.cause.causalJudgeRefinement,
      causeFinding: result.cause.causeFinding,
      causeFindingArtifact: result.cause.causeFindingArtifact,
      revisionDecision: result.cause.revisionDecision,
      feedTimeline: result.cause.feedTimeline,
    };

    const localizationRoom = {
      distinctBandAgents: result.localization.distinctBandAgents,
      roomId: result.localization.roomId,
      causeRoomId: result.localization.causeRoomId,
      inputCauseFindingArtifact: result.localization.inputCauseFindingArtifact,
      phase: result.localization.phase,
      causeDefenseRequest: result.localization.causeDefenseRequest,
      causeDefenseDecision: result.localization.causeDefenseDecision,
      localizationDefenseVerdict: result.localization.localizationDefenseVerdict,
      causeRevisionRequest: result.localization.causeRevisionRequest,
      pendingCauseRevision: result.localization.pendingCauseRevision,
      arc: result.localization.arc,
      surfaceCandidates: result.localization.surfaceCandidates,
      localizationFinding: result.localization.localizationFinding,
      localizationFindingArtifact: result.localization.localizationFindingArtifact,
      investigationBreakthrough: result.localization.investigationBreakthrough,
      feedTimeline: result.localization.feedTimeline,
      bandMessageIds: result.localization.bandMessageIds,
    };

    const completed = completeInvestigation(params.id, run.id, {
      pipeline: "full",
      roomId: result.cause.roomId,
      localizationRoomId: result.localization.roomId,
      distinctBandAgents: result.cause.distinctBandAgents,
      distinctLocalizationAgents: result.localization.distinctBandAgents,
      bandMessageIds: result.cause.bandMessageIds,
      causeRoom,
      localizationRoom,
      crmLink: crm.link,
      crmLookup: crm.lookup,
    });
    const latestRecord = getIncident(params.id);
    await persistFailureIncidentRecordIfNeeded(latestRecord);
    await persistImportedIncidentRecordIfNeeded(latestRecord);

    return NextResponse.json({
      ok: true,
      run: completed,
      causeRoomId: result.cause.roomId,
      localizationRoomId: result.localization.roomId,
      causeFinding: result.cause.causeFinding,
      localizationFinding: result.localization.localizationFinding,
      crmLink: crm.link,
      crmLookup: crm.lookup,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Investigation failed";
    const failed = failInvestigation(params.id, run.id, message);
    const latestRecord = getIncident(params.id);
    await persistFailureIncidentRecordIfNeeded(latestRecord);
    await persistImportedIncidentRecordIfNeeded(latestRecord);
    return NextResponse.json(
      { ok: false, error: message, run: failed },
      { status: 500 },
    );
  }
}
