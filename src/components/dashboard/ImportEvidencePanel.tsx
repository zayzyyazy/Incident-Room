"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImportNormalizeReport } from "@/lib/normalizer/import-evidence";
import { Panel } from "@/components/ui/shell";
import type { ChatListItem } from "@/lib/chat/types";

type ImportTab = "paste" | "chat";

type ImportSample = {
  id: string;
  platform: string;
  title: string;
  hook: string;
};

export function ImportEvidencePanel({ onImported }: { onImported: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<ImportTab>("chat");
  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportNormalizeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [mongoConfigured, setMongoConfigured] = useState<boolean | null>(null);
  const [failuresOnly, setFailuresOnly] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [importSamples, setImportSamples] = useState<ImportSample[]>([]);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);

  const loadImportSamples = useCallback(async () => {
    try {
      const response = await fetch("/api/import-samples");
      const data = await response.json();
      if (data.ok) setImportSamples(data.samples ?? []);
    } catch {
      setImportSamples([]);
    }
  }, []);

  useEffect(() => {
    if (tab === "paste") loadImportSamples();
  }, [tab, loadImportSamples]);

  async function loadSampleIntoEditor(sampleId: string) {
    setLoadingSampleId(sampleId);
    setError(null);
    setReport(null);
    try {
      const response = await fetch(`/api/import-samples/${sampleId}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to load sample");
      setRawJson(data.rawJson ?? JSON.stringify(data.parsed, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sample");
    } finally {
      setLoadingSampleId(null);
    }
  }

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/chats?limit=30${failuresOnly ? "&failuresOnly=1" : ""}`,
      );
      const data = await response.json();
      if (response.status === 503) {
        setMongoConfigured(false);
        setChats([]);
        return;
      }
      if (!data.ok) throw new Error(data.error ?? "Failed to load chats");
      setMongoConfigured(true);
      setChats(data.chats ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      setChatsLoading(false);
    }
  }, [failuresOnly]);

  useEffect(() => {
    if (tab === "chat") loadChats();
  }, [tab, loadChats]);

  async function importFromChat(chatId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "Import failed");
      onImported();
      router.push(`/incidents/${data.incident.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadChatIntoEditor(chatId: string) {
    setError(null);
    setSelectedChatId(chatId);
    try {
      const response = await fetch(`/api/chats/${chatId}/export`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "Export failed");
      setRawJson(data.rawJson ?? JSON.stringify(data.export, null, 2));
      setReport(null);
      setTab("paste");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/api/incidents/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawJson }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "Normalize failed");
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Normalize failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawJson }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error ?? "Import failed");
      setRawJson("");
      setReport(null);
      onImported();
      router.push(`/incidents/${data.incident.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Import evidence">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("chat")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === "chat"
                ? "bg-trace/15 text-trace ring-1 ring-trace/30"
                : "bg-room-elevated text-room-muted hover:text-foreground"
            }`}
          >
            From agent chat (MongoDB)
          </button>
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === "paste"
                ? "bg-trace/15 text-trace ring-1 ring-trace/30"
                : "bg-room-elevated text-room-muted hover:text-foreground"
            }`}
          >
            Paste JSON
          </button>
        </div>

        {tab === "chat" ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-room-muted">
              Pull failed or recent conversations from your friend&apos;s agent chat
              stored in MongoDB. Each chat is converted into an Evidence Pack by the
              Normalizer on import.
            </p>
            {mongoConfigured === false ? (
              <p className="rounded-lg border border-signal/30 bg-signal/[0.06] px-3 py-2 text-xs text-room-muted">
                MongoDB is not configured. Add <code className="text-trace">MONGODB_URI</code>{" "}
                and <code className="text-trace">MONGO_DB</code> to{" "}
                <code className="text-trace">.env.local</code>, then restart the dev server.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-room-muted">
                <input
                  type="checkbox"
                  checked={failuresOnly}
                  onChange={(e) => setFailuresOnly(e.target.checked)}
                />
                Likely failures only
              </label>
              <button
                type="button"
                onClick={loadChats}
                disabled={chatsLoading}
                className="rounded-lg border border-room-border px-3 py-1.5 text-xs text-foreground hover:bg-room-elevated disabled:opacity-40"
              >
                {chatsLoading ? "Refreshing…" : "Refresh chats"}
              </button>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-room-border bg-room-bg p-2">
              {chats.length === 0 && !chatsLoading ? (
                <p className="px-2 py-4 text-center text-xs text-room-muted">
                  No chats found. Run a conversation at{" "}
                  <code className="text-trace">/chat/your-id</code> first.
                </p>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.chatId}
                    className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                      selectedChatId === chat.chatId
                        ? "border-trace/40 bg-trace/[0.06]"
                        : "border-room-border/60 bg-room-elevated/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] text-trace">{chat.chatId}</p>
                      <p className="mt-1 line-clamp-2 text-foreground">{chat.preview || "—"}</p>
                      <p className="mt-1 text-room-muted">
                        {chat.messageCount} messages · {new Date(chat.lastTimestamp).toLocaleString()}
                        {chat.likelyFailure ? (
                          <span className="ml-2 text-signal">likely failure</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => loadChatIntoEditor(chat.chatId)}
                        className="rounded border border-room-border px-2 py-1 text-[10px] hover:bg-room-panel"
                      >
                        Export
                      </button>
                      <button
                        type="button"
                        onClick={() => importFromChat(chat.chatId)}
                        disabled={loading}
                        className="rounded border border-trace/40 bg-trace/10 px-2 py-1 text-[10px] font-medium text-trace hover:bg-trace/20 disabled:opacity-40"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-room-muted">
              Paste any voice/chat agent export — Leaping, Vapi, Retell, Bland, OpenAI-style
              chat, or canonical <code className="text-trace">VoiceIncidentEvidence</code>. The
              Normalizer rewrites it into structured evidence packets.
            </p>
            {importSamples.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-room-muted">
                  Try platform samples
                </p>
                <div className="flex flex-col gap-2">
                  {importSamples.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => loadSampleIntoEditor(sample.id)}
                      disabled={loadingSampleId === sample.id}
                      className="rounded-lg border border-room-border bg-room-elevated px-3 py-2 text-left transition hover:border-trace/40 hover:bg-room-panel disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {sample.title}
                        </span>
                        <span className="shrink-0 rounded bg-trace/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-trace">
                          {sample.platform}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-room-muted">
                        {sample.hook}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <textarea
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                setReport(null);
                setError(null);
              }}
              placeholder='{"messages":[...],"tool_calls":[...]} or full platform export'
              className="h-48 w-full resize-y rounded-lg border border-room-border bg-room-bg p-3 font-mono text-xs text-foreground outline-none ring-trace/30 focus:ring-2"
            />
            {report ? (
              <div
                className={`rounded-lg border px-3 py-3 text-xs ${
                  report.warnings.some((w) => w.includes("no customer speech"))
                    ? "border-signal/40 bg-signal/[0.06] text-room-muted"
                    : "border-trace/30 bg-trace/[0.05] text-room-muted"
                }`}
              >
                <p className="font-medium text-trace">
                  Normalized · {report.platform}
                  {report.alreadyCanonical ? " (already canonical)" : ""}
                </p>
                <p className="mt-1">
                  {report.mapped.transcript_turns} turns · {report.mapped.tool_calls} tool
                  calls · raw preserved
                </p>
                <p className="mt-1 font-mono text-[10px] text-foreground">
                  {report.incident_id}
                </p>
                {report.warnings.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {report.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing || rawJson.trim().length < 10}
                className="rounded-lg border border-room-border bg-room-elevated px-4 py-2 text-sm text-foreground transition hover:bg-room-panel disabled:opacity-40"
              >
                {previewing ? "Normalizing…" : "Preview normalize"}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || rawJson.trim().length < 10}
                className="rounded-lg border border-trace/40 bg-trace/10 px-4 py-2 text-sm font-medium text-trace transition hover:bg-trace/20 disabled:opacity-40"
              >
                {loading ? "Importing…" : "Normalize & open incident"}
              </button>
            </div>
          </>
        )}

        {error ? <p className="text-xs text-alert">{error}</p> : null}
      </div>
    </Panel>
  );
}
