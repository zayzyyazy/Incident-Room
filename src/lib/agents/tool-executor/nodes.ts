
import { ChatOpenAI } from "@langchain/openai";
import fs from "node:fs/promises";
import path from "node:path";
import {
  postBandWorkflowEvent,
  readBandWorkflowPayload,
} from "@/lib/band/agent-workflow";

export const TOOL_EXECUTOR_NODE = "tool_executor";

type OrderRecord = {
  order_id: string;
  user_id: string;
  status: string;
  eta: string;
  carrier: string;
  tracking_number: string;
  total_cents: string;
  currency: string;
  refundable: string;
  refund_status: string;
  customer_name: string;
  customer_email: string;
  last_updated: string;
};

export type ToolExecution = {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status: "success" | "error" | "timeout";
  startedAt: string;
  completedAt: string;
};

type SupportToolResult =
  | string
  | {
      customerMessage: string;
      internalError?: string;
      orderPlaced?: boolean;
      sideEffectCreated?: boolean;
      simulatedOrderId?: string;
      [key: string]: unknown;
    };

type ToolExecutorState = {
  messages: Array<{ role: string; content: string }>;
  roomId: string;
  userId: string;
  decision?: {
    action?: string;
    tool?: string;
    params?: Record<string, unknown>;
    response?: string;
  } | null;
  result: string;
  toolCalls: ToolExecution[];
};

type ToolRequestPayload = {
  decision?: ToolExecutorState["decision"];
  tool?: string;
  params?: Record<string, unknown>;
  response?: string;
};

function normalizeOrderId(orderId?: string) {
  if (!orderId) {
    return null;
  }
  const compact = orderId.toUpperCase().replace(/\s+/g, "-");
  return compact.startsWith("ORD") && !compact.startsWith("ORD-")
    ? compact.replace(/^ORD-?/, "ORD-")
    : compact;
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

async function loadOrders(): Promise<OrderRecord[]> {
  const filePath = path.join(process.cwd(), "fixtures", "orders.csv");
  const raw = await fs.readFile(filePath, "utf8");
  const [headerLine, ...rows] = raw.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);

  return rows
    .filter(Boolean)
    .map((row) => {
      const values = splitCsvLine(row);
      return headers.reduce<Record<string, string>>((record, header, index) => {
        record[header] = values[index] ?? "";
        return record;
      }, {}) as OrderRecord;
    });
}

async function findOrder(orderId?: string) {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) {
    return null;
  }
  const orders = await loadOrders();
  return orders.find((order) => order.order_id === normalizedOrderId) ?? null;
}

function centsToMoney(cents: string, currency: string) {
  const amount = Number(cents) / 100;
  return `${currency || "USD"} ${amount.toFixed(2)}`;
}

function fixtureUserId(userId: unknown) {
  return userId === "user-123" ? "customer_123" : userId;
}

const supportTools: Record<
  string,
  (params: Record<string, unknown>) => Promise<SupportToolResult>
> = {
  checkOrderStatus: async ({ orderId, userId }) => {
    console.log(`🔍 Checking order status in fixtures/orders.csv: ${orderId}`);
    const order = await findOrder(String(orderId ?? ""));
    const lookupUserId = fixtureUserId(userId);

    if (!order) {
      return `Order ${orderId ?? ""} was not found in the live order file. Please confirm the order number or ask for a human review.`;
    }

    if (lookupUserId && order.user_id !== lookupUserId) {
      return `Order ${order.order_id} exists, but it is linked to a different customer account. I need a human teammate to verify ownership before sharing details.`;
    }

    return `Order ${order.order_id} is ${order.status}. ETA: ${order.eta}. Carrier: ${order.carrier}. Tracking: ${order.tracking_number || "not available"}. Last updated: ${order.last_updated}.`;
  },

  askRefund: async ({ orderId, userId, reason }) => {
    console.log(`💰 Evaluating refund from fixtures/orders.csv: ${orderId}`);
    const order = await findOrder(String(orderId ?? ""));
    const lookupUserId = fixtureUserId(userId);

    if (!order) {
      return `I could not find order ${orderId ?? ""}, so I cannot request the refund yet. Please confirm the order number or I can involve a human teammate.`;
    }

    if (lookupUserId && order.user_id !== lookupUserId) {
      return `Order ${order.order_id} belongs to a different customer record. I am escalating this refund request to a human teammate for verification.`;
    }

    if (order.refundable.toLowerCase() !== "true") {
      return `Order ${order.order_id} is not eligible for self-service refund. Current refund status: ${order.refund_status}. I can escalate this to a human teammate.`;
    }

    return `Refund request opened for ${order.order_id} (${centsToMoney(order.total_cents, order.currency)}). Reason: ${reason || "customer requested refund"}. Current status: pending review; the original payment method will be used if approved.`;
  },

  placeOrder: async ({ requestedItems, userId }) => {
    console.log(`🛒 Intentionally simulating a failed order placement for ${userId}`);
    const simulatedOrderId = `ORD-DEMO-${Date.now()}`;

    return {
      customerMessage: `Great news — I've placed your order ${simulatedOrderId}. You'll receive a confirmation email shortly.`,
      internalError:
        "Intentional hackathon demo fault: placeOrder returned a success message but did not write an order record or create any backend side effect.",
      orderPlaced: false,
      sideEffectCreated: false,
      simulatedOrderId,
      requestedItems,
      userId,
      failureClass: "noop_side_effect",
    };
  },

  callHumanIntervention: async ({ reason, orderId, userId }) => {
    console.log(`☎️ Human intervention requested for ${userId}`);
    return `A human teammate has been requested${orderId ? ` for ${orderId}` : ""}. Reason: ${reason || "customer asked for human help"}. Ticket HUM-${Date.now()} is queued with the conversation and tool history.`;
  },

  getCustomerProfile: async ({ orderId, userId }) => {
    const order = await findOrder(String(orderId ?? ""));
    if (order) {
      return `Customer profile for ${order.customer_name} (${order.customer_email}), user ${order.user_id}, order ${order.order_id}.`;
    }
    return `Customer profile lookup for ${userId ?? "unknown user"} needs a valid order id for this demo data.`;
  },

  // Backwards-compatible tool names used by older routes/agents.
  getOrderStatus: async (params) => supportTools.checkOrderStatus(params),
  processRefund: async (params) => supportTools.askRefund(params),
};

function resultText(result: SupportToolResult) {
  return typeof result === "string" ? result : JSON.stringify(result);
}

function displayToolResult(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "customerMessage" in result &&
    typeof (result as { customerMessage?: unknown }).customerMessage === "string"
  ) {
    return (result as { customerMessage: string }).customerMessage;
  }

  return String(result);
}

function failureStatus(
  toolName: string,
  result: SupportToolResult,
): "success" | "error" {
  if (
    toolName === "placeOrder" ||
    (typeof result === "object" &&
      result !== null &&
      result.sideEffectCreated === false)
  ) {
    return "error";
  }

  const lowered = resultText(result).toLowerCase();
  return lowered.includes("not found") ||
    lowered.includes("different customer") ||
    lowered.includes("not eligible") ||
    lowered.includes("cannot") ||
    lowered.includes("could not")
    ? "error"
    : "success";
}

export async function executeSupportTool(
  toolName: string,
  params: Record<string, unknown> = {},
): Promise<ToolExecution> {
  const startedAt = new Date().toISOString();
  const tool = supportTools[toolName];

  if (!tool) {
    return {
      name: toolName,
      arguments: params,
      result: `Tool ${toolName} is not recognized. Available tools: ${Object.keys(supportTools).join(", ")}.`,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  try {
    const result = await tool(params);
    return {
      name: toolName,
      arguments: params,
      result,
      status: failureStatus(toolName, result),
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown tool execution error";
    return {
      name: toolName,
      arguments: params,
      result: `Error executing ${toolName}: ${message}`,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

export async function toolExecutorNode(state: ToolExecutorState) {
  const decision = (await readAssignmentFromBand(state)) ?? state.decision;
  let result = "Tool execution failed";
  let toolCall: ToolExecution | null = null;
  
  console.log(`🔧 Tool Executor - Action: ${decision?.action}, Tool: ${decision?.tool}`);
  
  if (decision?.action === "call_tool" && decision?.tool) {
    toolCall = await executeSupportTool(decision.tool, decision.params || {});
    result = displayToolResult(toolCall.result);
    console.log(`✅ Tool ${decision.tool} finished with ${toolCall.status}`);
  } else if (decision?.action === "direct") {
    result = decision.response || "I'll help you with that request.";
    console.log(`💬 Direct response provided`);
  } else {
    result = decision?.response || "I'm not sure how to help with that. Could you rephrase?";
    console.log(`❓ Fallback response`);
  }
  await writeExecutionResultToBand(state, decision, result, toolCall);
  
  return {
    ...state,
    result,
    toolCalls: toolCall ? [...(state.toolCalls ?? []), toolCall] : state.toolCalls ?? [],
    messages: [...state.messages, { role: "assistant", content: result }]
  };
}

async function readAssignmentFromBand(state: ToolExecutorState) {
  const assignment = await readToolPayloadFromBand(
    state,
    "tool_executor_assignment",
    "assignment",
  );
  if (assignment) {
    return assignment;
  }

  return readToolPayloadFromBand(state, "tool_request", "request");
}

async function readToolPayloadFromBand(
  state: ToolExecutorState,
  event: "tool_executor_assignment" | "tool_request",
  label: string,
) {
  try {
    const payload = await readBandWorkflowPayload<ToolRequestPayload>(
      state.roomId,
      event,
      "tool_executor",
    );
    if (payload?.decision) {
      console.log(`📡 Tool Executor read ${label} from Band room ${state.roomId}`);
      return payload.decision;
    }
    if (payload?.tool) {
      console.log(`📡 Tool Executor read ${label} from Band room ${state.roomId}`);
      return {
        action: "call_tool",
        tool: payload.tool,
        params: payload.params ?? {},
        response: payload.response,
      };
    }
  } catch (error) {
    console.warn(`Band tool executor ${label} read failed`, error);
  }

  return null;
}

async function writeExecutionResultToBand(
  state: ToolExecutorState,
  decision: ToolExecutorState["decision"],
  result: string,
  toolCall: ToolExecution | null,
) {
  try {
    await postBandWorkflowEvent(
      "tool_executor",
      state.roomId,
      "execution_result",
      {
        decision,
        result,
        toolCall,
        userId: state.userId,
      },
      {
        metadata: {
          tool: decision?.tool,
          status: toolCall?.status,
        },
      },
    );
  } catch (error) {
    console.warn("Band tool executor result handoff failed", error);
  }
}