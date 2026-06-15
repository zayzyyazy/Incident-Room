
// app/api/replychat/route.ts
import { NextResponse } from "next/server";
import { createRoom, postMessage, formatBandPost, getRoomHistory } from "@/lib/band/client";
import { runSupervisor } from "@/lib/agents/supervisor/graph";
import { runDoer } from "@/lib/agents/doer/graph";
import { runToolExecutor } from "@/lib/agents/tool-executor/graph";
import { buildChatEvidence, StoredChatMessage } from "@/lib/chat/evidence";
import { upsertIncidentFromEvidence } from "@/lib/incidents/store";

type WorkflowTraceEntry = {
  step: string;
  agent: string;
  event: string;
  timestamp: string;
  bandMessageId?: string;
  payload: unknown;
};

type EndAnalyzerResult = {
  chatEnded: boolean;
  shouldInvestigate: boolean;
  reason: string;
  signals: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeMessage(message: any): StoredChatMessage {
  return {
    role: message.role === "assistant" || message.role === "user" ? message.role : "system",
    content: String(message.content ?? ""),
    timestamp: message.timestamp ?? nowIso(),
    intent: message.intent ?? null,
    toolsCalled: message.toolsCalled ?? message.tools_called ?? [],
    roomId: message.roomId,
    analyzer: message.analyzer,
    workflowTrace: message.workflowTrace,
  };
}

function appendCurrentUserMessage(
  conversationHistory: any[] | undefined,
  message: string,
): StoredChatMessage[] {
  const history = (conversationHistory ?? []).map(normalizeMessage);
  const last = history.at(-1);

  if (last?.role === "user" && last.content === message) {
    return history;
  }

  return [
    ...history,
    {
      role: "user",
      content: message,
      timestamp: nowIso(),
      toolsCalled: [],
    },
  ];
}

function toolSignals(toolsCalled: any[]) {
  return toolsCalled.flatMap((tool) => {
    const result = String(tool.result ?? "").toLowerCase();
    const signals: string[] = [];
    if (tool.status === "error") {
      signals.push(`tool_error:${tool.name}`);
    }
    if (tool.name === "askRefund" || result.includes("refund")) {
      signals.push("refund_workflow");
    }
    if (tool.name === "callHumanIntervention" || result.includes("human teammate")) {
      signals.push("human_handoff");
    }
    if (
      result.includes("not found") ||
      result.includes("not eligible") ||
      result.includes("different customer") ||
      result.includes("cannot")
    ) {
      signals.push("unresolved_tool_result");
    }
    return signals;
  });
}

function analyzeEndOfChat(input: {
  messages: StoredChatMessage[];
  intent: string;
  decision: any;
  toolsCalled: any[];
  finalReply: string;
}): EndAnalyzerResult {
  const latestUserText =
    [...input.messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";
  const loweredUser = latestUserText.toLowerCase();
  const loweredReply = input.finalReply.toLowerCase();
  const allToolCalls = input.messages.flatMap(
    (message) => message.toolsCalled ?? message.tools_called ?? [],
  );
  const signals = [
    ...toolSignals([...allToolCalls, ...input.toolsCalled]),
  ];

  const userEnded =
    input.intent === "end_chat" ||
    /\b(thanks|thank you|bye|goodbye|that's all|that is all|resolved|done)\b/.test(
      loweredUser,
    );
  const workflowEnded =
    input.intent === "human_handoff" ||
    input.decision?.tool === "callHumanIntervention" ||
    loweredReply.includes("human teammate has been requested");
  const refundPending = signals.includes("refund_workflow");
  const unresolved =
    signals.includes("unresolved_tool_result") ||
    signals.some((signal) => signal.startsWith("tool_error"));

  if (userEnded) {
    signals.push("customer_closed_chat");
  }
  if (workflowEnded) {
    signals.push("workflow_handoff_closed");
  }

  const chatEnded = userEnded || workflowEnded;
  const shouldInvestigate =
    chatEnded &&
    (unresolved ||
      refundPending ||
      workflowEnded ||
      input.intent === "refund" ||
      input.intent === "human_handoff");

  return {
    chatEnded,
    shouldInvestigate,
    signals: [...new Set(signals)],
    reason: chatEnded
      ? shouldInvestigate
        ? "Chat is closed and contains refund, handoff, or unresolved tool signals."
        : "Chat is closed without investigation-worthy execution signals."
      : "Chat is still active; wait for customer closure or handoff before dashboard registration.",
  };
}

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

    const trace: WorkflowTraceEntry[] = [];

    async function postAgentStep(
      roomId: string,
      step: string,
      agent: string,
      event: string,
      payload: unknown,
      metadata: Record<string, unknown> = {},
    ) {
      const posted = await postMessage(
        roomId,
        formatBandPost(agent, event, payload),
        { agent, event, step, chatId, ...metadata },
      );
      trace.push({
        step,
        agent,
        event,
        timestamp: nowIso(),
        bandMessageId: posted.id,
        payload,
      });
      return posted;
    }

    // Each chat turn uses Band as the blackboard that agents post to and read from.
    const room = await createRoom();
    const roomId = room.id;
    console.log(`🏠 Room ID: ${roomId}`);

    const threadId = crypto.randomUUID();

    const storedUserMessages = appendCurrentUserMessage(conversationHistory, message);
    const fullMessages = storedUserMessages.map(({ role, content }) => ({
      role,
      content,
    }));

    await postAgentStep(roomId, "00", "Customer", "customer_message", {
      chatId,
      userId,
      message,
      transcript_turns: fullMessages.length,
    });

    await postAgentStep(roomId, "01", "System", "supervisor_assignment", {
      instruction:
        "Supervisor, classify the latest customer intent using the chat transcript posted to this Band room.",
      latest_message: message,
    });

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

    await postAgentStep(roomId, "01", "Supervisor", "intent_analysis", {
      intent, 
      originalMessage: message,
      userId,
      transcript_turns: fullMessages.length,
    }, { intent });

    const historyAfterSupervisor = await getRoomHistory(roomId);

    await postAgentStep(roomId, "02", "Supervisor", "handoff_to_doer", {
      instruction:
        "Doer, use the Supervisor intent and Band room context to choose either a direct answer or a tool request.",
      intent,
      band_history_count: historyAfterSupervisor.length,
    }, { intent });

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

    await postAgentStep(roomId, "02", "Doer", "policy_decision", {
      ...decision,
      band_history_count: (await getRoomHistory(roomId)).length,
    }, { intent });

    // Step 3: Tool executor runs if needed using LangGraph
    let finalReply = "";
    let toolsCalled: any[] = [];

    if (decision?.action === "call_tool") {
      console.log(`\n📝 Step 3: ToolExecutor (LangGraph) running ${decision.tool}...`);
      await postAgentStep(roomId, "03", "Doer", "tool_executor_assignment", {
        instruction:
          "Tool Executor, run the requested live support tool and post the result back to Band before the assistant responds.",
        tool: decision.tool,
        params: decision.params,
      }, { intent, tool: decision.tool });

      const toolResult = await runToolExecutor(
        {
          messages: fullMessages,
          roomId: roomId,
          userId: userId,
          decision: decision,
        },
        threadId
      );
      finalReply = toolResult.result;
      console.log(`✅ Tool result: ${finalReply.substring(0, 100)}...`);
      
      toolsCalled =
        toolResult.toolCalls?.length > 0
          ? toolResult.toolCalls
          : [{
              name: decision.tool,
              arguments: decision.params,
              result: finalReply,
              status: "success",
            }];

      await postAgentStep(roomId, "03", "ToolExecutor", "execution_result", {
        result: finalReply, 
        userId,
        tool: decision.tool,
        toolsCalled,
        band_history_count: (await getRoomHistory(roomId)).length,
      }, { tool: decision.tool });
    } else {
      console.log("\n📝 Step 3: Direct response (no tool needed)");
      finalReply = decision?.response || "I'll help you with that request.";
      console.log(`✅ Response: ${finalReply}`);
      await postAgentStep(roomId, "03", "Doer", "direct_response_selected", {
        response: finalReply,
        reasoning: decision?.reasoning,
      }, { intent });
    }

    await postAgentStep(roomId, "04", "Assistant", "draft_response", {
      message: finalReply,
      userId,
      intent,
      action: decision?.action
    }, { type: "response" });

    await postAgentStep(roomId, "05", "EndAnalyzer", "analysis_assignment", {
      instruction:
        "Analyze whether this chat is ended. If ended and there are refund, handoff, or failed tool signals, convert it to incident evidence for the dashboard.",
      known_tools: toolsCalled.map((tool) => tool.name),
    });

    const assistantMessage: StoredChatMessage = {
      role: "assistant",
      content: finalReply,
      timestamp: nowIso(),
      intent,
      toolsCalled,
      roomId,
      workflowTrace: trace,
    };
    const transcriptForEvidence = [...storedUserMessages, assistantMessage];
    const analyzer = analyzeEndOfChat({
      messages: transcriptForEvidence,
      intent,
      decision,
      toolsCalled,
      finalReply,
    });
    assistantMessage.analyzer = analyzer;

    const evidence = buildChatEvidence(transcriptForEvidence, {
      chatId,
      userId,
      roomId,
      analyzer,
      title: `Support chat ${chatId}: ${intent}`,
    });

    let incident: { id: string; title: string; status: string } | null = null;
    if (analyzer.chatEnded && analyzer.shouldInvestigate) {
      const record = upsertIncidentFromEvidence(evidence);
      incident = {
        id: record.id,
        title: record.evidence.title,
        status: record.status,
      };
    }

    await postAgentStep(roomId, "05", "EndAnalyzer", "analysis_result", {
      ...analyzer,
      incident,
      evidence_incident_id: evidence.incident_id,
    }, {
      shouldInvestigate: analyzer.shouldInvestigate,
      chatEnded: analyzer.chatEnded,
    });

    if (incident) {
      await postAgentStep(roomId, "06", "System", "dashboard_incident_registered", {
        incident,
        dashboard_source: "/api/incidents",
      });
    }

    await postAgentStep(roomId, "07", "Assistant", "final_response", {
      message: finalReply,
      userId,
      intent,
      action: decision?.action,
      analyzer,
    }, { type: "response" });

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
      historyCount: history.length,
      workflow_trace: trace,
      analyzer,
      incident,
      evidence,
      investigation_input: { evidence }
    });

  } catch (error) {
    console.error("❌ ReplyChat API Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 });
  }
}
