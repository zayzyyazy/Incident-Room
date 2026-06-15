"use client";

import { ReactNode } from "react";
import { IncidentReportView } from "@/lib/demo/investigation-verdict-view";

function ReportSection({
  label,
  children,
  accent,
}: {
  label: string;
  children: ReactNode;
  accent?: "signal" | "default";
}) {
  return (
    <section
      className={
        accent === "signal"
          ? "border-t border-signal/20 bg-signal/[0.04] px-6 py-4"
          : "px-6 py-4"
      }
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
          accent === "signal" ? "text-signal" : "text-room-muted"
        }`}
      >
        {label}
      </p>
      <div className="mt-2 text-base leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

export function IncidentReportHero({
  report,
  bandRoomUrl,
}: {
  report: IncidentReportView;
  bandRoomUrl?: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-room-border bg-room-panel">
      <header className="border-b border-room-border px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-room-muted">
          Incident finding
        </p>
        <p className="mt-2 text-xl font-semibold leading-snug text-foreground sm:text-2xl">
          {report.finding}
        </p>
      </header>

      <div className="divide-y divide-room-border">
        <ReportSection label="Customer impact">{report.customerImpact}</ReportSection>
        <ReportSection label="System reality">{report.systemReality}</ReportSection>

        {report.causeRoomFinding ? (
          <ReportSection label="Cause Room finding">
            {report.causeRoomFinding}
          </ReportSection>
        ) : null}

        {report.architectureRoomFinding ? (
          <ReportSection label="Architecture Room finding">
            {report.architectureRoomFinding}
          </ReportSection>
        ) : null}

        {report.reconciliation ? (
          <ReportSection label="Reconciliation">{report.reconciliation}</ReportSection>
        ) : null}

        {report.failedTheories.length > 0 ? (
          <ReportSection label="Failed theories">
            <ul className="space-y-2">
              {report.failedTheories.map((t) => (
                <li key={t.label} className="text-sm leading-relaxed">
                  <span className="font-medium text-foreground">{t.label}</span>
                  <span className="text-room-muted"> — {t.reason}</span>
                </li>
              ))}
            </ul>
          </ReportSection>
        ) : null}

        <ReportSection label="Surviving explanation">
          {report.survivingExplanation}
        </ReportSection>

        <ReportSection label="Fix target" accent="signal">
          <p className="font-medium">{report.fixTarget}</p>
          {report.fixDetail ? (
            <p className="mt-1 text-sm text-room-muted">{report.fixDetail}</p>
          ) : null}
        </ReportSection>
      </div>

      {bandRoomUrl ? (
        <footer className="border-t border-room-border px-6 py-3">
          <a
            href={bandRoomUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-trace underline-offset-2 hover:underline"
          >
            Band · Evidence trail
          </a>
        </footer>
      ) : null}
    </article>
  );
}
