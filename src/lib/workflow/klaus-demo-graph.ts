import type { LeapingAgentSlice } from "@/lib/localization-room/load-artifact";

export type WorkflowNode = {
  id: string;
  name: string;
  type: string;
  functions?: string[];
  excerpt?: string;
};

export type WorkflowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type KlausDemoGraph = {
  platform: string;
  agentName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  primaryStageId: string;
  klausPathStageIds: string[];
};

/** Klaus handoff path — ordered nodes for demo highlight. */
const KLAUS_PATH = [
  "27411b25-0e4a-4fbe-933e-70ebdc7afc0f",
  "c6754cc3-030f-4f1b-96c2-b3797a00d10b",
  "23075e2c-a16f-403a-8bbd-0356a093902d",
  "6e34730e-43f5-49ac-8e4b-571f1a6ce3f8",
];

export const KLAUS_PRIMARY_STAGE_ID =
  "6e34730e-43f5-49ac-8e4b-571f1a6ce3f8";

export function buildKlausDemoGraph(slice: LeapingAgentSlice): KlausDemoGraph {
  const stageById = new Map(slice.stages.map((s) => [s.id, s]));
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  for (const id of KLAUS_PATH) {
    const stage = stageById.get(id);
    if (!stage) continue;
    nodes.push({
      id: stage.id,
      name: stage.name,
      type: stage.type,
      functions: stage.functions,
      excerpt: stage.stage_message?.slice(0, 120),
    });
  }

  for (let i = 0; i < KLAUS_PATH.length - 1; i++) {
    const from = KLAUS_PATH[i];
    const to = KLAUS_PATH[i + 1];
    const stage = stageById.get(from);
    const transition = stage?.transitions?.find((t) => t.to === to);
    edges.push({
      from,
      to,
      label: transition?.name ?? "→",
    });
  }

  return {
    platform: slice.platform ?? "leaping",
    agentName: slice.name,
    nodes,
    edges,
    primaryStageId: KLAUS_PRIMARY_STAGE_ID,
    klausPathStageIds: KLAUS_PATH,
  };
}

export function stageIdFromPointer(pointer: string): string | null {
  const match = pointer.match(/\/stages\[id=([^\]]+)\]/);
  return match?.[1] ?? null;
}
