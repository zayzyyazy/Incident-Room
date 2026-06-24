/** Locked cross-room outcomes — every room-to-room challenge resolves to one of these. */
export type CrossRoomOutcome = "DEFEND" | "REVISE" | "INSUFFICIENT_EVIDENCE";

export const CROSS_ROOM_OUTCOMES: readonly CrossRoomOutcome[] = [
  "DEFEND",
  "REVISE",
  "INSUFFICIENT_EVIDENCE",
] as const;

export function assertCrossRoomOutcome(
  value: string,
): asserts value is CrossRoomOutcome {
  if (!CROSS_ROOM_OUTCOMES.includes(value as CrossRoomOutcome)) {
    throw new Error(
      `Invalid cross-room outcome "${value}". Expected DEFEND | REVISE | INSUFFICIENT_EVIDENCE.`,
    );
  }
}
