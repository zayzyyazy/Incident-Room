// app/chat/[chatId]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
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

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

type ApiChatMessage = Omit<Message, 'timestamp'> & {
  timestamp: string | Date;
};

export default function ChatPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  console.log(`chat is is ${chatId}`)
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on component mount
  useEffect(() => {
    loadChatHistory();
  }, [chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

// app/chat/[chatId]/page.tsx
// app/chat/[chatId]/page.tsx - Update loadChatHistory
const loadChatHistory = async () => {
  try {
    setIsInitialLoading(true);
    console.log("🔄 Loading history for chatId:", chatId);
    
    const response = await fetch(`/api/chat-history/${chatId}`);
    console.log("📡 Response status:", response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("📚 Received data:", data);
    console.log("📊 Message count:", data.messages?.length);
    
    if (data.messages && data.messages.length > 0) {
      const formattedMessages = data.messages.map((msg: ApiChatMessage) => ({
        ...msg,
        tools_called: msg.tools_called ?? msg.toolsCalled ?? [],
        timestamp: new Date(msg.timestamp)
      }));
      console.log("✅ Setting messages:", formattedMessages.length);
      setMessages(formattedMessages);
    } else {
      console.log("⚠️ No messages found");
    }
  } catch (error) {
    console.error('❌ Error loading chat history:', error);
  } finally {
    setIsInitialLoading(false);
  }
};



  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() || isLoading) return;

  const userMessage = {
    id: Date.now().toString(),
    role: 'user' as const,
    content: input,
    timestamp: new Date()
  };

  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);

  // ✅ Store user message
  await fetch('/api/store-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      userId: "customer_123",
      role: 'user',
      content: input
    })
  });

  try {
    const response = await fetch('/api/replychat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: input , conversationHistory: messages}) // No history needed
    });

    const data = await response.json();

    const assistantMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: data.reply,
      tools_called: data.tools_called || [],
      toolsCalled: data.tools_called || [],
      roomId: data.roomId,
      workflowTrace: data.workflow_trace || [],
      analyzer: data.analyzer,
      evidence: data.evidence,
      investigationInput: data.investigation_input,
      incident: data.incident,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    // ✅ Store assistant message
    await fetch('/api/store-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        userId: "customer_123",
        role: 'assistant',
        content: data.reply,
        intent: data.intent,
        toolsCalled: data.tools_called,
        roomId: data.roomId,
        workflowTrace: data.workflow_trace,
        analyzer: data.analyzer,
        evidence: data.evidence,
        investigationInput: data.investigation_input,
        incident: data.incident
      })
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    setIsLoading(false);
  }
};
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-800">Chat Interface</h1>
          <p className="text-sm text-gray-500">Chat ID: {chatId}</p>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg">No messages yet</p>
              <p className="text-sm">Start a conversation by typing below!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <div className="mb-1 text-xs opacity-70">
                    {message.role === 'user' ? 'You' : 'Assistant'} • {formatTimestamp(message.timestamp)}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  
                  {/* Display tools called if any */}
                  {message.tools_called && message.tools_called.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                      <details>
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                          🔧 Tools called ({message.tools_called.length})
                        </summary>
                        <div className="mt-1 space-y-1">
                          {message.tools_called.map((tool, idx) => (
                            <div key={idx} className="bg-gray-50 p-1 rounded">
                              <span className="font-mono font-semibold">{tool.name}</span>
                              {tool.result != null && (
                                <div className="text-gray-600 mt-1">
                                  Result: {JSON.stringify(tool.result, null, 2) ?? String(tool.result)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ minHeight: '44px', maxHeight: '150px' }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}