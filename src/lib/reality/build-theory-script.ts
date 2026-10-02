import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  buildIncidentReportFromScript,
  buildRedeliveryTheoryScript,
  TheoryScriptBeat,
} from "@/lib/reality/theory-script";
import { IncidentReport } from "@/lib/reality/types";

function agentPromiseSegment(evidence: VoiceIncidentEvidence): string {
  const seg = [...evidence.layer1_conversation.segments]
    .reverse()
    .find(
      (s) =>
        s.speaker === "agent" &&
        /bestätigt|confirmed|veranlasst|arranged|morgen|tomorrow|SMS|cancelled/i.test(
          s.text,
        ),
    );
  return seg?.text ?? "Agent used success language without verification.";
}

function failedRedeliveryTool(evidence: VoiceIncidentEvidence) {
  return evidence.layer2_execution.function_calls.find(
    (c) => c.name === "schedule_redelivery" && c.status === "error",
  );
}

export function buildTheoryScriptForEvidence(
  evidence: VoiceIncidentEvidence,
): { script: TheoryScriptBeat[]; report: IncidentReport } {
  const tool = failedRedeliveryTool(evidence);
  const failedTool = tool?.name ?? "schedule_redelivery";
  const http = tool?.http_status;
  const failureDetail = http ? `returned ${http}` : "failed with no result";

  const quote = agentPromiseSegment(evidence);
  const beliefSummary =
    evidence.incident_id.startsWith("LEAP") || quote.includes("bestätigt")
      ? "Customer was told redelivery is confirmed for tomorrow."
      : "Customer was told redelivery is confirmed for tomorrow.";

  const script = buildRedeliveryTheoryScript({
    failedTool,
    failureDetail,
    customerQuote: quote,
    beliefSummary,
  });

  const customerImpact =
    evidence.incident_id.startsWith("LEAP")
      ? "Customer believed redelivery was confirmed for tomorrow."
      : "Customer believed redelivery was confirmed for tomorrow.";

  const report = buildIncidentReportFromScript(script, {
    customerImpact,
    systemReality: "No verified redelivery was created.",
    failedTool,
  });

  return { script, report };
}
