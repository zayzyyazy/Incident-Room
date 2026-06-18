"use client";

import { useEffect, useState } from "react";
import { EvidenceCitation, IncidentPdfBrief } from "@/lib/report/types";

function citationLabel(c: EvidenceCitation): string {
  if (c.kind === "transcript") return `transcript · ${c.ref}`;
  if (c.kind === "tool_call") return `tool · ${c.ref}`;
  if (c.kind === "side_effect") return `side effect`;
  return `investigation · ${c.ref}`;
}

function kindAccent(kind: EvidenceCitation["kind"]): string {
  if (kind === "transcript") return "text-trace border-trace/30 bg-trace/5";
  if (kind === "tool_call") return "text-signal border-signal/30 bg-signal/5";
  if (kind === "side_effect") return "text-alert border-alert/30 bg-alert/5";
  return "text-command border-command/30 bg-command/5";
}

export function EvidenceCitationPreview({
  brief,
  pdfUrl,
  loading,
}: {
  brief?: IncidentPdfBrief | null;
  pdfUrl?: string;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="border-b border-room-border/60 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-room-muted">
          Evidence citations
        </p>
        <p className="mt-2 text-sm text-room-muted animate-pulse">Loading audit citations…</p>
      </div>
    );
  }

  if (!brief?.evidence_citations?.length) return null;

  const visible = expanded
    ? brief.evidence_citations
    : brief.evidence_citations.slice(0, 3);
  const hiddenCount = brief.evidence_citations.length - visible.length;

  return (
    <div className="border-b border-room-border/60 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-room-muted">
            Evidence citations
          </p>
          <p className="mt-1 text-xs text-room-muted">
            Same quotes as the PDF — sanity-check before download.
          </p>
        </div>
        {brief.the_gap ? (
          <p className="max-w-md text-right text-xs leading-relaxed text-room-muted">
            {brief.the_gap.length > 140
              ? `${brief.the_gap.slice(0, 137)}…`
              : brief.the_gap}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 space-y-3">
        {visible.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-room-border/80 bg-room-elevated/50 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-foreground">
                [{c.id}]
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kindAccent(c.kind)}`}
              >
                {citationLabel(c)}
              </span>
            </div>
            <p className="mt-2 font-mono text-sm leading-snug text-foreground">
              &ldquo;{c.quote.length > 220 ? `${c.quote.slice(0, 217)}…` : c.quote}&rdquo;
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-room-muted">
              {c.significance}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {hiddenCount > 0 && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-trace hover:underline"
          >
            +{hiddenCount} more in PDF
          </button>
        ) : expanded && brief.evidence_citations.length > 3 ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-medium text-room-muted hover:text-foreground"
          >
            Show fewer
          </button>
        ) : null}
        {pdfUrl ? (
          <a
            href={pdfUrl}
            className="text-xs font-medium text-room-muted hover:text-trace"
          >
            Download full memo ↓
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function useReportBrief(
  incidentId?: string,
  initialBrief?: IncidentPdfBrief | null,
) {
  const [brief, setBrief] = useState<IncidentPdfBrief | null | undefined>(
    initialBrief,
  );
  const [loading, setLoading] = useState(Boolean(incidentId && !initialBrief));

  useEffect(() => {
    if (initialBrief) {
      setBrief(initialBrief);
      setLoading(false);
      return;
    }
    if (!incidentId) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/incidents/${incidentId}/report-brief`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setBrief(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBrief(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [incidentId, initialBrief]);

  return { brief, loading };
}
