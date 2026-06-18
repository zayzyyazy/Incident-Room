import { buildIncidentReportView } from "@/lib/demo/investigation-verdict-view";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { VerdictOutcome } from "@/lib/investigation/events";
import { InvestigationRun } from "@/lib/incidents/types";
import { runReportSynthesizer, briefIsTrustworthy } from "@/lib/agents/report-synthesizer";
import { computeVerdict } from "@/lib/investigation/evidence-analysis";
import { IncidentPdfBrief } from "@/lib/report/types";

export async function buildPdfBriefForInvestigation(input: {
  evidence: VoiceIncidentEvidence;
  run?: InvestigationRun | null;
}): Promise<IncidentPdfBrief> {
  const run = input.run;
  const cached = run?.earnedInvestigation?.pdfBrief;
  if (briefIsTrustworthy(cached)) return cached!;

  const report = buildIncidentReportView(input.evidence, run);
  const verdict: VerdictOutcome =
    run?.earnedInvestigation?.verdict ??
    computeVerdict(input.evidence).verdict;

  return runReportSynthesizer({
    evidence: input.evidence,
    report,
    verdict,
    run,
  });
}
