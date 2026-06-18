
import { StateGraph, START, END, MemorySaver, Annotation } from "@langchain/langgraph";
import { toolExecutorNode, TOOL_EXECUTOR_NODE, ToolExecution } from "./nodes";
import { randomUUID } from "crypto";

type ToolDecision = {
  action?: string;
  tool?: string;
  params?: Record<string, unknown>;
  response?: string;
};

const GraphState = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (left, right) => right,
    default: () => [],
  }),
  roomId: Annotation<string>(),
  userId: Annotation<string>(),
  decision: Annotation<ToolDecision | null>({
    reducer: (left, right) => right,
    default: () => null,
  }),
  result: Annotation<string>({
    reducer: (left, right) => right,
    default: () => "",
  }),
  toolCalls: Annotation<ToolExecution[]>({
    reducer: (left, right) => right,
    default: () => [],
  }),
});

export type GraphStateType = typeof GraphState.State;

export async function runToolExecutor(
  input: { 
    messages?: Array<{ role: string; content: string }>;
    roomId: string;
    userId: string;
    decision?: ToolDecision | null;
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
      messages: input.messages ?? [],
      roomId: input.roomId,
      userId: input.userId,
      decision: input.decision ?? null,
      result: "",
      toolCalls: [],
    },
    config
  );
  
  return result;
}