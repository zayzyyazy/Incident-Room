"use client";

import { useState } from "react";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { IncidentCrmLink, CrmLookupResult } from "@/lib/crm/types";
import { Panel } from "@/components/ui/shell";

type Tab = "transcript" | "execution" | "customer";

export function EvidencePanel({
  evidence,
  crmLink,
  crmLookup,
}: {
  evidence: VoiceIncidentEvidence;
  crmLink?: IncidentCrmLink | null;
  crmLookup?: CrmLookupResult | null;
}) {
  const [tab, setTab] = useState<Tab>("transcript");

  const tabs: { id: Tab; label: string }[] = [
    { id: "transcript", label: "Conversation · L1" },
    { id: "execution", label: "Execution · L2" },
    { id: "customer", label: "Pattern · L3" },
  ];

  return (
    <Panel
      title="Evidence"
      className="max-h-[380px] overflow-hidden"
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
            <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-lg border border-room-border bg-room-bg p-3 font-mono text-xs leading-relaxed">
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
          <div className="space-y-3">
            <p className="text-xs text-room-muted">
              CRM lookup — matched from call evidence (phone, customer id, VNR).
            </p>
            {crmLink?.customer ? (
              <div className="rounded-lg border border-trace/30 bg-trace/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-trace">
                    {crmLink.customer.name}
                  </div>
                  <span className="text-[10px] uppercase text-room-muted">
                    matched on {crmLink.matched_on}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-xs text-room-muted">
                  <div>
                    <span className="text-room-muted">ID </span>
                    <code className="text-foreground">{crmLink.customer.customer_id}</code>
                  </div>
                  {crmLink.customer.phone ? <div>Phone: {crmLink.customer.phone}</div> : null}
                  {crmLink.customer.email ? <div>Email: {crmLink.customer.email}</div> : null}
                  {crmLink.customer.birth_date ? (
                    <div>Birth date (CRM): {crmLink.customer.birth_date}</div>
                  ) : null}
                  {crmLink.customer.address ? <div>Address: {crmLink.customer.address}</div> : null}
                  {crmLink.customer.vnr_last4 ? (
                    <div>VNR last 4: {crmLink.customer.vnr_last4}</div>
                  ) : null}
                  {crmLink.customer.prior_calls_14d != null ? (
                    <div>Prior calls (14d): {crmLink.customer.prior_calls_14d}</div>
                  ) : null}
                  {crmLink.customer.notes ? (
                    <div className="italic text-signal">{crmLink.customer.notes}</div>
                  ) : null}
                  {crmLink.customer.open_tickets?.length ? (
                    <div>
                      Open tickets:
                      <ul className="mt-1 list-inside list-disc">
                        {crmLink.customer.open_tickets.map((t) => (
                          <li key={t.id}>{t.subject}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-room-border bg-room-bg p-6 text-center text-sm text-room-muted">
                No CRM match yet.
                {crmLookup?.hints_used ? (
                  <pre className="mt-3 text-left font-mono text-[10px]">
                    {JSON.stringify(crmLookup.hints_used, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-2 text-xs">
                    Run investigation or add customer at{" "}
                    <a href="/crm" className="text-trace hover:underline">
                      /crm
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
