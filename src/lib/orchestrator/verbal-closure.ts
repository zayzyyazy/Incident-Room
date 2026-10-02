type Layer1Conversation = {
  segments?: Array<{ turn_id: string; speaker: string; text: string }>;
  behavioral_hints?: Array<{ type: string; turn_ref: string; note?: string }>;
};

const PREMATURE_CLOSURE_HINT_TYPES = new Set([
  "premature_closure",
  "premature_verbal_closure",
]);

/** Agent phrasing that tells the customer the request is done (L1 perception). */
const AGENT_COMPLETION_PATTERN =
  /\b(I'?ve updated|updated your|I have updated|is scheduled|I'?ve scheduled|callback is|appointment is|You'?ll receive|confirmation shortly|is confirmed|has been updated|is set for|I'?ve placed your order|order is confirmed|order has been placed|placed your order)\b/i;

export function getPrematureClosureTurnRefs(
  layer1?: Layer1Conversation,
): string[] {
  if (!layer1) {
    return [];
  }

  const fromHints = (layer1.behavioral_hints ?? [])
    .filter((hint) => PREMATURE_CLOSURE_HINT_TYPES.has(hint.type))
    .map((hint) => hint.turn_ref);

  const fromLanguage = (layer1.segments ?? [])
    .filter(
      (segment) =>
        segment.speaker === "agent" &&
        AGENT_COMPLETION_PATTERN.test(segment.text),
    )
    .map((segment) => segment.turn_id);

  return Array.from(new Set([...fromHints, ...fromLanguage]));
}

export function hasPrematureVerbalClosure(layer1?: Layer1Conversation): boolean {
  return getPrematureClosureTurnRefs(layer1).length > 0;
}

export function layer1FromContext(
  filteredContext: unknown,
): Layer1Conversation | undefined {
  return (filteredContext as { layer1_conversation?: Layer1Conversation })
    .layer1_conversation;
}
