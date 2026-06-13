import { NextResponse } from "next/server";
import { z } from "zod";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import {
  listIncidents,
  upsertIncidentFromEvidence,
} from "@/lib/incidents/store";

const PostSchema = z.union([
  z.object({ evidence: VoiceIncidentEvidenceSchema }),
  z.object({ rawJson: z.string().min(2) }),
]);

export async function GET() {
  return NextResponse.json({ ok: true, incidents: listIncidents() });
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());

    const evidence =
      "evidence" in body
        ? body.evidence
        : VoiceIncidentEvidenceSchema.parse(JSON.parse(body.rawJson));

    const incident = upsertIncidentFromEvidence(evidence);

    return NextResponse.json({
      ok: true,
      incident: {
        id: incident.id,
        title: incident.evidence.title,
        status: incident.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid evidence";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
