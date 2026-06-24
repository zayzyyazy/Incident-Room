import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { LeapingAgentSlice } from "@/lib/localization-room/load-artifact";
import {
  DefinitionPacket,
  RoutedEvidence,
  RoutedEvidenceSchema,
  RoutingStatus,
  ToolTracePacket,
  TranscriptPacket,
} from "@/lib/normalizer/types";

const FORBIDDEN_INTERPRETATION_KEYS = new Set([
  "belief",
  "confidence",
  "verdict",
  "finding",
  "customer_believed",
  "failed_execution",
  "intent",
  "behavioral_hints",
  "hypothesis",
  "cause",
  "summary",
]);

function sideEffectsAsRecords(
  sideEffects: VoiceIncidentEvidence["layer2_execution"]["side_effects"],
) {
  return Object.entries(sideEffects).map(([key, value]) => ({ key, value }));
}

export function buildTranscriptPacket(
  evidence: VoiceIncidentEvidence,
): TranscriptPacket {
  const turns = evidence.layer1_conversation.segments.map((s) => ({
    turn_id: s.turn_id,
    speaker: s.speaker,
    text: s.text,
    ...(s.start_sec != null ? { start_sec: s.start_sec } : {}),
  }));

  const speaker_labels = Array.from(
    new Set(turns.map((t) => t.speaker)),
  ) as string[];

  const timestamps = turns
    .map((t) => t.start_sec)
    .filter((t): t is number => typeof t === "number");

  return { turns, speaker_labels, timestamps };
}

export function buildToolTracePacket(
  evidence: VoiceIncidentEvidence,
): ToolTracePacket {
  const tool_calls = evidence.layer2_execution.function_calls.map((c) => ({
    name: c.name,
    ...(c.args ? { args: c.args } : {}),
    ...(c.status ? { status: c.status } : {}),
    ...(c.turn_ref ? { turn_ref: c.turn_ref } : {}),
    ...(c.http_status != null ? { http_status: c.http_status } : {}),
    ...(c.error_message ? { error_message: c.error_message } : {}),
  }));

  const tool_results = evidence.layer2_execution.function_calls
    .filter((c) => c.result !== undefined)
    .map((c) => ({
      tool_name: c.name,
      result: c.result,
      ...(c.turn_ref ? { turn_ref: c.turn_ref } : {}),
    }));

  const errors = evidence.layer2_execution.function_calls
    .filter((c) => c.status === "error" || c.status === "timeout" || c.error_message)
    .map((c) => ({
      tool_name: c.name,
      ...(c.status ? { status: c.status } : {}),
      ...(c.http_status != null ? { http_status: c.http_status } : {}),
      ...(c.error_message ? { error_message: c.error_message } : {}),
      ...(c.turn_ref ? { turn_ref: c.turn_ref } : {}),
    }));

  return {
    tool_calls,
    tool_results,
    errors,
    side_effects: sideEffectsAsRecords(
      evidence.layer2_execution.side_effects,
    ),
  };
}

export function buildDefinitionPacket(
  artifact?: LeapingAgentSlice | null,
): DefinitionPacket {
  if (!artifact) {
    return {
      nodes: [],
      edges: [],
      tool_bindings: [],
      prompts: [],
      guards: [],
    };
  }

  const nodes = artifact.stages.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    metadata: {
      ...(s.field_name ? { field_name: s.field_name } : {}),
      ...(s.value !== undefined ? { value: s.value } : {}),
      ...(s.functions?.length ? { functions: s.functions } : {}),
    },
  }));

  const edges: DefinitionPacket["edges"] = [];
  for (const stage of artifact.stages) {
    for (const transition of stage.transitions ?? []) {
      if (!transition.to) continue;
      edges.push({
        from: stage.id,
        to: transition.to,
        label: transition.name ?? transition.description,
      });
    }
  }

  const tool_bindings = artifact.functions.map((f) => ({
    name: f.name,
    type: f.type,
    ...(f.method ? { method: f.method } : {}),
    ...(f.description ? { description: f.description } : {}),
  }));

  const prompts: DefinitionPacket["prompts"] = [];
  if (artifact.system_message_excerpt || artifact.system_message) {
    prompts.push({
      scope: "system",
      excerpt:
        artifact.system_message_excerpt ??
        artifact.system_message!.slice(0, 1200),
    });
  }
  for (const stage of artifact.stages) {
    if (!stage.stage_message) continue;
    prompts.push({
      scope: "stage",
      ref: stage.id,
      excerpt: stage.stage_message,
    });
  }

  const guards = artifact.functions
    .filter((f) => f.type === "guard" || /guard|confirm/i.test(f.description ?? ""))
    .map((f) => ({
      ref: f.name,
      kind: f.type,
      description: f.description,
    }));

  return { nodes, edges, tool_bindings, prompts, guards };
}

export function buildRoutingStatus(input: {
  transcript: TranscriptPacket;
  toolTrace: ToolTracePacket;
  definition: DefinitionPacket;
}): RoutingStatus {
  return {
    has_transcript: input.transcript.turns.length > 0,
    has_tool_trace:
      input.toolTrace.tool_calls.length > 0 ||
      input.toolTrace.errors.length > 0,
    has_definition: input.definition.nodes.length > 0,
  };
}

/** Pure parser/router — splits platform JSON into packets. No inference. */
export function routeEvidence(input: {
  evidence: VoiceIncidentEvidence;
  definitionArtifact?: LeapingAgentSlice | null;
}): RoutedEvidence {
  const transcript_packet = buildTranscriptPacket(input.evidence);
  const tool_trace_packet = buildToolTracePacket(input.evidence);
  const definition_packet = buildDefinitionPacket(input.definitionArtifact);
  const routing_status = buildRoutingStatus({
    transcript: transcript_packet,
    toolTrace: tool_trace_packet,
    definition: definition_packet,
  });

  const routed = {
    transcript_packet,
    tool_trace_packet,
    definition_packet,
    routing_status,
  };

  assertNoInterpretation(routed);
  return RoutedEvidenceSchema.parse(routed);
}

function assertNoInterpretation(value: unknown, path = ""): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoInterpretation(item, path);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const full = path ? `${path}.${key}` : key;
    if (FORBIDDEN_INTERPRETATION_KEYS.has(key)) {
      throw new Error(
        `Normalizer must not emit interpretation field: ${full}`,
      );
    }
    assertNoInterpretation(child, full);
  }
}
