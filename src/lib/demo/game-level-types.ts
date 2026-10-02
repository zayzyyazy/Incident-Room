import { AgentSlotId } from "@/lib/demo/game-level";

export type StageSlot = {
  id: AgentSlotId;
  label: string;
  shortLabel: string;
  accent: string;
  border: string;
  glow: string;
  sprite: string;
  role: string;
};

export const STAGE_SLOTS_EXPORT: Record<AgentSlotId, StageSlot> = {
  incident_room: {
    id: "incident_room",
    label: "Incident Room",
    shortLabel: "IR",
    accent: "text-command",
    border: "border-command",
    glow: "shadow-glow-command",
    sprite: "from-command/80 to-violet-900",
    role: "Conductor",
  },
  communication_investigator: {
    id: "communication_investigator",
    label: "Communication",
    shortLabel: "CM",
    accent: "text-trace",
    border: "border-trace",
    glow: "shadow-glow-trace",
    sprite: "from-trace/90 to-cyan-900",
    role: "Transcript",
  },
  claim_tracer: {
    id: "claim_tracer",
    label: "Claim Tracer",
    shortLabel: "CT",
    accent: "text-trace",
    border: "border-trace",
    glow: "shadow-glow-trace",
    sprite: "from-trace/90 to-cyan-900",
    role: "Transcript",
  },
  execution_investigator: {
    id: "execution_investigator",
    label: "Execution",
    shortLabel: "EX",
    accent: "text-signal",
    border: "border-signal",
    glow: "shadow-glow-signal",
    sprite: "from-signal/90 to-orange-950",
    role: "Tool trace",
  },
  backend_witness: {
    id: "backend_witness",
    label: "Backend Witness",
    shortLabel: "BW",
    accent: "text-signal",
    border: "border-signal",
    glow: "shadow-glow-signal",
    sprite: "from-signal/90 to-orange-950",
    role: "Tool trace",
  },
  workflow_investigator: {
    id: "workflow_investigator",
    label: "Workflow",
    shortLabel: "WF",
    accent: "text-amber-warm",
    border: "border-amber-warm",
    glow: "shadow-glow-amber",
    sprite: "from-amber-warm/90 to-amber-950",
    role: "Architecture",
  },
  policy_investigator: {
    id: "policy_investigator",
    label: "Policy",
    shortLabel: "PL",
    accent: "text-alert",
    border: "border-alert",
    glow: "shadow-glow-alert",
    sprite: "from-rose-500/90 to-rose-950",
    role: "Guard rails",
  },
  evidence_normalizer: {
    id: "evidence_normalizer",
    label: "Normalizer",
    shortLabel: "NR",
    accent: "text-trace",
    border: "border-trace/60",
    glow: "shadow-glow-trace",
    sprite: "from-slate-500 to-slate-800",
    role: "Evidence courier",
  },
  causal_judge: {
    id: "causal_judge",
    label: "Causal Judge",
    shortLabel: "CJ",
    accent: "text-command",
    border: "border-command",
    glow: "shadow-glow-command",
    sprite: "from-command/80 to-violet-900",
    role: "Judge",
  },
  unknown: {
    id: "unknown",
    label: "Agent",
    shortLabel: "??",
    accent: "text-room-muted",
    border: "border-room-border",
    glow: "",
    sprite: "from-room-muted to-room-panel",
    role: "Unknown",
  },
};
