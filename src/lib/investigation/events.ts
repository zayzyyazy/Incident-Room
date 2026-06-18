import { z } from "zod";

export const VerdictOutcomeSchema = z.enum([
  "JUSTIFIED",
  "NOT_JUSTIFIED",
  "INSUFFICIENT_EVIDENCE",
]);

export type VerdictOutcome = z.infer<typeof VerdictOutcomeSchema>;

export const TheoryStateSchema = z.enum([
  "proposed",
  "challenged",
  "supported",
  "refined",
  "withdrawn",
  "accepted",
]);

export type TheoryState = z.infer<typeof TheoryStateSchema>;

export const InvestigationEventKindSchema = z.enum([
  "NormalizerRouting",
  "InvestigationOpened",
  "EvidenceRequested",
  "EvidenceReturned",
  "SpecialistRecruited",
  "TheoryProposed",
  "TheoryChallenged",
  "TheorySupported",
  "TheoryRefined",
  "TheoryWithdrawn",
  "TheoryAccepted",
  "ConfidenceChanged",
  "RoomChallenge",
  "VerdictIssued",
  "ExplanationIssued",
  "FixTargetIssued",
]);

export type InvestigationEventKind = z.infer<typeof InvestigationEventKindSchema>;

export type EarnedInvestigationRoom = "verdict" | "explanation" | "normalizer";

export type EarnedFeedEntry = {
  agentId: string;
  messageId: string;
  bandEventKind?: string;
  content?: string;
  payload?: {
    type: InvestigationEventKind;
    agent_role?: string;
    room?: EarnedInvestigationRoom;
    theory?: string;
    theory_state?: TheoryState;
    recruit?: string;
    verdict?: VerdictOutcome;
    confidence_before?: string;
    confidence_after?: string;
    line?: string;
    [key: string]: unknown;
  };
  room: EarnedInvestigationRoom;
};

import { IncidentPdfBrief } from "@/lib/report/types";

export type EarnedExplanation = {
  primary: string;
  rejected: Array<{ label: string; reason: string }>;
  supporting_evidence: string[];
};

export type EarnedInvestigationResult = {
  verdictRoomId: string;
  explanationRoomId: string;
  normalizerRoomId: string;
  verdict: VerdictOutcome;
  verdictRationale: string;
  explanation: EarnedExplanation;
  incidentReport: {
    type: "IncidentReport";
    finding: string;
    customer_impact: string;
    system_reality: string;
    failed_theories: Array<{ label: string; reason: string }>;
    surviving_explanation: string;
    fix_target: string;
    fix_detail?: string;
    collaboration_highlights: Array<{
      kind: string;
      agent_label: string;
      line: string;
    }>;
  };
  feedTimeline: EarnedFeedEntry[];
  bandMessageIds: Record<string, string>;
  distinctBandAgents: boolean;
  events: InvestigationEventKind[];
  pdfBrief?: IncidentPdfBrief;
};
