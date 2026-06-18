"use client";

import Link from "next/link";

export type InvestigationSection =
  | "timeline"
  | "transcripts"
  | "evidence"
  | "themes"
  | "theories"
  | "agents"
  | "activity"
  | "reports";

export const INVESTIGATION_SECTIONS: {
  id: InvestigationSection;
  label: string;
  live?: boolean;
}[] = [
  { id: "timeline", label: "Timeline" },
  { id: "transcripts", label: "Transcripts" },
  { id: "evidence", label: "Evidence" },
  { id: "themes", label: "Themes" },
  { id: "theories", label: "Theories", live: true },
  { id: "agents", label: "Agents" },
  { id: "activity", label: "Activity Feed" },
  { id: "reports", label: "Reports" },
];

export function InvestigationSidebar({
  incidentId,
  active = "theories",
  live,
  onSelect,
}: {
  incidentId: string;
  active?: InvestigationSection;
  live?: boolean;
  onSelect: (section: InvestigationSection) => void;
}) {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-room-border bg-[#11141a] lg:flex lg:flex-col">
      <div className="border-b border-room-border px-4 py-4">
        <Link href={`/incidents/${incidentId}`} className="text-sm font-semibold text-trace">
          Incident Room
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {INVESTIGATION_SECTIONS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                isActive
                  ? "bg-room-elevated font-medium text-foreground"
                  : "text-room-muted hover:bg-room-elevated/50 hover:text-foreground"
              }`}
            >
              <span>{item.label}</span>
              {item.live && live && item.id === "theories" ? (
                <span className="rounded border border-trace/40 bg-trace/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-trace">
                  Live
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-room-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-command/20 font-mono text-xs font-bold text-command">
            AD
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Audit Director</p>
            <p className="text-[10px] text-room-muted">Compliance Team</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
