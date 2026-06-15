
import { NextResponse } from "next/server";
import { createRoom, postMessage, formatBandPost, getRoomHistory } from "@/lib/band/client";
import { runSupervisor } from "@/lib/agents/supervisor/graph";

// Simple Doer logic (no LangGraph to avoid loops)
function doerLogic(intent: string, originalMessage: string, userId: string) {
  console.log(`📝 Doer processing intent: ${intent}`);
  
  if (intent === "order_status") {
    const orderId = extractOrderId(originalMessage);
    if (!orderId) {
      return {
        action: "direct",
        response: "Please provide your order number (e.g., ORD-12345)",
        reasoning: "Order ID missing"
      };
    } else {
      return {
        action: "call_tool",
        tool: "getOrderStatus",
        params: { orderId, userId },
        reasoning: "Tool needed to fetch order status"
      };
    }
  } 
  else if (intent === "refund") {
    return {
      action: "call_tool",
      tool: "processRefund",
      params: { userId, amount: 50 },
      reasoning: "Process refund within policy limits"
    };
  } 
  else if (intent === "product_info") {
    return {
      action: "direct",
      response: "I can help with product information. What specific product are you interested in?",
      reasoning: "Need more product details"
    };
  } 
  else {
    return {
      action: "direct",
      response: "I can help with order status, refunds, or product information. How can I assist you?",
      reasoning: "Unknown intent"
    };
  }
}

// Simple Tool Executor logic (no LangGraph)
async function toolExecutorLogic(toolRequest: any, originalUserId: string) {
  console.log(`🔧 Executing tool: ${toolRequest.tool}`);
  
  if (toolRequest.tool === "getOrderStatus") {
    const mockOrders: Record<string, any> = {
      "ORD-12345": { status: "shipped", eta: "2 days", carrier: "FedEx" }
    };
    const order = mockOrders[toolRequest.params.orderId];
    return order 
      ? `Order ${toolRequest.params.orderId}: ${order.status}, arriving in ${order.eta} via ${order.carrier}`
      : `Order ${toolRequest.params.orderId} not found. Please check your order number.`;
  } 
  else if (toolRequest.tool === "processRefund") {
    return `Refund of $${toolRequest.params.amount} approved for ${toolRequest.params.userId}. Processed in 3-5 business days.`;
  } 
  else {
    return "Tool not recognized. I can help with order status and refunds.";
  }
}

function extractOrderId(text: string): string | null {
  const match = text.match(/ORD[-\s]?[A-Z0-9]+/i);
  return match ? match[0] : null;
}

// ========== MAIN ORCHESTRATOR ==========
export async function POST(request: Request) {
  try {
    const { message, userId = "customer_123" } = await request.json();
    
    if (!message) {
      return NextResponse.json({ ok: false, error: "Message required" }, { status: 400 });
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("🚀 Starting Multi-Agent Workflow");
    console.log("=".repeat(50));
    console.log(`📥 User Message: "${message}"`);
    console.log(`👤 User ID: ${userId}`);
    
    // Create Band room
    const room = await createRoom("customer-support-room");
    console.log(`🏠 Room Created: ${room.id}`);
    
    // Step 1: Supervisor analyzes intent using LangGraph
    console.log("\n📝 Step 1: Supervisor (LangGraph) analyzing intent...");
    const supervisorResult = await runSupervisor(
      {
        messages: [{ role: "user", content: message }],
        roomId: room.id,
        userId,
      },
      crypto.randomUUID()
    );
    const intent = supervisorResult.intent || "unknown";
    console.log(`✅ Intent: ${intent}`);
    
    // Post supervisor decision to Band
    await postMessage(room.id, formatBandPost("Supervisor", "intent_analysis", { 
      intent, 
      originalMessage: message 
    }), { agent: "Supervisor", intent });
    
    // Step 2: Doer applies policies (simple logic, no LLM)
    console.log("\n📝 Step 2: Doer applying business policies...");
    const decision = doerLogic(intent, message, userId);
    console.log(`✅ Decision: ${decision.action}${decision.tool ? ` - Tool: ${decision.tool}` : ''}`);
    console.log(`   Reasoning: ${decision.reasoning}`);
    
    // Post doer decision to Band
    await postMessage(room.id, formatBandPost("Doer", "policy_decision", decision), { 
      agent: "Doer",
      intent 
    });
    
    // Step 3: Tool agent executes if needed
    let finalResponse;
    if (decision.action === "call_tool") {
      console.log("\n📝 Step 3: Tool Executor running...");
      finalResponse = await toolExecutorLogic(decision, userId);
      console.log(`✅ Tool Result: ${finalResponse.substring(0, 100)}...`);
      
      await postMessage(room.id, formatBandPost("ToolAgent", "execution_result", { 
        result: finalResponse, 
        userId,
        tool: decision.tool 
      }), { agent: "ToolAgent", tool: decision.tool });
    } else {
      console.log("\n📝 Step 3: Direct response (no tool needed)");
      finalResponse = decision.response;
      console.log(`✅ Response: ${finalResponse}`);
    }
    
    // Post final response to room
    await postMessage(room.id, formatBandPost("System", "final_response", { 
      message: finalResponse, 
      userId 
    }), { type: "response" });
    
    // Get complete history
    const history = await getRoomHistory(room.id);
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ Workflow Complete");
    console.log("=".repeat(50) + "\n");
    
    return NextResponse.json({
      ok: true,
      roomId: room.id,
      response: finalResponse,
      intent: intent,
      action: decision.action,
      toolUsed: decision.tool || null,
      agentChain: ["Supervisor(LangGraph)", "Doer(Policy)", decision.action === "call_tool" ? "ToolExecutor" : "None"],
      historyCount: history.length
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ API Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}