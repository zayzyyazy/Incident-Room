export interface AgentState {
  messages: any[];
  next?: string;
  intent?: string;
  decision?: any;
  result?: any;
  roomId: string;
  userId: string;
}

export interface ToolCall {
  name: string;
  arguments: any;
  result?: any;
}