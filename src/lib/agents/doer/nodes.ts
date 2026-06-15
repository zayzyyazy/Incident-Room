// src/lib/agents/doer/nodes.ts
import { ChatOpenAI } from "@langchain/openai";

export const DOER_NODE = "doer";

export async function doerNode(state: any) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userMessage = lastMessage?.content || "";
  const intent = state.intent || "unknown";
  
  // Search ALL messages for order ID (not just last)
  let extractedOrderId = null;
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const msg = state.messages[i];
    if (msg.role === 'user') {
      const match = msg.content.match(/ORD[-\s]?[A-Z0-9]+/i);
      if (match) {
        extractedOrderId = match[0];
        break;
      }
    }
  }
  
  const hasOrderId = extractedOrderId !== null;
  
  console.log(`📝 Doer processing - Intent: ${intent}, Has Order ID: ${hasOrderId}, Order ID: ${extractedOrderId}`);
  console.log(`📝 Full conversation length: ${state.messages.length} messages`);
  
  // Rule-based decision
  let decision;
  
  if (intent === "order_status") {
    if (hasOrderId) {
      decision = {
        action: "call_tool",
        tool: "getOrderStatus",
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
        tool: "processRefund",
        params: { orderId: extractedOrderId, userId: state.userId, amount: 50 },
        reasoning: "Order ID found, processing refund"
      };
    } else {
      decision = {
        action: "direct",
        response: "I can help with a refund. Please provide your order number (e.g., ORD-12345) so I can process it.",
        reasoning: "Need order ID for refund"
      };
    }
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
  
  return {
    ...state,
    decision,
    messages: [...state.messages, { role: "assistant", content: `Decision: ${decision.action}` }]
  };
}