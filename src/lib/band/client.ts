const DEFAULT_BASE_URL = "https://app.band.ai/api/v1";
export class BandApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = "BandApiError";
  }
}

function getConfig(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || process.env.BAND_API_KEY;
  const baseUrl = process.env.BAND_REST_URL ?? DEFAULT_BASE_URL;

  if (!apiKey) {
    throw new Error("BAND_API_KEY is not set");
  }

  return { apiKey, baseUrl };
}

async function bandFetch<T>(
  path: string,
  init?: RequestInit,
  apiKeyOverride?: string,
): Promise<T> {
  const { apiKey, baseUrl } = getConfig(apiKeyOverride);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...fetchInit.headers,
    },
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "error" in body
        ? JSON.stringify((body as { error?: unknown }).error)
        : JSON.stringify(body);
    throw new BandApiError(
      `Band API ${init?.method ?? "GET"} ${path} failed (${response.status}): ${detail}`,
      response.status,
      body,
    );
  }

  return body as T;
}

export type BandAgentProfile = {
  id: string;
  handle?: string;
  name?: string;
};

export type BandChatRoom = {
  id: string;
  title?: string;
  task_id?: string | null;
};

export type BandMessageRecord = {
  id: string;
  content?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

export type BandParticipant = {
  id: string;
  handle?: string;
  name?: string;
  participant_id?: string;
};

function unwrapBandResource<T>(
  body: unknown,
  nestedKeys: string[] = [],
): T {
  let current: unknown = body;

  if (
    current &&
    typeof current === "object" &&
    "data" in current &&
    (current as { data?: unknown }).data !== undefined
  ) {
    current = (current as { data: unknown }).data;
  }

  for (const key of nestedKeys) {
    if (
      current &&
      typeof current === "object" &&
      key in current &&
      (current as Record<string, unknown>)[key] !== undefined
    ) {
      current = (current as Record<string, unknown>)[key];
    }
  }

  return current as T;
}

function requireId<T extends { id?: string }>(
  label: string,
  value: T,
  raw: unknown,
): T {
  if (!value.id) {
    throw new Error(
      `Band ${label} returned no id. Raw response: ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

export async function getAgentProfile(apiKey?: string): Promise<BandAgentProfile> {
  const raw = await bandFetch<unknown>("/agent/me", undefined, apiKey);
  return requireId(
    "getAgentProfile",
    unwrapBandResource<BandAgentProfile>(raw, ["agent"]),
    raw,
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createRoom(options?: {
  taskId?: string;
  title?: string;
  apiKey?: string;
}): Promise<BandChatRoom> {
  const chat: Record<string, unknown> = {};

  if (options?.taskId && UUID_RE.test(options.taskId)) {
    chat.task_id = options.taskId;
  }

  if (options?.title?.trim()) {
    chat.title = options.title.trim();
  }

  const raw = await bandFetch<unknown>("/agent/chats", {
    method: "POST",
    apiKey: options?.apiKey,
    body: JSON.stringify({ chat }),
  });

  return requireId(
    "createRoom",
    unwrapBandResource<BandChatRoom>(raw, ["chat"]),
    raw,
  );
}

export async function postMessage(
  roomId: string,
  content: string,
  metadata?: Record<string, unknown>,
  mentions?: Array<{ id: string; handle?: string; name?: string }>,
  apiKey?: string,
): Promise<BandMessageRecord> {
  const me = await getAgentProfile(apiKey);

  const resolvedMentions = mentions?.length
    ? mentions
    : [
        {
          id: me.id,
          handle: me.handle ?? "incident-room",
          name: me.name ?? "Incident Room",
        },
      ];

  const mentionsSelf = resolvedMentions.some((m) => m.id === me.id);

  // Band rejects self-mentions on /messages (cannot_mention_self).
  // Orchestrator posts are internal analysis → use /events (no mentions).
  if (mentionsSelf && !mentions?.length) {
    return postAgentRoomUpdate(roomId, content, metadata, apiKey);
  }

  const mentionHandle = normalizeBandHandle(
    resolvedMentions[0]?.handle ?? "incident-room",
  );
  const routedContent = contentIncludesMention(content, resolvedMentions)
    ? content
    : `@${mentionHandle} ${content}`;

  const data = await bandFetch<unknown>(
    `/agent/chats/${roomId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        message: {
          content: routedContent,
          mentions: resolvedMentions,
        },
      }),
    },
    apiKey,
  );

  return requireId(
    "postMessage",
    unwrapBandResource<BandMessageRecord>(data, ["message"]),
    data,
  );
}

export async function postAgentRoomUpdate(
  roomId: string,
  content: string,
  metadata?: Record<string, unknown>,
  apiKey?: string,
): Promise<BandMessageRecord> {
  const raw = await bandFetch<unknown>(`/agent/chats/${roomId}/events`, {
    method: "POST",
    body: JSON.stringify({
      event: {
        content,
        message_type: "thought",
        metadata,
      },
    }),
  }, apiKey);

  const event = requireId(
    "postAgentRoomUpdate",
    unwrapBandResource<{ id: string }>(raw, ["event"]),
    raw,
  );

  return {
    id: event.id,
    content,
    metadata,
  };
}

export async function postEvent(
  roomId: string,
  eventType: string,
  payload: Record<string, unknown>,
  apiKey?: string,
): Promise<unknown> {
  const { apiKey, baseUrl } = getConfig(apiKeyOverride);

  return bandFetch(`/agent/chats/${roomId}/events`, {
    method: "POST",
    apiKey,
    baseUrl,
    body: JSON.stringify({
      event: {
        message_type: eventType,
        content:
          typeof payload.content === "string"
            ? payload.content
            : JSON.stringify(payload),
        metadata: payload.metadata as Record<string, unknown> | undefined,
      },
    }),
  }, apiKey);
}

export async function addChatParticipant(
  roomId: string,
  participantId: string,
  apiKey?: string,
): Promise<BandParticipant> {
  const raw = await bandFetch<unknown>(
    `/agent/chats/${roomId}/participants`,
    {
      method: "POST",
      body: JSON.stringify({
        participant: {
          participant_id: participantId,
        },
      }),
    },
    apiKey,
  );

  return unwrapBandResource<BandParticipant>(raw, ["participant"]);
}

export async function getRoomHistory(
  roomId: string,
  apiKey?: string,
): Promise<BandMessageRecord[]> {
  const data = await bandFetch<unknown>(
    `/agent/chats/${roomId}/context`,
    undefined,
    apiKey,
  );

  const unwrapped = unwrapBandResource<unknown>(data);
  const candidates = [unwrapped, data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as BandMessageRecord[];
    }
    if (candidate && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      if (Array.isArray(record.messages)) {
        return record.messages as BandMessageRecord[];
      }
      if (
        record.context &&
        typeof record.context === "object" &&
        Array.isArray((record.context as { messages?: unknown }).messages)
      ) {
        return (record.context as { messages: BandMessageRecord[] }).messages;
      }
    }
  }

  return [];
}

export function formatBandPost(
  agentRole: string,
  messageType: string,
  payload: unknown,
): string {
  return `[${agentRole}] ${messageType}\n\n${JSON.stringify(payload, null, 2)}`;
}

function normalizeBandHandle(handle: string) {
  return handle.replace(/^@+/, "");
}

function contentIncludesMention(
  content: string,
  mentions: Array<{ id: string; handle?: string; name?: string }>,
) {
  return mentions.some((mention) => {
    if (!mention.handle) {
      return false;
    }

    return content.includes(`@${normalizeBandHandle(mention.handle)}`);
  });
}
