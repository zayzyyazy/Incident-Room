"use client";

import { useMemo } from "react";
import { InvestigationAgentsBay } from "@/components/demo/InvestigationAgentsBay";
import { deriveRecruitedAgents, dialogueSummary } from "@/lib/demo/game-level";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { InvestigationRun } from "@/lib/incidents/types";
import { stepsFromInvestigationRun } from "@/lib/demo/investigation-steps";
import {
  buildIncidentReportView,
  bandRoomUrl,
} from "@/lib/demo/investigation-verdict-view";
import { IncidentReportHero } from "@/components/demo/IncidentReportHero";
import { InvestigationSection } from "@/components/ui/investigation-sidebar";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-room-border bg-room-panel">
      <div className="border-b border-room-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function speakerLabel(speaker: string) {
  if (speaker === "agent") return "Agent";
  if (speaker === "customer") return "Customer";
  return "System";
}

function speakerColor(speaker: string) {
  if (speaker === "agent") return "text-trace";
  if (speaker === "customer") return "text-signal";
  return "text-room-muted";
}

export function InvestigationSectionPanels({
  section,
  evidence,
  incidentId,
  run,
}: {
  section: InvestigationSection;
  evidence: VoiceIncidentEvidence;
  incidentId: string;
  run: InvestigationRun | null;
}) {
  const steps = useMemo(() => (run ? stepsFromInvestigationRun(run) : []), [run]);
  const report = useMemo(() => buildIncidentReportView(evidence, run), [evidence, run]);

  const timeline = useMemo(() => {
    const events: { id: string; label: string; detail: string; tone: string }[] = [];

    for (const seg of evidence.layer1_conversation.segments) {
      events.push({
        id: seg.turn_id,
        label: `${speakerLabel(seg.speaker)} · ${seg.turn_id}`,
        detail: seg.text,
        tone: speakerColor(seg.speaker),
      });
    }

    evidence.layer2_execution.function_calls.forEach((call, i) => {
      events.push({
        id: `tool-${i}`,
        label: `Tool · ${call.name}`,
        detail:
          call.status === "error" || call.status === "timeout"
            ? `${call.status}${call.http_status ? ` (${call.http_status})` : ""}${call.error_message ? ` — ${call.error_message}` : ""}`
            : call.status ?? "called",
        tone: call.status === "success" ? "text-trace" : "text-alert",
      });
    });

    const side = evidence.layer2_execution.side_effects;
    events.push({
      id: "side-effects",
      label: "Side effects",
      detail: `appointment_created=${side.appointment_created}, crm_record=${side.crm_record_exists ?? false}`,
      tone: side.appointment_created ? "text-trace" : "text-alert",
    });

    return events;
  }, [evidence]);

  const themes = useMemo(() => {
    const items: { label: string; detail: string }[] = [];
    if (evidence.layer1_conversation.intent) {
      items.push({ label: "Intent", detail: evidence.layer1_conversation.intent });
    }
    for (const hint of evidence.layer1_conversation.behavioral_hints ?? []) {
      items.push({ label: hint.type, detail: hint.note });
    }
    if (items.length === 0) {
      items.push({
        label: "Customer belief",
        detail: "Callback and email promised — customer left satisfied.",
      });
    }
    return items;
  }, [evidence]);

  if (section === "timeline") {
    return (
      <Panel title="Incident timeline">
        <div className="space-y-3">
          {timeline.map((event) => (
            <div
              key={event.id}
              className="flex gap-4 border-b border-room-border/50 pb-3 last:border-0"
            >
              <p className={`w-36 shrink-0 text-xs font-semibold ${event.tone}`}>
                {event.label}
              </p>
              <p className="text-sm leading-relaxed text-foreground">{event.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (section === "transcripts") {
    return (
      <Panel title="Call transcript">
        <div className="space-y-4">
          {evidence.layer1_conversation.segments.map((seg) => (
            <div key={seg.turn_id} className="flex gap-4">
              <div className="w-24 shrink-0">
                <p className={`text-xs font-semibold uppercase ${speakerColor(seg.speaker)}`}>
                  {speakerLabel(seg.speaker)}
                </p>
                <p className="font-mono text-[10px] text-room-muted">{seg.turn_id}</p>
              </div>
              <p className="text-sm leading-relaxed text-foreground">{seg.text}</p>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (section === "evidence") {
    return (
      <div className="space-y-5">
        <Panel title="Layer 2 · Tool trace">
          <div className="space-y-3">
            {evidence.layer2_execution.function_calls.map((call, i) => (
              <div
                key={`${call.name}-${i}`}
                className="rounded-lg border border-room-border bg-room-elevated/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-medium text-foreground">{call.name}</p>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      call.status === "success"
                        ? "bg-trace/10 text-trace"
                        : "bg-alert/10 text-alert"
                    }`}
                  >
                    {call.status ?? "unknown"}
                  </span>
                  {call.http_status ? (
                    <span className="text-xs text-room-muted">HTTP {call.http_status}</span>
                  ) : null}
                </div>
                {call.error_message ? (
                  <p className="mt-2 text-sm text-alert">{call.error_message}</p>
                ) : null}
                {call.turn_ref ? (
                  <p className="mt-1 text-xs text-room-muted">turn_ref: {call.turn_ref}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Side effects">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries(evidence.layer2_execution.side_effects).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-room-border px-4 py-3">
                <dt className="text-xs uppercase text-room-muted">{key.replace(/_/g, " ")}</dt>
                <dd className="mt-1 font-medium text-foreground">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    );
  }

  if (section === "themes") {
    return (
      <Panel title="Behavioral themes">
        <div className="space-y-3">
          {themes.map((theme, i) => (
            <div
              key={`${theme.label}-${i}`}
              className="rounded-lg border border-room-border bg-room-elevated/30 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-room-muted">
                {theme.label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{theme.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (section === "agents") {
    const recruited = run
      ? deriveRecruitedAgents(steps, Math.max(0, steps.length - 1))
      : [];
    return (
        <Panel title="Investigation agents">
          <InvestigationAgentsBay recruited={recruited} />
        </Panel>
    );
  }

  if (section === "activity") {
    return (
      <Panel title="Activity feed">
        {steps.length === 0 ? (
          <p className="text-sm text-room-muted">
            No investigation activity yet. Run an investigation from Theories.
          </p>
        ) : (
          <div className="max-h-[520px] space-y-3 overflow-y-auto">
            {steps.map((step) => (
              <div
                key={step.id}
                className="rounded-lg border border-room-border bg-room-elevated/30 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-trace">{step.agentShort}</span>
                  <span className="text-[10px] uppercase text-room-muted">{step.headline}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-foreground">
                  {dialogueSummary(step, 120)}
                </p>
                {step.subline ? (
                  <p className="mt-1 text-xs text-room-muted">{step.subline}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    );
  }

  if (section === "reports") {
    if (run?.status === "complete" && report.finding !== "Investigation incomplete") {
      return (
        <IncidentReportHero
          report={report}
          bandRoomUrl={bandRoomUrl(run.realityCollision?.investigationRoomId ?? run.roomId)}
          incidentId={incidentId}
          pdfBrief={run.earnedInvestigation?.pdfBrief}
        />
      );
    }

    return (
      <Panel title="Investigation report">
        <p className="text-sm text-room-muted">
          No completed report yet. Run an investigation from Theories — the audit memo appears
          here when agents finish.
        </p>
      </Panel>
    );
  }

  return null;
}
