"use client";

import { ReactNode } from "react";
import { IncidentReportView } from "@/lib/demo/investigation-verdict-view";
import { IncidentPdfBrief } from "@/lib/report/types";
import {
  EvidenceCitationPreview,
  useReportBrief,
} from "@/components/demo/EvidenceCitationPreview";

function ReportRow({
  label,
  children,
  highlight,
}: {
  label: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 border-b border-room-border/60 px-6 py-5 sm:grid-cols-[180px_1fr] ${
        highlight ? "bg-signal/[0.04]" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-room-muted">
        {label}
      </p>
      <div className="text-[15px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

export function IncidentReportHero({
  report,
  bandRoomUrl,
  incidentId,
  pdfBrief: pdfBriefProp,
}: {
  report: IncidentReportView;
  bandRoomUrl?: string;
  incidentId?: string;
  pdfBrief?: IncidentPdfBrief | null;
}) {
  const pdfUrl = incidentId ? `/api/incidents/${incidentId}/report.pdf` : undefined;
  const { brief, loading } = useReportBrief(incidentId, pdfBriefProp);

  return (
    <article className="overflow-hidden rounded-xl border border-room-border bg-room-panel">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-room-border px-6 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-room-muted">
            Investigation report
          </p>
          {incidentId ? (
            <p className="mt-1 font-mono text-xs text-room-muted">{incidentId}</p>
          ) : null}
        </div>
        <span className="rounded-md border border-trace/50 bg-trace/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-trace">
          ✓ Investigation complete
        </span>
        {pdfUrl ? (
          <a
            href={pdfUrl}
            className="rounded-md border border-room-border bg-room-elevated px-3 py-1.5 text-[11px] font-semibold text-foreground hover:border-trace/40 hover:text-trace"
          >
            Download PDF ↓
          </a>
        ) : null}
        <div className="w-full text-right text-xs text-room-muted sm:w-auto">
          <p>Completed · Audit Systems</p>
        </div>
      </header>

      <div className="border-b border-room-border bg-room-elevated/40 px-6 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-room-muted">
          Call outcome
        </p>
        <p className="mt-2 text-2xl font-semibold leading-snug text-foreground">
          {report.finding}
        </p>
      </div>

      <ReportRow label="Customer impact">{report.customerImpact}</ReportRow>
      <ReportRow label="System reality">{report.systemReality}</ReportRow>

      {report.causeRoomFinding ? (
        <ReportRow label="Cause Room finding">{report.causeRoomFinding}</ReportRow>
      ) : null}

      {report.architectureRoomFinding ? (
        <ReportRow label="Architecture Room finding">
          {report.architectureRoomFinding}
        </ReportRow>
      ) : null}

      {report.reconciliation ? (
        <ReportRow label="Reconciliation">{report.reconciliation}</ReportRow>
      ) : null}

      {report.failedTheories.length > 0 ? (
        <ReportRow label="Failed theories">
          <ul className="space-y-2">
            {report.failedTheories.map((t) => (
              <li key={t.label} className="text-sm">
                <span className="font-medium">{t.label}</span>
                <span className="text-room-muted"> — {t.reason}</span>
              </li>
            ))}
          </ul>
        </ReportRow>
      ) : null}

      <ReportRow label="Surviving explanation">{report.survivingExplanation}</ReportRow>

      <EvidenceCitationPreview brief={brief} pdfUrl={pdfUrl} loading={loading} />

      <ReportRow label="What to do next" highlight>
        <p className="font-semibold">{report.fixTarget}</p>
        {brief?.workflow_surface ? (
          <p className="mt-1.5 text-sm text-signal">
            Workflow surface: {brief.workflow_surface}
            {brief.workflow_binding ? ` · ${brief.workflow_binding}` : ""}
          </p>
        ) : null}
        {report.fixDetail ? (
          <p className="mt-1.5 text-sm text-room-muted">{report.fixDetail}</p>
        ) : brief?.fix_detail ? (
          <p className="mt-1.5 text-sm text-room-muted">{brief.fix_detail}</p>
        ) : null}
      </ReportRow>

      {bandRoomUrl ? (
        <footer className="border-t border-room-border px-6 py-4">
          <a
            href={bandRoomUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between text-sm text-room-muted hover:text-trace"
          >
            <span>Show evidence trail</span>
            <span>▾</span>
          </a>
        </footer>
      ) : null}
    </article>
  );
}
