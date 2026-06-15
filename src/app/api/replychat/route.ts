
// app/api/replychat/route.ts
import { NextResponse } from "next/server";
import { createRoom, postMessage, formatBandPost, getRoomHistory } from "@/lib/band/client";
import { runSupervisor } from "@/lib/agents/supervisor/graph";
import { runDoer } from "@/lib/agents/doer/graph";
import { runToolExecutor } from "@/lib/agents/tool-executor/graph";

// ========== MAIN HANDLER ==========
export async function POST(request: Request) {
  try {
    const { chatId, message, conversationHistory, userId = "customer_123" } = await request.json();

    if (!message || !chatId) {
      return NextResponse.json({ error: "chatId and message are required" }, { status: 400 });
    }

    console.log("\n" + "=".repeat(50));
    console.log("🚀 ReplyChat API - Multi-Agent Workflow");
    console.log("=".repeat(50));
    console.log(`📥 Chat ID: ${chatId}`);
    console.log(`📥 User Message: "${message}"`);
    console.log(`👤 User ID: ${userId}`);

    // Create or get room using chatId
    const room = await createRoom(`chat-${chatId}`);
    const roomId = room.id;
    console.log(`🏠 Room ID: ${roomId}`);

    const threadId = crypto.randomUUID();

    // Step 1: Supervisor analyzes intent using LangGraph
   // app/api/replychat/route.ts
// Step 1: Build full conversation history
    const fullMessages = [
      ...(conversationHistory || []), // Previous messages from MongoDB
      { role: "user", content: message } // Current message
    ];

    // Step 1: Supervisor with FULL history
    const supervisorResult = await runSupervisor(
      {
        messages: fullMessages, // ✅ Pass full array, not single message
        roomId: roomId,
        userId: userId,
      },
      threadId
    );
    const intent = supervisorResult.intent || "unknown";
    console.log(`✅ Intent detected: ${intent}`);

    // Post supervisor analysis to Band
    await postMessage(roomId, formatBandPost("Supervisor", "intent_analysis", { 
      intent, 
      originalMessage: message,
      userId
    }), { agent: "Supervisor", intent });

    // Step 2: Doer applies policies using LangGraph
    console.log("\n📝 Step 2: Doer (LangGraph) applying business policies...");
    const doerResult = await runDoer(
      {
        messages: fullMessages,
        roomId: roomId,
        userId: userId,
        intent: intent,
      },
      threadId
    );
    const decision = doerResult.decision;
    console.log(`✅ Decision: ${decision?.action}${decision?.tool ? ` - Tool: ${decision.tool}` : ''}`);
    console.log(`   Reasoning: ${decision?.reasoning || 'N/A'}`);

    // Post doer decision to Band
    await postMessage(roomId, formatBandPost("Doer", "policy_decision", decision), { 
      agent: "Doer",
      intent 
    });

    // Step 3: Tool executor runs if needed using LangGraph
    let finalReply = "";
    let toolsCalled: any[] = [];

    if (decision?.action === "call_tool") {
      console.log(`\n📝 Step 3: ToolExecutor (LangGraph) running ${decision.tool}...`);
      const toolResult = await runToolExecutor(
        {
          messages: [{ role: "user", content: message }],
          roomId: roomId,
          userId: userId,
          decision: decision,
        },
        threadId
      );
      finalReply = toolResult.result;
      console.log(`✅ Tool result: ${finalReply.substring(0, 100)}...`);
      
      toolsCalled = [{
        name: decision.tool,
        arguments: decision.params,
        result: finalReply
      }];

      // Post tool execution result to Band
      await postMessage(roomId, formatBandPost("ToolAgent", "execution_result", { 
        result: finalReply, 
        userId,
        tool: decision.tool 
      }), { agent: "ToolAgent", tool: decision.tool });
    } else {
      console.log("\n📝 Step 3: Direct response (no tool needed)");
      finalReply = decision?.response || "I'll help you with that request.";
      console.log(`✅ Response: ${finalReply}`);
    }

    // Save final response to Band
    await postMessage(roomId, formatBandPost("Assistant", "final_response", { 
      message: finalReply,
      userId,
      intent,
      action: decision?.action
    }), { type: "response" });

    // Get conversation history (optional)
    const history = await getRoomHistory(roomId);

    console.log("\n" + "=".repeat(50));
    console.log("✅ ReplyChat Workflow Complete");
    console.log(`💬 Final Reply: ${finalReply}`);
    console.log("=".repeat(50) + "\n");

    return NextResponse.json({
      reply: finalReply,
      tools_called: toolsCalled,
      roomId: roomId,
      intent: intent,
      action: decision?.action,
      historyCount: history.length
    });

  } catch (error) {
    console.error("❌ ReplyChat API Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 });
  }
}
