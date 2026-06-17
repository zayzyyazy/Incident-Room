import {
  BandAgentProfile,
  getBandRoomHostApiKey,
  isReusingBandRoom,
  postAgentRoomUpdate,
  postEvent,
} from "@/lib/band/client";
import { LocalizationInvestigatorRole } from "@/lib/localization-room/types";

export type LocalizationRoomBandRole = LocalizationInvestigatorRole;

export type LocalizationRoomAgentConfig = {
  role: LocalizationRoomBandRole;
  apiKey: string;
  profile: BandAgentProfile;
  displayName: string;
};

/** Locked Band display names — register agents in Band with these exact names. */
export const LOCALIZATION_ROLE_DISPLAY_NAMES: Record<
  LocalizationRoomBandRole,
  string
> = {
  control_flow_investigator: "Control Flow Investigator",
  policy_investigator: "Policy Investigator",
  guard_investigator: "Guard Investigator",
  localization_judge: "Localization Judge",
};

export const LOCALIZATION_ROLE_QUESTIONS: Record<
  LocalizationRoomBandRole,
  string
> = {
  control_flow_investigator:
    "What execution path could emit this behavior?",
  policy_investigator:
    "What instruction or policy permits this behavior?",
  guard_investigator: "What missing guard allows this behavior?",
  localization_judge:
    "Formalize the mechanism investigators discovered — referee only, do not discover.",
};

const ROLE_ENV_KEYS: Record<LocalizationRoomBandRole, string[]> = {
  control_flow_investigator: ["BAND_API_KEY_CONTROL_FLOW_INVESTIGATOR"],
  policy_investigator: ["BAND_API_KEY_POLICY_INVESTIGATOR"],
  guard_investigator: ["BAND_API_KEY_GUARD_INVESTIGATOR"],
  localization_judge: ["BAND_API_KEY_LOCALIZATION_JUDGE"],
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

export async function resolveLocalizationRoomAgents(): Promise<
  Record<LocalizationRoomBandRole, LocalizationRoomAgentConfig>
> {
  const fallbackKey = process.env.BAND_API_KEY;
  if (!fallbackKey) {
    throw new Error("BAND_API_KEY is not set");
  }

  const roles: LocalizationRoomBandRole[] = [
    "control_flow_investigator",
    "policy_investigator",
    "guard_investigator",
    "localization_judge",
  ];

  const configs = await Promise.all(
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
        displayName:
          profile.name ?? LOCALIZATION_ROLE_DISPLAY_NAMES[role],
      } satisfies LocalizationRoomAgentConfig;
    }),
  );

  return Object.fromEntries(
    configs.map((c) => [c.role, c]),
  ) as Record<LocalizationRoomBandRole, LocalizationRoomAgentConfig>;
}

export function localizationAgentsAreDistinct(
  agents: Record<LocalizationRoomBandRole, LocalizationRoomAgentConfig>,
): boolean {
  const ids = new Set(Object.values(agents).map((a) => a.profile.id));
  return ids.size === 4;
}

export async function setupLocalizationRoomParticipants(
  roomId: string,
  roomCreatorKey: string,
  agents: Record<LocalizationRoomBandRole, LocalizationRoomAgentConfig>,
): Promise<void> {
  const { addParticipantToRoom } = await import("@/lib/band/multi-agent");

  for (const agent of Object.values(agents)) {
    if (agent.apiKey === roomCreatorKey) continue;
    await addParticipantToRoom(roomId, roomCreatorKey, agent.profile.id);
  }
}

export async function postLocalizationRoomEvent(input: {
  roomId: string;
  role: LocalizationRoomBandRole;
  agents: Record<LocalizationRoomBandRole, LocalizationRoomAgentConfig>;
  messageType: "thought" | "task" | "tool_result";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const agent = input.agents[input.role];

  let canPostAsAgent = true;
  if (isReusingBandRoom()) {
    const { ensureRoomParticipant } = await import("@/lib/band/multi-agent");
    canPostAsAgent = await ensureRoomParticipant(
      input.roomId,
      agent.profile.id,
      getBandRoomHostApiKey(agent.apiKey),
    );
  }

  if (!canPostAsAgent && isReusingBandRoom()) {
    const post = await postAgentRoomUpdate(
      input.roomId,
      `**${agent.displayName}** — ${input.content}`,
      {
        ...input.metadata,
        agentRole: input.role,
        displayName: agent.displayName,
        orchestratorFallback: true,
      },
    );
    return {
      id: post.id,
      content: input.content,
      metadata: input.metadata,
    };
  }

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
        room: "localization",
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
}
