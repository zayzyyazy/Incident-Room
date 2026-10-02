import { InvestigationStep } from "@/lib/demo/investigation-steps";
import { AgentSlotId, InvestigationPhase } from "@/lib/demo/game-level";
import { gameActionForStep } from "@/lib/demo/game-level";

export type StagePoint = {
  x: number;
  y: number;
  face: "left" | "right" | "center";
};

const VENT_LEFT: StagePoint = { x: 6, y: 58, face: "right" };
const VENT_RIGHT: StagePoint = { x: 94, y: 58, face: "left" };

const PODIUM: StagePoint = { x: 50, y: 50, face: "center" };
const TABLE: StagePoint = { x: 50, y: 46, face: "center" };

const DEBATE_SLOTS: Partial<Record<AgentSlotId, StagePoint>> = {
  communication_investigator: { x: 38, y: 48, face: "right" },
  execution_investigator: { x: 62, y: 48, face: "left" },
  policy_investigator: { x: 50, y: 42, face: "center" },
  workflow_investigator: { x: 50, y: 38, face: "center" },
  incident_room: { x: 50, y: 56, face: "center" },
  evidence_normalizer: { x: 42, y: 46, face: "right" },
};

export function ventForSlot(slotId: AgentSlotId): StagePoint {
  const home = DEBATE_SLOTS[slotId];
  if (!home || home.x <= 50) return VENT_LEFT;
  return VENT_RIGHT;
}

export function resolveCharacterMotion(
  slotId: AgentSlotId,
  home: StagePoint,
  step: InvestigationStep | null,
  speaking: boolean,
  justRecruited: boolean,
  phase: InvestigationPhase,
  recruitSettling?: AgentSlotId | null,
): StagePoint {
  if (justRecruited && recruitSettling !== slotId) return ventForSlot(slotId);
  if (recruitSettling === slotId) return home;

  if (!step) return home;

  const activeSlot = step.agentId as AgentSlotId;

  if (
    (step.kind === "EvidenceReturned" || step.kind === "EvidenceRequested") &&
    slotId === "evidence_normalizer"
  ) {
    return TABLE;
  }

  if (step.kind === "RoomChallenge" || step.kind === "TheoryChallenged") {
    if (slotId === activeSlot || speaking) {
      return DEBATE_SLOTS[slotId] ?? PODIUM;
    }
    if (slotId === "incident_room") return { x: 50, y: 58, face: "center" };
  }

  if (speaking) {
    return DEBATE_SLOTS[slotId] ?? PODIUM;
  }

  if (phase === "debate" && slotId !== "evidence_normalizer") {
    return home;
  }

  return home;
}

export type StageVfxKind =
  | "evidence_drop"
  | "debate_clash"
  | "recruit"
  | "verdict"
  | null;

export function stageVfxForStep(step: InvestigationStep | null): StageVfxKind {
  if (!step) return null;
  const action = gameActionForStep(step);
  if (step.kind === "EvidenceReturned") return "evidence_drop";
  if (step.kind === "RoomChallenge" || step.kind === "TheoryChallenged") {
    return "debate_clash";
  }
  if (step.kind === "SpecialistRecruited") return "recruit";
  if (step.kind === "VerdictIssued" || step.kind === "FixTargetIssued") return "verdict";
  if (action.tone === "evidence") return "evidence_drop";
  return null;
}
