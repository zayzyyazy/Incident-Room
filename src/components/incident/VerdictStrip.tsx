"use client";

import { InvestigationRun } from "@/lib/incidents/types";
import { Panel } from "@/components/ui/shell";

export function VerdictStrip({
  run,
  roomId,
}: {
  run?: InvestigationRun | null;
  roomId?: string;
}) {
  if (!run || run.status !== "complete") {
    return (
      <Panel className="mt-4 p-4">
        <p className="text-sm text-room-muted">
          Cross-layer verdict appears here after investigation completes.
        </p>
      </Panel>
    );
  }

  const conversation = run.conversationAnalysis?.conversation_verdict;
  const execution = run.outcomeAnalysis?.execution_verdict;
  const gap =
    conversation === "appears_resolved" && execution === "outcome_failed";

  return (
    <Panel className="mt-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-room-muted">
            Cross-layer assessment
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            {gap ? (
              <span className="text-alert">
                Transcript suggests resolution but execution failed — silent
                backend failure detected.
              </span>
            ) : execution === "outcome_failed" ? (
              <span className="text-signal">
                Execution failed while conversation layer shows{" "}
                {conversation?.replace(/_/g, " ") ?? "mixed signals"}.
              </span>
            ) : (
              <span className="text-trace">
                Layers appear aligned on this run.
              </span>
            )}
          </p>
          {run.contradiction?.detected && run.contradiction.reason ? (
            <p className="mt-2 text-xs text-alert">{run.contradiction.reason}</p>
          ) : null}
        </div>
        {(roomId ?? run.roomId) ? (
          <div className="text-right text-xs text-room-muted">
            <div>Band room</div>
            <code className="mt-1 block max-w-[280px] truncate font-mono text-[10px] text-trace">
              {roomId ?? run.roomId}
            </code>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
