const DEFAULT_BASE_URL = "https://app.band.ai/api/v1";

const LOCAL_ROOM_PREFIX = "local-";

export function isLocalBandRoom(roomId: string): boolean {
  return roomId.startsWith(LOCAL_ROOM_PREFIX);
}

export function bandRoomLimitReached(error: unknown): boolean {
  if (!(error instanceof BandApiError) || error.status !== 403) {
    return false;
  }
  const body = error.body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const code =
      record.code ??
      (record.error && typeof record.error === "object"
        ? (record.error as Record<string, unknown>).code
        : undefined);
    if (code === "limit_reached") return true;
  }
  return error.message.includes("limit_reached");
}

function localBandRoomId(): string {
  return `${LOCAL_ROOM_PREFIX}${crypto.randomUUID()}`;
}

function localBandMessage(
  content: string,
  metadata?: Record<string, unknown>,
): BandMessageRecord {
  return {
    id: crypto.randomUUID(),
    content,
    metadata,
  };
}

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

/** True when posts target a user-owned demo room via BAND_REUSE_ROOM_ID. */
export function isReusingBandRoom(): boolean {
  const reuseId = process.env.BAND_REUSE_ROOM_ID?.trim();
  return Boolean(reuseId && UUID_RE.test(reuseId));
}

/**
 * Quiet Band demo: do not @mention internal LLM agents (Normaliezer, Verdictjudge).
 * They auto-reply with thoughts/tool calls and flood the room (and burn OpenAI quota).
 * Default ON — set BAND_DEMO_QUIET=0 only if you want autonomous Normalizer replies.
 */
export function isBandDemoQuiet(): boolean {
  const flag = process.env.BAND_DEMO_QUIET?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return true;
}

/** Room owner key for participant adds when reusing a manually created chat. */
export function getBandRoomHostApiKey(roomCreatorApiKey?: string): string {
  if (isReusingBandRoom() && process.env.BAND_API_KEY) {
    return process.env.BAND_API_KEY;
  }
  return roomCreatorApiKey ?? process.env.BAND_API_KEY!;
}

export async function createRoom(options?: {
  taskId?: string;
  title?: string;
  apiKey?: string;
  /** When set, skip API create and post into this room (Verdict vs Explanation). */
  reuseRoomId?: string;
}): Promise<BandChatRoom> {
  const explicitReuse = options?.reuseRoomId?.trim();
  if (explicitReuse && UUID_RE.test(explicitReuse)) {
    // #region agent log
    fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "aca1d4",
      },
      body: JSON.stringify({
        sessionId: "aca1d4",
        hypothesisId: "E-fix",
        location: "band/client.ts:createRoom:explicit-reuse",
        message: "reusing explicit Band room id",
        data: { roomId: explicitReuse.slice(0, 8), title: options?.title?.slice(0, 40) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return { id: explicitReuse, title: options?.title };
  }

  const reuseId = process.env.BAND_REUSE_ROOM_ID?.trim();
  if (reuseId && UUID_RE.test(reuseId)) {
    // #region agent log
    fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "aca1d4",
      },
      body: JSON.stringify({
        sessionId: "aca1d4",
        hypothesisId: "E-fix",
        location: "band/client.ts:createRoom:env-reuse",
        message: "reusing BAND_REUSE_ROOM_ID",
        data: { roomId: reuseId.slice(0, 8), title: options?.title?.slice(0, 40) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return { id: reuseId, title: options?.title };
  }

  const chat: Record<string, unknown> = {};

  if (options?.taskId && UUID_RE.test(options.taskId)) {
    chat.task_id = options.taskId;
  }

  if (options?.title?.trim()) {
    chat.title = options.title.trim();
  }

  // #region agent log
  fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "aca1d4",
    },
    body: JSON.stringify({
      sessionId: "aca1d4",
      hypothesisId: "A",
      location: "band/client.ts:createRoom:before",
      message: "creating Band chat room",
      data: {
        title: options?.title?.slice(0, 80) ?? null,
        hasTaskId: Boolean(options?.taskId),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    const raw = await bandFetch<unknown>("/agent/chats", {
      method: "POST",
      apiKey: options?.apiKey,
      body: JSON.stringify({ chat }),
    });

    const room = requireId(
      "createRoom",
      unwrapBandResource<BandChatRoom>(raw, ["chat"]),
      raw,
    );

    // #region agent log
    fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "aca1d4",
      },
      body: JSON.stringify({
        sessionId: "aca1d4",
        hypothesisId: "A",
        location: "band/client.ts:createRoom:success",
        message: "Band chat room created",
        data: { roomId: room.id.slice(0, 8) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return room;
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "aca1d4",
      },
      body: JSON.stringify({
        sessionId: "aca1d4",
        hypothesisId: "A-E",
        location: "band/client.ts:createRoom:error",
        message: "createRoom failed",
        data: {
          status: error instanceof BandApiError ? error.status : null,
          limitReached: bandRoomLimitReached(error),
          err:
            error instanceof Error ? error.message.slice(0, 240) : String(error),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (bandRoomLimitReached(error)) {
      const localRoom = {
        id: localBandRoomId(),
        title: options?.title,
      };

      // #region agent log
      fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "aca1d4",
        },
        body: JSON.stringify({
          sessionId: "aca1d4",
          hypothesisId: "E",
          location: "band/client.ts:createRoom:local-fallback",
          message: "using local Band room fallback after limit_reached",
          data: { roomId: localRoom.id.slice(0, 16) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      return localRoom;
    }

    throw error;
  }
}

/** Visible chat message — appears in the Band room message stream (not hidden /events). */
export async function postChatMessageAsAgent(
  roomId: string,
  content: string,
  options?: {
    apiKey?: string;
    metadata?: Record<string, unknown>;
    mentions?: Array<{ id: string; handle?: string; name?: string }>;
  },
): Promise<BandMessageRecord> {
  if (isLocalBandRoom(roomId)) {
    return localBandMessage(content, options?.metadata);
  }

  const { apiKey, baseUrl } = getConfig(options?.apiKey);
  const mentions = options?.mentions ?? [];

  const body: Record<string, unknown> = {
    message: {
      content,
      mentions,
    },
  };

  const data = await bandFetch<unknown>(
    `/agent/chats/${roomId}/messages`,
    {
      method: "POST",
      apiKey,
      baseUrl,
      body: JSON.stringify(body),
    },
  );

  const message = requireId(
    "postChatMessageAsAgent",
    unwrapBandResource<BandMessageRecord>(data, ["message"]),
    data,
  );

  return {
    id: message.id,
    content,
    metadata: options?.metadata,
  };
}

export async function postMessage(
  roomId: string,
  content: string,
  metadata?: Record<string, unknown>,
  mentions?: Array<{ id: string; handle?: string; name?: string }>,
  apiKey?: string,
): Promise<BandMessageRecord> {
  if (isLocalBandRoom(roomId)) {
    return localBandMessage(content, metadata);
  }

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
  if (isLocalBandRoom(roomId)) {
    return localBandMessage(content, metadata);
  }

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
  if (isLocalBandRoom(roomId)) {
    return {
      data: {
        event: {
          id: crypto.randomUUID(),
          message_type: eventType,
          content: payload.content,
          metadata: payload.metadata,
        },
      },
    };
  }

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
  if (isLocalBandRoom(roomId)) {
    return [];
  }

  try {
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
  } catch (error) {
    if (error instanceof BandApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
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
