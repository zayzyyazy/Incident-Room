import { InvestigationStep } from "@/lib/demo/investigation-steps";
import { AgentSlotId, resolveAgentSlot } from "@/lib/demo/game-level";

export type TheoryStanceKind =
  | "proposed"
  | "supports"
  | "challenges"
  | "refines"
  | "withdraws"
  | "accepts";

export type TheoryStance = {
  slotId: AgentSlotId;
  label: string;
  shortLabel: string;
  accent: string;
  kind: TheoryStanceKind;
  beatId: string;
};

export type BoardTheory = {
  id: string;
  label: string;
  status: "active" | "contested" | "withdrawn" | "accepted";
  confidence?: string;
  stances: TheoryStance[];
};

const THEORY_BEATS = new Set([
  "TheoryProposed",
  "TheorySupported",
  "TheoryChallenged",
  "TheoryRefined",
  "TheoryWithdrawn",
  "TheoryAccepted",
  "RoomChallenge",
  "ConfidenceChanged",
]);

function theoryIdFromStep(step: InvestigationStep): string | undefined {
  const raw = step.subline?.trim();
  if (!raw) return undefined;
  if (raw.includes("→")) return undefined;
  return raw.replace(/\s+/g, "_").toLowerCase();
}

function stanceKindForBeat(kind: string): TheoryStanceKind | null {
  if (kind === "TheoryProposed") return "proposed";
  if (kind === "TheorySupported") return "supports";
  if (kind === "TheoryChallenged" || kind === "RoomChallenge") return "challenges";
  if (kind === "TheoryRefined") return "refines";
  if (kind === "TheoryWithdrawn") return "withdraws";
  if (kind === "TheoryAccepted") return "accepts";
  return null;
}

export function isTheoryBeat(step: InvestigationStep | null): boolean {
  return Boolean(step && THEORY_BEATS.has(step.kind));
}

export function deriveTheoryBoard(
  steps: InvestigationStep[],
  throughIndex: number,
): { theories: BoardTheory[]; focusTheoryId?: string; focusStep?: InvestigationStep } {
  const slice = steps.slice(0, throughIndex + 1);
  const byId = new Map<string, BoardTheory>();
  let focusTheoryId: string | undefined;
  const focusStep = slice[throughIndex];

  for (const step of slice) {
    const stanceKind = stanceKindForBeat(step.kind);
    const theoryId = theoryIdFromStep(step);
    if (!theoryId && step.kind !== "ConfidenceChanged") continue;

    if (step.kind === "TheoryProposed" && theoryId) {
      const existing = byId.get(theoryId);
      const slot = resolveAgentSlot(step);
      const entry: BoardTheory = existing ?? {
        id: theoryId,
        label: step.subline ?? theoryId.replace(/_/g, " "),
        status: "active",
        stances: [],
      };
      entry.stances.push({
        slotId: slot.id,
        label: slot.label,
        shortLabel: slot.shortLabel,
        accent: slot.accent,
        kind: "proposed",
        beatId: step.id,
      });
      byId.set(theoryId, entry);
      focusTheoryId = theoryId;
    }

    if (stanceKind && theoryId && step.kind !== "TheoryProposed") {
      const entry = byId.get(theoryId) ?? {
        id: theoryId,
        label: theoryId.replace(/_/g, " "),
        status: "contested" as const,
        stances: [],
      };
      const slot = resolveAgentSlot(step);
      entry.stances.push({
        slotId: slot.id,
        label: slot.label,
        shortLabel: slot.shortLabel,
        accent: slot.accent,
        kind: stanceKind,
        beatId: step.id,
      });
      if (step.kind === "TheoryWithdrawn") entry.status = "withdrawn";
      if (step.kind === "TheoryAccepted") entry.status = "accepted";
      else if (step.kind === "TheoryChallenged" || step.kind === "RoomChallenge") {
        entry.status = "contested";
      }
      byId.set(theoryId, entry);
      focusTheoryId = theoryId;
    }

    if (step.kind === "ConfidenceChanged" && theoryId) {
      const entry = byId.get(theoryId);
      if (entry) entry.confidence = step.subline;
    }
  }

  if (focusStep) {
    const fromStep = theoryIdFromStep(focusStep);
    if (fromStep) focusTheoryId = fromStep;
  }

  const theories = Array.from(byId.values()).filter((t) => t.stances.length > 0);
  return { theories, focusTheoryId, focusStep };
}

export function stancesForTheory(
  board: ReturnType<typeof deriveTheoryBoard>,
  theoryId?: string,
): TheoryStance[] {
  if (!theoryId) return [];
  return board.theories.find((t) => t.id === theoryId)?.stances ?? [];
}

export function agentStanceOnFocus(
  board: ReturnType<typeof deriveTheoryBoard>,
  slotId: AgentSlotId,
): TheoryStanceKind | null {
  if (!board.focusTheoryId) return null;
  const stances = stancesForTheory(board, board.focusTheoryId);
  const mine = [...stances].reverse().find((s) => s.slotId === slotId);
  return mine?.kind ?? null;
}

export function stanceGlyph(kind: TheoryStanceKind): string {
  if (kind === "proposed") return "💭";
  if (kind === "supports") return "✓";
  if (kind === "challenges") return "✗";
  if (kind === "refines") return "🔧";
  if (kind === "withdraws") return "↩";
  return "★";
}

export function stanceLabel(kind: TheoryStanceKind): string {
  if (kind === "proposed") return "proposed";
  if (kind === "supports") return "agrees";
  if (kind === "challenges") return "disputes";
  if (kind === "refines") return "refines";
  if (kind === "withdraws") return "withdraws";
  return "accepts";
}
