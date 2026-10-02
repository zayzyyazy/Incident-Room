import {
  createRoom,
  formatBandPost,
  getRoomHistory,
  postMessage,
} from "@/lib/band/client";
import {
  bandMetadataForAnalysis,
  ConversationAnalysis,
  OutcomeAnalysis,
} from "@/lib/band/message-types";
import { runConversationAnalyst } from "@/lib/agents/conversation-analyst";
import { runOutcomeInvestigator } from "@/lib/agents/outcome-investigator";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { IncidentCrmLink } from "@/lib/crm/types";
import { forAgent01, forAgent02 } from "@/lib/orchestrator/context-filter";

export type TwoAgentInvestigationResult = {
  roomId: string;
  conversationAnalysis: ConversationAnalysis;
  outcomeAnalysis: OutcomeAnalysis;
  bandMessageIds: {
    conversation: string;
    outcome: string;
  };
  history: Awaited<ReturnType<typeof getRoomHistory>>;
};

export async function runTwoAgentInvestigation(
  evidence: VoiceIncidentEvidence,
  taskId?: string,
  crmLink?: IncidentCrmLink,
): Promise<TwoAgentInvestigationResult> {
  const room = await createRoom({
    taskId,
    title: `${evidence.incident_id} · ${evidence.title}`,
  });

  const conversationAnalysis = await runConversationAnalyst(
    forAgent01(evidence),
  );

  const conversationPost = await postMessage(
    room.id,
    formatBandPost(
      "Conversation Analyst",
      "conversation_analysis",
      conversationAnalysis,
    ),
    bandMetadataForAnalysis("conversation_analysis", conversationAnalysis),
  );

  const outcomeAnalysis = await runOutcomeInvestigator(
    forAgent02(evidence, conversationAnalysis, crmLink),
    conversationPost.id,
  );

  const outcomePost = await postMessage(
    room.id,
    formatBandPost(
      "Outcome Investigator",
      "outcome_analysis",
      outcomeAnalysis,
    ),
    bandMetadataForAnalysis(
      "outcome_analysis",
      outcomeAnalysis,
      conversationPost.id,
    ),
  );

  const history = await getRoomHistory(room.id);

  return {
    roomId: room.id,
    conversationAnalysis,
    outcomeAnalysis,
    bandMessageIds: {
      conversation: conversationPost.id,
      outcome: outcomePost.id,
    },
    history,
  };
}
