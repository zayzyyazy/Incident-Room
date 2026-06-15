import fs from "node:fs/promises";
import path from "node:path";

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

const supportTools: Record<
  string,
  (params: Record<string, unknown>) => Promise<string>
> = {
  checkOrderStatus: async ({ orderId, userId }) => {
    console.log(`🔍 Checking order status in fixtures/orders.csv: ${orderId}`);
    const order = await findOrder(String(orderId ?? ""));

    if (!order) {
      return `Order ${orderId ?? ""} was not found in the live order file. Please confirm the order number or ask for a human review.`;
    }

    if (userId && order.user_id !== userId) {
      return `Order ${order.order_id} exists, but it is linked to a different customer account. I need a human teammate to verify ownership before sharing details.`;
    }

    return `Order ${order.order_id} is ${order.status}. ETA: ${order.eta}. Carrier: ${order.carrier}. Tracking: ${order.tracking_number || "not available"}. Last updated: ${order.last_updated}.`;
  },

  askRefund: async ({ orderId, userId, reason }) => {
    console.log(`💰 Evaluating refund from fixtures/orders.csv: ${orderId}`);
    const order = await findOrder(String(orderId ?? ""));

    if (!order) {
      return `I could not find order ${orderId ?? ""}, so I cannot request the refund yet. Please confirm the order number or I can involve a human teammate.`;
    }

    if (userId && order.user_id !== userId) {
      return `Order ${order.order_id} belongs to a different customer record. I am escalating this refund request to a human teammate for verification.`;
    }

    if (order.refundable.toLowerCase() !== "true") {
      return `Order ${order.order_id} is not eligible for self-service refund. Current refund status: ${order.refund_status}. I can escalate this to a human teammate.`;
    }

    return `Refund request opened for ${order.order_id} (${centsToMoney(order.total_cents, order.currency)}). Reason: ${reason || "customer requested refund"}. Current status: pending review; the original payment method will be used if approved.`;
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

function failureStatus(result: string): "success" | "error" {
  const lowered = result.toLowerCase();
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
      status: failureStatus(result),
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
  const decision = state.decision;
  let result = "Tool execution failed";
  let toolCall: ToolExecution | null = null;
  
  console.log(`🔧 Tool Executor - Action: ${decision?.action}, Tool: ${decision?.tool}`);
  
  if (decision?.action === "call_tool" && decision?.tool) {
    toolCall = await executeSupportTool(decision.tool, decision.params || {});
    result = String(toolCall.result);
    console.log(`✅ Tool ${decision.tool} finished with ${toolCall.status}`);
  } else if (decision?.action === "direct") {
    result = decision.response || "I'll help you with that request.";
    console.log(`💬 Direct response provided`);
  } else {
    result = decision?.response || "I'm not sure how to help with that. Could you rephrase?";
    console.log(`❓ Fallback response`);
  }
  
  return {
    ...state,
    result,
    toolCalls: toolCall ? [...(state.toolCalls ?? []), toolCall] : state.toolCalls ?? [],
    messages: [...state.messages, { role: "assistant", content: result }]
  };
}