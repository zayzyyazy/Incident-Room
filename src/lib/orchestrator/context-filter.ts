import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { ConversationAnalysis } from "@/lib/band/message-types";

export function forAgent01(evidence: VoiceIncidentEvidence) {
  return {
    incident_id: evidence.incident_id,
    title: evidence.title,
    layer1_conversation: evidence.layer1_conversation,
  };
}

export function forAgent02(
  evidence: VoiceIncidentEvidence,
  conversationAnalysis: ConversationAnalysis,
) {
  return {
    incident_id: evidence.incident_id,
    layer2_execution: evidence.layer2_execution,
    conversation_analysis: {
      conversation_verdict: conversationAnalysis.conversation_verdict,
      summary_en: conversationAnalysis.summary_en,
      spoken_entities: conversationAnalysis.spoken_entities,
    },
  };
}
