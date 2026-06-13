import { ConversationAnalysis, OutcomeAnalysis } from "@/lib/band/message-types";

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
};

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: "conversation_analyst",
    role: "conversation_analyst",
    label: "Conversation Analyst",
    shortLabel: "CA",
    layer: "L1 · Transcript",
    question: "What did the call look like to the customer?",
    accentClass: "text-trace",
    borderClass: "border-trace/40",
    glowClass: "shadow-glow-trace",
    messageType: "conversation_analysis",
    order: 1,
    enabled: true,
  },
  {
    id: "outcome_investigator",
    role: "outcome_investigator",
    label: "Outcome Investigator",
    shortLabel: "OI",
    layer: "L2 · Execution",
    question: "Did the intended outcome actually happen?",
    accentClass: "text-signal",
    borderClass: "border-signal/40",
    glowClass: "shadow-glow-signal",
    messageType: "outcome_analysis",
    order: 2,
    enabled: true,
  },
  {
    id: "customer_impact_analyst",
    role: "customer_impact_analyst",
    label: "Customer Impact Analyst",
    shortLabel: "CI",
    layer: "L3 · Customer",
    question: "How bad is this for the customer and queue?",
    accentClass: "text-amber-warm",
    borderClass: "border-amber-warm/40",
    glowClass: "shadow-glow-amber",
    messageType: "customer_impact_analysis",
    order: 3,
    enabled: false,
  },
  {
    id: "service_commander",
    role: "service_commander",
    label: "Service Commander",
    shortLabel: "SC",
    layer: "Band only",
    question: "What should customer service do?",
    accentClass: "text-command",
    borderClass: "border-command/40",
    glowClass: "shadow-glow-command",
    messageType: "service_resolution",
    order: 4,
    enabled: false,
  },
];

export type AgentFeedMessage = {
  agentId: string;
  messageId?: string;
  payload: ConversationAnalysis | OutcomeAnalysis | Record<string, unknown>;
  contradictsMessageId?: string | null;
};

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
