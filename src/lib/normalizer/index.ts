import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  RoutedEvidence,
  NormalizerRoutingArtifact,
} from "@/lib/normalizer/types";
import { routeEvidence } from "@/lib/normalizer/route-evidence";
import { LeapingAgentSlice } from "@/lib/localization-room/load-artifact";

export { normalizeImportedEvidence, normalizeImportedJson } from "@/lib/normalizer/import-evidence";
export type {
  ImportNormalizeReport,
  ImportNormalizeResult,
  ImportPlatform,
} from "@/lib/normalizer/import-evidence";

export function normalizeIncidentEvidence(input: {
  evidence: VoiceIncidentEvidence;
  definitionArtifact?: LeapingAgentSlice | null;
}): RoutedEvidence {
  return routeEvidence(input);
}

export function buildRoutingArtifact(
  routed: RoutedEvidence,
): NormalizerRoutingArtifact {
  return {
    type: "NormalizerRouting",
    routing_status: routed.routing_status,
    packet_counts: {
      transcript_turns: routed.transcript_packet.turns.length,
      tool_calls: routed.tool_trace_packet.tool_calls.length,
      definition_nodes: routed.definition_packet.nodes.length,
    },
  };
}

export function routingSummaryLine(routed: RoutedEvidence): string {
  const { routing_status, transcript_packet, tool_trace_packet, definition_packet } =
    routed;
  const parts: string[] = [];
  if (routing_status.has_transcript) {
    parts.push(`${transcript_packet.turns.length} transcript turns`);
  }
  if (routing_status.has_tool_trace) {
    parts.push(`${tool_trace_packet.tool_calls.length} tool calls`);
  }
  if (routing_status.has_definition) {
    parts.push(`${definition_packet.nodes.length} definition nodes`);
  }
  return parts.length
    ? `Routed ${parts.join(" · ")} — no interpretation.`
    : "No routable evidence packets found.";
}
