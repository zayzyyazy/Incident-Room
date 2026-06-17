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
import { CauseFindingArtifact, LocalizationFindingArtifact } from "@/lib/cross-room/artifacts";
import {
  CauseDefenseDecision,
  CauseDefenseRequest,
} from "@/lib/cross-room/cause-defense";
import { CauseRevisionDecision } from "@/lib/cross-room/artifacts";
import { LocalizationFeedEntry } from "@/lib/orchestrator/run-localization-room-investigation";
import {
  LocalizationFinding,
  LocalizationInvestigationArc,
  SurfaceCandidate,
} from "@/lib/localization-room/types";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";
import {
  ConversationAnalysis,
  OutcomeAnalysis,
} from "@/lib/band/message-types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { IncidentCrmLink, CrmLookupResult } from "@/lib/crm/types";

export type CauseRoomRunResult = {
  distinctBandAgents: boolean;
  bandMessageIds: Record<string, string | string[]>;
  claimTracerInitial: ClaimTracerInitial;
  backendWitnessInitial: BackendWitnessInitial;
  claimTracerChallenge1: AgentChallenge;
  backendWitnessChallenge1: AgentChallenge;
  causalJudgeTask: CausalJudgeTask;
  causalJudgeBridge: CausalJudgeBridge;
  claimTracerChallenge2: AgentChallenge;
  backendWitnessChallenge2: AgentChallenge;
  causalJudgeRefinement: CausalJudgeRefinement;
  causeFinding: CauseFinding;
  causeFindingArtifact?: CauseFindingArtifact;
  feedTimeline?: CauseRoomFeedEntry[];
  revisionDecision?: CauseRevisionDecision;
};

export type LocalizationRoomRunResult = {
  distinctBandAgents: boolean;
  roomId: string;
  causeRoomId: string;
  inputCauseFindingArtifact: CauseFindingArtifact;
  phase?: "initial" | "post_revision";
  causeDefenseRequest?: CauseDefenseRequest;
  causeDefenseDecision?: CauseDefenseDecision;
  causeDefenseFeedTimeline?: CauseRoomFeedEntry[];
  localizationDefenseVerdict?: import("@/lib/cross-room/localization-defense-verdict").LocalizationDefenseVerdict;
  causeRevisionRequest?: import("@/lib/cross-room/artifacts").CauseRevisionRequest;
  pendingCauseRevision?: boolean;
  arc?: LocalizationInvestigationArc;
  surfaceCandidates: SurfaceCandidate[];
  localizationFinding?: LocalizationFinding;
  localizationFindingArtifact?: LocalizationFindingArtifact;
  feedTimeline?: LocalizationFeedEntry[];
  bandMessageIds?: Record<string, string>;
  investigationBreakthrough?: import("@/lib/localization-room/types").InvestigationBreakthrough;
};

import { EarnedInvestigationResult } from "@/lib/investigation/events";
import { RealityCollisionResult } from "@/lib/reality/types";

export type InvestigationRun = {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "complete" | "failed";
  pipeline: "cause_room" | "full" | "legacy" | "reality_collision" | "no_actionable" | "earned_investigation";
  roomId?: string;
  localizationRoomId?: string;
  distinctBandAgents?: boolean;
  distinctLocalizationAgents?: boolean;
  bandMessageIds?: Record<string, string | string[]>;
  stepTimeline?: import("@/lib/demo/investigation-steps").InvestigationStep[];
  causeRoom?: CauseRoomRunResult;
  localizationRoom?: LocalizationRoomRunResult;
  conversationAnalysis?: ConversationAnalysis;
  outcomeAnalysis?: OutcomeAnalysis;
  contradiction?: {
    detected: boolean;
    contradicts_msg_id: string | null;
    reason: string | null;
  };
  error?: string;
  crmLink?: IncidentCrmLink;
  crmLookup?: CrmLookupResult;
  realityCollision?: RealityCollisionResult;
  earnedInvestigation?: EarnedInvestigationResult;
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
  crmLink?: IncidentCrmLink;
  lastCrmLookup?: CrmLookupResult;
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
  lastCause?: string;
  lastCauseClass?: string;
  lastRoomId?: string;
};

export function formatCauseClassLabel(causeClass?: string): string {
  return causeClass ? hypothesisClassLabel(causeClass) : "—";
}
