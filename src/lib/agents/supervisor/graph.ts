// src/lib/agents/supervisor/graph.ts
import { StateGraph, START, END, MemorySaver, Annotation } from "@langchain/langgraph";
import { randomUUID } from "crypto";
import { supervisorNode, SUPERVISOR_NODE } from "./nodes";

// Define the state
const GraphState = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (left, right) => right,
    default: () => [],
  }),
  roomId: Annotation<string>(),
  userId: Annotation<string>(),
  intent: Annotation<string>({
    reducer: (left, right) => right,
    default: () => "unknown",
  }),
});

export type GraphStateType = typeof GraphState.State;

export async function runSupervisor(
  input: { 
    messages: Array<{ role: string; content: string }>; 
    roomId: string; 
    userId: string;
  },
  threadId?: string
) {
  const checkpointer = new MemorySaver();
  
  const workflow = new StateGraph(GraphState)
    .addNode(SUPERVISOR_NODE, supervisorNode)
    .addEdge(START, SUPERVISOR_NODE)
    .addEdge(SUPERVISOR_NODE, END);
  
  const graph = workflow.compile({ checkpointer });
  
  const validThreadId = threadId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId)
    ? threadId
    : randomUUID();
  
  const config = { configurable: { thread_id: validThreadId } };
  
  const result = await graph.invoke(
    {
      messages: input.messages,
      roomId: input.roomId,
      userId: input.userId,
      intent: "unknown",
    },
    config
  );
  
  return result;
}
