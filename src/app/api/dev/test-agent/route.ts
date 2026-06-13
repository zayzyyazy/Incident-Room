import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runConversationAnalyst } from "@/lib/agents/conversation-analyst";
import { runOutcomeInvestigator } from "@/lib/agents/outcome-investigator";
import { ConversationAnalysisSchema } from "@/lib/band/message-types";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import { forAgent01, forAgent02 } from "@/lib/orchestrator/context-filter";

const RequestSchema = z.object({
  agent: z.enum(["conversation_analyst", "outcome_investigator"]),
  fixture: z.string().optional(),
  evidence: VoiceIncidentEvidenceSchema.optional(),
  conversation_analysis: ConversationAnalysisSchema.optional(),
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
    const body = RequestSchema.parse(await request.json());
    const evidence =
      body.evidence ?? loadFixture(body.fixture ?? "hero-klaus-minimal");

    if (body.agent === "conversation_analyst") {
      const result = await runConversationAnalyst(forAgent01(evidence));
      return NextResponse.json({ ok: true, agent: body.agent, result });
    }

    const conversationAnalysis =
      body.conversation_analysis ??
      (await runConversationAnalyst(forAgent01(evidence)));

    const result = await runOutcomeInvestigator(
      forAgent02(evidence, conversationAnalysis),
      "MSG-01-preview",
    );

    return NextResponse.json({
      ok: true,
      agent: body.agent,
      conversation_analysis: conversationAnalysis,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
