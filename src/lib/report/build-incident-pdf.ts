import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { IncidentPdfBrief } from "@/lib/report/types";

/** Standard PDF fonts only support WinAnsi; strip/replace common Unicode from exports. */
function pdfSafe(text: string): string {
  return text
    .replace(/\u2192/g, "->")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, max = 86): string[] {
  const normalized = pdfSafe(text).replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const lines: string[] = [];
  let line = "";

  for (const word of normalized.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function citationHeader(c: IncidentPdfBrief["evidence_citations"][number]): string {
  if (c.kind === "transcript") {
    return `[${c.id}] transcript · ${c.ref}`;
  }
  if (c.kind === "tool_call") {
    return `[${c.id}] tool · ${c.ref}`;
  }
  if (c.kind === "side_effect") {
    return `[${c.id}] side effect · ${c.ref}`;
  }
  return `[${c.id}] investigation · ${c.ref}`;
}

export async function buildIncidentPdf(input: {
  evidence: VoiceIncidentEvidence;
  brief: IncidentPdfBrief;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 13;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(lines = 1) {
    if (y - lines * lineHeight < margin + 24) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawWrapped(
    text: string,
    opts?: {
      bold?: boolean;
      mono?: boolean;
      size?: number;
      gap?: number;
      indent?: number;
      color?: ReturnType<typeof rgb>;
    },
  ) {
    const size = opts?.size ?? 10;
    const gap = opts?.gap ?? lineHeight;
    const indent = opts?.indent ?? 0;
    const chosen = opts?.mono ? mono : opts?.bold ? bold : font;
    const color = opts?.color ?? rgb(0.08, 0.09, 0.11);

    for (const line of wrap(text)) {
      ensureSpace();
      page.drawText(line, {
        x: margin + indent,
        y,
        size,
        font: chosen,
        color,
        maxWidth: contentWidth - indent,
      });
      y -= gap;
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(3);
    y -= 4;
    drawWrapped(title, { bold: true, size: 9, gap: 15, color: rgb(0.35, 0.38, 0.42) });
  }

  function sectionBody(body: string, indent = 0) {
    drawWrapped(body, { size: 10, gap: lineHeight, indent });
    y -= 4;
  }

  const importMeta = input.evidence.layer3_customer?._import as
    | { platform_detected?: string; normalized_at?: string }
    | undefined;

  drawWrapped("INCIDENT ROOM — AUDIT MEMO", { bold: true, size: 15, gap: 18 });
  drawWrapped(
    `${input.evidence.incident_id} · ${input.evidence.source_platform.toUpperCase()}`,
    { size: 10, gap: 12 },
  );
  drawWrapped(input.evidence.title, { size: 10, gap: 10 });
  if (importMeta?.platform_detected) {
    drawWrapped(
      `Evidence imported from ${importMeta.platform_detected} export · normalized ${importMeta.normalized_at?.slice(0, 10) ?? "—"}`,
      { size: 8, gap: 16, color: rgb(0.45, 0.47, 0.5) },
    );
  } else {
    y -= 6;
  }

  sectionTitle("EXECUTIVE SUMMARY");
  sectionBody(input.brief.executive_summary);

  sectionTitle("CALL OUTCOME");
  sectionBody(input.brief.verdict_statement);

  sectionTitle("WHAT HAPPENED");
  sectionBody(input.brief.the_gap);

  sectionTitle("WHAT THE CUSTOMER BELIEVED");
  sectionBody(input.brief.what_customer_believed);

  sectionTitle("WHAT THE AGENT COMMUNICATED");
  sectionBody(input.brief.what_agent_communicated);

  sectionTitle("WHAT THE BACKEND DID");
  sectionBody(input.brief.what_backend_did);

  sectionTitle("EVIDENCE (CITED)");
  for (const citation of input.brief.evidence_citations) {
    ensureSpace(5);
    drawWrapped(citationHeader(citation), { bold: true, size: 9, gap: 13 });
    drawWrapped(`"${citation.quote}"`, { mono: true, size: 9, gap: 12, indent: 8 });
    drawWrapped(`-> ${citation.significance}`, {
      size: 9,
      gap: 14,
      indent: 8,
      color: rgb(0.28, 0.3, 0.34),
    });
  }

  sectionTitle("INVESTIGATION");
  sectionBody(
    `Rejected theory: ${input.brief.rejected_theory.label} — ${input.brief.rejected_theory.reason}`,
  );
  sectionBody(input.brief.surviving_explanation);
  if (input.brief.investigation_note) {
    sectionBody(input.brief.investigation_note);
  }

  sectionTitle("FIX TARGET");
  sectionBody(input.brief.fix_target);
  if (input.brief.workflow_surface) {
    sectionBody(`Workflow surface: ${input.brief.workflow_surface}`);
  }
  if (input.brief.workflow_binding) {
    sectionBody(`Tool binding: ${input.brief.workflow_binding}`);
  }
  if (input.brief.fix_detail) {
    sectionBody(input.brief.fix_detail);
  }

  y -= 6;
  drawWrapped(
    `Generated ${new Date().toISOString().slice(0, 19)}Z · Incident Room Report Synthesizer`,
    { size: 8, gap: 10, color: rgb(0.5, 0.52, 0.55) },
  );

  return doc.save();
}
