"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AgentFeed } from "@/components/incident/AgentFeed";
import { EvidencePanel } from "@/components/incident/EvidencePanel";
import { VerdictStrip } from "@/components/incident/VerdictStrip";
import { AppShell, StatusPill } from "@/components/ui/shell";
import { buildFeedFromInvestigation } from "@/lib/agents/registry";
import { IncidentRecord, InvestigationRun } from "@/lib/incidents/types";

export default function IncidentRoomPage({
  params,
}: {
  params: { id: string };
}) {
  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<InvestigationRun | null>(null);

  const loadIncident = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/incidents/${params.id}`);
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error ?? "Failed to load incident");
      }
      setIncident(data.incident);
      setLatestRun(data.incident.investigations.at(-1) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  async function runInvestigation() {
    setInvestigating(true);
    setError(null);

    try {
      const response = await fetch(`/api/incidents/${params.id}/investigate`, {
        method: "POST",
      });
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error ?? "Investigation failed");
      }

      setLatestRun(data.run);
      await loadIncident();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Investigation failed");
    } finally {
      setInvestigating(false);
    }
  }

  if (loading) {
    return (
      <AppShell title={params.id} subtitle="Loading incident…">
        <div className="text-room-muted">Loading…</div>
      </AppShell>
    );
  }

  if (!incident) {
    return (
      <AppShell title={params.id} subtitle="Not found">
        <p className="text-alert">{error ?? "Incident not found"}</p>
        <Link href="/" className="mt-4 inline-block text-trace">
          ← Back to desk
        </Link>
      </AppShell>
    );
  }

  const feedMessages = latestRun?.status === "complete"
    ? buildFeedFromInvestigation({
        bandMessageIds: latestRun.bandMessageIds,
        conversationAnalysis: latestRun.conversationAnalysis,
        outcomeAnalysis: latestRun.outcomeAnalysis,
      })
    : [];

  const roomId = latestRun?.roomId ?? incident.lastRoomId;

  return (
    <AppShell
      title={incident.evidence.title}
      subtitle={incident.id}
      actions={
        <div className="flex items-center gap-3">
          <StatusPill status={investigating ? "investigating" : incident.status} />
          {roomId ? (
            <a
              href="https://band.ai"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-room-muted underline-offset-2 hover:text-trace hover:underline"
              title={`Band room: ${roomId}`}
            >
              Band ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={runInvestigation}
            disabled={investigating}
            className="rounded-lg border border-signal/50 bg-signal/15 px-4 py-2 text-sm font-semibold text-signal transition hover:bg-signal/25 disabled:opacity-50"
          >
            {investigating ? "Investigating…" : "Run investigation"}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <EvidencePanel evidence={incident.evidence} />
        <AgentFeed
          messages={feedMessages}
          loading={investigating}
          emptyHint="Click Run investigation — agents will analyze blind layers and post to Band."
        />
      </div>

      <VerdictStrip run={latestRun} roomId={roomId} />

      {incident.investigations.length > 0 ? (
        <section className="mt-6 rounded-xl border border-room-border bg-room-panel p-4">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-room-muted">
            Investigation history
          </h3>
          <ul className="mt-3 space-y-2">
            {[...incident.investigations].reverse().map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-room-border bg-room-bg px-3 py-2 text-xs"
              >
                <span className="font-mono text-room-muted">{run.id}</span>
                <StatusPill status={run.status} />
                <span className="text-room-muted">
                  {run.conversationAnalysis?.conversation_verdict ?? "—"} /{" "}
                  {run.outcomeAnalysis?.execution_verdict ?? "—"}
                </span>
                <span className="text-room-muted">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
