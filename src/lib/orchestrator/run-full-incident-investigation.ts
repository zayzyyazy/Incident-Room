import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { CauseFindingArtifact } from "@/lib/cross-room/artifacts";
import { runCauseRoomRevisionCycle } from "@/lib/cross-room/cause-revision";
import {
  FROZEN_DEMO_PATHS,
  FrozenDemoPath,
  isFrozenDemoPath,
  resolveFrozenDemoPath,
} from "@/lib/cross-room/incident-profile";
import { LocalizationDefenseVerdict } from "@/lib/cross-room/localization-defense-verdict";
import { CrossRoomOutcome } from "@/lib/cross-room/outcomes";
import {
  InvestigationStep,
  resetStepCounter,
  stepFromFeedEntry,
  createStepSink,
} from "@/lib/demo/investigation-steps";
import { runCauseRoomInvestigation } from "@/lib/orchestrator/run-cause-room-investigation";
import { runLocalizationRoomInvestigation } from "@/lib/orchestrator/run-localization-room-investigation";

function forceMartaInitialCause(
  artifact: CauseFindingArtifact,
): CauseFindingArtifact {
  return {
    ...artifact,
    cause_class: "premature_confirmation_after_failed_execution",
    cause_statement:
      "Agent confirmed cancellation while backend execution may have failed — overclaimed initial cause.",
  };
}

function assertCrossRoomResolved(input: {
  path: FrozenDemoPath;
  defenseDecision?: { decision: CrossRoomOutcome };
  localizationDefenseVerdict?: LocalizationDefenseVerdict;
  revisionCompleted: boolean;
  localizationComplete: boolean;
}): void {
  if (!input.localizationComplete) {
    throw new Error(
      "Cross-room gate: incident cannot finalize without completed Localization.",
    );
  }

  if (!isFrozenDemoPath(input.path)) {
    return;
  }

  const expected = FROZEN_DEMO_PATHS[input.path];

  if (input.path === "marta") {
    if (!input.revisionCompleted) {
      throw new Error(
        "Cross-room gate: Marta requires Cause Room REVISE after implementation contradicts cause.",
      );
    }
    if (input.localizationDefenseVerdict?.verdict !== "ACCEPTED") {
      throw new Error(
        "Cross-room gate: Marta requires Localization to accept revised CauseFinding.",
      );
    }
    return;
  }

  if (input.path === "stefan") {
    if (input.defenseDecision?.decision !== "INSUFFICIENT_EVIDENCE") {
      throw new Error(
        "Cross-room gate: Stefan requires Cause Room INSUFFICIENT_EVIDENCE — neither side fully proved.",
      );
    }
    if (input.localizationDefenseVerdict?.verdict !== "INSUFFICIENT") {
      throw new Error(
        "Cross-room gate: Stefan requires Localization defense verdict INSUFFICIENT.",
      );
    }
    return;
  }

  if (input.defenseDecision?.decision !== expected.cross_room_outcome) {
    throw new Error(
      `Cross-room gate: Klaus requires Cause Room ${expected.cross_room_outcome}.`,
    );
  }
  if (input.localizationDefenseVerdict?.verdict !== expected.localization_verdict) {
    throw new Error(
      `Cross-room gate: Klaus requires Localization verdict ${expected.localization_verdict}.`,
    );
  }
}

export async function runFullIncidentInvestigation(
  evidence: VoiceIncidentEvidence,
  options?: {
    taskId?: string;
    onStep?: (step: InvestigationStep) => void | Promise<void>;
  },
) {
  const demoPath = resolveFrozenDemoPath(evidence.incident_id);
  const onStep = options?.onStep;
  const stepSink = createStepSink(onStep);

  const emitCauseFeed = async (
    entries: {
      agentId: string;
      messageId: string;
      bandEventKind: string;
      content: string;
      payload?: unknown;
    }[],
  ) => {
    if (!stepSink) return;
    for (const entry of entries) {
      const step = stepFromFeedEntry({
        room: "cause",
        agentId: entry.agentId,
        messageId: entry.messageId,
        bandEventKind: entry.bandEventKind,
        content: entry.content,
        payload: entry.payload,
      });
      if (step) await stepSink.push(step);
    }
  };

  resetStepCounter();

  const causeResult = await runCauseRoomInvestigation(evidence, {
    taskId: options?.taskId,
    onStep,
  });

  if (!causeResult.causeFindingArtifact) {
    throw new Error("Cause Room did not produce CauseFinding artifact");
  }

  let causeFindingArtifact = causeResult.causeFindingArtifact;
  if (demoPath === "marta") {
    causeFindingArtifact = forceMartaInitialCause(causeFindingArtifact);
  }

  let localizationResult = await runLocalizationRoomInvestigation({
    evidence,
    causeRoomId: causeResult.roomId,
    causeFindingArtifact,
    causeFindingArtifactMessageId:
      causeResult.bandMessageIds.causeFindingArtifact as string,
    phase: "initial",
    onStep,
  });

  let causeFeedTimeline = [...causeResult.feedTimeline];
  if (localizationResult.causeDefenseFeedTimeline?.length) {
    causeFeedTimeline.push(...localizationResult.causeDefenseFeedTimeline);
  }

  let revisionCycle:
    | Awaited<ReturnType<typeof runCauseRoomRevisionCycle>>
    | undefined;

  if (
    localizationResult.pendingCauseRevision &&
    localizationResult.causeRevisionRequest
  ) {
    revisionCycle = await runCauseRoomRevisionCycle({
      causeRoomId: causeResult.roomId,
      evidenceIncidentId: evidence.incident_id,
      revisionRequest: localizationResult.causeRevisionRequest,
      revisionRequestMessageId:
        localizationResult.bandMessageIds.causeRevisionRequest!,
      priorCauseArtifact: causeFindingArtifact,
    });

    causeFeedTimeline = [
      ...causeFeedTimeline,
      ...revisionCycle.feedTimeline,
    ];
    await emitCauseFeed(revisionCycle.feedTimeline);

    causeFindingArtifact = revisionCycle.revisedCauseFindingArtifact;

    localizationResult = await runLocalizationRoomInvestigation({
      evidence,
      causeRoomId: causeResult.roomId,
      causeFindingArtifact,
      causeFindingArtifactMessageId:
        revisionCycle.bandMessageIds.revisedCauseFindingArtifact,
      phase: "post_revision",
      onStep,
    });
  }

  assertCrossRoomResolved({
    path: demoPath,
    defenseDecision: localizationResult.causeDefenseDecision,
    localizationDefenseVerdict: localizationResult.localizationDefenseVerdict,
    revisionCompleted: Boolean(revisionCycle),
    localizationComplete: Boolean(localizationResult.localizationFinding),
  });

  return {
    cause: {
      ...causeResult,
      causeFinding: revisionCycle?.revisedCauseFinding ?? causeResult.causeFinding,
      causeFindingArtifact: causeFindingArtifact,
      feedTimeline: causeFeedTimeline,
      revisionDecision: revisionCycle?.decision,
    },
    localization: localizationResult,
    revisionCycle,
    demoPath,
  };
}
