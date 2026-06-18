import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import { runCauseRoomInvestigation } from "@/lib/orchestrator/run-cause-room-investigation";

const RequestSchema = z.object({
  fixture: z.string().optional(),
  evidence: VoiceIncidentEvidenceSchema.optional(),
  taskId: z.string().optional(),
});

function loadFixture(name: string) {
  const fixturePath = path.join(
    process.cwd(),
    "fixtures",
    name.endsWith(".json") ? name : `${name}.json`,
  );
  const raw = fs.readFileSync(fixturePath, "utf8");
  return VoiceIncidentEvidenceSchema.parse(JSON.parse(raw));
}

export async function POST(request: NextRequest) {
  try {
    const body = RequestSchema.parse(
      request.headers.get("content-length") === "0"
        ? {}
        : await request.json(),
    );

    const evidence =
      body.evidence ?? loadFixture(body.fixture ?? "hero-klaus-minimal");

    const result = await runCauseRoomInvestigation(evidence, {
      taskId: body.taskId,
    });

    const rejected = result.causeFinding.considered_hypotheses.filter(
      (h) => h.status === "rejected",
    ).length;

    return NextResponse.json({
      ok: true,
      roomId: result.roomId,
      distinctBandAgents: result.distinctBandAgents,
      bandMessageIds: result.bandMessageIds,
      openingClasses: {
        claimTracer: result.claimTracerInitial.hypothesis_class,
        backendWitness: result.backendWitnessInitial.hypothesis_class,
      },
      bridgeClass: result.causalJudgeBridge.bridge_hypothesis_class,
      causeFinding: result.causeFinding,
      collaborationMetrics: {
        peerConflictBeforeJudge: true,
        classChanges: [
          result.claimTracerInitial.hypothesis_class !==
            result.claimTracerChallenge1.updated_hypothesis_class,
          result.backendWitnessInitial.hypothesis_class !==
            result.backendWitnessChallenge1.updated_hypothesis_class,
        ].filter(Boolean).length,
        rejectedHypotheses: rejected,
        causeDiffersFromOpenings:
          result.causeFinding.cause_class !==
            result.claimTracerInitial.hypothesis_class &&
          result.causeFinding.cause_class !==
            result.backendWitnessInitial.hypothesis_class,
      },
      historyCount: result.history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
