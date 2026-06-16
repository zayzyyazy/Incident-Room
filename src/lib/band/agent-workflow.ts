import {
  addChatParticipant,
  BandMessageRecord,
  formatBandPost,
  getRoomHistory,
  postAgentRoomUpdate,
  postMessage,
} from "@/lib/band/client";

export type BandWorkflowRole = "supervisor" | "doer" | "tool_executor";

type ConfiguredBandAgent = {
  role: BandWorkflowRole;
  name: string;
  id?: string;
  apiKey?: string;
  handle?: string;
};

type WorkflowPostOptions = {
  mentionRole?: BandWorkflowRole;
  metadata?: Record<string, unknown>;
};

const ROLE_CONFIG: Record<
  BandWorkflowRole,
  {
    name: string;
    idEnv: string;
    apiKeyEnv: string;
    handleEnv: string;
    defaultHandle: string;
  }
> = {
  supervisor: {
    name: "Supervisor",
    idEnv: "SUPERVISOR_AGENT_ID",
    apiKeyEnv: "SUPERVISOR_AGENT_API_KEY",
    handleEnv: "SUPERVISOR_AGENT_HANDLE",
    defaultHandle: "supervisor-agent",
  },
  doer: {
    name: "Doer",
    idEnv: "DOER_AGENT_ID",
    apiKeyEnv: "DOER_AGENT_API_KEY",
    handleEnv: "DOER_AGENT_HANDLE",
    defaultHandle: "doer-agent",
  },
  tool_executor: {
    name: "Tool Executor",
    idEnv: "TOOL_EXECUTOR_ID",
    apiKeyEnv: "TOOL_EXECUTOR_API_KEY",
    handleEnv: "TOOL_EXECUTOR_HANDLE",
    defaultHandle: "tool-executor-agent",
  },
};

export function getBandWorkflowAgent(role: BandWorkflowRole): ConfiguredBandAgent {
  const config = ROLE_CONFIG[role];

  return {
    role,
    name: config.name,
    id: cleanEnv(process.env[config.idEnv]),
    apiKey: cleanEnv(process.env[config.apiKeyEnv]),
    handle: normalizeHandle(
      cleanEnv(process.env[config.handleEnv]) ?? config.defaultHandle,
    ),
  };
}

export function configuredBandWorkflowAgents() {
  return (Object.keys(ROLE_CONFIG) as BandWorkflowRole[]).map((role) =>
    getBandWorkflowAgent(role),
  );
}

export async function recruitBandWorkflowAgents(roomId: string) {
  const results: Array<{
    role: BandWorkflowRole;
    status: "added" | "skipped" | "error";
    detail?: string;
  }> = [];

  for (const agent of configuredBandWorkflowAgents()) {
    if (!agent.id) {
      results.push({ role: agent.role, status: "skipped", detail: "missing id" });
      continue;
    }

    try {
      await addChatParticipant(roomId, agent.id);
      results.push({ role: agent.role, status: "added" });
    } catch (error) {
      results.push({
        role: agent.role,
        status: "error",
        detail: error instanceof Error ? error.message : "Unknown Band error",
      });
    }
  }

  return results;
}

export async function postBandWorkflowEvent(
  role: BandWorkflowRole,
  roomId: string,
  event: string,
  payload: unknown,
  options: WorkflowPostOptions = {},
) {
  const sender = getBandWorkflowAgent(role);
  const content = formatBandPost(sender.name, event, payload);
  const metadata = {
    agentRole: role,
    agentName: sender.name,
    event,
    payload,
    ...options.metadata,
  };

  if (options.mentionRole) {
    const mention = getBandWorkflowAgent(options.mentionRole);
    if (mention.id) {
      return postMessage(
        roomId,
        content,
        metadata,
        [{ id: mention.id, handle: mention.handle, name: mention.name }],
        sender.apiKey,
      );
    }
  }

  return postAgentRoomUpdate(roomId, content, metadata, sender.apiKey);
}

export async function postBandWorkflowAssignment(
  roomId: string,
  toRole: BandWorkflowRole,
  event: string,
  payload: unknown,
  metadata: Record<string, unknown> = {},
) {
  const recipient = getBandWorkflowAgent(toRole);
  const content = formatBandPost("System", event, payload);

  if (!recipient.id) {
    return postAgentRoomUpdate(roomId, content, {
      agentRole: "system",
      event,
      payload,
      missingRecipientRole: toRole,
      ...metadata,
    });
  }

  return postMessage(
    roomId,
    content,
    {
      agentRole: "system",
      event,
      payload,
      recipientRole: toRole,
      ...metadata,
    },
    [{ id: recipient.id, handle: recipient.handle, name: recipient.name }],
  );
}

export async function readBandWorkflowPayload<T>(
  roomId: string,
  event: string,
  viewerRole?: BandWorkflowRole,
): Promise<T | null> {
  const viewer = viewerRole ? getBandWorkflowAgent(viewerRole) : null;
  const histories: BandMessageRecord[][] = [];

  if (viewer?.apiKey) {
    try {
      histories.push(await getRoomHistory(roomId, viewer.apiKey));
    } catch (error) {
      console.warn(
        `Band ${viewer.name} context read failed; falling back to room owner context`,
        error,
      );
    }
  }

  try {
    histories.push(await getRoomHistory(roomId));
  } catch (error) {
    console.warn("Band room owner context read failed", error);
  }

  for (const history of histories) {
    const found = findLatestWorkflowPayload<T>(history, event);
    if (found) {
      return found;
    }
  }

  return null;
}

export function findLatestWorkflowPayload<T>(
  history: BandMessageRecord[],
  event: string,
): T | null {
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];
    const metadata = message.metadata;

    if (metadata?.event === event && metadata.payload !== undefined) {
      return metadata.payload as T;
    }

    const parsed = parseBandPost(message.content);
    if (parsed?.event === event) {
      return parsed.payload as T;
    }
  }

  return null;
}

function parseBandPost(content?: string) {
  if (!content) {
    return null;
  }

  const match = content.match(/^\[(?<agent>[^\]]+)]\s+(?<event>[^\n]+)\n\n(?<json>[\s\S]+)$/);
  if (!match?.groups) {
    return null;
  }

  try {
    return {
      agent: match.groups.agent,
      event: match.groups.event.trim(),
      payload: JSON.parse(match.groups.json) as unknown,
    };
  } catch {
    return null;
  }
}

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeHandle(handle: string) {
  return handle.replace(/^@+/, "");
}
