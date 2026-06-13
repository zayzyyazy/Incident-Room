import {
  ConversationAnalysis,
  OutcomeAnalysis,
} from "@/lib/band/message-types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";

export type InvestigationRun = {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "complete" | "failed";
  roomId?: string;
  bandMessageIds?: {
    conversation: string;
    outcome: string;
  };
  conversationAnalysis?: ConversationAnalysis;
  outcomeAnalysis?: OutcomeAnalysis;
  contradiction?: {
    detected: boolean;
    contradicts_msg_id: string | null;
    reason: string | null;
  };
  error?: string;
};

export type IncidentStatus =
  | "pending"
  | "investigating"
  | "complete"
  | "failed";

export type IncidentRecord = {
  id: string;
  evidence: VoiceIncidentEvidence;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  lastRoomId?: string;
  investigations: InvestigationRun[];
};

export type IncidentSummary = {
  id: string;
  title: string;
  source_platform: string;
  status: IncidentStatus;
  updatedAt: string;
  investigationCount: number;
  lastVerdict?: string;
  lastExecutionVerdict?: string;
  lastRoomId?: string;
};
