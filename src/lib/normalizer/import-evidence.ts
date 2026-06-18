import { z } from "zod";
import {
  FunctionCallSchema,
  TranscriptSegmentSchema,
  VoiceIncidentEvidence,
  VoiceIncidentEvidenceSchema,
} from "@/lib/evidence/types";
import {
  assessImportedEvidence,
  dedupeToolCalls,
  isLeapingCallsExport,
  mapLeapingCallExport,
  unwrapLeapingCall,
} from "@/lib/normalizer/leaping-import";

export type { ImportAssessment } from "@/lib/normalizer/leaping-import";

export const ImportPlatformSchema = z.enum([
  "canonical",
  "leaping",
  "vapi",
  "retell",
  "bland",
  "openai_chat",
  "generic",
  "unknown",
]);

export type ImportPlatform = z.infer<typeof ImportPlatformSchema>;

export type ImportNormalizeReport = {
  platform: ImportPlatform;
  alreadyCanonical: boolean;
  incident_id: string;
  title: string;
  mapped: {
    transcript_turns: number;
    tool_calls: number;
    has_call_metadata: boolean;
    raw_preserved: boolean;
  };
  warnings: string[];
};

export type ImportNormalizeResult = {
  evidence: VoiceIncidentEvidence;
  report: ImportNormalizeReport;
};

const SOURCE_PLATFORMS = new Set([
  "leaping",
  "vapi",
  "retell",
  "bland",
  "synthetic",
]);

const WRAPPER_KEYS = [
  "data",
  "call",
  "body",
  "export",
  "incident",
  "recording",
  "payload",
  "result",
] as const;

const MESSAGE_ARRAY_KEYS = [
  "messages",
  "transcript",
  "transcript_object",
  "transcripts",
  "conversation",
  "segments",
  "turns",
  "utterances",
  "dialogue",
] as const;

const TOOL_ARRAY_KEYS = [
  "function_calls",
  "tool_calls",
  "tools",
  "toolCalls",
  "pathway_logs",
  "executions",
] as const;

type SegmentDraft = z.infer<typeof TranscriptSegmentSchema>;
type ToolDraft = z.infer<typeof FunctionCallSchema>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function unwrapPayload(raw: unknown, depth = 0): Record<string, unknown> {
  const record = asRecord(raw);
  if (!record || depth > 4) return record ?? {};

  if (record.incident_id && record.layer1_conversation && record.layer2_execution) {
    return record;
  }

  for (const key of WRAPPER_KEYS) {
    const nested = asRecord(record[key]);
    if (!nested) continue;
    if (
      nested.incident_id ||
      nested.layer1_conversation ||
      MESSAGE_ARRAY_KEYS.some((k) => nested[k] != null) ||
      TOOL_ARRAY_KEYS.some((k) => nested[k] != null)
    ) {
      return unwrapPayload(nested, depth + 1);
    }
  }

  return record;
}

function normalizeSpeaker(role: unknown): SegmentDraft["speaker"] {
  const value = String(role ?? "agent").toLowerCase();
  if (["user", "customer", "caller", "human", "client", "lead", "callee"].includes(value)) {
    return "customer";
  }
  if (value === "system") return "system";
  return "agent";
}

function inferToolStatus(input: {
  status?: unknown;
  result?: unknown;
  error?: unknown;
  http_status?: unknown;
}): ToolDraft["status"] | undefined {
  const status = pickString(input.status)?.toLowerCase();
  if (status) {
    if (status.includes("timeout")) return "timeout";
    if (["error", "failed", "failure", "rejected"].includes(status)) return "error";
    if (["success", "ok", "completed", "done"].includes(status)) return "success";
  }
  if (input.error != null) return "error";
  const http = pickNumber(input.http_status);
  if (http != null && http >= 400) return "error";
  return input.result !== undefined ? "success" : undefined;
}

function segmentFromMessage(item: Record<string, unknown>, index: number): SegmentDraft | null {
  const text = pickString(
    item.text,
    item.content,
    item.message,
    item.transcript,
    item.utterance,
  );
  if (!text) return null;

  const speaker = normalizeSpeaker(
    item.speaker ?? item.role ?? item.from ?? item.participant ?? item.type,
  );

  return {
    turn_id: pickString(item.turn_id, item.id, item.turnId, item.utterance_id) ?? `T${String(index + 1).padStart(2, "0")}`,
    speaker,
    text,
    ...(pickNumber(item.start_sec, item.start, item.start_time, item.timestamp, item.time) != null
      ? {
          start_sec: pickNumber(
            item.start_sec,
            item.start,
            item.start_time,
            item.timestamp,
            item.time,
          ),
        }
      : {}),
  };
}

function collectMessages(root: Record<string, unknown>): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];

  for (const key of MESSAGE_ARRAY_KEYS) {
    const arr = asArray(root[key]);
    if (!arr) continue;
    for (const item of arr) {
      const record = asRecord(item);
      if (record) found.push(record);
    }
  }

  const layer1 = asRecord(root.layer1_conversation);
  if (layer1) {
    const segments = asArray(layer1.segments);
    if (segments) {
      for (const item of segments) {
        const record = asRecord(item);
        if (record) found.push(record);
      }
    }
  }

  return found;
}

function buildTranscriptString(segments: SegmentDraft[]): string {
  return segments
    .map((segment) => {
      const label =
        segment.speaker === "customer"
          ? "Customer"
          : segment.speaker === "system"
            ? "System"
            : "Agent";
      return `${label}: ${segment.text}`;
    })
    .join("\n");
}

function toolFromRecord(item: Record<string, unknown>, _index: number): ToolDraft | null {
  const fn = asRecord(item.function);
  const name = pickString(
    item.name,
    item.tool_name,
    item.function_name,
    item.toolName,
    fn?.name,
  );
  if (!name) return null;

  let args = asRecord(item.args) ?? asRecord(item.arguments);
  if (!args && typeof item.arguments === "string") {
    try {
      args = JSON.parse(item.arguments) as Record<string, unknown>;
    } catch {
      args = { raw: item.arguments };
    }
  }
  if (!args && fn?.arguments) {
    if (typeof fn.arguments === "string") {
      try {
        args = JSON.parse(fn.arguments) as Record<string, unknown>;
      } catch {
        args = { raw: fn.arguments };
      }
    } else {
      args = asRecord(fn.arguments) ?? null;
    }
  }

  const result =
    item.result ??
    item.response ??
    item.output ??
    item.return_value ??
    item.tool_result ??
    item.data;

  const errorMessage = pickString(
    item.error_message,
    item.error,
    asRecord(item.error)?.message,
    asRecord(result)?.message,
    asRecord(result)?.error,
  );

  return {
    name,
    ...(args ? { args } : {}),
    ...(result !== undefined ? { result } : {}),
    status: inferToolStatus({
      status: item.status,
      result,
      error: item.error,
      http_status: item.http_status ?? item.statusCode,
    }),
    turn_ref: pickString(item.turn_ref, item.turn_id, item.turnId, item.message_id),
    ...(pickNumber(item.http_status, item.statusCode) != null
      ? { http_status: pickNumber(item.http_status, item.statusCode) }
      : {}),
    ...(errorMessage ? { error_message: errorMessage } : {}),
  };
}

function collectToolCalls(root: Record<string, unknown>): ToolDraft[] {
  const tools: ToolDraft[] = [];

  for (const key of TOOL_ARRAY_KEYS) {
    const arr = asArray(root[key]);
    if (!arr) continue;
    arr.forEach((item, index) => {
      const record = asRecord(item);
      if (!record) return;
      const mapped = toolFromRecord(record, index);
      if (mapped) tools.push(mapped);
    });
  }

  const layer2 = asRecord(root.layer2_execution);
  const layer2Calls = asArray(layer2?.function_calls);
  if (layer2Calls) {
    layer2Calls.forEach((item, index) => {
      const record = asRecord(item);
      if (!record) return;
      const mapped = toolFromRecord(record, index);
      if (mapped) tools.push(mapped);
    });
  }

  const messages = collectMessages(root);
  for (const message of messages) {
    const embedded = asArray(message.tool_calls);
    if (!embedded) continue;
    embedded.forEach((item, index) => {
      const record = asRecord(item);
      if (!record) return;
      const mapped = toolFromRecord(record, tools.length + index);
      if (mapped) tools.push(mapped);
    });
  }

  return dedupeToolCalls(tools);
}

function inferSideEffects(toolCalls: ToolDraft[]) {
  let appointment_created = false;
  let appointment_id: string | null = null;
  let sms_sent = false;
  let crm_record_exists = false;

  for (const call of toolCalls) {
    const name = call.name.toLowerCase();
    const result = asRecord(call.result);
    const status = call.status ?? "success";

    if (/appointment|callback|schedule/.test(name) && status === "success") {
      appointment_created = true;
      appointment_id =
        pickString(result?.appointment_id, result?.id, result?.booking_id) ??
        appointment_id;
    }
    if (/appointment|callback|schedule/.test(name) && status !== "success") {
      appointment_created = false;
    }
    if (/sms|text_message/.test(name) && status === "success") {
      sms_sent = true;
    }
    if (/crm|customer|note|ticket/.test(name) && status === "success") {
      crm_record_exists = true;
    }
  }

  return {
    appointment_created,
    appointment_id,
    sms_sent,
    crm_record_exists,
  };
}

function detectPlatform(root: Record<string, unknown>): ImportPlatform {
  if (VoiceIncidentEvidenceSchema.safeParse(root).success) return "canonical";
  if (root.layer1_conversation && root.layer2_execution) return "canonical";

  const platform = pickString(root.source_platform, root.platform, root.provider)?.toLowerCase();
  if (platform === "leaping" || root.leaping_call_id) return "leaping";
  if (platform === "vapi" || root.assistantId || root.assistant_id) return "vapi";
  if (platform === "retell" || root.retell_llm_dynamic_variables) return "retell";
  if (platform === "bland" || (root.call_id && root.pathway_id)) return "bland";
  if (asArray(root.messages)) return "openai_chat";
  if (
    MESSAGE_ARRAY_KEYS.some((key) => asArray(root[key])) ||
    TOOL_ARRAY_KEYS.some((key) => asArray(root[key]))
  ) {
    return "generic";
  }
  return "unknown";
}

function buildIncidentId(root: Record<string, unknown>): string {
  const existing = pickString(root.incident_id, root.id, root.call_id, root.callId);
  if (existing) return existing;

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `IMP-${stamp}-${suffix}`;
}

function buildTitle(root: Record<string, unknown>, segments: SegmentDraft[]): string {
  return (
    pickString(root.title, root.name, root.summary, root.subject, root.call_summary) ??
    (segments.find((s) => s.speaker === "customer")?.text.slice(0, 72) ||
      "Imported voice incident")
  );
}

function buildCallMetadata(root: Record<string, unknown>) {
  const metadata = asRecord(root.call_metadata) ?? {};
  const duration_sec = pickNumber(
    metadata.duration_sec,
    root.duration_sec,
    root.duration,
    root.call_duration,
    root.duration_ms != null ? Number(root.duration_ms) / 1000 : undefined,
  );
  const status = pickString(metadata.status, root.status, root.call_status, root.state);
  const agent_id = pickString(metadata.agent_id, root.agent_id, root.assistant_id, root.assistantId);
  const recording_url = pickString(metadata.recording_url, root.recording_url, root.recordingUrl);
  const leaping_call_id = pickString(
    metadata.leaping_call_id,
    root.leaping_call_id,
    root.leapingCallId,
  );

  if (!duration_sec && !status && !agent_id && !recording_url && !leaping_call_id) {
    return undefined;
  }

  return {
    duration_sec: duration_sec ?? 0,
    status: status ?? "imported",
    ...(agent_id ? { agent_id } : {}),
    ...(recording_url ? { recording_url } : {}),
    ...(leaping_call_id ? { leaping_call_id } : {}),
  };
}

function resolveSourcePlatform(
  platform: ImportPlatform,
  root: Record<string, unknown>,
): VoiceIncidentEvidence["source_platform"] {
  const explicit = pickString(root.source_platform, root.platform)?.toLowerCase();
  if (explicit && SOURCE_PLATFORMS.has(explicit)) {
    return explicit as VoiceIncidentEvidence["source_platform"];
  }
  if (platform === "leaping") return "leaping";
  if (platform === "vapi") return "vapi";
  if (platform === "retell") return "retell";
  if (platform === "bland") return "bland";
  return "synthetic";
}

function collectLayer3(root: Record<string, unknown>, rawSnapshot: unknown) {
  const layer3 = {
    ...(asRecord(root.layer3_customer) ?? {}),
  };

  const customer = asRecord(root.customer) ?? asRecord(root.caller) ?? asRecord(root.contact);
  if (customer) {
    Object.assign(layer3, customer);
  }

  layer3._import = {
    platform_detected: detectPlatform(root),
    normalized_at: new Date().toISOString(),
    raw_snapshot: rawSnapshot,
  };

  return layer3;
}

function mappedRootKeys(root: Record<string, unknown>): string[] {
  const consumed = new Set([
    "incident_id",
    "source_platform",
    "title",
    "call_metadata",
    "layer1_conversation",
    "layer2_execution",
    "layer3_customer",
    ...MESSAGE_ARRAY_KEYS,
    ...TOOL_ARRAY_KEYS,
    "messages",
    "customer",
    "caller",
    "contact",
    "duration_sec",
    "duration",
    "status",
    "agent_id",
    "assistant_id",
    "recording_url",
  ]);

  return Object.keys(root).filter((key) => !consumed.has(key));
}

function enrichCanonical(
  evidence: VoiceIncidentEvidence,
  rawSnapshot: unknown,
  platform: ImportPlatform,
): VoiceIncidentEvidence {
  const layer3 = {
    ...(evidence.layer3_customer ?? {}),
    _import: {
      platform_detected: platform,
      normalized_at: new Date().toISOString(),
      raw_snapshot: rawSnapshot,
      already_canonical: true,
    },
  };

  return VoiceIncidentEvidenceSchema.parse({
    ...evidence,
    layer3_customer: layer3,
  });
}

export function normalizeImportedEvidence(rawInput: unknown): ImportNormalizeResult {
  const warnings: string[] = [];
  const rawSnapshot = rawInput;

  if (isLeapingCallsExport(rawInput)) {
    const unwrapped = unwrapLeapingCall(rawInput);
    if (unwrapped) {
      const evidence = mapLeapingCallExport({
        call: unwrapped.call,
        rawSnapshot,
        listCount: unwrapped.listCount,
      });
      const assessment = assessImportedEvidence(evidence);
      if (assessment.outcome === "no_actionable_incident") {
        warnings.push(assessment.reason);
      }
      const importWarnings =
        (asRecord(evidence.layer3_customer?._import)?.warnings as string[] | undefined) ??
        [];
      return {
        evidence,
        report: {
          platform: "leaping",
          alreadyCanonical: false,
          incident_id: evidence.incident_id,
          title: evidence.title,
          mapped: {
            transcript_turns: evidence.layer1_conversation.segments.length,
            tool_calls: evidence.layer2_execution.function_calls.length,
            has_call_metadata: Boolean(evidence.call_metadata),
            raw_preserved: true,
          },
          warnings: [...importWarnings, ...warnings],
        },
      };
    }
  }

  const root = unwrapPayload(rawInput);

  const canonical = VoiceIncidentEvidenceSchema.safeParse(root);
  if (canonical.success) {
    const evidence = enrichCanonical(canonical.data, rawSnapshot, "canonical");
    return {
      evidence,
      report: {
        platform: "canonical",
        alreadyCanonical: true,
        incident_id: evidence.incident_id,
        title: evidence.title,
        mapped: {
          transcript_turns: evidence.layer1_conversation.segments.length,
          tool_calls: evidence.layer2_execution.function_calls.length,
          has_call_metadata: Boolean(evidence.call_metadata),
          raw_preserved: true,
        },
        warnings,
      },
    };
  }

  const platform = detectPlatform(root);
  if (platform === "unknown") {
    warnings.push(
      "Could not detect a known export shape. Mapped what was structurally available.",
    );
  }

  const messageRecords = collectMessages(root);
  const segments = messageRecords
    .map((message, index) => segmentFromMessage(message, index))
    .filter((segment): segment is SegmentDraft => segment != null);

  if (segments.length === 0) {
    const transcript = pickString(
      asRecord(root.layer1_conversation)?.transcript,
      root.transcript,
      root.transcript_text,
    );
    if (transcript) {
      segments.push({
        turn_id: "T01",
        speaker: "system",
        text: transcript,
      });
      warnings.push("No structured turns found — stored full transcript as a single system turn.");
    }
  }

  const toolCalls = collectToolCalls(root);
  const unmapped = mappedRootKeys(root);
  if (unmapped.length > 0) {
    warnings.push(
      `Preserved ${unmapped.length} unmapped top-level field(s) in layer3_customer._import.unmapped_root_keys.`,
    );
  }

  const layer3 = collectLayer3(root, rawSnapshot);
  if (asRecord(root.raw_metadata)) {
    layer3.raw_metadata = root.raw_metadata;
  }
  layer3._import = {
    ...(asRecord(layer3._import) ?? {}),
    unmapped_root_keys: unmapped,
    unmapped_root_values: Object.fromEntries(
      unmapped.map((key) => [key, root[key]]),
    ),
  };

  const evidence = VoiceIncidentEvidenceSchema.parse({
    incident_id: buildIncidentId(root),
    source_platform: resolveSourcePlatform(platform, root),
    title: buildTitle(root, segments),
    call_metadata: {
      ...buildCallMetadata(root),
    },
    layer1_conversation: {
      transcript: buildTranscriptString(segments),
      segments,
      ...(pickString(asRecord(root.layer1_conversation)?.intent, root.intent)
        ? {
            intent: pickString(
              asRecord(root.layer1_conversation)?.intent,
              root.intent,
            ),
          }
        : {}),
      ...(asArray(asRecord(root.layer1_conversation)?.behavioral_hints)
        ? {
            behavioral_hints: asArray(asRecord(root.layer1_conversation)?.behavioral_hints),
          }
        : {}),
    },
    layer2_execution: {
      function_calls: toolCalls,
      side_effects: inferSideEffects(toolCalls),
      ...(asArray(asRecord(root.layer2_execution)?.transitions)
        ? { transitions: asArray(asRecord(root.layer2_execution)?.transitions) }
        : asArray(root.transitions)
          ? { transitions: asArray(root.transitions) }
          : {}),
    },
    layer3_customer: layer3,
  });

  const assessed = assessImportedEvidence(evidence);
  const finalEvidence = VoiceIncidentEvidenceSchema.parse({
    ...evidence,
    layer3_customer: {
      ...evidence.layer3_customer,
      _import: {
        ...(asRecord(evidence.layer3_customer?._import) ?? {}),
        assessment: assessed,
      },
    },
  });

  if (assessed.outcome === "no_actionable_incident") {
    warnings.push(assessed.reason);
  }

  return {
    evidence: finalEvidence,
    report: {
      platform,
      alreadyCanonical: false,
      incident_id: finalEvidence.incident_id,
      title: finalEvidence.title,
      mapped: {
        transcript_turns: finalEvidence.layer1_conversation.segments.length,
        tool_calls: finalEvidence.layer2_execution.function_calls.length,
        has_call_metadata: Boolean(finalEvidence.call_metadata),
        raw_preserved: true,
      },
      warnings,
    },
  };
}

export function normalizeImportedJson(rawJson: string): ImportNormalizeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Invalid JSON — could not parse pasted input.");
  }
  return normalizeImportedEvidence(parsed);
}
