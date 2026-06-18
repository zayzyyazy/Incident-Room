"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LiveInvestigationTheater } from "@/components/demo/LiveInvestigationTheater";
import { AppShell, StatusPill } from "@/components/ui/shell";
import { InvestigationSidebar, InvestigationSection } from "@/components/ui/investigation-sidebar";
import { InvestigationSectionPanels } from "@/components/demo/InvestigationSectionPanels";
import { IncidentRecord, InvestigationRun } from "@/lib/incidents/types";
import { KlausDemoGraph } from "@/lib/workflow/klaus-demo-graph";

function formatCallMeta(incident: IncidentRecord) {
  const meta = incident.evidence.call_metadata;
  if (!meta?.duration_sec) return null;
  const mins = Math.floor(meta.duration_sec / 60);
  const secs = meta.duration_sec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")} call`;
}

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
  const [elapsed, setElapsed] = useState(0);
  const [section, setSection] = useState<InvestigationSection>("theories");

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

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  const callMeta = useMemo(
    () => (incident ? formatCallMeta(incident) : null),
    [incident],
  );

  const elapsedLabel = useMemo(() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [elapsed]);

  if (loading) {
    return (
      <AppShell variant="investigation" title={params.id} subtitle="Loading…">
        <div className="text-room-muted">Loading incident…</div>
      </AppShell>
    );
  }

  if (!incident) {
    return (
      <AppShell variant="investigation" title={params.id} subtitle="Not found">
        <p className="text-alert">{error ?? "Incident not found"}</p>
        <Link href="/" className="mt-4 inline-block text-trace">
          ← Back to desk
        </Link>
      </AppShell>
    );
  }

  const platformLabel = incident.evidence.source_platform.toUpperCase();

  return (
    <AppShell
      variant="investigation"
      title={incident.evidence.title}
      subtitle={`${platformLabel} · ${incident.id}`}
      meta={callMeta ?? undefined}
      sidebar={
        <InvestigationSidebar
          incidentId={params.id}
          active={section}
          live={live}
          onSelect={setSection}
        />
      }
      actions={
        <div className="flex items-center gap-3">
          {live ? (
            <span className="hidden rounded-md border border-room-border bg-room-elevated px-2.5 py-1 font-mono text-xs text-room-muted sm:inline">
              LIVE {elapsedLabel}
            </span>
          ) : null}
          <StatusPill
            status={
              live
                ? "investigating"
                : latestRun?.status === "complete"
                  ? "complete"
                  : incident.status
            }
          />
        </div>
      }
    >
      {error && !live ? (
        <div className="mb-4 rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </div>
      ) : null}

      <div className={section === "theories" ? undefined : "hidden"}>
        <LiveInvestigationTheater
          incidentId={params.id}
          evidence={incident.evidence}
          workflow={workflow ?? undefined}
          initialRun={latestRun}
          onStatusChange={(s) => {
            const isLive = s === "connecting" || s === "live";
            setLive(isLive);
            if (s === "connecting") setElapsed(0);
          }}
          onGoToReports={() => setSection("reports")}
          onComplete={(run) => {
            setLive(false);
            setLatestRun(run);
            setError(null);
            void loadIncident();
          }}
        />
      </div>

      {section !== "theories" ? (
        <InvestigationSectionPanels
          section={section}
          evidence={incident.evidence}
          incidentId={params.id}
          run={latestRun}
        />
      ) : null}
    </AppShell>
  );
}
