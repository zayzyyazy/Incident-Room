import { NextResponse } from "next/server";
import { z } from "zod";
import { VoiceIncidentEvidenceSchema } from "@/lib/evidence/types";
import {
  listIncidents,
  upsertIncidentFromEvidence,
} from "@/lib/incidents/store";
import { listFailureIncidents } from "@/lib/incidents/failures";
import {
  listImportedIncidents,
  persistImportedIncidentEvidence,
} from "@/lib/incidents/imported";
import { IncidentRecord, IncidentSummary } from "@/lib/incidents/types";
import { fetchChatMessages } from "@/lib/chat/mongo-queries";
import { mongoChatToImportJson } from "@/lib/chat/mongo-to-evidence";
import { isMongoConfigured } from "@/lib/mongodb/config";
import { normalizeImportedJson } from "@/lib/normalizer/import-evidence";

const PostSchema = z.union([
  z.object({ evidence: VoiceIncidentEvidenceSchema }),
  z.object({ rawJson: z.string().min(2) }),
  z.object({ chatId: z.string().min(1) }),
]);

function summaryFromIncident(incident: IncidentRecord): IncidentSummary {
  const last = incident.investigations.at(-1);
  return {
    id: incident.id,
    title: incident.evidence.title,
    source_platform: incident.evidence.source_platform,
    status: incident.status,
    updatedAt: incident.updatedAt,
    investigationCount: incident.investigations.length,
    lastVerdict: last?.conversationAnalysis?.conversation_verdict,
    lastExecutionVerdict: last?.outcomeAnalysis?.execution_verdict,
    lastCause: last?.causeRoom?.causeFinding.cause,
    lastCauseClass: last?.causeRoom?.causeFinding.cause_class,
    lastRoomId: incident.lastRoomId ?? last?.roomId,
  };
}

export async function GET() {
  try {
    const merged = new Map<string, IncidentSummary>();

    for (const incident of listIncidents()) {
      merged.set(incident.id, incident);
    }

    for (const failure of await listFailureIncidents()) {
      merged.set(failure.id, summaryFromIncident(failure));
    }

    for (const imported of await listImportedIncidents()) {
      merged.set(imported.id, summaryFromIncident(imported));
    }

    const incidents = Array.from(merged.values()).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return NextResponse.json({ ok: true, incidents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load incidents";
    console.error("Failed to list incidents:", error);
    return NextResponse.json(
      { ok: false, error: message, incidents: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());

    if ("evidence" in body) {
      const incident = upsertIncidentFromEvidence(body.evidence);
      await persistImportedIncidentEvidence(incident.evidence);
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
      await persistImportedIncidentEvidence(incident.evidence);

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
    await persistImportedIncidentEvidence(incident.evidence);

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
