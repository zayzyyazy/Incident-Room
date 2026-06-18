import {
  buildCallFinding,
  callOutcomeLabel,
} from "@/lib/investigation/call-finding";
import { IncidentReportView } from "@/lib/demo/investigation-verdict-view";
import { VerdictOutcome } from "@/lib/investigation/events";
import {
  agentOutcomeTurn,
  buildFixRecommendation,
  customerBeliefNarrative,
  formatToolFailure,
  primaryFailedTool,
  resolveFixSurface,
} from "@/lib/investigation/evidence-analysis";
import { AGENT_MODELS, completeJson } from "@/lib/llm/router";
import {
  buildEvidencePool,
  defaultCitationSignificance,
} from "@/lib/report/evidence-pool";
import { EvidencePoolItem, IncidentPdfBrief } from "@/lib/report/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { InvestigationRun } from "@/lib/incidents/types";
import { z } from "zod";

export const PDF_BRIEF_REVISION = 4;

function verdictStatement(evidence: VoiceIncidentEvidence): string {
  const finding = buildCallFinding(evidence);
  return `${callOutcomeLabel(finding.call_outcome)} — ${finding.headline}`;
}

function isBlankField(value?: string): boolean {
  const trimmed = value?.trim();
  return !trimmed || trimmed === "-" || trimmed === "—";
}

export function buildPdfBriefDeterministic(input: {
  evidence: VoiceIncidentEvidence;
  report: IncidentReportView;
  verdict: VerdictOutcome;
  pool: EvidencePoolItem[];
  run?: InvestigationRun | null;
}): IncidentPdfBrief {
  const primary = primaryFailedTool(input.evidence);
  const agentTurn = agentOutcomeTurn(input.evidence);
  const fix = buildFixRecommendation(input.evidence, primary);
  const surface = resolveFixSurface(
    input.evidence.incident_id,
    primary?.name,
  );

  const primaryPool = input.pool.find((p) => p.label?.includes("Primary"));
  const failedDesc = primary
    ? formatToolFailure(primary)
    : primaryPool
      ? `${primaryPool.ref}: "${primaryPool.quote}"`
      : "no successful backend mutation recorded";

  const agentSaid = agentTurn
    ? `"${agentTurn.text}" (${agentTurn.turn_id})`
    : input.report.systemReality;

  const customerBelief = customerBeliefNarrative(input.evidence);

  const citations = input.pool
    .filter((p) => p.kind !== "investigation_beat" || input.run?.earnedInvestigation)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      ref: p.ref,
      quote: p.quote,
      significance: defaultCitationSignificance(p),
    }));

  const beats =
    input.run?.earnedInvestigation?.feedTimeline
      ?.filter((e) =>
        [
          "TheoryProposed",
          "TheorySupported",
          "TheoryChallenged",
          "ConfidenceChanged",
          "TheoryWithdrawn",
          "TheoryAccepted",
          "VerdictIssued",
        ].includes(String(e.payload?.type)),
      )
      .map((e) => e.content ?? String(e.payload?.line ?? ""))
      .filter(Boolean) ?? [];

  const investigation_note =
    beats.length > 0
      ? beats.slice(0, 4).join(" ")
      : "Specialists contested conversation vs execution theories; confidence shifted after agent promise language; surviving theory accepted before verdict.";

  const callFinding = buildCallFinding(input.evidence);

  const executive_summary = [
    `On ${input.evidence.source_platform} call ${input.evidence.incident_id},`,
    callFinding.headline + ".",
    callFinding.execution_break,
    surface.workflow_surface ? `Fix surface: ${surface.workflow_surface}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const the_gap = callFinding.what_happened;

  return {
    revision: PDF_BRIEF_REVISION,
    executive_summary,
    verdict_statement: verdictStatement(input.evidence),
    what_customer_believed: customerBelief,
    what_agent_communicated: agentSaid,
    what_backend_did: failedDesc,
    the_gap,
    evidence_citations:
      citations.length >= 2
        ? citations
        : input.pool.slice(0, 6).map((p) => ({
            id: p.id,
            kind: p.kind,
            ref: p.ref,
            quote: p.quote,
            significance: defaultCitationSignificance(p),
          })),
    rejected_theory: input.report.failedTheories[0] ?? {
      label: "execution_failure_alone",
      reason:
        "Failed execution explains system state but not customer belief.",
    },
    surviving_explanation: isBlankField(input.report.survivingExplanation)
      ? the_gap
      : input.report.survivingExplanation,
    fix_target: isBlankField(input.report.fixTarget)
      ? fix.fix_target
      : input.report.fixTarget,
    fix_detail: isBlankField(input.report.fixDetail)
      ? fix.fix_detail
      : (input.report.fixDetail ?? fix.fix_detail),
    workflow_surface: surface.workflow_surface,
    workflow_binding: surface.workflow_binding,
    investigation_note,
  };
}

/** @deprecated alias */
export const buildPdfBriefFallback = buildPdfBriefDeterministic;

export function briefIsTrustworthy(brief?: IncidentPdfBrief | null): boolean {
  if (!brief) return false;
  if ((brief.revision ?? 0) < PDF_BRIEF_REVISION) return false;
  if (isBlankField(brief.fix_target)) return false;
  if (isBlankField(brief.surviving_explanation)) return false;
  if (isBlankField(brief.verdict_statement)) return false;
  if ((brief.evidence_citations?.length ?? 0) < 2) return false;
  return true;
}

const ExecutiveSummaryOnlySchema = z.object({
  executive_summary: z.string().min(40).max(600),
});

export async function runReportSynthesizer(input: {
  evidence: VoiceIncidentEvidence;
  report: IncidentReportView;
  verdict: VerdictOutcome;
  run?: InvestigationRun | null;
}): Promise<IncidentPdfBrief> {
  const pool = buildEvidencePool(input.evidence, input.run);
  const brief = buildPdfBriefDeterministic({
    evidence: input.evidence,
    report: input.report,
    verdict: input.verdict,
    pool,
    run: input.run,
  });

  if (!process.env.AIMLAPI_KEY && !process.env.FEATHERLESS_API_KEY) {
    return brief;
  }

  try {
    const primary = AGENT_MODELS.reportSynthesizer;
    const { executive_summary } = await completeJson(ExecutiveSummaryOnlySchema, {
      provider: primary.provider,
      model: primary.model,
      messages: [
        {
          role: "system",
          content:
            "Write ONLY a 2-3 sentence executive_summary for an incident audit memo. Do not change verdict, tool names, or quotes. Return JSON: { executive_summary }.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              incident_id: input.evidence.incident_id,
              verdict: input.verdict,
              primary_failure: primaryFailedTool(input.evidence)?.name,
              the_gap: brief.the_gap,
              fix_target: brief.fix_target,
            },
            null,
            2,
          ),
        },
      ],
    });
    if (!isBlankField(executive_summary)) {
      return { ...brief, executive_summary };
    }
  } catch {
    // deterministic brief is authoritative
  }

  return brief;
}
