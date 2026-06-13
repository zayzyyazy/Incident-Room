import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import { runTwoAgentInvestigation } from "@/lib/orchestrator/run-two-agent-investigation";

const RequestSchema = z.object({
  fixture: z.string().optional(),
  evidence: VoiceIncidentEvidenceSchema.optional(),
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

    const result = await runTwoAgentInvestigation(evidence);

    return NextResponse.json({
      ok: true,
      roomId: result.roomId,
      bandMessageIds: result.bandMessageIds,
      conversationAnalysis: result.conversationAnalysis,
      outcomeAnalysis: result.outcomeAnalysis,
      contradiction: {
        detected:
          result.outcomeAnalysis.contradicts_msg_id !== null ||
          (result.conversationAnalysis.conversation_verdict ===
            "appears_resolved" &&
            result.outcomeAnalysis.execution_verdict === "outcome_failed"),
        contradicts_msg_id: result.outcomeAnalysis.contradicts_msg_id,
        reason: result.outcomeAnalysis.contradiction_reason_en,
      },
      historyCount: result.history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
