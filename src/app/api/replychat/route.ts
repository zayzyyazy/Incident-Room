
// app/api/replychat/route.ts
import { NextResponse } from "next/server";
import { createRoom, postMessage, formatBandPost, getRoomHistory } from "@/lib/band/client";
import {
  postBandWorkflowEvent,
  postBandWorkflowAssignment,
  recruitBandWorkflowAgents,
} from "@/lib/band/agent-workflow";
import { runSupervisor } from "@/lib/agents/supervisor/graph";
import { runDoer } from "@/lib/agents/doer/graph";
import { runToolExecutor } from "@/lib/agents/tool-executor/graph";
import {
  buildChatEvidence,
  StoredChatMessage,
  StoredToolCall,
} from "@/lib/chat/evidence";
import { runTwoAgentInvestigation } from "@/lib/orchestrator/run-two-agent-investigation";
import {
  completeInvestigation,
  failInvestigation,
  persistFailedChatEvidence,
  startInvestigation,
  upsertIncidentFromEvidence,
} from "@/lib/incidents/store";

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

type SupportDecision = {
  action?: string;
  tool?: string;
  params?: Record<string, unknown>;
  response?: string;
  reasoning?: string;
};

type RegisteredIncident = {
  id: string;
  title: string;
  status: string;
  evidenceFile?: string;
  investigation?: {
    status: string;
    runId: string;
    roomId?: string;
    error?: string;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMessage(message: unknown): StoredChatMessage {
  const record = isRecord(message) ? message : {};
  const role = record.role === "assistant" || record.role === "user"
    ? record.role
    : "system";

  return {
    role,
    content: String(record.content ?? ""),
    timestamp:
      typeof record.timestamp === "string" || record.timestamp instanceof Date
        ? record.timestamp
        : nowIso(),
    intent: typeof record.intent === "string" ? record.intent : null,
    toolsCalled: Array.isArray(record.toolsCalled)
      ? (record.toolsCalled as StoredToolCall[])
      : Array.isArray(record.tools_called)
        ? (record.tools_called as StoredToolCall[])
        : [],
    roomId: typeof record.roomId === "string" ? record.roomId : undefined,
    analyzer: isRecord(record.analyzer) ? record.analyzer : undefined,
    workflowTrace: Array.isArray(record.workflowTrace)
      ? record.workflowTrace
      : undefined,
  };
}

function appendCurrentUserMessage(
  conversationHistory: unknown[] | undefined,
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

function toolSignals(toolsCalled: StoredToolCall[]) {
  return toolsCalled.flatMap((tool) => {
    const result = typeof tool.result === "string"
      ? tool.result.toLowerCase()
      : JSON.stringify(tool.result ?? {}).toLowerCase();
    const signals: string[] = [];
    if (tool.status === "error") {
      signals.push(`tool_error:${tool.name}`);
    }
    if (tool.name === "placeOrder") {
      signals.push("place_order_workflow");
      if (tool.status === "error" || result.includes('"orderplaced":false')) {
        signals.push("place_order_noop");
      }
      if (result.includes("customerMessage".toLowerCase())) {
        signals.push("deceptive_success_reply");
      }
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
  decision: SupportDecision;
  toolsCalled: StoredToolCall[];
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
  const placeOrderNoop = signals.includes("place_order_noop");
  const unresolved =
    signals.includes("unresolved_tool_result") ||
    signals.some((signal) => signal.startsWith("tool_error"));

  if (userEnded) {
    signals.push("customer_closed_chat");
  }
  if (workflowEnded) {
    signals.push("workflow_handoff_closed");
  }

  const chatEnded = userEnded || workflowEnded || placeOrderNoop;
  const shouldInvestigate =
    chatEnded &&
    (unresolved ||
      refundPending ||
      placeOrderNoop ||
      workflowEnded ||
      input.intent === "refund" ||
      input.intent === "human_handoff" ||
      input.intent === "place_order");

  return {
    chatEnded,
    shouldInvestigate,
    signals: Array.from(new Set(signals)),
    reason: chatEnded
      ? shouldInvestigate
        ? placeOrderNoop
          ? "Chat contains a simulated place-order no-op: the assistant confirmed success, but the tool recorded no backend order."
          : "Chat is closed and contains refund, handoff, or unresolved tool signals."
        : "Chat is closed without investigation-worthy execution signals."
      : "Chat is still active; wait for customer closure or handoff before dashboard registration.",
  };
}

async function runAutomaticInvestigation(
  incidentId: string,
  evidence: ReturnType<typeof buildChatEvidence>,
) {
  const run = startInvestigation(incidentId);

  try {
    const result = await runTwoAgentInvestigation(evidence);
    const contradiction = {
      detected:
        result.outcomeAnalysis.contradicts_msg_id !== null ||
        (result.conversationAnalysis.conversation_verdict ===
          "appears_resolved" &&
          result.outcomeAnalysis.execution_verdict === "outcome_failed"),
      contradicts_msg_id: result.outcomeAnalysis.contradicts_msg_id,
      reason: result.outcomeAnalysis.contradiction_reason_en,
    };

    const completed = completeInvestigation(incidentId, run.id, {
      roomId: result.roomId,
      bandMessageIds: result.bandMessageIds,
      conversationAnalysis: result.conversationAnalysis,
      outcomeAnalysis: result.outcomeAnalysis,
      contradiction,
    });

    return {
      status: completed.status,
      runId: completed.id,
      roomId: completed.roomId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed";
    const failed = failInvestigation(incidentId, run.id, message);
    return {
      status: failed.status,
      runId: failed.id,
      error: message,
    };
  }
}

// ========== MAIN HANDLER ==========
export async function POST(request: Request) {
  try {
    const { chatId, message, conversationHistory, userId = "user-123" } = await request.json();

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

    const postAgentStep = async (
      roomId: string,
      step: string,
      agent: string,
      event: string,
      payload: unknown,
      metadata: Record<string, unknown> = {},
    ) => {
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
    };

    // Each chat turn uses Band as the blackboard that agents post to and read from.
    const room = await createRoom();
    const roomId = room.id;
    console.log(`🏠 Room ID: ${roomId}`);
    const recruitment = await recruitBandWorkflowAgents(roomId);
    console.log(`🤝 Band remote agents: ${JSON.stringify(recruitment)}`);

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

    await postAgentStep(roomId, "00", "System", "band_remote_agents_recruited", {
      agents: recruitment,
      protocol:
        "Configured Band remote agents are added as room participants and receive directed @mentions for each handoff.",
    });

    await postAgentStep(roomId, "01", "System", "supervisor_assignment", {
      instruction:
        "Supervisor, classify the latest customer intent using the chat transcript posted to this Band room.",
      latest_message: message,
    });
    try {
      await postBandWorkflowAssignment(
        roomId,
        "supervisor",
        "supervisor_assignment",
        {
          instruction:
            "Classify the latest customer intent using the chat transcript posted to this Band room, then hand the intent to Doer in Band.",
          latest_message: message,
          chatId,
          userId,
          transcript_turns: fullMessages.length,
        },
        { chatId, userId },
      );
    } catch (error) {
      console.warn("Band supervisor assignment mention failed", error);
    }

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

    const doerHandoffPayload = {
      instruction:
        "Doer, use the Supervisor intent and Band room context to choose either a direct answer or a tool request.",
      intent,
      messages: fullMessages,
      latest_message: message,
      chatId,
      userId,
      band_history_count: historyAfterSupervisor.length,
    };

    await postAgentStep(roomId, "02", "Supervisor", "handoff_to_doer", doerHandoffPayload, { intent });
    try {
      await postBandWorkflowEvent(
        "supervisor",
        roomId,
        "handoff_to_doer",
        doerHandoffPayload,
        {
          mentionRole: "doer",
          metadata: { intent, chatId, userId },
        },
      );
    } catch (error) {
      console.warn("Band supervisor-to-doer handoff failed", error);
    }

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
    const decision = (doerResult.decision ?? {}) as SupportDecision;
    console.log(`✅ Decision: ${decision?.action}${decision?.tool ? ` - Tool: ${decision.tool}` : ''}`);
    console.log(`   Reasoning: ${decision?.reasoning || 'N/A'}`);

    await postAgentStep(roomId, "02", "Doer", "policy_decision", {
      ...decision,
      band_history_count: (await getRoomHistory(roomId)).length,
    }, { intent });

    // Step 3: Tool executor runs if needed using LangGraph
    let finalReply = "";
    let toolsCalled: StoredToolCall[] = [];

    if (decision?.action === "call_tool") {
      console.log(`\n📝 Step 3: ToolExecutor (LangGraph) running ${decision.tool}...`);
      const toolExecutorAssignment = {
        instruction:
          "Tool Executor, run the requested live support tool and post the result back to Band before the assistant responds.",
        decision,
        tool: decision.tool,
        params: decision.params,
        intent,
        chatId,
        userId,
      };

      await postAgentStep(roomId, "03", "Doer", "tool_executor_assignment", toolExecutorAssignment, { intent, tool: decision.tool });
      try {
        await postBandWorkflowEvent(
          "doer",
          roomId,
          "tool_executor_assignment",
          toolExecutorAssignment,
          {
            mentionRole: "tool_executor",
            metadata: { intent, tool: decision.tool, chatId, userId },
          },
        );
      } catch (error) {
        console.warn("Band doer-to-tool-executor assignment failed", error);
      }

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
              name: decision.tool ?? "unknown_tool",
              arguments: decision.params ?? {},
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
      title: analyzer.shouldInvestigate
        ? `Failed chat ${chatId}: ${intent}`
        : `Support chat ${chatId}: ${intent}`,
    });

    let incident: RegisteredIncident | null = null;
    if (analyzer.chatEnded && analyzer.shouldInvestigate) {
      const evidenceFile = persistFailedChatEvidence(evidence);
      const record = upsertIncidentFromEvidence(evidence);
      incident = {
        id: record.id,
        title: record.evidence.title,
        status: record.status,
        evidenceFile,
      };

      if (analyzer.signals.includes("place_order_noop")) {
        incident.investigation = await runAutomaticInvestigation(record.id, evidence);
        incident.status = incident.investigation.status;
      }
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
