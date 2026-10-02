import { InvestigationStep } from "@/lib/demo/investigation-steps";
import { STAGE_SLOTS_EXPORT, StageSlot } from "@/lib/demo/game-level-types";

export type AgentSlotId =
  | "incident_room"
  | "communication_investigator"
  | "execution_investigator"
  | "workflow_investigator"
  | "policy_investigator"
  | "evidence_normalizer"
  | "claim_tracer"
  | "backend_witness"
  | "causal_judge"
  | "unknown";

export type { StageSlot };
export { STAGE_SLOTS_EXPORT as STAGE_SLOTS };

export type InvestigationPhase = "briefing" | "evidence" | "debate" | "verdict";

export type GameAction = {
  verb: string;
  tone: "neutral" | "challenge" | "evidence" | "recruit" | "verdict" | "support";
  icon: string;
};

const RECRUIT_TO_SLOT: Record<string, AgentSlotId> = {
  normalizer: "evidence_normalizer",
  communication_investigator: "communication_investigator",
  execution_investigator: "execution_investigator",
  workflow_investigator: "workflow_investigator",
  policy_investigator: "policy_investigator",
  verdict_judge: "incident_room",
};

const RECRUIT_DISPLAY: Record<string, string> = {
  normalizer: "Evidence Normalizer",
  communication_investigator: "Communication Investigator",
  execution_investigator: "Execution Investigator",
  workflow_investigator: "Workflow Investigator",
  policy_investigator: "Policy Investigator",
  verdict_judge: "Verdict Judge",
};

export const CHARACTER_POSITIONS: Record<
  AgentSlotId,
  { x: number; y: number; face: "left" | "right" | "center" }
> = {
  incident_room: { x: 50, y: 72, face: "center" },
  communication_investigator: { x: 28, y: 58, face: "right" },
  claim_tracer: { x: 28, y: 58, face: "right" },
  execution_investigator: { x: 72, y: 58, face: "left" },
  backend_witness: { x: 72, y: 58, face: "left" },
  workflow_investigator: { x: 62, y: 40, face: "center" },
  policy_investigator: { x: 38, y: 40, face: "center" },
  evidence_normalizer: { x: 12, y: 50, face: "right" },
  causal_judge: { x: 50, y: 72, face: "center" },
  unknown: { x: 88, y: 58, face: "left" },
};

export const PARTY_ROSTER: { id: AgentSlotId; recruitKey?: string }[] = [
  { id: "incident_room" },
  { id: "evidence_normalizer", recruitKey: "normalizer" },
  { id: "communication_investigator", recruitKey: "communication_investigator" },
  { id: "execution_investigator", recruitKey: "execution_investigator" },
  { id: "policy_investigator", recruitKey: "policy_investigator" },
  { id: "workflow_investigator", recruitKey: "workflow_investigator" },
];

export function resolveAgentSlot(step: InvestigationStep): StageSlot {
  if (
    step.kind === "EvidenceReturned" ||
    step.kind === "EvidenceRequested" ||
    step.kind === "NormalizerRouting"
  ) {
    return STAGE_SLOTS_EXPORT.evidence_normalizer;
  }
  const role = step.agentId as AgentSlotId;
  if (STAGE_SLOTS_EXPORT[role]) return STAGE_SLOTS_EXPORT[role];
  if (step.agentLabel.toLowerCase().includes("communication")) {
    return STAGE_SLOTS_EXPORT.communication_investigator;
  }
  if (step.agentLabel.toLowerCase().includes("execution")) {
    return STAGE_SLOTS_EXPORT.execution_investigator;
  }
  if (step.agentLabel.toLowerCase().includes("workflow")) {
    return STAGE_SLOTS_EXPORT.workflow_investigator;
  }
  if (step.agentLabel.toLowerCase().includes("policy")) {
    return STAGE_SLOTS_EXPORT.policy_investigator;
  }
  if (step.agentLabel.toLowerCase().includes("normalizer")) {
    return STAGE_SLOTS_EXPORT.evidence_normalizer;
  }
  return STAGE_SLOTS_EXPORT.incident_room;
}

export function deriveRecruitedAgents(
  steps: InvestigationStep[],
  throughIndex: number,
): AgentSlotId[] {
  const recruited: AgentSlotId[] = ["incident_room"];
  const slice = steps.slice(0, throughIndex + 1);

  for (const step of slice) {
    if (step.kind === "SpecialistRecruited" && step.subline) {
      const slot = RECRUIT_TO_SLOT[step.subline];
      if (slot && !recruited.includes(slot)) recruited.push(slot);
    }
  }
  return recruited;
}

export function recruitDisplayName(subline?: string): string {
  if (!subline) return "Specialist";
  return RECRUIT_DISPLAY[subline] ?? subline.replace(/_/g, " ");
}

export function gameActionForStep(step: InvestigationStep): GameAction {
  const k = step.kind;
  if (k === "SpecialistRecruited") {
    return { verb: "JOINED THE PARTY", tone: "recruit", icon: "⚡" };
  }
  if (k === "EvidenceReturned" || k === "EvidenceRequested" || k === "NormalizerRouting") {
    return { verb: "DELIVERS EVIDENCE", tone: "evidence", icon: "📦" };
  }
  if (k === "TheoryProposed") return { verb: "PROPOSES THEORY", tone: "neutral", icon: "💭" };
  if (k === "TheorySupported") return { verb: "SUPPORTS THEORY", tone: "support", icon: "📈" };
  if (k === "TheoryChallenged" || k === "RoomChallenge") {
    return { verb: "CHALLENGES", tone: "challenge", icon: "⚔" };
  }
  if (k === "TheoryWithdrawn") return { verb: "WITHDRAWS THEORY", tone: "challenge", icon: "✕" };
  if (k === "ConfidenceChanged") return { verb: "SHIFTS CONFIDENCE", tone: "challenge", icon: "📊" };
  if (k === "TheoryRefined") return { verb: "REFINES THEORY", tone: "support", icon: "🔧" };
  if (k === "TheoryAccepted") return { verb: "ACCEPTS THEORY", tone: "support", icon: "✓" };
  if (k === "VerdictIssued") return { verb: "DELIVERS FINDING", tone: "verdict", icon: "⚖" };
  if (k === "ExplanationIssued") return { verb: "EXPLAINS", tone: "verdict", icon: "📜" };
  if (k === "FixTargetIssued") return { verb: "NAMES FIX TARGET", tone: "verdict", icon: "🎯" };
  if (k === "InvestigationOpened") return { verb: "OPENS CASE", tone: "neutral", icon: "▶" };
  return { verb: step.headline.toUpperCase(), tone: "neutral", icon: "•" };
}

export function investigationPhase(
  steps: InvestigationStep[],
  activeIndex: number,
): InvestigationPhase {
  const step = steps[activeIndex];
  if (!step) return "briefing";
  if (kIsVerdict(step.kind)) return "verdict";
  if (kIsDebate(step.kind)) return "debate";
  if (kIsEvidence(step.kind)) return "evidence";
  return "briefing";
}

function kIsVerdict(k: string) {
  return k === "VerdictIssued" || k === "ExplanationIssued" || k === "FixTargetIssued";
}
function kIsDebate(k: string) {
  return [
    "TheoryProposed",
    "TheoryChallenged",
    "TheorySupported",
    "TheoryWithdrawn",
    "ConfidenceChanged",
    "RoomChallenge",
    "TheoryRefined",
    "TheoryAccepted",
  ].includes(k);
}
function kIsEvidence(k: string) {
  return k === "EvidenceRequested" || k === "EvidenceReturned" || k === "NormalizerRouting";
}

export const PHASE_LABELS: Record<InvestigationPhase, string> = {
  briefing: "Phase 1 · Briefing",
  evidence: "Phase 2 · Evidence routing",
  debate: "Phase 3 · Theory combat",
  verdict: "Phase 4 · Verdict",
};

export function recruitSlotId(subline?: string): AgentSlotId | undefined {
  if (!subline) return undefined;
  return RECRUIT_TO_SLOT[subline];
}

export function dialogueLine(step: InvestigationStep): string {
  const raw = step.line.trim();
  if (!raw) return step.headline;
  const cleaned = raw.replace(/\*\*/g, "").trim();
  if (/^[A-Z0-9][A-Z0-9\s—-]{2,48}$/.test(cleaned) && cleaned.length < 40) {
    return step.subline ? `${cleaned} — ${step.subline.replace(/_/g, " ")}` : cleaned;
  }
  return cleaned.length > 0 ? cleaned : raw;
}

/** Short line for live UI — headlines, theory chips, one sentence max */
export function dialogueSummary(step: InvestigationStep, max = 84): string {
  if (step.kind === "SpecialistRecruited") {
    return `Recruited ${recruitDisplayName(step.subline)}`;
  }
  if (step.subline && step.kind.startsWith("Theory")) {
    return step.subline;
  }
  if (step.kind === "ConfidenceChanged" && step.subline) {
    return step.subline;
  }
  if (step.kind === "VerdictIssued" || step.kind === "FixTargetIssued") {
    const line = dialogueLine(step);
    return line.length > max ? `${line.slice(0, max - 1)}…` : line;
  }
  const line = dialogueLine(step);
  const firstSentence = line.split(/(?<=[.!?])\s+/)[0] ?? line;
  const clip = firstSentence.length > max ? firstSentence.slice(0, max - 1) : firstSentence;
  return clip.endsWith("…") ? clip : clip.length < line.length ? `${clip}…` : clip;
}

export function isRecruitBeat(step: InvestigationStep): boolean {
  return step.kind === "SpecialistRecruited";
}
