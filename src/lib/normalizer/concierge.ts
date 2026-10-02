import {
  EvidencePacketKind,
  NormalizerEvidenceDelivery,
  NormalizerEvidenceRequest,
  RoutedEvidence,
  TranscriptPacket,
  ToolTracePacket,
  DefinitionPacket,
} from "@/lib/normalizer/types";

export type AgentEvidenceScope =
  | "claim_tracer"
  | "backend_witness"
  | "control_flow_investigator"
  | "policy_investigator"
  | "guard_investigator"
  | "localization_judge"
  | "causal_judge";

const DEFAULT_SCOPE_PACKET: Record<AgentEvidenceScope, EvidencePacketKind> = {
  claim_tracer: "transcript_packet",
  backend_witness: "tool_trace_packet",
  control_flow_investigator: "definition_packet",
  policy_investigator: "definition_packet",
  guard_investigator: "definition_packet",
  localization_judge: "definition_packet",
  causal_judge: "transcript_packet",
};

export function defaultPacketForAgent(
  agent: AgentEvidenceScope,
): EvidencePacketKind {
  return DEFAULT_SCOPE_PACKET[agent];
}

export function packetForAgent(
  routed: RoutedEvidence,
  agent: AgentEvidenceScope,
): TranscriptPacket | ToolTracePacket | DefinitionPacket {
  const kind = defaultPacketForAgent(agent);
  return getPacket(routed, kind);
}

export function getPacket(
  routed: RoutedEvidence,
  kind: EvidencePacketKind,
): TranscriptPacket | ToolTracePacket | DefinitionPacket {
  switch (kind) {
    case "transcript_packet":
      return routed.transcript_packet;
    case "tool_trace_packet":
      return routed.tool_trace_packet;
    case "definition_packet":
      return routed.definition_packet;
  }
}

/** Evidence concierge — locate and route slices. No analysis. */
export function fulfillEvidenceRequest(
  routed: RoutedEvidence,
  request: Pick<NormalizerEvidenceRequest, "requested_packet" | "ref">,
): NormalizerEvidenceDelivery {
  const payload = slicePacket(routed, request.requested_packet, request.ref);
  return {
    type: "NormalizerEvidenceDelivery",
    requested_packet: request.requested_packet,
    ref: request.ref,
    payload,
  };
}

function slicePacket(
  routed: RoutedEvidence,
  kind: EvidencePacketKind,
  ref?: string,
): unknown {
  if (!ref) {
    return getPacket(routed, kind);
  }

  if (kind === "transcript_packet") {
    const turn = routed.transcript_packet.turns.find(
      (t) => t.turn_id === ref || t.turn_id.includes(ref),
    );
    return turn ?? { error: "turn_not_found", ref };
  }

  if (kind === "tool_trace_packet") {
    const call = routed.tool_trace_packet.tool_calls.find(
      (c) => c.name === ref || c.turn_ref === ref,
    );
    const err = routed.tool_trace_packet.errors.find(
      (e) => e.tool_name === ref || e.turn_ref === ref,
    );
    return call ?? err ?? { error: "tool_ref_not_found", ref };
  }

  if (kind === "definition_packet") {
    const node = routed.definition_packet.nodes.find(
      (n) => n.id === ref || n.name === ref,
    );
    const binding = routed.definition_packet.tool_bindings.find(
      (b) => b.name === ref,
    );
    const prompt = routed.definition_packet.prompts.find(
      (p) => p.ref === ref || p.scope === ref,
    );
    return node ?? binding ?? prompt ?? { error: "definition_ref_not_found", ref };
  }

  return getPacket(routed, kind);
}

export function parseMentionRequest(content: string): {
  mention: string;
  requested_packet?: EvidencePacketKind;
  ref?: string;
} | null {
  const match = content.match(
    /@(?:normalizer|evidence_normalizer|Evidence Router)\s+(?:request\s+)?(transcript_packet|tool_trace_packet|definition_packet)(?:\s+ref:([^\s]+))?/i,
  );
  if (!match) return null;
  return {
    mention: match[0],
    requested_packet: match[1] as EvidencePacketKind,
    ref: match[2],
  };
}
