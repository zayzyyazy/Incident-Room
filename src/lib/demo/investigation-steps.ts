import { getAgentDefinition } from "@/lib/agents/registry";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";

export type DemoPhase =
  | "cause"
  | "cross_room"
  | "localization"
  | "breakthrough"
  | "surface"
  | "customer_reality"
  | "system_reality"
  | "reconciliation"
  | "theory_investigation"
  | "normalizer"
  | "complete";

export type InvestigationRoom =
  | "cause"
  | "localization"
  | "customer_reality"
  | "system_reality"
  | "reconciliation"
  | "theory_investigation"
  | "normalizer";

export type InvestigationStep = {
  id: string;
  index: number;
  room: InvestigationRoom;
  agentId: string;
  agentShort: string;
  agentLabel: string;
  phase: DemoPhase;
  headline: string;
  line: string;
  subline?: string;
  pointer?: string;
  crossRoom?: "to_cause" | "from_cause";
  kind: string;
  messageId: string;
  hero?: boolean;
};

export type InvestigationStepSink = {
  push: (step: Omit<InvestigationStep, "index">) => Promise<void>;
};

/** Demo-visible beats: hypotheses, debate, cross-room, breakthrough — not tool noise. */
const DEMO_VISIBLE_KINDS = new Set([
  "claim_tracer_initial",
  "backend_witness_initial",
  "agent_challenge",
  "causal_judge_bridge",
  "causal_judge_refinement",
  "CauseFinding",
  "CauseDefenseRequest",
  "defense_backend_witness",
  "defense_claim_tracer",
  "CauseDefenseDecision",
  "CauseRevisionRequest",
  "CauseRevisionDecision",
  "LocalizationDefenseVerdict",
  "surface_opening",
  "surface_attack",
  "surface_counterattack",
  "investigator_admission",
  "mechanism_discovery",
  "InvestigationBreakthrough",
  "LocalizationFinding",
  "revision_backend_witness",
  "revision_claim_tracer",
  "CustomerRealityVerdict",
  "SystemRealityVerdict",
  "ReconciliationOpen",
  "ReconciliationChallenge",
  "CustomerRealityYield",
  "InvestigationVerdict",
  "customer_belief_trace",
  "system_tool_trace",
  "TheoryOpening",
  "TheoryChallenge",
  "TheoryWithdrawal",
  "TheoryCounter",
  "TheorySynthesis",
  "IncidentFinding",
  "NormalizerRouting",
  "NormalizerEvidenceRequest",
  "NormalizerEvidenceDelivery",
]);

let stepCounter = 0;

export function resetStepCounter(): void {
  stepCounter = 0;
}

export function createStepSink(
  onStep?: (step: InvestigationStep) => void | Promise<void>,
): InvestigationStepSink | undefined {
  if (!onStep) return undefined;
  return {
    async push(entry) {
      const step: InvestigationStep = {
        ...entry,
        index: stepCounter++,
      };
      await onStep(step);
    },
  };
}

export function demoStepPaceMs(step: InvestigationStep): number {
  if (step.kind === "IncidentFinding") return 2800;
  if (step.kind === "TheorySynthesis") return 2400;
  if (step.kind === "TheoryChallenge" || step.kind === "TheoryCounter") return 2200;
  if (step.kind === "TheoryWithdrawal") return 2000;
  if (step.kind === "TheoryOpening") return 1800;
  if (step.kind === "CustomerRealityVerdict" || step.kind === "SystemRealityVerdict") {
    return 2200;
  }
  if (step.kind === "ReconciliationOpen") return 2400;
  if (step.hero || step.kind === "InvestigationBreakthrough") return 2600;
  if (step.kind === "investigator_admission") return 2200;
  if (step.kind === "CauseDefenseRequest") return 2000;
  if (step.phase === "cross_room") return 1700;
  if (step.phase === "surface") return 2000;
  if (step.kind === "agent_challenge") return 1400;
  return 1500;
}

function clip(text: string, max = 200): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function classLabel(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return hypothesisClassLabel(value);
  } catch {
    return value.replace(/_/g, " ");
  }
}

function payloadType(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    return "message";
  }
  return String((payload as { type: string }).type);
}

function firstLine(content?: string): string {
  if (!content) return "";
  return content.split("\n")[0]?.trim() ?? "";
}

function phaseForKind(kind: string, room: InvestigationRoom): DemoPhase {
  if (room === "normalizer") return "normalizer";
  if (room === "theory_investigation") return "reconciliation";
  if (room === "customer_reality") return "customer_reality";
  if (room === "system_reality") return "system_reality";
  if (room === "reconciliation") return "reconciliation";
  if (
    kind === "CauseDefenseRequest" ||
    kind === "CauseDefenseDecision" ||
    kind === "CauseRevisionRequest" ||
    kind === "CauseRevisionDecision" ||
    kind === "LocalizationDefenseVerdict" ||
    kind === "defense_backend_witness" ||
    kind === "defense_claim_tracer" ||
    kind === "revision_backend_witness" ||
    kind === "revision_claim_tracer"
  ) {
    return "cross_room";
  }
  if (
    kind === "InvestigationBreakthrough" ||
    kind === "mechanism_discovery"
  ) {
    return "breakthrough";
  }
  if (kind === "LocalizationFinding") {
    return "surface";
  }
  if (room === "cause") return "cause";
  return "localization";
}

function headlineForKind(kind: string): string {
  const map: Record<string, string> = {
    claim_tracer_initial: "Opening hypothesis",
    backend_witness_initial: "Execution hypothesis",
    agent_challenge: "Challenge",
    causal_judge_bridge: "Bridge cause",
    causal_judge_refinement: "Refined cause",
    CauseFinding: "CauseFinding locked",
    CauseDefenseRequest: "Localization attacks cause",
    defense_backend_witness: "Cause checks execution",
    defense_claim_tracer: "Cause checks belief",
    CauseDefenseDecision: "Cause Room ruling",
    LocalizationDefenseVerdict: "Verdict",
    CauseRevisionRequest: "Implementation contradicts cause",
    CauseRevisionDecision: "Cause revised",
    surface_opening: "Surface theory",
    surface_attack: "Reject incomplete theory",
    surface_counterattack: "Counterattack",
    investigator_admission: "Investigator admits error",
    mechanism_discovery: "Mechanism discovered",
    InvestigationBreakthrough: "Breakthrough",
    LocalizationFinding: "Where it lives in code",
    revision_backend_witness: "Revision · execution check",
    revision_claim_tracer: "Revision · belief check",
    CustomerRealityVerdict: "Customer Reality verdict",
    SystemRealityVerdict: "System Reality verdict",
    ReconciliationOpen: "Realities collide",
    ReconciliationChallenge: "Architecture challenge",
    CustomerRealityYield: "Customer Reality narrows",
    InvestigationVerdict: "Finding locked",
    customer_belief_trace: "Belief trace",
    system_tool_trace: "Tool trace",
    TheoryOpening: "Initial theory",
    TheoryChallenge: "Challenge",
    TheoryWithdrawal: "Withdrawal",
    TheoryCounter: "Counter",
    TheorySynthesis: "Synthesis",
    IncidentFinding: "Incident finding",
    NormalizerRouting: "Evidence routed",
    NormalizerEvidenceRequest: "Evidence request",
    NormalizerEvidenceDelivery: "Evidence delivery",
  };
  return map[kind] ?? kind.replace(/_/g, " ");
}

function crossRoomForKind(
  kind: string,
  room: InvestigationRoom,
): InvestigationStep["crossRoom"] {
  if (kind === "ReconciliationOpen") return "to_cause";
  if (kind === "CustomerRealityVerdict" && room === "customer_reality") {
    return undefined;
  }
  if (kind === "SystemRealityVerdict" && room === "system_reality") {
    return undefined;
  }
  if (room === "localization" && kind === "CauseDefenseRequest") {
    return "to_cause";
  }
  if (room === "cause" && kind === "CauseDefenseDecision") {
    return "from_cause";
  }
  if (room === "localization" && kind === "CauseRevisionRequest") {
    return "to_cause";
  }
  if (room === "cause" && kind === "CauseRevisionDecision") {
    return "from_cause";
  }
  return undefined;
}

function isDemoVisibleBeat(kind: string, room: InvestigationRoom): boolean {
  if (!DEMO_VISIBLE_KINDS.has(kind)) return false;
  if (kind === "CauseDefenseRequest" && room === "cause") return false;
  if (kind === "CauseFinding" && room === "localization") return false;
  return true;
}

function shouldSkipStep(
  kind: string,
  room: InvestigationRoom,
  bandEventKind?: string,
): boolean {
  if (bandEventKind === "tool_call") return true;
  if (bandEventKind === "tool_result") return true;
  return !isDemoVisibleBeat(kind, room);
}

function demoCopy(
  kind: string,
  content: string,
  payload: unknown,
): Pick<InvestigationStep, "line" | "subline" | "hero" | "pointer"> {
  const raw = firstLine(content);

  if (kind === "investigator_admission" && payload && typeof payload === "object") {
    const admission = String(
      (payload as { admission_en?: string }).admission_en ?? raw,
    );
    return {
      line: admission.split(".")[0] + ".",
      hero: true,
    };
  }

  if (kind === "InvestigationBreakthrough" && payload && typeof payload === "object") {
    const p = payload as { headline?: string; human_sentence?: string };
    return {
      line: p.headline ?? raw,
      subline: p.human_sentence,
      hero: true,
    };
  }

  if (kind === "LocalizationFinding" && payload && typeof payload === "object") {
    const p = payload as {
      primary_surface?: { label?: string; pointer?: string };
      mechanism_explanation?: string;
      implementation_mechanism?: { canonical_id?: string; statement?: string };
    };
    const mechanismLabel =
      p.implementation_mechanism?.canonical_id?.replace(/_/g, " ") ??
      "Mechanism";
    const surfaceLabel =
      p.primary_surface?.label ??
      p.primary_surface?.pointer ??
      raw.replace(/^Artifact:\s*/i, "");
    return {
      line: `${mechanismLabel} → ${surfaceLabel}`,
      subline:
        p.mechanism_explanation ??
        p.implementation_mechanism?.statement,
      pointer: surfaceLabel,
      hero: true,
    };
  }

  if (kind === "mechanism_discovery" && payload && typeof payload === "object") {
    const p = payload as {
      discovery_en?: string;
      mechanism?: { canonical_id?: string; statement?: string };
    };
    return {
      line: p.mechanism?.canonical_id?.replace(/_/g, " ") ?? raw,
      subline: p.discovery_en ?? p.mechanism?.statement,
      hero: true,
    };
  }

  if (kind === "LocalizationDefenseVerdict" && payload && typeof payload === "object") {
    const p = payload as { verdict?: string; rationale_en?: string; cause_finding_status?: string };
    return {
      line: `${p.verdict ?? "Verdict"} · CauseFinding ${p.cause_finding_status ?? "updated"}`,
      subline: p.rationale_en,
    };
  }

  if (kind === "CauseFinding" && payload && typeof payload === "object") {
    const p = payload as { cause_statement?: string; cause_class?: string };
    const stmt = p.cause_statement?.split(".")[0];
    return {
      line: stmt ? `${stmt}.` : raw,
      subline: classLabel(p.cause_class),
    };
  }

  if (kind === "CauseDefenseDecision" && payload && typeof payload === "object") {
    const p = payload as { decision?: string; defense?: string };
    const line =
      content.includes("Accepted.") || content.includes("@")
        ? clip(firstLine(content))
        : p.decision === "DEFEND"
          ? "Accepted. Both are required: failed write and confirmation language before verification."
          : `${p.decision ?? "Ruling"} — ${(p.defense ?? raw).split(".")[0]}.`;
    return { line, hero: true };
  }

  if (kind === "claim_tracer_initial" && payload && typeof payload === "object") {
    const p = payload as { hypothesis_en?: string; hypothesis_class?: string };
    return {
      line: clip(p.hypothesis_en ?? raw),
      subline: classLabel(p.hypothesis_class),
    };
  }

  if (kind === "backend_witness_initial" && payload && typeof payload === "object") {
    const p = payload as {
      hypothesis_en?: string;
      hypothesis_class?: string;
      execution_summary_en?: string;
    };
    return {
      line: clip(p.hypothesis_en ?? p.execution_summary_en ?? raw),
      subline: classLabel(p.hypothesis_class),
    };
  }

  if (kind === "agent_challenge" && payload && typeof payload === "object") {
    const p = payload as {
      updated_hypothesis_en?: string;
      claim?: string;
      updated_hypothesis_class?: string;
    };
    return {
      line: clip(p.updated_hypothesis_en ?? p.claim ?? raw),
      subline: `Refines → ${classLabel(p.updated_hypothesis_class) ?? "hypothesis"}`,
    };
  }

  if (kind === "causal_judge_bridge" && payload && typeof payload === "object") {
    const p = payload as {
      bridge_hypothesis_en?: string;
      bridge_hypothesis_class?: string;
    };
    return {
      line: clip(p.bridge_hypothesis_en ?? raw),
      subline: classLabel(p.bridge_hypothesis_class),
    };
  }

  if (kind === "causal_judge_refinement" && payload && typeof payload === "object") {
    const p = payload as { refinement_en?: string; refined_bridge_class?: string };
    return {
      line: clip(p.refinement_en ?? raw),
      subline: classLabel(p.refined_bridge_class),
    };
  }

  if (kind === "CauseDefenseRequest") {
    return { line: clip(raw, 220) };
  }

  if (kind === "CauseRevisionRequest") {
    return { line: clip(raw, 240), hero: true };
  }

  if (kind === "CauseRevisionDecision" && payload && typeof payload === "object") {
    const p = payload as { decision?: string; reason?: string; new_cause_class?: string };
    return {
      line: clip(raw || `Revision accepted → ${classLabel(p.new_cause_class) ?? "revised cause"}`),
      subline: p.reason,
      hero: true,
    };
  }

  if (kind === "revision_claim_tracer") {
    return { line: clip(raw, 240) };
  }

  if (kind === "CustomerRealityVerdict" && payload && typeof payload === "object") {
    const p = payload as { belief?: string; promise_made?: boolean };
    return {
      line: p.belief ?? raw,
      subline: p.promise_made ? "Promise made · transcript only" : undefined,
      hero: true,
    };
  }

  if (kind === "SystemRealityVerdict" && payload && typeof payload === "object") {
    const p = payload as { actual_state?: string; side_effect_created?: boolean };
    return {
      line: p.actual_state ?? raw,
      subline: p.side_effect_created
        ? "Side effect created · tool trace"
        : "No side effect · tool trace only",
      hero: true,
    };
  }

  if (kind === "ReconciliationOpen" && payload && typeof payload === "object") {
    const p = payload as { customer_reality?: string; system_reality?: string };
    return {
      line: raw.includes("@")
        ? clip(raw, 240)
        : `CUSTOMER REALITY: ${p.customer_reality ?? "—"}. SYSTEM REALITY: ${p.system_reality ?? "—"}. These cannot both be true.`,
      hero: true,
    };
  }

  if (kind === "ReconciliationChallenge") {
    return { line: clip(raw, 240), hero: true };
  }

  if (kind === "CustomerRealityYield") {
    return { line: clip(raw, 240) };
  }

  if (kind === "InvestigationVerdict" && payload && typeof payload === "object") {
    const p = payload as { finding?: string };
    return {
      line: p.finding ?? raw,
      hero: true,
    };
  }

  if (kind === "IncidentFinding" && payload && typeof payload === "object") {
    const p = payload as { artifact?: { finding?: string }; line?: string };
    return {
      line: p.artifact?.finding ?? (payload as { line?: string }).line ?? raw,
      hero: true,
    };
  }

  if (kind === "NormalizerRouting" && payload && typeof payload === "object") {
    const p = payload as {
      artifact?: { packet_counts?: Record<string, number> };
      routing_status?: Record<string, boolean>;
    };
    const counts = p.artifact?.packet_counts;
    const status = p.routing_status;
    const parts: string[] = [];
    if (counts?.transcript_turns) parts.push(`${counts.transcript_turns} transcript turns`);
    if (counts?.tool_calls) parts.push(`${counts.tool_calls} tool calls`);
    if (counts?.definition_nodes) parts.push(`${counts.definition_nodes} definition nodes`);
    const flags = status
      ? Object.entries(status)
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/^has_/, ""))
          .join(", ")
      : "";
    return {
      line:
        parts.length > 0
          ? `Split evidence into packets — ${parts.join(" · ")}.`
          : raw || "Evidence split into transcript, tool trace, and definition packets.",
      subline: flags ? `Available: ${flags}. No interpretation.` : "No interpretation.",
      hero: true,
    };
  }

  if (kind === "NormalizerEvidenceRequest") {
    return { line: clip(raw, 240), hero: true };
  }

  if (
    kind === "TheoryOpening" ||
    kind === "TheoryChallenge" ||
    kind === "TheoryWithdrawal" ||
    kind === "TheoryCounter" ||
    kind === "TheorySynthesis"
  ) {
    const p = payload as { line?: string };
    return {
      line: p.line ?? raw,
      hero:
        kind === "TheoryChallenge" ||
        kind === "TheoryCounter" ||
        kind === "TheorySynthesis" ||
        kind === "TheoryWithdrawal",
    };
  }

  return { line: clip(raw) };
}

const THEORY_ROLE_LABELS: Record<string, string> = {
  customer_advocate: "Customer Advocate",
  system_auditor: "System Auditor",
  skeptic: "Skeptic",
  reconciliation_judge: "Reconciliation Judge",
};

export function stepFromFeedEntry(input: {
  room: InvestigationRoom;
  agentId: string;
  messageId: string;
  bandEventKind?: string;
  content?: string;
  payload?: unknown;
}): Omit<InvestigationStep, "index"> | null {
  const kind = payloadType(input.payload);
  if (shouldSkipStep(kind, input.room, input.bandEventKind)) {
    return null;
  }

  const agent = getAgentDefinition(input.agentId);
  const phase = phaseForKind(kind, input.room);
  const copy = demoCopy(kind, input.content ?? "", input.payload);
  const roleKey =
    input.payload &&
    typeof input.payload === "object" &&
    "agent_role" in input.payload
      ? String((input.payload as { agent_role: string }).agent_role)
      : undefined;
  const roleLabel = roleKey ? THEORY_ROLE_LABELS[roleKey] : undefined;

  return {
    id: input.messageId,
    room: input.room,
    agentId: input.agentId,
    agentShort: agent?.shortLabel ?? input.agentId.slice(0, 3).toUpperCase(),
    agentLabel: roleLabel ?? agent?.label ?? input.agentId,
    phase,
    headline: headlineForKind(kind),
    line: copy.line,
    subline: copy.subline,
    pointer: copy.pointer,
    crossRoom: crossRoomForKind(kind, input.room),
    kind,
    messageId: input.messageId,
    hero: copy.hero,
  };
}

export function filterDemoSteps(steps: InvestigationStep[]): InvestigationStep[] {
  return steps
    .filter((s) => isDemoVisibleBeat(s.kind, s.room))
    .map((step, index) => ({ ...step, index }));
}

export const DEMO_PHASES: { id: DemoPhase; label: string }[] = [
  { id: "cause", label: "Cause" },
  { id: "cross_room", label: "Cross-room" },
  { id: "localization", label: "Localization" },
  { id: "breakthrough", label: "Breakthrough" },
  { id: "surface", label: "Surface" },
  { id: "complete", label: "Done" },
];

type FeedRow = {
  agentId: string;
  messageId: string;
  bandEventKind?: string;
  content?: string;
  payload?: unknown;
};

function pushFeedRows(
  merged: Omit<InvestigationStep, "index">[],
  rows: FeedRow[],
  room: "cause" | "localization",
) {
  for (const row of rows) {
    const step = stepFromFeedEntry({
      room,
      agentId: row.agentId,
      messageId: row.messageId,
      bandEventKind: row.bandEventKind,
      content: row.content,
      payload: row.payload,
    });
    if (step) merged.push(step);
  }
}

/** Rebuild curated demo steps from a saved investigation. */
export function stepsFromInvestigationRun(run: {
  stepTimeline?: InvestigationStep[];
  realityCollision?: { feedTimeline?: Array<FeedRow & { room: InvestigationRoom }> };
  causeRoom?: { feedTimeline?: FeedRow[] };
  localizationRoom?: {
    feedTimeline?: FeedRow[];
    causeDefenseFeedTimeline?: FeedRow[];
  };
}): InvestigationStep[] {
  if (run.stepTimeline?.length) {
    return filterDemoSteps(run.stepTimeline);
  }

  if (run.realityCollision?.feedTimeline?.length) {
    const merged: Omit<InvestigationStep, "index">[] = [];
    for (const row of run.realityCollision.feedTimeline) {
      const step = stepFromFeedEntry({
        room: row.room,
        agentId: row.agentId,
        messageId: row.messageId,
        bandEventKind: row.bandEventKind,
        content: row.content,
        payload: row.payload,
      });
      if (step) merged.push(step);
    }
    return merged.map((step, index) => ({ ...step, index }));
  }

  const merged: Omit<InvestigationStep, "index">[] = [];
  pushFeedRows(merged, run.causeRoom?.feedTimeline ?? [], "cause");

  const locFeed = run.localizationRoom?.feedTimeline ?? [];
  const defenseFeed = run.localizationRoom?.causeDefenseFeedTimeline ?? [];
  let defenseInserted = false;

  for (const row of locFeed) {
    const kind = payloadType(row.payload);
    if (
      !defenseInserted &&
      kind === "CauseDefenseRequest" &&
      defenseFeed.length > 0
    ) {
      pushFeedRows(merged, defenseFeed, "cause");
      defenseInserted = true;
    }
    const step = stepFromFeedEntry({
      room: "localization",
      agentId: row.agentId,
      messageId: row.messageId,
      bandEventKind: row.bandEventKind,
      content: row.content,
      payload: row.payload,
    });
    if (step) merged.push(step);
  }

  return merged.map((step, index) => ({ ...step, index }));
}
