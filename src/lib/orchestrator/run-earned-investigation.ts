import { createRoom, isReusingBandRoom } from "@/lib/band/client";
import {
  agentsAreDistinct,
  resolveCauseRoomAgents,
} from "@/lib/band/multi-agent";
import {
  EarnedSpecialist,
  postEarnedBeat,
  resolveEarnedAgentPools,
} from "@/lib/band/earned-investigation";
import { formatEarnedBeatChatContent } from "@/lib/band/earned-band-chat";
import {
  createStepSink,
  InvestigationStep,
  resetStepCounter,
  stepFromEarnedFeedEntry,
} from "@/lib/demo/investigation-steps";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  buildEarnedIncidentReport,
  buildEarnedScriptForEvidence,
} from "@/lib/investigation/build-earned-script";
import {
  EarnedFeedEntry,
  EarnedInvestigationResult,
} from "@/lib/investigation/events";
import { runReportSynthesizer } from "@/lib/agents/report-synthesizer";
import { runEvidenceNormalizer } from "@/lib/normalizer/run-normalizer";
import { loadLeapingAgentSlice } from "@/lib/localization-room/load-artifact";

/** Pause between Band posts so the investigation reads as live debate, not a dump. */
const BEAT_PACE_MS = 520;

export async function runEarnedInvestigation(
  evidence: VoiceIncidentEvidence,
  options?: {
    taskId?: string;
    onStep?: (step: InvestigationStep) => void | Promise<void>;
  },
): Promise<EarnedInvestigationResult> {
  const stepSink = createStepSink(options?.onStep);
  resetStepCounter();

  let definitionArtifact = null;
  try {
    definitionArtifact = loadLeapingAgentSlice("pflegemittelbox-klaus-slice");
  } catch {
    definitionArtifact = null;
  }

  const normalizer = await runEvidenceNormalizer({
    evidence,
    definitionArtifact,
    taskId: options?.taskId,
    onStep: options?.onStep,
    postToBand: !isReusingBandRoom(),
  });

  const pools = await resolveEarnedAgentPools();
  const script = buildEarnedScriptForEvidence(evidence);
  const verdict = script.find((b) => b.kind === "VerdictIssued")?.verdict ?? "INSUFFICIENT_EVIDENCE";
  const incidentReport = buildEarnedIncidentReport({ evidence, verdict, script });

  const bandRoom = await createRoom({
    taskId: options?.taskId,
    title: `Incident investigation · ${evidence.incident_id}`,
    apiKey: pools.cause.causal_judge.apiKey,
  });

  const feedTimeline: EarnedFeedEntry[] = [];
  const bandMessageIds: Record<string, string> = {};
  const events: EarnedInvestigationResult["events"] = [];
  const recruited = new Set<EarnedSpecialist>();

  for (let i = 0; i < script.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, BEAT_PACE_MS));
    }
    const beat = script[i]!;
    let post: { id: string; content?: string; metadata?: Record<string, unknown> };
    try {
      ({ post } = await postEarnedBeat({
        beat,
        roomId: bandRoom.id,
        pools,
        recruited,
      }));
    } catch (error) {
      console.warn("Band post failed for earned beat; continuing in UI:", error);
      post = {
        id: `local-earned-${i}-${crypto.randomUUID()}`,
        content: beat.line,
        metadata: { bandError: true },
      };
    }

    bandMessageIds[`earned${i}`] = post.id;
    events.push(beat.kind);

    const entry: EarnedFeedEntry = {
      agentId: beat.agentId,
      messageId: post.id,
      bandEventKind:
        beat.kind === "TheoryWithdrawn" ||
        beat.kind === "TheoryChallenged" ||
        beat.kind === "ConfidenceChanged" ||
        beat.kind === "TheorySupported"
          ? "thought"
          : "task",
      content: post.content ?? formatEarnedBeatChatContent(beat),
      payload: {
        type: beat.kind,
        agent_role: beat.agentRole,
        room: beat.room,
        theory: beat.theory,
        recruit: beat.recruit,
        verdict: beat.verdict,
        confidence_before: beat.confidenceBefore,
        confidence_after: beat.confidenceAfter,
        line: beat.line,
      },
      room: beat.room,
    };
    feedTimeline.push(entry);

    const step = stepFromEarnedFeedEntry(entry);
    if (step && stepSink) await stepSink.push(step);
  }

  const explanationBeat = script.find((b) => b.kind === "ExplanationIssued");

  let pdfBrief;
  try {
    pdfBrief = await runReportSynthesizer({
      evidence,
      report: {
        finding: incidentReport.finding,
        customerImpact: incidentReport.customer_impact,
        systemReality: incidentReport.system_reality,
        failedTheories: incidentReport.failed_theories,
        survivingExplanation: incidentReport.surviving_explanation,
        fixTarget: incidentReport.fix_target,
        fixDetail: incidentReport.fix_detail,
        collaborationHighlights: incidentReport.collaboration_highlights,
      },
      verdict,
      run: {
        id: "earned-pdf",
        startedAt: new Date().toISOString(),
        status: "complete",
        pipeline: "earned_investigation",
        earnedInvestigation: {
          verdictRoomId: bandRoom.id,
          explanationRoomId: bandRoom.id,
          normalizerRoomId: normalizer.roomId ?? bandRoom.id,
          verdict,
          verdictRationale: "",
          explanation: { primary: "", rejected: [], supporting_evidence: [] },
          incidentReport,
          feedTimeline,
          bandMessageIds,
          distinctBandAgents: false,
          events,
        },
      },
    });
  } catch (error) {
    console.warn("PDF brief synthesis failed:", error);
  }

  return {
    verdictRoomId: bandRoom.id,
    explanationRoomId: bandRoom.id,
    normalizerRoomId: normalizer.roomId ?? bandRoom.id,
    verdict,
    verdictRationale:
      script.find((b) => b.kind === "VerdictIssued")?.line ??
      "Outcome trust could not be established.",
    explanation: {
      primary:
        explanationBeat?.line ??
        incidentReport.surviving_explanation,
      rejected: incidentReport.failed_theories,
      supporting_evidence: [
        "Failed tool trace from Normalizer",
        "Agent success language in transcript",
        "Workflow binding without hard guard",
      ],
    },
    incidentReport,
    feedTimeline,
    bandMessageIds,
    distinctBandAgents: agentsAreDistinct(await resolveCauseRoomAgents()),
    events,
    pdfBrief,
  };
}
