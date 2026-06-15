"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LiveInvestigationTheater } from "@/components/demo/LiveInvestigationTheater";
import { AppShell, StatusPill } from "@/components/ui/shell";
import { IncidentRecord, InvestigationRun } from "@/lib/incidents/types";
import { KlausDemoGraph } from "@/lib/workflow/klaus-demo-graph";

export default function IncidentRoomPage({
  params,
}: {
  params: { id: string };
}) {
  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<InvestigationRun | null>(null);
  const [workflow, setWorkflow] = useState<KlausDemoGraph | null>(null);
  const [live, setLive] = useState(false);

  const loadIncident = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, wfRes] = await Promise.all([
        fetch(`/api/incidents/${params.id}`),
        fetch(`/api/incidents/${params.id}/workflow`),
      ]);
      const data = await incRes.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to load incident");
      setIncident(data.incident);
      const run = data.incident.investigations.at(-1) ?? null;
      setLatestRun(run);
      if (run?.status === "failed" && run.error) setError(run.error);

      const wfData = await wfRes.json();
      if (wfData.ok) setWorkflow(wfData.graph);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

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

  return (
    <AppShell
      title={incident.evidence.title}
      subtitle={incident.id}
      actions={
        <StatusPill
          status={
            live
              ? "investigating"
              : latestRun?.status === "complete"
                ? "complete"
                : incident.status
          }
        />
      }
    >
      {error && !live ? (
        <div className="mb-4 rounded-lg border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </div>
      ) : null}

      <LiveInvestigationTheater
        incidentId={params.id}
        evidence={incident.evidence}
        workflow={workflow ?? undefined}
        initialRun={latestRun}
        onStatusChange={(s) => setLive(s === "connecting" || s === "live")}
        onComplete={(run) => {
          setLive(false);
          setLatestRun(run);
          setError(null);
          void loadIncident();
        }}
      />
    </AppShell>
  );
}
