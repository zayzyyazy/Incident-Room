import { z } from "zod";

export const FailedTheorySchema = z.object({
  label: z.string(),
  reason: z.string(),
});

export const IncidentReportSchema = z.object({
  type: z.literal("IncidentReport"),
  finding: z.string(),
  customer_impact: z.string(),
  system_reality: z.string(),
  failed_theories: z.array(FailedTheorySchema),
  surviving_explanation: z.string(),
  fix_target: z.string(),
  fix_detail: z.string().optional(),
  cause_room_finding: z.string().optional(),
  architecture_room_finding: z.string().optional(),
  reconciliation: z.string().optional(),
  collaboration_highlights: z
    .array(
      z.object({
        kind: z.string(),
        agent_label: z.string(),
        line: z.string(),
      }),
    )
    .optional(),
});

export type IncidentReport = z.infer<typeof IncidentReportSchema>;
export type FailedTheory = z.infer<typeof FailedTheorySchema>;

export type TheoryAgentRole =
  | "customer_advocate"
  | "system_auditor"
  | "skeptic"
  | "reconciliation_judge";

export const THEORY_AGENT_LABELS: Record<TheoryAgentRole, string> = {
  customer_advocate: "Customer Advocate",
  system_auditor: "System Auditor",
  skeptic: "Skeptic",
  reconciliation_judge: "Reconciliation Judge",
};

export const THEORY_AGENT_IDS: Record<TheoryAgentRole, string> = {
  customer_advocate: "claim_tracer",
  system_auditor: "backend_witness",
  skeptic: "control_flow_investigator",
  reconciliation_judge: "causal_judge",
};

export type TheoryBeatKind =
  | "TheoryOpening"
  | "TheoryChallenge"
  | "TheoryWithdrawal"
  | "TheoryCounter"
  | "TheorySynthesis"
  | "IncidentFinding";

export type TheoryScriptBeat = {
  kind: TheoryBeatKind;
  role: TheoryAgentRole;
  line: string;
  highlight?: boolean;
};

export function buildRedeliveryTheoryScript(input: {
  failedTool: string;
  failureDetail: string;
  customerQuote: string;
  beliefSummary: string;
}): TheoryScriptBeat[] {
  return [
    {
      kind: "TheoryOpening",
      role: "system_auditor",
      line: `This is a backend failure. ${input.failedTool} ${input.failureDetail}.`,
    },
    {
      kind: "TheoryOpening",
      role: "customer_advocate",
      line: `This is an unverified customer promise. ${input.beliefSummary}`,
    },
    {
      kind: "TheoryChallenge",
      role: "skeptic",
      line: "Backend failure alone cannot explain why the customer believed redelivery was confirmed.",
      highlight: true,
    },
    {
      kind: "TheoryWithdrawal",
      role: "system_auditor",
      line: "I withdraw backend-failure-only. It explains missing redelivery, not customer belief.",
    },
    {
      kind: "TheoryCounter",
      role: "skeptic",
      line: `Promise language alone cannot explain missing redelivery; ${input.failedTool} failed.`,
      highlight: true,
    },
    {
      kind: "TheorySynthesis",
      role: "reconciliation_judge",
      line: "Both are required: customer-facing promise + failed verification.",
    },
    {
      kind: "IncidentFinding",
      role: "reconciliation_judge",
      line: "The agent made an unverified customer promise.",
    },
  ];
}

export function buildIncidentReportFromScript(
  script: TheoryScriptBeat[],
  input: {
    customerImpact: string;
    systemReality: string;
    failedTool: string;
    fixDetail?: string;
  },
): IncidentReport {
  return {
    type: "IncidentReport",
    finding: "The agent made an unverified customer promise.",
    customer_impact: input.customerImpact,
    system_reality: input.systemReality,
    failed_theories: [
      {
        label: "Backend failure alone",
        reason: "Explains missing redelivery, not customer belief.",
      },
      {
        label: "Promise language alone",
        reason: "Explains belief, not missing system state.",
      },
    ],
    surviving_explanation:
      "The agent promised redelivery before the system had proof that redelivery succeeded.",
    fix_target: `Block fulfillment language until ${input.failedTool} returns success`,
    fix_detail:
      input.fixDetail ??
      `${input.failedTool} · fulfillment confirmation gate · redelivery ID required`,
  };
}
