export interface AgentState {
  messages: Array<{ role: string; content: string }>;
  next?: string;
  intent?: string;
  decision?: Record<string, unknown>;
  result?: unknown;
  roomId: string;
  userId: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}