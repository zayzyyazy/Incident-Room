import { VoiceIncidentEvidence } from "@/lib/evidence/types";

export type StoredToolCall = {
  name: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  status?: "success" | "error" | "timeout";
  turn_ref?: string;
  startedAt?: string;
  completedAt?: string;
};

export type StoredChatMessage = {
  role: string;
  content: string;
  timestamp?: string | Date;
  intent?: string | null;
  toolsCalled?: StoredToolCall[];
  tools_called?: StoredToolCall[];
  roomId?: string;
  analyzer?: Record<string, unknown>;
  workflowTrace?: unknown[];
};

export type ChatEvidenceOptions = {
  chatId: string;
  userId: string;
  roomId?: string;
  analyzer?: Record<string, unknown>;
  title?: string;
};

function sanitizeIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
}

export function incidentIdForChat(chatId: string) {
  return `CHAT-${sanitizeIdPart(chatId)}`;
}

function turnId(index: number) {
  return `T${String(index + 1).padStart(2, "0")}`;
}

function roleToSpeaker(role: string): "agent" | "customer" | "system" {
  if (role === "assistant") {
    return "agent";
  }
  if (role === "user") {
    return "customer";
  }
  return "system";
}

function normalizeTools(messages: StoredChatMessage[]): StoredToolCall[] {
  return messages.flatMap((message) => {
    const tools = message.toolsCalled ?? message.tools_called ?? [];
    return tools.map((tool) => ({
      ...tool,
      arguments: tool.arguments ?? {},
    }));
  });
}

function toolErrorMessage(tool: StoredToolCall) {
  if (tool.status !== "error") {
    return undefined;
  }

  if (typeof tool.result === "string") {
    return tool.result;
  }

  return JSON.stringify(tool.result);
}

function behavioralHints(messages: StoredChatMessage[]) {
  const hints = [
    {
      type: "chat_session",
      turn_ref: turnId(messages.length - 1),
      note: "Evidence was generated from the customer support chat transcript.",
    },
  ];

  messages.forEach((message, index) => {
    const tools = message.toolsCalled ?? message.tools_called ?? [];
    const hasFailedPlaceOrder = tools.some(
      (tool) => tool.name === "placeOrder" && tool.status === "error",
    );

    if (message.role === "assistant" && hasFailedPlaceOrder) {
      hints.push({
        type: "premature_closure",
        turn_ref: turnId(index),
        note: "Assistant told the customer the order was placed, but the placeOrder tool recorded no backend side effect.",
      });
    }
  });

  return hints;
}

export function buildChatEvidence(
  messages: StoredChatMessage[],
  options: ChatEvidenceOptions,
): VoiceIncidentEvidence {
  const segments = messages.map((message, index) => ({
    turn_id: turnId(index),
    speaker: roleToSpeaker(message.role),
    text: message.content,
  }));

  const transcript = segments
    .map((segment) => `${segment.turn_id} ${segment.speaker}: ${segment.text}`)
    .join("\n");

  const tools = normalizeTools(messages);
  const firstIntent = messages.find((message) => message.intent)?.intent ?? undefined;
  const title =
    options.title ??
    `Support chat ${options.chatId}${firstIntent ? ` (${firstIntent})` : ""}`;

  return {
    incident_id: incidentIdForChat(options.chatId),
    source_platform: "synthetic",
    title,
    call_metadata: {
      duration_sec: Math.max(messages.length * 20, 1),
      status: "chat_completed",
      agent_id: "replychat-band-workflow",
    },
    layer1_conversation: {
      transcript,
      segments,
      intent: firstIntent,
      behavioral_hints: behavioralHints(messages),
    },
    layer2_execution: {
      function_calls: tools.map((tool, index) => ({
        name: tool.name,
        args: tool.arguments ?? {},
        result: tool.result,
        status: tool.status ?? "success",
        turn_ref: tool.turn_ref ?? segments.at(-1)?.turn_id ?? turnId(index),
        error_message: toolErrorMessage(tool),
      })),
      side_effects: {
        appointment_created: false,
        appointment_id: null,
        sms_sent: false,
        crm_record_exists: true,
      },
      transitions: [
        {
          from: "chat",
          to: "incident_investigation_input",
          roomId: options.roomId ?? null,
          analyzer: options.analyzer ?? null,
        },
      ],
    },
    layer3_customer: {
      chatId: options.chatId,
      userId: options.userId,
      roomId: options.roomId ?? null,
      analyzer: options.analyzer ?? null,
      messages,
      tools,
    },
  };
}
