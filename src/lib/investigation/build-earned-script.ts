import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { FROZEN_DEMO_PATHS, resolveFrozenDemoPath } from "@/lib/cross-room/incident-profile";
import {
  EarnedInvestigationRoom,
  InvestigationEventKind,
  VerdictOutcome,
} from "@/lib/investigation/events";
import {
  agentOutcomeTurn,
  buildFixRecommendation,
  computeVerdict,
  customerAckTurn,
  customerBeliefNarrative,
  customerIntentTurn,
  formatToolFailure,
  listFailedTools,
  primaryFailedTool,
  resolveFixSurface,
} from "@/lib/investigation/evidence-analysis";
import { buildCallFinding } from "@/lib/investigation/call-finding";

export type EarnedScriptBeat = {
  kind: InvestigationEventKind;
  room: EarnedInvestigationRoom;
  agentRole: string;
  agentId: string;
  line: string;
  recruit?: string;
  theory?: string;
  verdict?: VerdictOutcome;
  confidenceBefore?: string;
  confidenceAfter?: string;
  withdrawReason?: string;
  hero?: boolean;
};

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function packetCounts(evidence: VoiceIncidentEvidence) {
  const turns = evidence.layer1_conversation.segments.length;
  const tools = evidence.layer2_execution.function_calls.length;
  const defs = evidence.layer2_execution.function_calls.length > 0 ? 1 : 0;
  return { turns, tools, defs };
}

function survivingTheoryId(evidence: VoiceIncidentEvidence): string {
  const path = resolveFrozenDemoPath(evidence.incident_id);
  if (path === "klaus") return FROZEN_DEMO_PATHS.klaus.cause_class;
  if (path === "marta") return FROZEN_DEMO_PATHS.marta.revised_cause_class;
  return "premature_confirmation_after_failed_execution";
}

/**
 * Earned investigation screenplay — evidence revealed in stages, theories fight,
 * confidence moves, opinions change before verdict.
 */
export function buildEarnedScriptForEvidence(
  evidence: VoiceIncidentEvidence,
): EarnedScriptBeat[] {
  const { verdict, failures, agentLine } = computeVerdict(evidence);
  const callFinding = buildCallFinding(evidence);
  if (verdict === "INSUFFICIENT_EVIDENCE" && failures.length === 0) {
    return buildInsufficientScript(evidence);
  }
  return buildContestedScript(evidence, verdict, failures, agentLine, callFinding);
}

function buildInsufficientScript(evidence: VoiceIncidentEvidence): EarnedScriptBeat[] {
  const counts = packetCounts(evidence);
  return [
    {
      kind: "InvestigationOpened",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: `Case ${evidence.incident_id} — trust unknown. Specialists must contest evidence before any verdict.`,
    },
    {
      kind: "SpecialistRecruited",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Routing must happen before interpretation.",
      recruit: "normalizer",
    },
    {
      kind: "EvidenceReturned",
      room: "normalizer",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: `Packets routed: ${counts.turns} transcript turns · ${counts.tools} tool calls. No interpretation.`,
    },
    {
      kind: "TheoryProposed",
      room: "explanation",
      agentRole: "communication_investigator",
      agentId: "communication_investigator",
      line: "Transcript alone does not show a trust violation. Proposing insufficient_evidence.",
      theory: "insufficient_evidence",
    },
    {
      kind: "VerdictIssued",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "INSUFFICIENT EVIDENCE — cannot trust or reject the outcome yet.",
      verdict: "INSUFFICIENT_EVIDENCE",
      hero: true,
    },
    {
      kind: "ExplanationIssued",
      room: "explanation",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "No failed mutation and no premature success language strong enough to reject the call outcome.",
    },
    {
      kind: "FixTargetIssued",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Collect richer tool trace or customer confirmation before closing incidents like this.",
    },
  ];
}

function buildContestedScript(
  evidence: VoiceIncidentEvidence,
  verdict: VerdictOutcome,
  failures: ReturnType<typeof listFailedTools>,
  agentLine: string,
  callFinding: ReturnType<typeof buildCallFinding>,
): EarnedScriptBeat[] {
  const primary = primaryFailedTool(evidence) ?? failures[0];
  const failedToolName = primary?.name ?? "backing_mutation_tool";
  const failureDetail = primary
    ? formatToolFailure(primary).replace(`${failedToolName} → `, "")
    : "failed with no side effect";
  const counts = packetCounts(evidence);
  const intent = customerIntentTurn(evidence);
  const agentTurn = agentOutcomeTurn(evidence);
  const ack = agentTurn ? customerAckTurn(evidence, agentTurn.turn_id) : undefined;
  const surface = resolveFixSurface(evidence.incident_id, failedToolName);
  const surviving = survivingTheoryId(evidence);
  const belief = customerBeliefNarrative(evidence);
  const { fix_target, fix_detail } = buildFixRecommendation(evidence, primary);

  const successTool = evidence.layer2_execution.function_calls.find(
    (c) => c.status === "success",
  );

  const beats: EarnedScriptBeat[] = [
    {
      kind: "InvestigationOpened",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: `Case ${evidence.incident_id} (${evidence.source_platform}) — verdict withheld until specialists contest the evidence.`,
    },
    {
      kind: "SpecialistRecruited",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Evidence must be split before anyone interprets the call.",
      recruit: "normalizer",
    },
    {
      kind: "EvidenceRequested",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Requesting transcript_packet and tool_trace_packet. No verdict yet.",
    },
    {
      kind: "EvidenceReturned",
      room: "normalizer",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: `Routed ${counts.turns} transcript turns · ${counts.tools} tool calls · definition slice. **No interpretation performed.**`,
      hero: true,
    },
    {
      kind: "SpecialistRecruited",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Conversation read is not execution proof. Recruiting communication specialist.",
      recruit: "communication_investigator",
    },
    {
      kind: "TheoryProposed",
      room: "explanation",
      agentRole: "communication_investigator",
      agentId: "communication_investigator",
      line: intent
        ? `From transcript only: customer stated intent at ${intent.turn_id}. Tone cooperative. **Theory: conversation_resolved.**`
        : "Transcript reads cooperative. **Theory: conversation_resolved.**",
      theory: "conversation_resolved",
      confidenceAfter: "high (74%)",
    },
    {
      kind: "SpecialistRecruited",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Transcript theories cannot close without execution packet.",
      recruit: "execution_investigator",
    },
    {
      kind: "RoomChallenge",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Rejecting early close on conversation_resolved. Tool trace not opened for mutation tools.",
      theory: "conversation_resolved",
      hero: true,
    },
    {
      kind: "SpecialistRecruited",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: "Premature customer closure is a policy question — recruiting policy investigator.",
      recruit: "policy_investigator",
    },
    {
      kind: "TheoryProposed",
      room: "explanation",
      agentRole: "policy_investigator",
      agentId: "policy_investigator",
      line: `Agent must not confirm ${failedToolName} success before tool returns OK. **Policy flag: premature_closure.**`,
      theory: "premature_closure_policy",
      confidenceAfter: "medium (62%)",
    },
    {
      kind: "EvidenceRequested",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: `Execution specialist requests tool_trace for ${failedToolName} — partial delivery first.`,
    },
    {
      kind: "EvidenceReturned",
      room: "normalizer",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: successTool
        ? `Partial trace: ${successTool.name} succeeded. **${failedToolName} outcome still unverified.**`
        : `Partial trace delivered. **${failedToolName} outcome still unverified.**`,
    },
    {
      kind: "TheoryProposed",
      room: "explanation",
      agentRole: "execution_investigator",
      agentId: "execution_investigator",
      line: `I see a likely execution break at ${failedToolName} but I am **withholding** execution_failure until the full trace returns.`,
      theory: "execution_failure",
      confidenceAfter: "medium (48%)",
    },
    {
      kind: "EvidenceReturned",
      room: "normalizer",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: `Full trace: ${failedToolName} ${failureDetail}. Side effects do not confirm the promised outcome.`,
      hero: true,
    },
    {
      kind: "TheorySupported",
      room: "explanation",
      agentRole: "execution_investigator",
      agentId: "execution_investigator",
      line: `execution_failure **now supported** on ${failedToolName}. appointment_created=${String(evidence.layer2_execution.side_effects.appointment_created)}.`,
      theory: "execution_failure",
      confidenceBefore: "medium (48%)",
      confidenceAfter: "high (81%)",
      hero: true,
    },
    {
      kind: "TheoryChallenged",
      room: "explanation",
      agentRole: "communication_investigator",
      agentId: "communication_investigator",
      line: `execution_failure is **incomplete**. It explains the backend but not why the customer would believe success. Agent at ${agentTurn?.turn_id ?? "—"}: "${clip(agentLine, 100)}"`,
      theory: "execution_failure",
      hero: true,
    },
    {
      kind: "ConfidenceChanged",
      room: "explanation",
      agentRole: "communication_investigator",
      agentId: "communication_investigator",
      line: "Updating conversation_resolved after seeing agent promise language.",
      theory: "conversation_resolved",
      confidenceBefore: "high (74%)",
      confidenceAfter: "low (22%)",
      hero: true,
    },
    {
      kind: "TheoryChallenged",
      room: "explanation",
      agentRole: "communication_investigator",
      agentId: "communication_investigator",
      line: ack
        ? `Customer ${ack.turn_id} ("${clip(ack.text, 60)}") reads as acceptance **after** premature agent assurance — not independent proof of backend success.`
        : "Customer acknowledgement follows agent assurance — not independent proof of backend success.",
      theory: "execution_failure",
    },
  ];

  if (surface.workflow_surface || surface.workflow_binding) {
    beats.push(
      {
        kind: "SpecialistRecruited",
        room: "verdict",
        agentRole: "incident_room",
        agentId: "incident_room",
        line: "Need workflow context before fix target. Recruiting workflow investigator.",
        recruit: "workflow_investigator",
      },
      {
        kind: "TheoryRefined",
        room: "explanation",
        agentRole: "workflow_investigator",
        agentId: "workflow_investigator",
        line: surface.workflow_binding
          ? `Refining to ${surviving.replace(/_/g, " ")} at **${surface.workflow_surface}** (${surface.workflow_binding}).`
          : `Refining to ${surviving.replace(/_/g, " ")} at **${surface.workflow_surface}**.`,
        theory: surviving,
        hero: true,
      },
    );
  }

  beats.push(
    {
      kind: "TheoryWithdrawn",
      room: "explanation",
      agentRole: "execution_investigator",
      agentId: "execution_investigator",
      line: "Withdrawing **execution_failure_alone** — accurate on tools, blind to customer belief.",
      theory: "execution_failure",
      withdrawReason:
        "Failed execution explains system state but not customer belief.",
      hero: true,
    },
    {
      kind: "TheoryAccepted",
      room: "explanation",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: `Surviving theory: **${surviving.replace(/_/g, " ")}** — premature success communication with failed backing mutation.`,
      theory: surviving,
      hero: true,
    },
    {
      kind: "VerdictIssued",
      room: "verdict",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: callFinding.headline,
      verdict,
      hero: true,
    },
    {
      kind: "ExplanationIssued",
      room: "explanation",
      agentRole: "incident_room",
      agentId: "incident_room",
      line: callFinding.what_happened,
      hero: true,
    },
    {
      kind: "FixTargetIssued",
      room: "verdict",
      agentRole: "workflow_investigator",
      agentId: "workflow_investigator",
      line: callFinding.recommended_actions.join(" "),
    },
  );

  return beats;
}

export function buildEarnedIncidentReport(input: {
  evidence: VoiceIncidentEvidence;
  verdict: VerdictOutcome;
  script: EarnedScriptBeat[];
}) {
  const highlights = input.script
    .filter((b) =>
      [
        "EvidenceRequested",
        "EvidenceReturned",
        "SpecialistRecruited",
        "RoomChallenge",
        "TheoryProposed",
        "TheorySupported",
        "TheoryChallenged",
        "ConfidenceChanged",
        "TheoryRefined",
        "TheoryWithdrawn",
        "TheoryAccepted",
      ].includes(b.kind),
    )
    .map((b) => ({
      kind: b.kind,
      agent_label:
        b.agentRole === "incident_room"
          ? "Incident Room"
          : b.agentRole.replace(/_/g, " "),
      line: b.line,
    }));

  const callFinding = buildCallFinding(input.evidence);
  const explanationBeat = input.script.find((b) => b.kind === "ExplanationIssued");
  const primaryFailed = primaryFailedTool(input.evidence);
  const fix = buildFixRecommendation(input.evidence, primaryFailed);
  const accepted = input.script.find((b) => b.kind === "TheoryAccepted");

  return {
    type: "IncidentReport" as const,
    finding: callFinding.headline,
    customer_impact: callFinding.customer_impact,
    system_reality: callFinding.execution_break,
    failed_theories: [
      {
        label: "execution_failure_alone",
        reason:
          input.script.find((b) => b.kind === "TheoryWithdrawn")?.withdrawReason ??
          "Failed execution explains system state but not customer belief.",
      },
      {
        label: "conversation_resolved",
        reason:
          "Transcript cooperation collapsed after agent promise language and failed mutation.",
      },
    ],
    surviving_explanation:
      accepted?.line?.replace(/\*\*/g, "") ??
      explanationBeat?.line ??
      callFinding.what_happened,
    fix_target: fix.fix_target,
    fix_detail: callFinding.recommended_actions.join(" "),
    collaboration_highlights: highlights,
  };
}
