"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

interface Message {
  id?: string;
  _id?: string;
  role: "user" | "assistant";
  content: string;
  tools_called?: ToolCall[];
  toolsCalled?: ToolCall[];
  roomId?: string;
  workflowTrace?: unknown[];
  analyzer?: unknown;
  evidence?: unknown;
  investigationInput?: unknown;
  incident?: unknown;
  timestamp: Date;
}

type ApiChatMessage = Omit<Message, "timestamp"> & {
  timestamp: string | Date;
};

type ChatSummary = {
  chatId: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
  intent?: string | null;
  hasIncident: boolean;
};

const SINGLE_USER_ID = "user-123";

function newChatId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadChatList = useCallback(async () => {
    try {
      setIsSidebarLoading(true);
      const response = await fetch("/api/chat-history");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setChats(Array.isArray(data.chats) ? data.chats : []);
    } catch (error) {
      console.error("Error loading chat list:", error);
    } finally {
      setIsSidebarLoading(false);
    }
  }, []);

  const loadChatHistory = useCallback(async () => {
    try {
      setIsInitialLoading(true);
      const response = await fetch(`/api/chat-history/${chatId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.messages && data.messages.length > 0) {
        const formattedMessages = data.messages.map((msg: ApiChatMessage) => ({
          ...msg,
          tools_called: msg.tools_called ?? msg.toolsCalled ?? [],
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setMessages([]);
    } finally {
      setIsInitialLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadChatHistory();
    loadChatList();
  }, [loadChatHistory, loadChatList]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openNewChat = () => {
    router.push(`/chat/${newChatId()}`);
  };

  const openChat = (nextChatId: string) => {
    if (nextChatId !== chatId) {
      router.push(`/chat/${nextChatId}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }

    const outgoingText = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: outgoingText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    await fetch("/api/store-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        userId: SINGLE_USER_ID,
        role: "user",
        content: outgoingText,
      }),
    });

    try {
      const response = await fetch("/api/replychat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          userId: SINGLE_USER_ID,
          message: outgoingText,
          conversationHistory: messages,
        }),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(data.reply || data.error || "ReplyChat request failed");
      }
      if (!data.reply) {
        throw new Error(data.error || "ReplyChat returned an empty reply");
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        tools_called: data.tools_called || [],
        toolsCalled: data.tools_called || [],
        roomId: data.roomId,
        workflowTrace: data.workflow_trace || [],
        analyzer: data.analyzer,
        evidence: data.evidence,
        investigationInput: data.investigation_input,
        incident: data.incident,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      await fetch("/api/store-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          userId: SINGLE_USER_ID,
          role: "assistant",
          content: data.reply,
          intent: data.intent,
          toolsCalled: data.tools_called,
          roomId: data.roomId,
          workflowTrace: data.workflow_trace,
          analyzer: data.analyzer,
          evidence: data.evidence,
          investigationInput: data.investigation_input,
          incident: data.incident,
        }),
      });

      await loadChatList();
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "I hit an internal support workflow issue.",
        tools_called: [],
        toolsCalled: [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-950 text-gray-100">
        <div className="border-b border-white/10 p-3">
          <button
            type="button"
            onClick={openNewChat}
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-medium transition hover:bg-white/15"
          >
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Previous chats - {SINGLE_USER_ID}
          </div>
          {isSidebarLoading ? (
            <div className="px-2 py-3 text-sm text-gray-400">Loading chats...</div>
          ) : chats.length === 0 ? (
            <div className="px-2 py-3 text-sm text-gray-400">
              No stored chats yet.
            </div>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.chatId}
                  type="button"
                  onClick={() => openChat(chat.chatId)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${
                    chat.chatId === chatId
                      ? "bg-white/15 text-white"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {chat.title}
                    </span>
                    {chat.hasIncident ? (
                      <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-200">
                        fail
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-gray-400">
                    {chat.preview}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500">
                    <span>{chat.messageCount} msgs</span>
                    <span>{formatRelativeDate(chat.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-xl font-semibold text-gray-800">
              Chat Interface
            </h1>
            <p className="text-sm text-gray-500">Chat ID: {chatId}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-4xl space-y-4">
            {isInitialLoading ? (
              <div className="mt-20 text-center text-gray-500">
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="mt-20 text-center text-gray-500">
                <p className="text-lg">No messages yet</p>
                <p className="text-sm">
                  Start a conversation by typing below.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={message.id ?? message._id ?? `${message.role}-${index}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-blue-500 text-white"
                        : "border border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <div className="mb-1 text-xs opacity-70">
                      {message.role === "user" ? "You" : "Assistant"} -{" "}
                      {formatTimestamp(message.timestamp)}
                    </div>
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>

                    {message.tools_called && message.tools_called.length > 0 ? (
                      <div className="mt-2 border-t border-gray-200 pt-2 text-xs">
                        <details>
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            Tools called ({message.tools_called.length})
                          </summary>
                          <div className="mt-1 space-y-1">
                            {message.tools_called.map((tool, idx) => (
                              <div key={idx} className="rounded bg-gray-50 p-1">
                                <span className="font-mono font-semibold">
                                  {tool.name}
                                </span>
                                {tool.result != null ? (
                                  <pre className="mt-1 whitespace-pre-wrap break-words text-gray-600">
                                    {JSON.stringify(tool.result, null, 2) ??
                                      String(tool.result)}
                                  </pre>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            {isLoading ? (
              <div className="flex justify-start">
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-100" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 delay-200" />
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <div className="mx-auto max-w-4xl">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Shift+Enter for new line)"
                rows={1}
                className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ minHeight: "44px", maxHeight: "150px" }}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-blue-500 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Send"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
