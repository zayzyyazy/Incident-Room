"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImportEvidencePanel } from "@/components/dashboard/ImportEvidencePanel";
import { IconSearch } from "@/components/ui/icons";
import {
  AppShell,
  Panel,
  PlatformBadge,
  StatCard,
  StatusPill,
} from "@/components/ui/shell";
import { IncidentSummary } from "@/lib/incidents/types";

type Tab = "all" | "pending" | "complete";

const PAGE_SIZE = 8;

export default function DashboardPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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

  const openReplyChat = () => {
    const newChatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.push(`/chat/${newChatId}`);
  };

  const stats = useMemo(() => {
    const pending = incidents.filter((i) => i.status === "pending").length;
    const complete = incidents.filter((i) => i.status === "complete").length;
    const totalRuns = incidents.reduce((n, i) => n + i.investigationCount, 0);
    return { pending, complete, total: incidents.length, totalRuns };
  }, [incidents]);

  const filtered = useMemo(() => {
    let rows = incidents;
    if (tab === "pending") rows = rows.filter((i) => i.status === "pending");
    if (tab === "complete") rows = rows.filter((i) => i.status === "complete");
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.source_platform.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [incidents, tab, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab, query]);

  return (
    <AppShell
      title="Operations Desk"
      subtitle="Monitor and manage Voice AI incidents across platforms."
      variant="desk"
      toolbar={
        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={openReplyChat}
            className="rounded-lg border border-trace/40 bg-trace/10 px-3 py-1.5 text-xs font-medium text-trace transition hover:border-trace/70 hover:bg-trace/20"
          >
            Open ReplyChat
          </button>
          <span className="text-xs text-room-muted">
            Hero demo: <strong className="text-foreground">retell_call_clinic_44102</strong> · Klaus
          </span>
          <select className="rounded-lg border border-room-border bg-room-elevated px-3 py-1.5 text-xs text-room-muted">
            <option>Last 7 days</option>
          </select>
          <button
            type="button"
            className="rounded-lg border border-room-border bg-room-elevated px-3 py-1.5 text-xs text-foreground"
          >
            Export
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: "retell_call_clinic_44102", label: "Maria · Retell 503", tone: "signal" },
          { id: "PMB-2024-0847", label: "Klaus · callback gap", tone: "trace" },
          { id: "SYN-2026-0615-priya", label: "Priya · theories", tone: "command" },
        ].map((hero) => (
          <Link
            key={hero.id}
            href={`/incidents/${hero.id}`}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-room-elevated ${
              hero.tone === "signal"
                ? "border-signal/40 text-signal"
                : hero.tone === "command"
                  ? "border-command/40 text-command"
                  : "border-trace/40 text-trace"
            }`}
          >
            {hero.label} →
          </Link>
        ))}
        <Link
          href="/crm"
          className="rounded-lg border border-room-border px-3 py-2 text-xs text-room-muted hover:text-foreground"
        >
          CRM (13 customers) →
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Incidents"
          value={stats.total}
          hint="Across all platforms"
          tone="trace"
          icon={<span className="text-lg">▣</span>}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          hint="Require attention"
          tone="signal"
          icon={<span className="text-lg">◷</span>}
        />
        <StatCard
          label="Complete"
          value={stats.complete}
          hint="Successfully processed"
          tone="trace"
          icon={<span className="text-lg">✓</span>}
        />
        <StatCard
          label="Total Runs"
          value={stats.totalRuns}
          hint="Across all incidents"
          tone="command"
          icon={<span className="text-lg">〰</span>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-room-border px-5 py-3">
            <div className="flex gap-1">
              {(
                [
                  ["all", "All Incidents"],
                  ["pending", "Pending"],
                  ["complete", "Complete"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    tab === id
                      ? "bg-room-elevated font-medium text-foreground"
                      : "text-room-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-room-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search incidents..."
                className="w-52 rounded-lg border border-room-border bg-room-bg py-2 pl-9 pr-3 text-sm text-foreground outline-none ring-trace/30 focus:ring-1"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-room-border text-xs text-room-muted">
                  <th className="px-5 py-3 font-medium">Incident ID</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Platform</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Runs</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-room-muted">
                      Loading incidents…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-room-muted">
                      No incidents match this filter.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((incident) => (
                    <tr
                      key={incident.id}
                      className="border-b border-room-border/40 transition hover:bg-room-elevated/30"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-room-muted">
                        {incident.id}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="font-medium text-foreground hover:text-trace"
                        >
                          {incident.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <PlatformBadge platform={incident.source_platform} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={incident.status} />
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">
                        {incident.investigationCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-room-border px-5 py-3 text-xs text-room-muted">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}{" "}
              incidents
            </span>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(pageCount, 3) }, (_, i) => i + 1).map(
                (n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-7 w-7 rounded border text-xs ${
                      page === n
                        ? "border-trace/50 bg-trace/10 text-trace"
                        : "border-room-border text-room-muted"
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
              <span className="ml-2">{PAGE_SIZE} / page</span>
            </div>
          </div>
        </Panel>

        <ImportEvidencePanel onImported={refresh} />
      </div>
    </AppShell>
  );
}
