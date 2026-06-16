// src/lib/agents/doer/nodes.ts
import {
  postBandWorkflowEvent,
  readBandWorkflowPayload,
} from "@/lib/band/agent-workflow";

export const DOER_NODE = "doer";

type AgentMessage = {
  role: string;
  content: string;
};

type DoerDecision = {
  action?: string;
  tool?: string;
  params?: Record<string, unknown>;
  response?: string;
  reasoning?: string;
};

type DoerState = {
  messages: AgentMessage[];
  roomId: string;
  userId: string;
  intent: string;
  decision?: DoerDecision | null;
};

type IntentPayload = {
  intent?: string;
};

function extractOrderIdFromMessages(messages: Array<{ role: string; content: string }>) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user') {
      const match = msg.content.match(/ORD[-\s]?[A-Z0-9]+/i);
      if (match) {
        return match[0].toUpperCase().replace(/\s+/g, "-").replace(/^ORD-?/, "ORD-");
      }
    }
  }
  return null;
}

export async function doerNode(state: DoerState) {
  const bandIntent = await readIntentFromBand(state);
  const intent = bandIntent || state.intent || "unknown";
  const latestUserMessage =
    [...state.messages].reverse().find((msg) => msg.role === "user")
      ?.content || "";
  const extractedOrderId = extractOrderIdFromMessages(state.messages);
  
  const hasOrderId = extractedOrderId !== null;
  
  console.log(`📝 Doer processing - Intent: ${intent}, Has Order ID: ${hasOrderId}, Order ID: ${extractedOrderId}`);
  console.log(`📝 Full conversation length: ${state.messages.length} messages`);
  
  // Rule-based decision
  let decision;
  
  if (intent === "order_status") {
    if (hasOrderId) {
      decision = {
        action: "call_tool",
        tool: "checkOrderStatus",
        params: { orderId: extractedOrderId, userId: state.userId },
        reasoning: "Order ID found, fetching status"
      };
    } else {
      decision = {
        action: "direct",
        response: "Please provide your order number (e.g., ORD-12345) so I can check the status.",
        reasoning: "Order ID missing"
      };
    }
  } 
  else if (intent === "refund") {
    if (hasOrderId) {
      decision = {
        action: "call_tool",
        tool: "askRefund",
        params: {
          orderId: extractedOrderId,
          userId: state.userId,
          reason: latestUserMessage
        },
        reasoning: "Order ID found, opening refund request from live order data"
      };
    } else {
      decision = {
        action: "direct",
        response: "I can help with a refund. Please provide your order number (e.g., ORD-12345) so I can process it.",
        reasoning: "Need order ID for refund"
      };
    }
  }
  else if (intent === "human_handoff") {
    decision = {
      action: "call_tool",
      tool: "callHumanIntervention",
      params: {
        orderId: extractedOrderId,
        userId: state.userId,
        reason: latestUserMessage || "Customer requested a human teammate"
      },
      reasoning: "Customer requested human intervention"
    };
  }
  else if (intent === "end_chat") {
    decision = {
      action: "direct",
      response: "Thanks for chatting with us. I'll keep the conversation and tool history available if the team needs to review it.",
      reasoning: "Customer ended the chat"
    };
  }
  else if (intent === "product_info") {
    decision = {
      action: "direct",
      response: "I'd be happy to help with product information. What specific product are you interested in?",
      reasoning: "Need more product details"
    };
  }
  else if (intent === "gorilla") {
    decision = {
      action: "direct",
      response: "🦍 Gorillas are amazing creatures! They share 98% of their DNA with humans. How can I help you with gorillas today?",
      reasoning: "Gorilla mention detected"
    };
  }
  else {
    decision = {
      action: "direct",
      response: "I can help with order status, refunds, or product information. How can I assist you today?",
      reasoning: "Unknown intent"
    };
  }
  
  console.log(`✅ Doer decision: ${decision.action}${decision.tool ? ` - ${decision.tool}` : ''}`);
  await writeDecisionToBand(state, intent, decision);
  
  return {
    ...state,
    decision,
    messages: [...state.messages, { role: "assistant", content: `Decision: ${decision.action}` }]
  };
}

async function readIntentFromBand(state: DoerState) {
  try {
    const payload = await readBandWorkflowPayload<IntentPayload>(
      state.roomId,
      "intent_analysis",
      "doer",
    );
    if (payload?.intent) {
      console.log(`📡 Doer read intent from Band room ${state.roomId}: ${payload.intent}`);
      return payload.intent;
    }
  } catch (error) {
    console.warn("Band doer intent read failed", error);
  }

  return null;
}

async function writeDecisionToBand(
  state: DoerState,
  intent: string,
  decision: DoerDecision,
) {
  try {
    await postBandWorkflowEvent(
      "doer",
      state.roomId,
      decision.action === "call_tool" ? "tool_request" : "policy_decision",
      {
        intent,
        decision,
        userId: state.userId,
      },
      {
        mentionRole:
          decision.action === "call_tool" ? "tool_executor" : undefined,
        metadata: { intent, action: decision.action, tool: decision.tool },
      },
    );
  } catch (error) {
    console.warn("Band doer decision handoff failed", error);
  }
}