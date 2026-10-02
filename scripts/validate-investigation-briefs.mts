import { readFileSync } from "fs";
import { VoiceIncidentEvidenceSchema } from "../src/lib/evidence/types";
import {
  buildEarnedIncidentReport,
  buildEarnedScriptForEvidence,
} from "../src/lib/investigation/build-earned-script";
import { buildCallFinding, callOutcomeLabel } from "../src/lib/investigation/call-finding";
import { computeVerdict } from "../src/lib/investigation/evidence-analysis";
import { normalizeImportedEvidence } from "../src/lib/normalizer/import-evidence";
import { buildPdfBriefDeterministic } from "../src/lib/agents/report-synthesizer";
import { buildEvidencePool } from "../src/lib/report/evidence-pool";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function checkIncident(label: string, evidence: ReturnType<typeof VoiceIncidentEvidenceSchema.parse>) {
  const script = buildEarnedScriptForEvidence(evidence);
  assert(script.length >= 10, `${label}: expected contested arc (>=10 beats), got ${script.length}`);
  const verdict = script.find((b) => b.kind === "VerdictIssued")?.verdict;
  assert(verdict, `${label}: missing verdict beat`);
  const report = buildEarnedIncidentReport({ evidence, verdict, script });
  const pool = buildEvidencePool(evidence);
  const brief = buildPdfBriefDeterministic({
    evidence,
    report: {
      finding: report.finding,
      customerImpact: report.customer_impact,
      systemReality: report.system_reality,
      failedTheories: report.failed_theories,
      survivingExplanation: report.surviving_explanation,
      fixTarget: report.fix_target,
      fixDetail: report.fix_detail,
    },
    verdict,
    pool,
  });

  assert(brief.fix_target && brief.fix_target !== "-", `${label}: empty fix_target`);
  const callFinding = buildCallFinding(evidence);
  assert(
    brief.verdict_statement.includes(callFinding.headline) ||
      brief.verdict_statement.includes(callOutcomeLabel(callFinding.call_outcome)),
    `${label}: call outcome drift`,
  );
  assert(pool.some((p) => p.label?.includes("Primary")), `${label}: missing primary failure`);
  assert(brief.evidence_citations.length >= 3, `${label}: too few citations`);
  assert(computeVerdict(evidence).verdict === verdict, `${label}: verdict mismatch`);
  if (verdict === "NOT_JUSTIFIED") {
    assert(
      script.some((b) => b.kind === "ConfidenceChanged"),
      `${label}: missing confidence shift`,
    );
    assert(
      script.some((b) => b.kind === "TheoryAccepted"),
      `${label}: missing accepted theory`,
    );
  }

  console.log(
    `ok ${label} · ${verdict} · beats=${script.length} · primary=${pool.find((p) => p.label?.includes("Primary"))?.ref}`,
  );
}

const klaus = VoiceIncidentEvidenceSchema.parse(
  JSON.parse(readFileSync("fixtures/hero-klaus-minimal.json", "utf8")),
);
checkIncident("klaus", klaus);

const retell = normalizeImportedEvidence(
  JSON.parse(readFileSync("fixtures/imports/raw-retell-appointment-gap.json", "utf8")),
).evidence;
checkIncident("retell", retell);

console.log("validate-briefs: all passed");
