import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import {
  DefinitionPacket,
  TranscriptPacket,
  ToolTracePacket,
} from "@/lib/normalizer/types";
import { routeEvidence } from "@/lib/normalizer/route-evidence";
import { LeapingAgentSlice } from "@/lib/localization-room/load-artifact";
import { BandPostContext } from "@/lib/cause-room/types";

/** Claim Tracer — transcript_packet only. */
export function claimTracerEvidenceView(
  evidence: VoiceIncidentEvidence,
  routed?: ReturnType<typeof routeEvidence>,
) {
  const packets = routed ?? routeEvidence({ evidence });
  return {
    incident_id: evidence.incident_id,
    title: evidence.title,
    domain: "transcript_packet_only",
    access_boundary:
      "You receive transcript_packet ONLY. You cannot see tool results, HTTP codes, workflow definitions, or side effects. Request additional transcript context via @evidence_normalizer.",
    transcript_packet: packets.transcript_packet satisfies TranscriptPacket,
    forbidden_fields: [
      "tool_trace_packet",
      "definition_packet",
      "layer2_execution",
      "tool_calls",
      "http_status",
      "side_effects",
      "intent",
      "behavioral_hints",
    ],
  };
}

/** Backend Witness — tool_trace_packet only. */
export function backendWitnessEvidenceView(
  evidence: VoiceIncidentEvidence,
  routed?: ReturnType<typeof routeEvidence>,
) {
  const packets = routed ?? routeEvidence({ evidence });
  return {
    incident_id: evidence.incident_id,
    title: evidence.title,
    domain: "tool_trace_packet_only",
    access_boundary:
      "You receive tool_trace_packet ONLY. You cannot see transcript quotes, customer belief, or workflow definitions. Request tool execution slices via @evidence_normalizer.",
    tool_trace_packet: packets.tool_trace_packet satisfies ToolTracePacket,
    forbidden_fields: [
      "transcript_packet",
      "definition_packet",
      "transcript",
      "customer_belief",
      "spoken_commitments",
      "agent_wording",
    ],
  };
}

/** Architecture / Localization — definition_packet only (+ cause finding later). */
export function definitionEvidenceView(input: {
  evidence: VoiceIncidentEvidence;
  artifact?: LeapingAgentSlice | null;
  routed?: ReturnType<typeof routeEvidence>;
}) {
  const packets =
    input.routed ??
    routeEvidence({
      evidence: input.evidence,
      definitionArtifact: input.artifact,
    });
  return {
    incident_id: input.evidence.incident_id,
    title: input.evidence.title,
    domain: "definition_packet_only",
    access_boundary:
      "You receive definition_packet ONLY until Cause Room finalizes. No transcript or runtime tool payloads. Request workflow slices via @evidence_normalizer.",
    definition_packet: packets.definition_packet satisfies DefinitionPacket,
    forbidden_fields: [
      "transcript_packet",
      "tool_trace_packet",
      "transcript",
      "tool_results",
    ],
  };
}

function summarizePayloadForPeer(
  post: BandPostContext,
  viewer: "claim_tracer" | "backend_witness" | "causal_judge",
): Record<string, unknown> {
  const payload = post.payload;
  if (!payload || typeof payload !== "object") {
    return { post_type: post.postType };
  }

  const p = payload as Record<string, unknown>;

  if (viewer === "claim_tracer" && post.agentRole === "backend_witness") {
    return {
      post_type: post.postType,
      hypothesis_class: p.hypothesis_class,
      execution_summary_en: p.execution_summary_en,
      note: "Execution-side claim only — request tool_trace_packet from @evidence_normalizer if needed.",
    };
  }

  if (viewer === "backend_witness" && post.agentRole === "claim_tracer") {
    return {
      post_type: post.postType,
      hypothesis_class: p.hypothesis_class,
      customer_belief: p.customer_belief,
      note: "Conversation-side claim only — request transcript_packet from @evidence_normalizer if needed.",
    };
  }

  if (viewer === "causal_judge") {
    return {
      post_type: post.postType,
      hypothesis_class:
        p.hypothesis_class ??
        p.bridge_hypothesis_class ??
        p.updated_hypothesis_class ??
        p.cause_class,
      claim: p.claim ?? p.hypothesis_en ?? p.bridge_hypothesis_en ?? p.cause,
      stance: p.stance,
      challenge_type: p.challenge_type,
      preserved_from_prior: p.preserved_from_prior,
      rejected_from_prior: p.rejected_from_prior,
      cites_evidence_refs: p.new_evidence_shared ?? p.evidence_cited,
    };
  }

  return { post_type: post.postType, ...(p.type ? { type: p.type } : {}) };
}

export function bandThreadForRole(
  posts: BandPostContext[],
  role: "claim_tracer" | "backend_witness" | "causal_judge",
) {
  return posts.map((p) => ({
    band_message_id: p.messageId,
    agent_role: p.agentRole,
    post_type: p.postType,
    band_event_kind: p.bandEventKind ?? "thought",
    summary: summarizePayloadForPeer(p, role),
    note:
      role === "causal_judge"
        ? "Structured peer claim — request evidence packets from @evidence_normalizer when refs are insufficient."
        : p.agentRole === role
          ? "Your prior Band post"
          : "Peer claim via Band — challenge completeness using your packet; @mention peers or @evidence_normalizer",
  }));
}
