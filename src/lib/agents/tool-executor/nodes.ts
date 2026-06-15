
// // src/lib/agents/tool-executor/nodes.ts
// import { ChatOpenAI } from "@langchain/openai";
// import { postMessage, formatBandPost } from "@/lib/band/client";

// export const TOOL_EXECUTOR_NODE = "tool_executor";

// // Mock tools
// const mockTools: Record<string, Function> = {
//   getOrderStatus: async ({ orderId }: any) => {
//     const mockOrders: any = { 
//       "ORD-12345": { status: "shipped", eta: "2 days", carrier: "FedEx" } 
//     };
//     const order = mockOrders[orderId];
//     return order
//       ? `Order ${orderId}: ${order.status}, arriving in ${order.eta} via ${order.carrier}`
//       : `Order ${orderId} not found`;
//   },
//   processRefund: async ({ userId, amount }: any) => {
//     // Apply business rules
//     if (amount > 100) {
//       return `Refund of $${amount} exceeds maximum allowed ($100). Please contact support.`;
//     }
//     return `Refund of $${amount} approved for ${userId}. Processed in 3-5 business days.`;
//   }
// };

// export async function toolExecutorNode(state: any) {
//   const decision = state.decision;
//   let result = "Tool execution failed";
//   let toolResponse = null;

//   if (decision?.action === "call_tool" && decision?.tool && mockTools[decision.tool]) {
//     try {
//       toolResponse = await mockTools[decision.tool](decision.params || {});
//       result = toolResponse;
//     } catch (error: any) {
//       result = `Error executing tool: ${error.message}`;
//     }
//   } else if (decision?.action === "direct") {
//     result = decision.response || "I'll help you with that request.";
//   }

//   const toolCall = {
//     name: decision?.tool || "none",
//     arguments: decision?.params || {},
//     result: result,
//     action: decision?.action
//   };

//   await postMessage(state.roomId, formatBandPost("ToolExecutor", "execution_result", toolCall), {
//     agent: "ToolExecutor"
//   });

//   return {
//     result,
//     messages: [...state.messages, { role: "assistant", content: result }]
//   };
// }
// src/lib/agents/tool-executor/nodes.ts
import { ChatOpenAI } from "@langchain/openai";

export const TOOL_EXECUTOR_NODE = "tool_executor";

// Mock tools
const mockTools: Record<string, Function> = {
  getOrderStatus: async ({ orderId, userId }: any) => {
    console.log(`🔍 Looking up order: ${orderId} for user: ${userId}`);
    
    if (!orderId || orderId === "extracted_from_message") {
      return "I couldn't find an order number in your message. Please provide your order number (e.g., ORD-12345).";
    }
    
    const mockOrders: Record<string, any> = {
      "ORD-12345": { status: "shipped", eta: "2 days", carrier: "FedEx", trackingNumber: "1Z999AA10123456784" },
      "ORD-67890": { status: "processing", eta: "5 days", carrier: "UPS" },
      "ORD-11111": { status: "delivered", eta: "delivered yesterday", carrier: "USPS" }
    };
    
    const order = mockOrders[orderId];
    if (order) {
      return `Order ${orderId}: ${order.status}, arriving in ${order.eta} via ${order.carrier}${order.trackingNumber ? `. Tracking: ${order.trackingNumber}` : ''}`;
    } else {
      return `Order ${orderId} not found. Please check your order number and try again. Valid format: ORD-12345`;
    }
  },
  
  processRefund: async ({ orderId, userId, amount }: any) => {
    console.log(`💰 Processing refund for order: ${orderId}, user: ${userId}, amount: ${amount}`);
    
    if (!orderId || orderId === "extracted_from_message") {
      return "Please provide your order number (e.g., ORD-12345) so I can process your refund.";
    }
    
    // Simulate refund validation
    const validOrders = ["ORD-12345", "ORD-67890"];
    if (!validOrders.includes(orderId)) {
      return `Order ${orderId} cannot be refunded. Please check the order number or contact support.`;
    }
    
    if (amount > 100) {
      return `Refund of $${amount} exceeds the maximum allowed ($100). Please contact support for assistance.`;
    }
    
    return `✅ Refund of $${amount} approved for order ${orderId}. Refund will be processed to your original payment method within 3-5 business days.`;
  }
};

export async function toolExecutorNode(state: any) {
  const decision = state.decision;
  let result = "Tool execution failed";
  
  console.log(`🔧 Tool Executor - Action: ${decision?.action}, Tool: ${decision?.tool}`);
  
  if (decision?.action === "call_tool" && decision?.tool && mockTools[decision.tool]) {
    try {
      result = await mockTools[decision.tool](decision.params || {});
      console.log(`✅ Tool ${decision.tool} executed successfully`);
    } catch (error: any) {
      result = `Error executing tool: ${error.message}`;
      console.error(`❌ Tool execution failed: ${error.message}`);
    }
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
    messages: [...state.messages, { role: "assistant", content: result }]
  };
}