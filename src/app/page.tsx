"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImportEvidencePanel } from "@/components/dashboard/ImportEvidencePanel";
import { AppShell, Panel, StatusPill } from "@/components/ui/shell";
import { IncidentSummary } from "@/lib/incidents/types";
import { useRouter } from 'next/navigation';
function formatVerdict(value?: string) {
  if (!value) {
    return "—";
  }
  return value.replace(/_/g, " ");
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/incidents");
      const data = await response.json();
      if (data.ok) {
        setIncidents(data.incidents);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
    const newChatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  return (
    <AppShell
      title="Operations desk"
      subtitle="Incidents & investigation history"
    >
      <button onClick={()=>{    router.push(`/chat/${newChatId}`)}}>Chat</button>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Incidents">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-room-border text-[11px] uppercase tracking-wider text-room-muted">
                  <th className="px-4 py-3 font-medium">Incident</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Conversation</th>
                  <th className="px-4 py-3 font-medium">Execution</th>
                  <th className="px-4 py-3 font-medium">Runs</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-room-muted">
                      Loading incidents…
                    </td>
                  </tr>
                ) : incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-room-muted">
                      No incidents yet.
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className="border-b border-room-border/60 transition hover:bg-room-elevated/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="font-medium text-foreground hover:text-trace"
                        >
                          {incident.title}
                        </Link>
                        <div className="font-mono text-[10px] text-room-muted">
                          {incident.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-room-muted">
                        {incident.source_platform}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={incident.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-room-muted">
                        {formatVerdict(incident.lastVerdict)}
                      </td>
                      <td className="px-4 py-3 text-xs text-room-muted">
                        {formatVerdict(incident.lastExecutionVerdict)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {incident.investigationCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <ImportEvidencePanel onImported={refresh} />
      </div>
      <Panel title="Active agents" className="mt-6">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              name: "Conversation Analyst",
              layer: "L1",
              color: "text-trace border-trace/40",
              status: "live",
            },
            {
              name: "Outcome Investigator",
              layer: "L2",
              color: "text-signal border-signal/40",
              status: "live",
            },
            {
              name: "Pattern Analyst",
              layer: "L3",
              color: "text-amber-warm border-amber-warm/40",
              status: "phase 2",
            },
            {
              name: "Failure Synthesizer",
              layer: "Band",
              color: "text-command border-command/40",
              status: "phase 2",
            },
          ].map((agent) => (
            <div
              key={agent.name}
              className={`rounded-lg border bg-room-elevated p-3 ${agent.color}`}
            >
              <div className="text-sm font-medium">{agent.name}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider opacity-70">
                {agent.layer} · {agent.status}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
