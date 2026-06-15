
import { StateGraph, START, END, MemorySaver, Annotation } from "@langchain/langgraph";
import { toolExecutorNode, TOOL_EXECUTOR_NODE } from "./nodes";
import { randomUUID } from "crypto";

const GraphState = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (left, right) => right,
    default: () => [],
  }),
  roomId: Annotation<string>(),
  userId: Annotation<string>(),
  decision: Annotation<any>({
    reducer: (left, right) => right,
    default: () => null,
  }),
  result: Annotation<string>({
    reducer: (left, right) => right,
    default: () => "",
  }),
  toolCalls: Annotation<any[]>({
    reducer: (left, right) => right,
    default: () => [],
  }),
});

export type GraphStateType = typeof GraphState.State;

export async function runToolExecutor(
  input: { 
    messages: Array<{ role: string; content: string }>;
    roomId: string;
    userId: string;
    decision: any;
  },
  threadId?: string
) {
  const checkpointer = new MemorySaver();

  const workflow = new StateGraph(GraphState)
    .addNode(TOOL_EXECUTOR_NODE, toolExecutorNode)
    .addEdge(START, TOOL_EXECUTOR_NODE)
    .addEdge(TOOL_EXECUTOR_NODE, END);

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
      decision: input.decision,
      result: "",
      toolCalls: [],
    },
    config
  );
  
  return result;
}