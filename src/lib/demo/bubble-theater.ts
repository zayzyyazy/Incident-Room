import { InvestigationStep } from "@/lib/demo/investigation-steps";

export type BubbleKind = "speech" | "thought" | "evidence" | "verdict" | "system";

export type AgentSlotId =
  | "incident_room"
  | "communication_investigator"
  | "execution_investigator"
  | "workflow_investigator"
  | "evidence_normalizer"
  | "claim_tracer"
  | "backend_witness"
  | "causal_judge"
  | "unknown";

export type StageSlot = {
  id: AgentSlotId;
  x: number;
  y: number;
  label: string;
  shortLabel: string;
  accent: string;
  border: string;
  glow: string;
};

const STAGE_SLOTS: Record<AgentSlotId, StageSlot> = {
  incident_room: {
    id: "incident_room",
    x: 50,
    y: 74,
    label: "Incident Room",
    shortLabel: "IR",
    accent: "text-command",
    border: "border-command/50",
    glow: "shadow-glow-command",
  },
  communication_investigator: {
    id: "communication_investigator",
    x: 16,
    y: 52,
    label: "Communication",
    shortLabel: "CM",
    accent: "text-trace",
    border: "border-trace/50",
    glow: "shadow-glow-trace",
  },
  claim_tracer: {
    id: "claim_tracer",
    x: 16,
    y: 52,
    label: "Claim Tracer",
    shortLabel: "CT",
    accent: "text-trace",
    border: "border-trace/50",
    glow: "shadow-glow-trace",
  },
  execution_investigator: {
    id: "execution_investigator",
    x: 84,
    y: 52,
    label: "Execution",
    shortLabel: "EX",
    accent: "text-signal",
    border: "border-signal/50",
    glow: "shadow-glow-signal",
  },
  backend_witness: {
    id: "backend_witness",
    x: 84,
    y: 52,
    label: "Backend Witness",
    shortLabel: "BW",
    accent: "text-signal",
    border: "border-signal/50",
    glow: "shadow-glow-signal",
  },
  workflow_investigator: {
    id: "workflow_investigator",
    x: 50,
    y: 18,
    label: "Workflow",
    shortLabel: "WF",
    accent: "text-amber-warm",
    border: "border-amber-warm/50",
    glow: "shadow-glow-amber",
  },
  evidence_normalizer: {
    id: "evidence_normalizer",
    x: 8,
    y: 30,
    label: "Normalizer",
    shortLabel: "NR",
    accent: "text-room-muted",
    border: "border-room-border",
    glow: "",
  },
  causal_judge: {
    id: "causal_judge",
    x: 50,
    y: 74,
    label: "Causal Judge",
    shortLabel: "CJ",
    accent: "text-command",
    border: "border-command/50",
    glow: "shadow-glow-command",
  },
  unknown: {
    id: "unknown",
    x: 92,
    y: 78,
    label: "Agent",
    shortLabel: "??",
    accent: "text-room-muted",
    border: "border-room-border",
    glow: "",
  },
};

const RECRUIT_TO_SLOT: Record<string, AgentSlotId> = {
  normalizer: "evidence_normalizer",
  communication_investigator: "communication_investigator",
  execution_investigator: "execution_investigator",
  workflow_investigator: "workflow_investigator",
  verdict_judge: "incident_room",
};

export function resolveAgentSlot(step: InvestigationStep): StageSlot {
  if (
    step.kind === "EvidenceReturned" ||
    step.kind === "EvidenceRequested" ||
    step.kind === "NormalizerRouting"
  ) {
    return STAGE_SLOTS.evidence_normalizer;
  }
  const role = step.agentId as AgentSlotId;
  if (STAGE_SLOTS[role]) return STAGE_SLOTS[role];
  if (step.agentLabel.toLowerCase().includes("communication")) {
    return STAGE_SLOTS.communication_investigator;
  }
  if (step.agentLabel.toLowerCase().includes("execution")) {
    return STAGE_SLOTS.execution_investigator;
  }
  if (step.agentLabel.toLowerCase().includes("workflow")) {
    return STAGE_SLOTS.workflow_investigator;
  }
  if (step.agentLabel.toLowerCase().includes("normalizer")) {
    return STAGE_SLOTS.evidence_normalizer;
  }
  return STAGE_SLOTS.unknown;
}

export function bubbleKindForStep(kind: string): BubbleKind {
  if (kind === "VerdictIssued" || kind === "FixTargetIssued" || kind === "ExplanationIssued") {
    return "verdict";
  }
  if (
    kind === "EvidenceRequested" ||
    kind === "EvidenceReturned" ||
    kind === "NormalizerRouting" ||
    kind === "NormalizerEvidenceDelivery"
  ) {
    return "evidence";
  }
  if (
    kind === "TheoryChallenged" ||
    kind === "TheoryWithdrawn" ||
    kind === "ConfidenceChanged" ||
    kind === "RoomChallenge" ||
    kind === "TheorySupported"
  ) {
    return "thought";
  }
  if (kind === "SpecialistRecruited" || kind === "InvestigationOpened") {
    return "system";
  }
  return "speech";
}

export function bubbleAccentClass(kind: BubbleKind): string {
  if (kind === "thought") return "border-dashed border-alert/50 bg-alert/[0.07]";
  if (kind === "evidence") return "border-trace/60 bg-trace/[0.08]";
  if (kind === "verdict") return "border-command/60 bg-command/[0.1]";
  if (kind === "system") return "border-room-border bg-room-elevated/80";
  return "border-foreground/20 bg-room-panel/95";
}

export function derivePresentAgents(
  steps: InvestigationStep[],
  throughIndex: number,
): StageSlot[] {
  const present = new Set<AgentSlotId>(["incident_room"]);
  const slice = steps.slice(0, throughIndex + 1);

  for (const step of slice) {
    present.add(resolveAgentSlot(step).id);
    if (step.kind === "SpecialistRecruited" && step.subline) {
      const slot = RECRUIT_TO_SLOT[step.subline];
      if (slot) present.add(slot);
    }
    if (step.line.toLowerCase().includes("normalizer")) {
      present.add("evidence_normalizer");
    }
  }

  return Array.from(present)
    .filter((id) => id !== "unknown")
    .map((id) => STAGE_SLOTS[id]);
}

export function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^[^:]+:\s*/, "").trim();
}

export function bubbleDisplayLine(step: InvestigationStep): string {
  const raw = step.line.trim();
  const cleaned = stripMarkdownBold(raw);
  if (cleaned.length > 0) return cleaned;
  return raw;
}

export function bubbleTailDirection(slot: StageSlot): "left" | "right" | "down" | "up" {
  if (slot.y < 30) return "down";
  if (slot.x < 30) return "right";
  if (slot.x > 70) return "left";
  return "up";
}
