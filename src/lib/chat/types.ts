export type MongoChatToolCall = {
  name: string;
  arguments?: unknown;
  result?: unknown;
  error?: unknown;
};

export type MongoChatMessage = {
  _id?: string;
  chatId: string;
  userId?: string;
  role: string;
  content: string;
  intent?: string | null;
  toolsCalled?: MongoChatToolCall[];
  timestamp: string | Date;
  status?: string;
};

export type ChatListItem = {
  chatId: string;
  userId?: string;
  messageCount: number;
  lastTimestamp: string;
  preview: string;
  lastRole: string;
  intents: string[];
  likelyFailure: boolean;
  failureSignals: string[];
};
