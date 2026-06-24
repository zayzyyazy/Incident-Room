import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { runFullIncidentInvestigation } from "@/lib/orchestrator/run-full-incident-investigation";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";

function loadFixture(name: string) {
  const candidates = [
    path.join(process.cwd(), "fixtures", `${name}.json`),
    path.join(process.cwd(), "fixtures/seeded", `${name}.json`),
    path.join(process.cwd(), "fixtures/incidents", `${name}.json`),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return VoiceIncidentEvidenceSchema.parse(raw);
    }
  }
  throw new Error(`Fixture not found: ${name}`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fixture = typeof body.fixture === "string" ? body.fixture : "hero-klaus-minimal";
    const evidence = loadFixture(fixture);
    const result = await runFullIncidentInvestigation(evidence);

    return NextResponse.json({
      ok: true,
      fixture,
      causeRoomId: result.cause.roomId,
      localizationRoomId: result.localization.roomId,
      distinctCauseAgents: result.cause.distinctBandAgents,
      distinctLocalizationAgents: result.localization.distinctBandAgents,
      causeClass: result.cause.causeFinding.cause_class,
      mechanism: result.localization.localizationFinding?.implementation_mechanism,
      primarySurface: result.localization.localizationFinding?.primary_surface,
      revised: Boolean(result.revisionCycle),
      pendingRevision: result.localization.pendingCauseRevision,
      causeHistoryCount: result.cause.history.length,
      localizationHistoryCount: result.localization.history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
