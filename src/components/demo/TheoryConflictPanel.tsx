"use client";

import { TheoryConflictBeat } from "@/lib/demo/investigation-verdict-view";
import { getAgentDefinition } from "@/lib/agents/registry";

function ConflictBeat({ beat }: { beat: TheoryConflictBeat }) {
  const agent = getAgentDefinition(beat.agentId);
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        beat.highlight
          ? "border-alert/60 bg-alert/10 ring-1 ring-alert/25"
          : "border-room-border bg-room-elevated/50"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-room-muted">
        {beat.kind} · {beat.agentLabel}
      </p>
      <p
        className={`mt-2 text-sm leading-relaxed ${
          agent?.accentClass ?? "text-foreground"
        }`}
      >
        {beat.line}
      </p>
    </div>
  );
}

export function TheoryConflictPanel({
  conflict,
  live,
  collapsed,
  onToggle,
}: {
  conflict: { show: boolean; beats: TheoryConflictBeat[] };
  live?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  if (!conflict.show) return null;

  const inner = (
    <div className="space-y-3">
      {conflict.beats.map((beat, i) => (
        <ConflictBeat key={`${beat.agentId}-${i}`} beat={beat} />
      ))}
    </div>
  );

  if (onToggle) {
    return (
      <div className="rounded-xl border border-room-border bg-room-panel">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-room-muted">
              How agents argued
            </p>
            <p className="mt-0.5 text-xs text-room-muted">
              {conflict.beats.length} theory beats
              {collapsed ? " · collapsed" : " · expanded"}
            </p>
          </div>
          <span className="text-sm text-trace">{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed ? (
          <div className="border-t border-room-border p-4">{inner}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-room-border bg-room-panel p-4 ${
        live ? "ring-2 ring-alert/25" : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-room-muted">
        Theory conflict · live
      </p>
      <div className="mt-3">{inner}</div>
    </div>
  );
}
