import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { IncidentCrmLink } from "@/lib/crm/types";
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
  crmLink?: IncidentCrmLink,
) {
  return {
    incident_id: evidence.incident_id,
    layer1_conversation: {
      behavioral_hints: evidence.layer1_conversation.behavioral_hints,
      segments: evidence.layer1_conversation.segments,
    },
    layer2_execution: evidence.layer2_execution,
    conversation_analysis: {
      conversation_verdict: conversationAnalysis.conversation_verdict,
      summary_en: conversationAnalysis.summary_en,
      spoken_entities: conversationAnalysis.spoken_entities,
      notable_turns: conversationAnalysis.notable_turns,
    },
    crm_context: crmLink
      ? {
          matched_on: crmLink.matched_on,
          customer: {
            customer_id: crmLink.customer.customer_id,
            name: crmLink.customer.name,
            phone: crmLink.customer.phone,
            email: crmLink.customer.email,
            birth_date: crmLink.customer.birth_date,
            address: crmLink.customer.address,
            vnr_last4: crmLink.customer.vnr_last4,
            prior_calls_14d: crmLink.customer.prior_calls_14d,
            notes: crmLink.customer.notes,
            open_tickets: crmLink.customer.open_tickets,
          },
        }
      : null,
  };
}
