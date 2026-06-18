import { z } from "zod";
import {
  FunctionCallSchema,
  TranscriptSegmentSchema,
  VoiceIncidentEvidence,
  VoiceIncidentEvidenceSchema,
} from "@/lib/evidence/types";

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
  }
  return undefined;
}

export function isLeapingCallsExport(raw: unknown): boolean {
  const root = asRecord(raw);
  if (!root) return false;
  const calls = asArray(root.calls);
  if (!calls?.length) return false;
  const first = asRecord(calls[0]);
  return Boolean(first && asArray(first.transcript));
}

export function unwrapLeapingCall(
  raw: unknown,
  callIndex = 0,
): { call: Record<string, unknown>; listCount: number } | null {
  const root = asRecord(raw);
  const calls = asArray(root?.calls);
  if (!calls?.length) return null;
  const call = asRecord(calls[callIndex] ?? calls[0]);
  if (!call) return null;
  return { call, listCount: calls.length };
}

function leapingSpeaker(sender: unknown): SegmentDraft["speaker"] {
  const value = String(sender ?? "bot").toLowerCase();
  if (["user", "customer", "caller", "human", "client", "callee"].includes(value)) {
    return "customer";
  }
  if (value === "system") return "system";
  return "agent";
}

function parseLeapingTranscript(transcript: unknown[]) {
  const segments: SegmentDraft[] = [];
  const tools: ToolDraft[] = [];
  const transitions: Record<string, unknown>[] = [];
  let intent: string | undefined;
  let endFields: Record<string, unknown> | undefined;
  let callSummary: string | undefined;

  const messageCandidates = new Map<string, SegmentDraft>();

  for (let index = 0; index < transcript.length; index++) {
    const item = transcript[index];
    const event = asRecord(item);
    if (!event) continue;

    const type = pickString(event.type) ?? "unknown";

    if (type === "start") {
      const fields = asRecord(event.fields);
      intent = pickString(fields?.intent, intent);
      continue;
    }

    if (type === "end") {
      endFields = asRecord(event.fields) ?? endFields;
      intent = pickString(endFields?.intent, intent, event.summary);
      callSummary = pickString(
        event.summary,
        endFields?.leaping_conversation_summary,
        callSummary,
      );
      continue;
    }

    if (type === "transition") {
      transitions.push({
        from: event.to_name ?? event.name,
        to: event.to_name,
        name: event.name,
        label: event.name,
        timestamp: event.timestamp,
      });
      continue;
    }

    if (type === "function") {
      const name = pickString(event.name);
      if (!name) continue;
      const error = event.error;
      tools.push({
        name,
        ...(asRecord(event.args) ? { args: asRecord(event.args)! } : {}),
        ...(event.returned !== undefined ? { result: event.returned } : {}),
        status: error != null ? "error" : "success",
        ...(error != null
          ? {
              error_message:
                typeof error === "string" ? error : JSON.stringify(error),
            }
          : {}),
        turn_ref: pickString(event.id) ?? `fn-${index}`,
      });
      continue;
    }

    if (type === "chat_message" || type === "message") {
      const text = pickString(event.text);
      if (!text) continue;
      const key =
        pickString(event.seq, event.id, event.timestamp) ?? `msg-${index}`;
      const segment: SegmentDraft = {
        turn_id: `T${String(segments.length + messageCandidates.size + 1).padStart(2, "0")}`,
        speaker: leapingSpeaker(event.sender),
        text,
        ...(pickNumber(event.timestamp) != null
          ? { start_sec: Math.floor(pickNumber(event.timestamp)!) }
          : {}),
      };

      const existing = messageCandidates.get(key);
      if (!existing || text.length >= existing.text.length) {
        messageCandidates.set(key, segment);
      }
    }
  }

  messageCandidates.forEach((segment) => {
    segments.push(segment);
  });
  enrichSegmentsFromSummary(segments, tools, callSummary);

  return { segments, tools, transitions, intent, endFields, callSummary };
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

function customerFromTools(tools: ToolDraft[]) {
  const lookup = tools.find((t) => t.name === "get_customer_by_phone" && t.status === "success");
  const result = asRecord(lookup?.result);
  if (!result) return undefined;
  return {
    crm_id: pickString(result.id),
    mail: pickString(result.mail),
    status: pickString(result.status),
    birthday_system: pickString(result.birthday),
    vip: pickString(result.vip),
    leaping_customer_record: result,
  };
}

function inferSideEffects(toolCalls: ToolDraft[]) {
  let appointment_created = false;
  let appointment_id: string | null = null;
  let sms_sent = false;
  let crm_record_exists = false;

  for (const call of toolCalls) {
    const name = call.name.toLowerCase();
    const status = call.status ?? "success";
    const result = asRecord(call.result);

    if (/appointment|callback|schedule/.test(name) && status === "success") {
      appointment_created = true;
      appointment_id =
        pickString(result?.appointment_id, result?.id, result?.booking_id) ??
        appointment_id;
    }
    if (/sms|text_message/.test(name) && status === "success") {
      sms_sent = true;
    }
    if (
      (/crm|customer|get_customer/.test(name) || name === "get_customer_by_phone") &&
      status === "success"
    ) {
      crm_record_exists = true;
    }
  }

  return { appointment_created, appointment_id, sms_sent, crm_record_exists };
}

const MUTATION_TOOL_RE =
  /update_status|pause|stornier|kuendig|send_email|send_email_box/i;

export function extractConversationSummaryText(
  toolCalls: ToolDraft[],
): string | undefined {
  const summaryCall = toolCalls.find((t) => t.name === "conversation_summary");
  if (!summaryCall) return undefined;
  if (typeof summaryCall.result === "string") return summaryCall.result;
  return pickString(asRecord(summaryCall.result)?.summary, summaryCall.result);
}

export function readImportEndFields(
  evidence: VoiceIncidentEvidence,
): Record<string, unknown> | null {
  const layer3 = asRecord(evidence.layer3_customer);
  const importBag = asRecord(layer3?._import);
  const unmapped = asRecord(importBag?.unmapped_root_values);
  const rawMeta =
    asRecord(layer3?.raw_metadata) ??
    asRecord(unmapped?.raw_metadata) ??
    asRecord(importBag?.end_fields);
  return asRecord(rawMeta?.end_fields) ?? asRecord(importBag?.end_fields);
}

function summaryDescribesCustomerInteraction(text: string): boolean {
  return /zwischen dem Benutzer|der Benutzer|die Kundin|der Kunde|Anrufer|Benutzer bat|Wunsch des Benutzers|wurde besprochen|möchte.*pausieren|möchte.*kündigen/i.test(
    text,
  );
}

function agentClaimedBackendAction(summary: string): boolean {
  return /bestätigte|vermerkte|erfolgreich abbestellt|wurde erfolgreich|Anliegen.*übermittelt|Pause entsprechend|wurde.*pausiert/i.test(
    summary,
  );
}

function hasSuccessfulMutationTool(toolCalls: ToolDraft[]): boolean {
  return toolCalls.some(
    (t) => MUTATION_TOOL_RE.test(t.name) && t.status === "success",
  );
}

function callLooksIncomplete(
  evidence: VoiceIncidentEvidence,
  endFields: Record<string, unknown> | null,
): boolean {
  const status = pickString(
    evidence.call_metadata?.status,
    endFields?.leaping_call_status,
  );
  if (/dropped|failed/i.test(status ?? "")) return true;
  if (endFields?.leaping_conversation_completed === false) return true;
  if (evidence.call_metadata?.status === "dropped") return true;

  const transitions = asArray(evidence.layer2_execution.transitions) ?? [];
  return transitions.some((item) => {
    const transition = asRecord(item);
    const label = pickString(transition?.label, transition?.name, transition?.node);
    return label === "conversation_dropped";
  });
}

function enrichSegmentsFromSummary(
  segments: SegmentDraft[],
  tools: ToolDraft[],
  callSummary?: string,
): void {
  const summaryText = callSummary ?? extractConversationSummaryText(tools);
  if (!summaryText) return;
  if (segments.some((s) => s.text.includes(summaryText.slice(0, 40)))) return;

  segments.push({
    turn_id: `T${String(segments.length + 1).padStart(2, "0")}`,
    speaker: "system",
    text: `Call summary: ${summaryText}`,
  });
}

function toolStatusRank(status: ToolDraft["status"] | undefined): number {
  if (status === "success" || status === "error" || status === "timeout") return 2;
  return 1;
}

export function dedupeToolCalls(tools: ToolDraft[]): ToolDraft[] {
  const deduped = new Map<string, ToolDraft>();
  for (const tool of tools) {
    const key = `${tool.name}:${JSON.stringify(tool.args ?? {})}:${tool.turn_ref ?? ""}`;
    const existing = deduped.get(key);
    if (
      !existing ||
      toolStatusRank(tool.status) > toolStatusRank(existing.status)
    ) {
      deduped.set(key, tool);
    }
  }
  const out: ToolDraft[] = [];
  deduped.forEach((value) => out.push(value));
  return out;
}

export type ImportAssessment = {
  outcome: "no_actionable_incident" | "possible_incident" | "clear_incident";
  reason: string;
  failed_tool_count: number;
  customer_turn_count: number;
  call_status?: string;
  signals?: string[];
};

export function assessImportedEvidence(
  evidence: VoiceIncidentEvidence,
): ImportAssessment {
  const failed = evidence.layer2_execution.function_calls.filter(
    (c) => c.status === "error" || c.status === "timeout",
  );
  const customerTurns = evidence.layer1_conversation.segments.filter(
    (s) => s.speaker === "customer",
  ).length;
  const summaryText =
    extractConversationSummaryText(evidence.layer2_execution.function_calls) ??
    evidence.layer1_conversation.segments
      .find((s) => s.text.startsWith("Call summary:"))
      ?.text.replace(/^Call summary:\s*/, "");
  const summaryCustomerSignal = summaryText
    ? summaryDescribesCustomerInteraction(summaryText)
    : false;
  const effectiveCustomerTurns =
    customerTurns + (summaryCustomerSignal ? 1 : 0);
  const endFields = readImportEndFields(evidence);
  const intent = pickString(
    evidence.layer1_conversation.intent,
    endFields?.intent,
  );
  const callStatus = pickString(
    evidence.call_metadata?.status,
    endFields?.leaping_call_status,
  );
  const incomplete = callLooksIncomplete(evidence, endFields);
  const promiseWithoutMutation =
    typeof summaryText === "string" && summaryText.trim()
      ? agentClaimedBackendAction(summaryText) &&
          !hasSuccessfulMutationTool(evidence.layer2_execution.function_calls)
      : false;

  const signals: string[] = [];
  if (summaryText) signals.push("conversation_summary_present");
  if (summaryCustomerSignal) signals.push("summary_customer_interaction");
  if (incomplete) signals.push("incomplete_call");
  if (promiseWithoutMutation) signals.push("promise_without_mutation_tool");
  if (intent) signals.push(`intent:${intent}`);

  if (promiseWithoutMutation) {
    return {
      outcome: "clear_incident",
      reason:
        "conversation_summary claims the agent completed a pause/cancel/status action, but no successful mutation tool (update_status, pause, send_email) appears in the trace.",
      failed_tool_count: failed.length,
      customer_turn_count: effectiveCustomerTurns,
      call_status: callStatus,
      signals,
    };
  }

  if (failed.length > 0) {
    return {
      outcome: "clear_incident",
      reason: `${failed.length} failed tool call(s) in the trace.`,
      failed_tool_count: failed.length,
      customer_turn_count: effectiveCustomerTurns,
      call_status: callStatus,
      signals,
    };
  }

  if (incomplete && effectiveCustomerTurns > 0) {
    return {
      outcome: "clear_incident",
      reason:
        "Customer interaction is captured (transcript or summary) but the call ended incomplete (dropped/uncompleted) — investigate whether the promised action actually ran.",
      failed_tool_count: 0,
      customer_turn_count: effectiveCustomerTurns,
      call_status: callStatus,
      signals,
    };
  }

  if (effectiveCustomerTurns === 0 && !summaryText) {
    return {
      outcome: "no_actionable_incident",
      reason:
        "All captured tools succeeded and no customer speech is in the transcript. This may be an in-progress or greeting-only call — not enough signal for a customer-harm incident.",
      failed_tool_count: 0,
      customer_turn_count: 0,
      call_status: callStatus,
      signals,
    };
  }

  if (effectiveCustomerTurns > 0 || summaryText) {
    return {
      outcome: "possible_incident",
      reason: summaryText
        ? "No failed tools, but conversation_summary or transcript describes customer intent — check for promise/side-effect mismatch."
        : "No failed tools in the trace. Only investigate if transcript shows a promise that contradicts side effects.",
      failed_tool_count: 0,
      customer_turn_count: effectiveCustomerTurns,
      call_status: callStatus,
      signals,
    };
  }

  return {
    outcome: "no_actionable_incident",
    reason:
      "All captured tools succeeded and no customer speech is in the transcript.",
    failed_tool_count: 0,
    customer_turn_count: 0,
    call_status: callStatus,
    signals,
  };
}

export function mapLeapingCallExport(input: {
  call: Record<string, unknown>;
  rawSnapshot: unknown;
  listCount?: number;
}): VoiceIncidentEvidence {
  const warnings: string[] = [];
  if ((input.listCount ?? 1) > 1) {
    warnings.push(
      `Leaping export contained ${input.listCount} calls — normalized the first call only.`,
    );
  }

  const transcript = asArray(input.call.transcript) ?? [];
  const { segments, tools, transitions, intent, endFields, callSummary } =
    parseLeapingTranscript(transcript);
  const customer = customerFromTools(tools);
  const resolvedIntent = pickString(intent, endFields?.intent);
  const resolvedStatus = pickString(
    input.call.status,
    endFields?.leaping_call_status,
    "imported",
  );

  const incidentId =
    pickString(input.call.id, input.call.leaping_call_id) ??
    `LEAP-${Date.now().toString(36)}`;

  const evidence = VoiceIncidentEvidenceSchema.parse({
    incident_id: incidentId,
    source_platform: "leaping",
    title:
      pickString(callSummary, input.call.summary, input.call.annotation) ??
      `Leaping call ${incidentId.slice(0, 8)} — ${pickString(input.call.status, "imported")}`,
    call_metadata: {
      duration_sec:
        pickNumber(
          input.call.duration_seconds,
          input.call.leaping_duration_seconds,
          endFields?.leaping_call_duration,
        ) ?? 0,
      status: resolvedStatus ?? "imported",
      ...(pickString(input.call.agent_id) ? { agent_id: pickString(input.call.agent_id) } : {}),
      ...(pickString(input.call.recording_url)
        ? { recording_url: pickString(input.call.recording_url) }
        : {}),
      leaping_call_id: incidentId,
    },
    layer1_conversation: {
      transcript: buildTranscriptString(segments),
      segments,
      ...(resolvedIntent ? { intent: resolvedIntent } : {}),
    },
    layer2_execution: {
      function_calls: tools,
      side_effects: inferSideEffects(tools),
      ...(transitions.length > 0 ? { transitions } : {}),
    },
    layer3_customer: {
      ...(customer ?? {}),
      phone: pickString(input.call.customer_phone_number),
      _import: {
        platform_detected: "leaping",
        normalized_at: new Date().toISOString(),
        raw_snapshot: input.rawSnapshot,
        leaping_call_export: true,
        warnings,
        ...(endFields ? { end_fields: endFields } : {}),
      },
    },
  });

  const assessment = assessImportedEvidence(evidence);
  return VoiceIncidentEvidenceSchema.parse({
    ...evidence,
    layer3_customer: {
      ...evidence.layer3_customer,
      _import: {
        ...(asRecord(evidence.layer3_customer?._import) ?? {}),
        assessment,
      },
    },
  });
}
