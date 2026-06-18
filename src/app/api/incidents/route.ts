import { NextResponse } from "next/server";
import { z } from "zod";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import {
  listIncidents,
  upsertIncidentFromEvidence,
} from "@/lib/incidents/store";
import { fetchChatMessages } from "@/lib/chat/mongo-queries";
import { mongoChatToImportJson } from "@/lib/chat/mongo-to-evidence";
import { isMongoConfigured } from "@/lib/mongodb/config";
import { normalizeImportedJson } from "@/lib/normalizer/import-evidence";

const PostSchema = z.union([
  z.object({ evidence: VoiceIncidentEvidenceSchema }),
  z.object({ rawJson: z.string().min(2) }),
  z.object({ chatId: z.string().min(1) }),
]);

export async function GET() {
  return NextResponse.json({ ok: true, incidents: listIncidents() });
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());

    if ("evidence" in body) {
      const incident = upsertIncidentFromEvidence(body.evidence);
      return NextResponse.json({
        ok: true,
        incident: {
          id: incident.id,
          title: incident.evidence.title,
          status: incident.status,
        },
      });
    }

    if ("chatId" in body) {
      if (!isMongoConfigured()) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "MongoDB is not configured. Set MONGODB_URI and MONGO_DB in .env.local",
          },
          { status: 503 },
        );
      }

      const messages = await fetchChatMessages(body.chatId);
      if (!messages.length) {
        return NextResponse.json(
          { ok: false, error: `No messages found for chat ${body.chatId}` },
          { status: 404 },
        );
      }

      const rawJson = mongoChatToImportJson(messages, body.chatId);
      const normalized = normalizeImportedJson(rawJson);
      const incident = upsertIncidentFromEvidence(normalized.evidence);

      return NextResponse.json({
        ok: true,
        incident: {
          id: incident.id,
          title: incident.evidence.title,
          status: incident.status,
        },
        report: normalized.report,
        source: { type: "mongo_chat", chatId: body.chatId },
      });
    }

    const normalized = normalizeImportedJson(body.rawJson);
    const incident = upsertIncidentFromEvidence(normalized.evidence);

    return NextResponse.json({
      ok: true,
      incident: {
        id: incident.id,
        title: incident.evidence.title,
        status: incident.status,
      },
      report: normalized.report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid evidence";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
