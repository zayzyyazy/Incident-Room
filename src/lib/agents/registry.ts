import {
  AgentChallenge,
  BackendWitnessInitial,
  CausalJudgeBridge,
  CausalJudgeRefinement,
  CausalJudgeTask,
  CauseFinding,
  ClaimTracerInitial,
  CauseRoomFeedEntry,
} from "@/lib/cause-room/types";
import { ConversationAnalysis, OutcomeAnalysis } from "@/lib/band/message-types";
import {
  EliminatedExplanation,
  InvestigatorYield,
  LocalizationFinding,
  MechanismDiscovery,
  MechanismFormalization,
  SurfaceAttack,
  SurfaceCandidate,
  SurfaceOpening,
} from "@/lib/localization-room/types";
import { LocalizationFeedEntry } from "@/lib/orchestrator/run-localization-room-investigation";

export type AgentDefinition = {
  id: string;
  role: string;
  label: string;
  shortLabel: string;
  layer: string;
  question: string;
  accentClass: string;
  borderClass: string;
  glowClass: string;
  messageType: string;
  order: number;
  enabled: boolean;
  room?: "cause" | "localization" | "legacy";
};

export const CAUSE_ROOM_AGENTS: AgentDefinition[] = [
  {
    id: "claim_tracer",
    role: "claim_tracer",
    label: "Claim Tracer",
    shortLabel: "CT",
    layer: "L1 · Conversation",
    question: "What causal class explains customer belief from transcript alone?",
    accentClass: "text-trace",
    borderClass: "border-trace/40",
    glowClass: "shadow-glow-trace",
    messageType: "claim_tracer_initial",
    order: 1,
    enabled: true,
    room: "cause",
  },
  {
    id: "backend_witness",
    role: "backend_witness",
    label: "Backend Witness",
    shortLabel: "BW",
    layer: "L2 · Execution",
    question: "What causal class explains tool/API/state evidence?",
    accentClass: "text-signal",
    borderClass: "border-signal/40",
    glowClass: "shadow-glow-signal",
    messageType: "backend_witness_initial",
    order: 2,
    enabled: true,
    room: "cause",
  },
  {
    id: "causal_judge",
    role: "causal_judge",
    label: "Causal Judge",
    shortLabel: "CJ",
    layer: "Bridge · Causality",
    question: "After conflict — what bridge class survives cross-domain scrutiny?",
    accentClass: "text-command",
    borderClass: "border-command/40",
    glowClass: "shadow-glow-command",
    messageType: "causal_judge_bridge",
    order: 3,
    enabled: true,
    room: "cause",
  },
];

export const LOCALIZATION_ROOM_AGENTS: AgentDefinition[] = [
  {
    id: "control_flow_investigator",
    role: "control_flow_investigator",
    label: "Control Flow Investigator",
    shortLabel: "CFI",
    layer: "Graph · Execution path",
    question: "What execution path could emit this behavior?",
    accentClass: "text-signal",
    borderClass: "border-signal/40",
    glowClass: "shadow-glow-signal",
    messageType: "surface_candidate",
    order: 4,
    enabled: true,
    room: "localization",
  },
  {
    id: "policy_investigator",
    role: "policy_investigator",
    label: "Policy Investigator",
    shortLabel: "PI",
    layer: "Policy · Prompts",
    question: "What instruction or policy permits this behavior?",
    accentClass: "text-trace",
    borderClass: "border-trace/40",
    glowClass: "shadow-glow-trace",
    messageType: "surface_candidate",
    order: 5,
    enabled: true,
    room: "localization",
  },
  {
    id: "guard_investigator",
    role: "guard_investigator",
    label: "Guard Investigator",
    shortLabel: "GI",
    layer: "Contracts · Guards",
    question: "What missing guard allows this behavior?",
    accentClass: "text-alert",
    borderClass: "border-alert/40",
    glowClass: "shadow-glow-alert",
    messageType: "surface_candidate",
    order: 6,
    enabled: true,
    room: "localization",
  },
  {
    id: "localization_judge",
    role: "localization_judge",
    label: "Mechanism Judge",
    shortLabel: "MJ",
    layer: "Discovery · Mechanism",
    question: "What implementation mechanism survives when every surface theory is incomplete?",
    accentClass: "text-command",
    borderClass: "border-command/40",
    glowClass: "shadow-glow-command",
    messageType: "localization_finding",
    order: 7,
    enabled: true,
    room: "localization",
  },
];

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: "evidence_normalizer",
    role: "evidence_normalizer",
    label: "Evidence Router",
    shortLabel: "NR",
    layer: "Router · Packets",
    question: "Where does each evidence slice live — transcript, tool trace, or definition?",
    accentClass: "text-room-muted",
    borderClass: "border-room-border",
    glowClass: "",
    messageType: "NormalizerRouting",
    order: 0,
    enabled: true,
    room: "cause",
  },
  ...CAUSE_ROOM_AGENTS,
  ...LOCALIZATION_ROOM_AGENTS,
  {
    id: "conversation_analyst",
    role: "conversation_analyst",
    label: "Conversation Analyst",
    shortLabel: "CA",
    layer: "Legacy · L1",
    question: "What did the customer believe from the transcript?",
    accentClass: "text-trace",
    borderClass: "border-trace/40",
    glowClass: "shadow-glow-trace",
    messageType: "conversation_analysis",
    order: 10,
    enabled: false,
    room: "legacy",
  },
  {
    id: "outcome_investigator",
    role: "outcome_investigator",
    label: "Outcome Investigator",
    shortLabel: "OI",
    layer: "Legacy · L2",
    question: "What actually happened in execution?",
    accentClass: "text-signal",
    borderClass: "border-signal/40",
    glowClass: "shadow-glow-signal",
    messageType: "outcome_analysis",
    order: 11,
    enabled: false,
    room: "legacy",
  },
];

export type AgentFeedMessage = {
  agentId: string;
  messageId?: string;
  messageType?: string;
  bandEventKind?: string;
  content?: string;
  payload:
    | ConversationAnalysis
    | OutcomeAnalysis
    | ClaimTracerInitial
    | BackendWitnessInitial
    | CausalJudgeTask
    | CausalJudgeBridge
    | CausalJudgeRefinement
    | AgentChallenge
    | CauseFinding
    | SurfaceCandidate
    | SurfaceOpening
    | SurfaceAttack
    | InvestigatorYield
    | MechanismFormalization
    | MechanismDiscovery
    | EliminatedExplanation
    | LocalizationFinding
    | Record<string, unknown>;
  contradictsMessageId?: string | null;
};

export function buildFeedFromTimeline(
  timeline: CauseRoomFeedEntry[],
): AgentFeedMessage[] {
  return timeline.map((entry) => ({
    agentId: entry.agentId,
    messageId: entry.messageId,
    bandEventKind: entry.bandEventKind,
    content: entry.content,
    messageType:
      entry.payload &&
      typeof entry.payload === "object" &&
      "type" in entry.payload
        ? String((entry.payload as { type: string }).type)
        : undefined,
    payload: (entry.payload ?? { content: entry.content }) as AgentFeedMessage["payload"],
  }));
}

export function buildFeedFromCauseRoom(result: {
  feedTimeline?: CauseRoomFeedEntry[];
  bandMessageIds?: Record<string, string | string[]>;
  claimTracerInitial?: ClaimTracerInitial;
  backendWitnessInitial?: BackendWitnessInitial;
  causalJudgeTask?: CausalJudgeTask;
  causalJudgeBridge?: CausalJudgeBridge;
  causalJudgeRefinement?: CausalJudgeRefinement;
  claimTracerChallenge1?: AgentChallenge;
  backendWitnessChallenge1?: AgentChallenge;
  claimTracerChallenge2?: AgentChallenge;
  backendWitnessChallenge2?: AgentChallenge;
  causeFinding?: CauseFinding;
}): AgentFeedMessage[] {
  if (result.feedTimeline?.length) {
    return buildFeedFromTimeline(result.feedTimeline);
  }

  const entries: Array<[string, string | undefined, unknown]> = [
    ["claim_tracer", asString(result.bandMessageIds?.claimTracerInitial), result.claimTracerInitial],
    ["backend_witness", asString(result.bandMessageIds?.backendWitnessInitial), result.backendWitnessInitial],
    ["claim_tracer", asString(result.bandMessageIds?.claimTracerChallenge1), result.claimTracerChallenge1],
    ["backend_witness", asString(result.bandMessageIds?.backendWitnessChallenge1), result.backendWitnessChallenge1],
    ["causal_judge", asString(result.bandMessageIds?.causalJudgeTask), result.causalJudgeTask],
    ["causal_judge", asString(result.bandMessageIds?.causalJudgeBridge), result.causalJudgeBridge],
    ["claim_tracer", asString(result.bandMessageIds?.claimTracerChallenge2), result.claimTracerChallenge2],
    ["backend_witness", asString(result.bandMessageIds?.backendWitnessChallenge2), result.backendWitnessChallenge2],
    ["causal_judge", asString(result.bandMessageIds?.causalJudgeRefinement), result.causalJudgeRefinement],
    ["causal_judge", asString(result.bandMessageIds?.causeFinding), result.causeFinding],
  ];

  return entries
    .filter(([, , payload]) => payload !== undefined)
    .map(([agentId, messageId, payload]) => ({
      agentId,
      messageId,
      messageType:
        payload && typeof payload === "object" && "type" in payload
          ? String((payload as { type: string }).type)
          : undefined,
      payload: payload as AgentFeedMessage["payload"],
    }));
}

function asString(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildFeedFromLocalizationRoom(result: {
  feedTimeline?: LocalizationFeedEntry[];
}): AgentFeedMessage[] {
  if (!result.feedTimeline?.length) return [];
  return result.feedTimeline.map((entry) => ({
    agentId: entry.agentId,
    messageId: entry.messageId,
    bandEventKind: entry.bandEventKind,
    content: entry.content,
    messageType:
      entry.payload &&
      typeof entry.payload === "object" &&
      "type" in entry.payload
        ? String((entry.payload as { type: string }).type)
        : undefined,
    payload: (entry.payload ?? { content: entry.content }) as AgentFeedMessage["payload"],
  }));
}

export function buildFeedFromInvestigation(result: {
  bandMessageIds?: { conversation: string; outcome: string };
  conversationAnalysis?: ConversationAnalysis;
  outcomeAnalysis?: OutcomeAnalysis;
}): AgentFeedMessage[] {
  const messages: AgentFeedMessage[] = [];

  if (result.conversationAnalysis) {
    messages.push({
      agentId: "conversation_analyst",
      messageId: result.bandMessageIds?.conversation,
      payload: result.conversationAnalysis,
    });
  }

  if (result.outcomeAnalysis) {
    messages.push({
      agentId: "outcome_investigator",
      messageId: result.bandMessageIds?.outcome,
      payload: result.outcomeAnalysis,
      contradictsMessageId: result.outcomeAnalysis.contradicts_msg_id,
    });
  }

  return messages.sort((a, b) => {
    const orderA =
      AGENT_REGISTRY.find((r) => r.id === a.agentId)?.order ?? 99;
    const orderB =
      AGENT_REGISTRY.find((r) => r.id === b.agentId)?.order ?? 99;
    return orderA - orderB;
  });
}

export function getAgentDefinition(
  agentId: string,
): AgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.id === agentId);
}
