import {
  BandAgentProfile,
  BandMessageRecord,
  getAgentProfile,
  getBandRoomHostApiKey,
  isLocalBandRoom,
  isReusingBandRoom,
  postAgentRoomUpdate,
  postEvent,
} from "@/lib/band/client";

export type CauseRoomBandRole =
  | "claim_tracer"
  | "backend_witness"
  | "causal_judge";

export type CauseRoomAgentConfig = {
  role: CauseRoomBandRole;
  apiKey: string;
  profile: BandAgentProfile;
  displayName: string;
};

const ROLE_ENV_KEYS: Record<CauseRoomBandRole, string[]> = {
  claim_tracer: ["BAND_API_KEY_CLAIM_TRACER"],
  backend_witness: ["BAND_API_KEY_BACKEND_WITNESS"],
  causal_judge: ["BAND_API_KEY_CAUSAL_JUDGE"],
};

const ROLE_DISPLAY_NAMES: Record<CauseRoomBandRole, string> = {
  claim_tracer: "Claim Tracer",
  backend_witness: "Backend Witness",
  causal_judge: "Causal Judge",
};

async function fetchAgentProfile(apiKey: string): Promise<BandAgentProfile> {
  const baseUrl = process.env.BAND_REST_URL ?? "https://app.band.ai/api/v1";
  const response = await fetch(`${baseUrl}/agent/me`, {
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Band profile fetch failed: ${JSON.stringify(body)}`);
  }
  const agent =
    body?.data?.agent ?? body?.agent ?? body?.data ?? body;
  if (!agent?.id) {
    throw new Error("Band profile missing agent id");
  }
  return agent as BandAgentProfile;
}

export async function resolveCauseRoomAgents(): Promise<
  Record<CauseRoomBandRole, CauseRoomAgentConfig>
> {
  const fallbackKey = process.env.BAND_API_KEY;
  if (!fallbackKey) {
    throw new Error("BAND_API_KEY is not set");
  }

  const roles: CauseRoomBandRole[] = [
    "claim_tracer",
    "backend_witness",
    "causal_judge",
  ];

  const configs: CauseRoomAgentConfig[] = await Promise.all(
    roles.map(async (role) => {
      const roleKey = ROLE_ENV_KEYS[role]
        .map((key) => process.env[key])
        .find(Boolean);
      const apiKey = roleKey ?? fallbackKey;
      const profile = await fetchAgentProfile(apiKey);
      return {
        role,
        apiKey,
        profile,
        displayName: profile.name ?? ROLE_DISPLAY_NAMES[role],
      };
    }),
  );

  return {
    claim_tracer: configs.find((c) => c.role === "claim_tracer")!,
    backend_witness: configs.find((c) => c.role === "backend_witness")!,
    causal_judge: configs.find((c) => c.role === "causal_judge")!,
  };
}

export function agentsAreDistinct(
  agents: Record<CauseRoomBandRole, CauseRoomAgentConfig>,
): boolean {
  const ids = new Set(Object.values(agents).map((a) => a.profile.id));
  return ids.size === 3;
}

export async function addParticipantToRoom(
  roomId: string,
  actingAgentApiKey: string,
  participantId: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (isLocalBandRoom(roomId)) {
    return { ok: true, status: 200, body: { local: true } };
  }

  const baseUrl = process.env.BAND_REST_URL ?? "https://app.band.ai/api/v1";
  const response = await fetch(`${baseUrl}/agent/chats/${roomId}/participants`, {
    method: "POST",
    headers: {
      "X-API-Key": actingAgentApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      participant: { participant_id: participantId, role: "member" },
    }),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { ok: response.ok, status: response.status, body };
}

/** Ensure a remote agent can post into a reused user-owned demo room. */
export async function ensureRoomParticipant(
  roomId: string,
  participantId: string,
  roomCreatorApiKey?: string,
): Promise<boolean> {
  if (isLocalBandRoom(roomId) || !isReusingBandRoom()) {
    return true;
  }

  const hostKey = getBandRoomHostApiKey(roomCreatorApiKey);
  const result = await addParticipantToRoom(roomId, hostKey, participantId);
  if (result.ok || result.status === 409 || result.status === 422) {
    return true;
  }
  return false;
}

export async function setupCauseRoomParticipants(
  roomId: string,
  roomCreatorApiKey: string,
  agents: Record<CauseRoomBandRole, CauseRoomAgentConfig>,
) {
  const creatorProfile = Object.values(agents).find(
    (a) => a.apiKey === roomCreatorApiKey,
  )?.profile;

  for (const agent of Object.values(agents)) {
    if (agent.apiKey === roomCreatorApiKey) {
      continue;
    }
    if (creatorProfile && agent.profile.id === creatorProfile.id) {
      continue;
    }

    const result = await addParticipantToRoom(
      roomId,
      roomCreatorApiKey,
      agent.profile.id,
    );

    if (!result.ok && result.status !== 409 && result.status !== 422) {
      throw new Error(
        `Failed to add ${agent.displayName} to Band room (${result.status}): ${JSON.stringify(result.body)}`,
      );
    }
  }
}

export async function postCauseRoomEvent(input: {
  roomId: string;
  role: CauseRoomBandRole;
  agents: Record<CauseRoomBandRole, CauseRoomAgentConfig>;
  messageType:
    | "thought"
    | "tool_call"
    | "tool_result"
    | "error"
    | "task";
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<BandMessageRecord> {
  const agent = input.agents[input.role];
  const canPostAsAgent = await ensureRoomParticipant(
    input.roomId,
    agent.profile.id,
    agent.apiKey,
  );

  if (!canPostAsAgent && isReusingBandRoom()) {
    try {
      const label = agent.displayName ?? input.role.replace(/_/g, " ");
      const post = await postAgentRoomUpdate(
        input.roomId,
        `**${label}** — ${input.content}`,
        {
          ...input.metadata,
          agentRole: input.role,
          displayName: label,
          orchestratorFallback: true,
        },
      );
      return {
        id: post.id,
        content: input.content,
        metadata: input.metadata,
      };
    } catch (error) {
      console.warn("Band orchestrator fallback failed:", error);
      return {
        id: crypto.randomUUID(),
        content: input.content,
        metadata: { ...input.metadata, bandError: true },
      };
    }
  }

  try {
    const raw = await postEvent(
      input.roomId,
      input.messageType,
      {
        content: input.content,
        metadata: {
          ...input.metadata,
          agentRole: input.role,
          displayName: agent.displayName,
          bandAgentId: agent.profile.id,
          bandAgentHandle: agent.profile.handle,
        },
      },
      agent.apiKey,
    );

    const event =
      raw && typeof raw === "object" && "data" in raw
        ? (raw as { data: { event?: { id: string } } }).data?.event
        : (raw as { event?: { id: string } })?.event;

    return {
      id: event?.id ?? crypto.randomUUID(),
      content: input.content,
      metadata: input.metadata,
    };
  } catch (error) {
    throw error;
  }
}

export async function postCrossAgentMessage(input: {
  roomId: string;
  fromRole: CauseRoomBandRole;
  agents: Record<CauseRoomBandRole, CauseRoomAgentConfig>;
  targetRole: CauseRoomBandRole;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<BandMessageRecord | null> {
  const from = input.agents[input.fromRole];
  const target = input.agents[input.targetRole];
  if (from.profile.id === target.profile.id) {
    return null;
  }

  const baseUrl = process.env.BAND_REST_URL ?? "https://app.band.ai/api/v1";
  const handle = target.profile.handle ?? target.profile.name ?? "peer";
  const routedContent = input.content.includes("@")
    ? input.content
    : `@${handle} ${input.content}`;

  const response = await fetch(`${baseUrl}/agent/chats/${input.roomId}/messages`, {
    method: "POST",
    headers: {
      "X-API-Key": from.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        content: routedContent,
        mentions: [
          {
            id: target.profile.id,
            handle: target.profile.handle,
            name: target.profile.name ?? target.profile.handle,
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  const message = body?.data?.message ?? body?.message ?? body;
  return {
    id: message.id,
    content: routedContent,
    metadata: input.metadata,
  };
}

export async function getOrchestratorProfile(): Promise<BandAgentProfile> {
  return getAgentProfile();
}
