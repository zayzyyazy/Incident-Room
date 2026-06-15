"use client";

import {
  AGENT_REGISTRY,
  AgentFeedMessage,
  getAgentDefinition,
} from "@/lib/agents/registry";
import {
  ConversationAnalysis,
  OutcomeAnalysis,
} from "@/lib/band/message-types";
import { Panel } from "@/components/ui/shell";

function VerdictBadge({ label, value }: { label: string; value: string }) {
  const tone =
    value.includes("failed") || value.includes("unresolved")
      ? "text-alert border-alert/40 bg-alert/10"
      : value.includes("resolved") || value.includes("achieved")
        ? "text-trace border-trace/40 bg-trace/10"
        : "text-room-muted border-room-border bg-room-elevated";

  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}
    >
      {label}: {value.replace(/_/g, " ")}
    </span>
  );
}

function AgentCard({
  message,
  index,
  previousMessageId,
}: {
  message: AgentFeedMessage;
  index: number;
  previousMessageId?: string;
}) {
  const agent = getAgentDefinition(message.agentId);
  if (!agent) {
    return null;
  }

  const payload = message.payload;
  const isConversation = message.agentId === "conversation_analyst";
  const conversation = isConversation
    ? (payload as ConversationAnalysis)
    : null;
  const outcome = !isConversation ? (payload as OutcomeAnalysis) : null;

  const showContradiction =
    message.contradictsMessageId &&
    previousMessageId &&
    message.contradictsMessageId === previousMessageId;

  return (
    <div
      className="animate-fade-up"
      style={{ animationDelay: `${index * 180}ms` }}
    >
      {showContradiction ? (
        <div className="mb-2 flex items-center gap-2 text-[11px] text-alert">
          <span className="h-px flex-1 bg-alert/40" />
          contradicts previous finding
          <span className="h-px flex-1 bg-alert/40" />
        </div>
      ) : null}

      <article
        className={`rounded-xl border bg-room-elevated p-4 ${agent.borderClass} ${agent.glowClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg border bg-room-panel font-mono text-xs font-bold ${agent.borderClass} ${agent.accentClass}`}
            >
              {agent.shortLabel}
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${agent.accentClass}`}>
                {agent.label}
              </h3>
              <p className="text-[11px] text-room-muted">{agent.layer}</p>
            </div>
          </div>
          {message.messageId ? (
            <code className="text-[10px] text-room-muted">
              {message.messageId.slice(0, 8)}
            </code>
          ) : null}
        </div>

        <p className="mt-3 text-xs italic text-room-muted">{agent.question}</p>

        <p className="mt-3 text-sm leading-relaxed text-foreground">
          {isConversation
            ? conversation?.summary_en
            : outcome?.summary_en}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {isConversation && conversation ? (
            <VerdictBadge
              label="verdict"
              value={conversation.conversation_verdict}
            />
          ) : null}
          {outcome ? (
            <VerdictBadge label="execution" value={outcome.execution_verdict} />
          ) : null}
          {outcome?.resolution_mode ? (
            <VerdictBadge
              label="path"
              value={outcome.resolution_mode.replace(/_/g, " ")}
            />
          ) : null}
          {outcome?.handoff_reason &&
          outcome.handoff_reason !== "not_applicable" &&
          outcome.handoff_reason !== "unknown" ? (
            <VerdictBadge label="handoff" value={outcome.handoff_reason} />
          ) : null}
        </div>

        {outcome?.handoff_detail_en ? (
          <p className="mt-2 text-xs text-room-muted">{outcome.handoff_detail_en}</p>
        ) : null}

        {outcome?.tool_failures?.length ? (
          <ul className="mt-3 space-y-2 border-t border-room-border pt-3">
            {outcome.tool_failures.map((failure) => (
              <li key={failure.tool_name} className="text-xs text-room-muted">
                <span className="text-alert">{failure.tool_name}</span> —{" "}
                {failure.detail_en}
              </li>
            ))}
          </ul>
        ) : null}

        {isConversation && conversation?.spoken_entities?.length ? (
          <details className="mt-3 text-xs text-room-muted">
            <summary className="cursor-pointer text-trace">German quotes</summary>
            <ul className="mt-2 space-y-1 font-mono">
              {conversation.spoken_entities.map((entity) => (
                <li key={entity.key}>
                  {entity.key}: {entity.quote_de ?? entity.value_as_spoken}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </article>
    </div>
  );
}

export function AgentFeed({
  messages,
  loading,
  emptyHint,
}: {
  messages: AgentFeedMessage[];
  loading?: boolean;
  emptyHint?: string;
}) {
  return (
    <Panel title="Investigation room" className="min-h-[520px]">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {AGENT_REGISTRY.map((agent) => (
            <span
              key={agent.id}
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                agent.enabled
                  ? `${agent.borderClass} ${agent.accentClass}`
                  : "border-room-border text-room-muted opacity-40"
              }`}
            >
              {agent.shortLabel}
              {!agent.enabled ? " · soon" : ""}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="rounded-lg border border-signal/30 bg-signal/5 p-6 text-center text-sm text-signal">
            Agents investigating… posting to Band
          </div>
        ) : null}

        {!loading && messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-room-border bg-room-bg p-8 text-center text-sm text-room-muted">
            {emptyHint ??
              "Run investigation to watch agents post findings here."}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <AgentCard
            key={`${message.agentId}-${message.messageId ?? index}`}
            message={message}
            index={index}
            previousMessageId={messages[index - 1]?.messageId}
          />
        ))}
      </div>
    </Panel>
  );
}
