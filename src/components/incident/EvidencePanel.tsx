"use client";

import { useState } from "react";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { Panel } from "@/components/ui/shell";

type Tab = "transcript" | "execution" | "customer";

export function EvidencePanel({ evidence }: { evidence: VoiceIncidentEvidence }) {
  const [tab, setTab] = useState<Tab>("transcript");

  const tabs: { id: Tab; label: string }[] = [
    { id: "transcript", label: "Conversation · L1" },
    { id: "execution", label: "Execution · L2" },
    { id: "customer", label: "Customer · L3" },
  ];

  return (
    <Panel
      title="Evidence"
      className="h-full min-h-[520px]"
      action={
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider transition ${
                tab === t.id
                  ? "bg-room-elevated text-trace"
                  : "text-room-muted hover:text-foreground"
              }`}
            >
              {t.label.split(" · ")[0]}
            </button>
          ))}
        </div>
      }
    >
      <div className="p-4">
        {tab === "transcript" && (
          <div className="space-y-3">
            <p className="text-xs text-room-muted">
              What the customer heard — agents with L1 access see this only.
            </p>
            <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg border border-room-border bg-room-bg p-3 font-mono text-xs leading-relaxed">
              {evidence.layer1_conversation.segments.map((segment) => (
                <div
                  key={segment.turn_id}
                  className={
                    segment.turn_id === "T05"
                      ? "rounded border border-signal/30 bg-signal/5 p-2"
                      : ""
                  }
                >
                  <span className="text-room-muted">{segment.turn_id}</span>{" "}
                  <span
                    className={
                      segment.speaker === "agent" ? "text-trace" : "text-signal"
                    }
                  >
                    {segment.speaker}
                  </span>
                  : {segment.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "execution" && (
          <div className="space-y-3">
            <p className="text-xs text-room-muted">
              Tool calls and side effects — Outcome Investigator layer.
            </p>
            <div className="space-y-2">
              {evidence.layer2_execution.function_calls.map((call) => (
                <div
                  key={`${call.name}-${call.turn_ref}`}
                  className={`rounded-lg border p-3 ${
                    call.status === "timeout" || call.status === "error"
                      ? "border-alert/40 bg-alert/5"
                      : "border-room-border bg-room-bg"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-signal">{call.name}</code>
                    <span className="text-[10px] uppercase text-room-muted">
                      {call.turn_ref} · {call.status ?? "unknown"}
                      {call.http_status ? ` · ${call.http_status}` : ""}
                    </span>
                  </div>
                  {call.error_message ? (
                    <p className="mt-2 text-xs text-alert">{call.error_message}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-room-border bg-room-bg p-3 font-mono text-[11px] text-room-muted">
              side_effects:{" "}
              {JSON.stringify(evidence.layer2_execution.side_effects, null, 2)}
            </div>
          </div>
        )}

        {tab === "customer" && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-room-border bg-room-bg p-6 text-center">
            <div className="text-sm font-medium text-room-muted">
              Customer context · Phase 2
            </div>
            <p className="mt-2 max-w-sm text-xs text-room-muted">
              Prior calls, open tickets, and CRM snapshot will appear here when
              Customer Impact Analyst is connected.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
