"use client";

import { KlausDemoGraph } from "@/lib/workflow/klaus-demo-graph";

export function WorkflowViewer({
  graph,
  highlightStageId,
  showHighlight,
  compact,
}: {
  graph: KlausDemoGraph;
  highlightStageId?: string;
  showHighlight?: boolean;
  compact?: boolean;
}) {
  const activeId = showHighlight ? highlightStageId ?? graph.primaryStageId : undefined;

  return (
    <div
      className={`rounded-xl border border-room-border bg-room-bg ${compact ? "p-2" : "p-4"}`}
    >
      {!compact ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-room-muted">
              Workflow · {graph.platform}
            </p>
            <p className="text-xs text-room-muted">{graph.agentName}</p>
          </div>
          {activeId ? (
            <span className="animate-pulse rounded-full border border-signal/50 bg-signal/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-signal">
              Bug lives here
            </span>
          ) : null}
        </div>
      ) : activeId ? (
        <p className="mb-2 text-[10px] font-semibold uppercase text-signal">
          Highlighted stage
        </p>
      ) : null}

      <div className={`flex flex-col gap-2 ${compact ? "max-h-64 overflow-y-auto" : ""}`}>
        {graph.nodes.map((node, index) => {
          const isHighlight = activeId === node.id;
          const typeTone: Record<string, string> = {
            dialogue: "border-trace/40 text-trace",
            switch: "border-signal/40 text-signal",
            field_setter: "border-room-border text-room-muted",
          };
          const tone = typeTone[node.type] ?? "border-room-border text-room-muted";

          return (
            <div key={node.id} className="flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-lg border-2 bg-room-panel p-3 transition-all duration-500 ${tone} ${
                  isHighlight
                    ? "border-signal bg-signal/10 shadow-[0_0_32px_rgba(232,149,74,0.35)] ring-2 ring-signal/40"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={`text-sm font-semibold ${isHighlight ? "text-signal" : "text-foreground"}`}
                    >
                      {node.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-room-muted">
                      {node.type} · {node.id.slice(0, 8)}…
                    </p>
                  </div>
                  {node.functions?.length ? (
                    <span className="rounded border border-room-border px-1.5 py-0.5 font-mono text-[9px] text-room-muted">
                      {node.functions.join(", ")}
                    </span>
                  ) : null}
                </div>
                {isHighlight && node.excerpt ? (
                  <p className="mt-2 border-t border-signal/20 pt-2 text-xs leading-relaxed text-room-muted">
                    {node.excerpt}…
                  </p>
                ) : null}
              </div>
              {index < graph.nodes.length - 1 && !compact ? (
                <div className="flex flex-col items-center py-0.5 text-room-muted">
                  <span className="text-xs">↓</span>
                  <span className="text-[9px] uppercase tracking-wider">
                    {graph.edges[index]?.label ?? "→"}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
