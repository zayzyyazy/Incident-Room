

// src/lib/agents/doer/graph.ts
import { StateGraph, START, END, MemorySaver, Annotation } from "@langchain/langgraph";
import { doerNode, DOER_NODE } from "./nodes";
import { randomUUID } from "crypto";

type DoerDecision = {
  action?: string;
  tool?: string;
  params?: Record<string, unknown>;
  response?: string;
  reasoning?: string;
};

// Define the state
const GraphState = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (left, right) => right,
    default: () => [],
  }),
  roomId: Annotation<string>(),
  userId: Annotation<string>(),
  intent: Annotation<string>(),
  decision: Annotation<DoerDecision | null>({
    reducer: (left, right) => right,
    default: () => null,
  }),
});

export type GraphStateType = typeof GraphState.State;

export async function runDoer(
  input: { 
    messages?: Array<{ role: string; content: string }>;
    roomId: string;
    userId: string;
    intent?: string;
  },
  threadId?: string
) {
  const checkpointer = new MemorySaver();

  const workflow = new StateGraph(GraphState)
    .addNode(DOER_NODE, doerNode)
    .addEdge(START, DOER_NODE)
    .addEdge(DOER_NODE, END);

  const graph = workflow.compile({ checkpointer });
  
  const validThreadId = threadId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId)
    ? threadId
    : randomUUID();
    
  const config = { configurable: { thread_id: validThreadId } };

  const result = await graph.invoke(
    {
      messages: input.messages ?? [],
      roomId: input.roomId,
      userId: input.userId,
      intent: input.intent ?? "unknown",
      decision: null,
    },
    config
  );
  
  return result;
}

