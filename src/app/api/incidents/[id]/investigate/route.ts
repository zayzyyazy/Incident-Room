import { NextResponse } from "next/server";
import { runTwoAgentInvestigation } from "@/lib/orchestrator/run-two-agent-investigation";
import {
  completeInvestigation,
  failInvestigation,
  getIncident,
  startInvestigation,
} from "@/lib/incidents/store";

type RouteParams = { params: { id: string } };

export async function POST(_request: Request, { params }: RouteParams) {
  const incident = getIncident(params.id);

  if (!incident) {
    return NextResponse.json(
      { ok: false, error: "Incident not found" },
      { status: 404 },
    );
  }

  const run = startInvestigation(params.id);

  try {
    const result = await runTwoAgentInvestigation(incident.evidence);

    const contradiction = {
      detected:
        result.outcomeAnalysis.contradicts_msg_id !== null ||
        (result.conversationAnalysis.conversation_verdict ===
          "appears_resolved" &&
          result.outcomeAnalysis.execution_verdict === "outcome_failed"),
      contradicts_msg_id: result.outcomeAnalysis.contradicts_msg_id,
      reason: result.outcomeAnalysis.contradiction_reason_en,
    };

    const completed = completeInvestigation(params.id, run.id, {
      roomId: result.roomId,
      bandMessageIds: result.bandMessageIds,
      conversationAnalysis: result.conversationAnalysis,
      outcomeAnalysis: result.outcomeAnalysis,
      contradiction,
    });

    return NextResponse.json({
      ok: true,
      run: completed,
      roomId: result.roomId,
      bandMessageIds: result.bandMessageIds,
      conversationAnalysis: result.conversationAnalysis,
      outcomeAnalysis: result.outcomeAnalysis,
      contradiction,
      historyCount: result.history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed";
    const failed = failInvestigation(params.id, run.id, message);
    return NextResponse.json(
      { ok: false, error: message, run: failed },
      { status: 500 },
    );
  }
}
