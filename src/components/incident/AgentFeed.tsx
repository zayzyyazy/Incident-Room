"use client";

import {
  AgentFeedMessage,
  CAUSE_ROOM_AGENTS,
  getAgentDefinition,
} from "@/lib/agents/registry";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";
import {
  AgentChallenge,
  BackendWitnessInitial,
  CausalJudgeBridge,
  CausalJudgeRefinement,
  CausalJudgeTask,
  CauseFinding,
  ClaimTracerInitial,
} from "@/lib/cause-room/types";
import {
  ConversationAnalysis,
  OutcomeAnalysis,
} from "@/lib/band/message-types";
import { Panel } from "@/components/ui/shell";

function VerdictBadge({ label, value }: { label: string; value: string }) {
  const tone =
    value.includes("rejected") || value.includes("CHALLENGE")
      ? "text-alert border-alert/40 bg-alert/10"
      : value.includes("YIELD") || value.includes("accepted")
        ? "text-signal border-signal/40 bg-signal/10"
        : "text-room-muted border-room-border bg-room-elevated";

  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}
    >
      {label}: {value.replace(/_/g, " ")}
    </span>
  );
}

function payloadType(payload: AgentFeedMessage["payload"]): string | undefined {
  if (payload && typeof payload === "object" && "type" in payload) {
    return String((payload as { type: string }).type);
  }
  return undefined;
}

function EventKindBadge({ kind }: { kind?: string }) {
  if (!kind) return null;

  const tone: Record<string, string> = {
    thought: "text-room-muted border-room-border bg-room-bg",
    tool_call: "text-signal border-signal/40 bg-signal/10",
    tool_result: "text-trace border-trace/40 bg-trace/10",
    error: "text-alert border-alert/40 bg-alert/10",
    task: "text-command border-command/40 bg-command/10",
  };

  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone[kind] ?? tone.thought}`}
    >
      {kind.replace(/_/g, " ")}
    </span>
  );
}

function CauseRoomBody({ payload }: { payload: AgentFeedMessage["payload"] }) {
  const type = payloadType(payload);

  if (type === "claim_tracer_initial") {
    const p = payload as ClaimTracerInitial;
    return (
      <>
        <VerdictBadge label="class" value={p.hypothesis_class} />
        <p className="mt-3 text-sm leading-relaxed">{p.hypothesis_en}</p>
        <p className="mt-2 text-xs text-room-muted">
          Customer belief: {p.customer_belief}
        </p>
      </>
    );
  }

  if (type === "backend_witness_initial") {
    const p = payload as BackendWitnessInitial;
    return (
      <>
        <VerdictBadge label="class" value={p.hypothesis_class} />
        <p className="mt-3 text-sm leading-relaxed">{p.hypothesis_en}</p>
        <p className="mt-2 text-xs text-room-muted">{p.execution_summary_en}</p>
      </>
    );
  }

  if (type === "causal_judge_task") {
    const p = payload as CausalJudgeTask;
    return (
      <>
        <p className="mt-3 text-sm leading-relaxed text-command">{p.task_en}</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-room-muted">
          {p.open_questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </>
    );
  }

  if (type === "causal_judge_bridge") {
    const p = payload as CausalJudgeBridge;
    return (
      <>
        <VerdictBadge label="bridge class" value={p.bridge_hypothesis_class} />
        <p className="mt-3 text-sm leading-relaxed text-command">
          {p.bridge_hypothesis_en}
        </p>
        {p.cause_statement ? (
          <p className="mt-2 text-sm leading-relaxed">{p.cause_statement}</p>
        ) : null}
        <p className="mt-2 text-xs text-room-muted">
          {p.challenges_completeness_en}
        </p>
      </>
    );
  }

  if (type === "causal_judge_refinement") {
    const p = payload as CausalJudgeRefinement;
    return (
      <>
        <VerdictBadge label="refinement" value="REFINEMENT" />
        <p className="mt-3 text-sm leading-relaxed text-command">
          {p.refinement_en}
        </p>
        <p className="mt-2 text-xs text-room-muted">
          {hypothesisClassLabel(p.prior_bridge_class)} →{" "}
          {hypothesisClassLabel(p.refined_bridge_class)}
        </p>
        <p className="mt-2 font-mono text-[10px] text-room-muted">
          responds to{" "}
          {p.responds_to_band_message_ids
            .map((id) => id.slice(0, 8))
            .join(", ")}
          …
        </p>
      </>
    );
  }

  if (type === "agent_challenge") {
    const p = payload as AgentChallenge;
    return (
      <>
        <div className="mt-3 flex flex-wrap gap-2">
          <VerdictBadge label="stance" value={p.stance} />
          <VerdictBadge label="type" value={p.challenge_type} />
          <VerdictBadge label="round" value={`${p.round}`} />
        </div>
        <p className="mt-2 text-xs text-trace">
          {hypothesisClassLabel(p.prior_hypothesis_class)} →{" "}
          {hypothesisClassLabel(p.updated_hypothesis_class)}
        </p>
        <p className="mt-1 text-xs text-room-muted">
          vs {hypothesisClassLabel(p.challenged_hypothesis_class)}
        </p>
        <p className="mt-2 text-sm font-medium leading-relaxed">{p.claim}</p>
        <p className="mt-2 text-sm leading-relaxed">{p.explanation_en}</p>
        {p.preserved_from_prior.length ? (
          <p className="mt-2 text-xs text-signal">
            Preserved: {p.preserved_from_prior.join("; ")}
          </p>
        ) : null}
        {p.rejected_from_prior.length ? (
          <p className="mt-1 text-xs text-alert">
            Rejected: {p.rejected_from_prior.join("; ")}
          </p>
        ) : null}
        <p className="mt-2 font-mono text-[10px] text-room-muted">
          cites {p.target_band_message_id.slice(0, 8)}…
        </p>
      </>
    );
  }

  if (type === "cause_finding") {
    const p = payload as CauseFinding;
    return (
      <>
        <VerdictBadge label="cause class" value={p.cause_class} />
        <p className="mt-3 text-sm font-medium leading-relaxed">{p.cause}</p>
        {p.audit_trail ? (
          <div className="mt-3 space-y-2 border-t border-room-border pt-3 text-xs">
            <p className="font-medium text-signal">Accepted because:</p>
            <ul className="list-disc space-y-1 pl-4 text-room-muted">
              {p.audit_trail.accepted_because.flatMap((e, i) =>
                e.cites_band_message_ids.map((id) => (
                  <li key={`acc-${i}-${id}`}>
                    {e.reason_en}{" "}
                    <code className="text-[10px]">{id.slice(0, 8)}…</code>
                  </li>
                )),
              )}
            </ul>
            <p className="font-medium text-alert">Rejected because:</p>
            <ul className="list-disc space-y-1 pl-4 text-room-muted">
              {p.audit_trail.rejected_because.flatMap((e, i) =>
                e.cites_band_message_ids.map((id) => (
                  <li key={`rej-${i}-${id}`}>
                    {e.reason_en}{" "}
                    <code className="text-[10px]">{id.slice(0, 8)}…</code>
                  </li>
                )),
              )}
            </ul>
          </div>
        ) : null}
        {p.hypothesis_lifecycle?.length ? (
          <ul className="mt-3 space-y-1 border-t border-room-border pt-3 text-xs">
            {p.hypothesis_lifecycle.map((h) => (
              <li key={`${h.class}-${h.status}`} className="text-room-muted">
                [{h.status}] {hypothesisClassLabel(h.class)} · {h.introduced_by}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 space-y-1 border-t border-room-border pt-3 text-xs">
            {p.considered_hypotheses.map((h) => (
              <li key={`${h.hypothesis_class}-${h.status}`} className="text-room-muted">
                [{h.status}] {hypothesisClassLabel(h.hypothesis_class)}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return null;
}

function AgentCard({
  message,
  index,
}: {
  message: AgentFeedMessage;
  index: number;
}) {
  const agent = getAgentDefinition(message.agentId);
  if (!agent) {
    return null;
  }

  const type = payloadType(message.payload);
  const isLegacyConversation = message.agentId === "conversation_analyst";
  const isLegacyOutcome = message.agentId === "outcome_investigator";
  const conversation = isLegacyConversation
    ? (message.payload as ConversationAnalysis)
    : null;
  const outcome = isLegacyOutcome
    ? (message.payload as OutcomeAnalysis)
    : null;

  return (
    <div
      className="animate-fade-up"
      style={{ animationDelay: `${index * 120}ms` }}
    >
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
              <p className="text-[11px] text-room-muted">
                {type?.replace(/_/g, " ") ?? agent.layer}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {message.bandEventKind ? (
              <EventKindBadge kind={message.bandEventKind} />
            ) : null}
            {message.messageId ? (
              <code className="text-[10px] text-room-muted">
                {message.messageId.slice(0, 8)}
              </code>
            ) : null}
          </div>
        </div>

        <p className="mt-3 text-xs italic text-room-muted">{agent.question}</p>

        {type ? (
          <CauseRoomBody payload={message.payload} />
        ) : message.content && !type ? (
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-room-muted">
            {message.content}
          </pre>
        ) : isLegacyConversation && conversation ? (
          <p className="mt-3 text-sm leading-relaxed">{conversation.summary_en}</p>
        ) : outcome ? (
          <p className="mt-3 text-sm leading-relaxed">{outcome.summary_en}</p>
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
  const activeAgents = CAUSE_ROOM_AGENTS.filter((a) => a.enabled);

  return (
    <Panel title="Cause Room" className="min-h-[520px]">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {activeAgents.map((agent) => (
            <span
              key={agent.id}
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${agent.borderClass} ${agent.accentClass}`}
            >
              {agent.shortLabel}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="rounded-lg border border-signal/30 bg-signal/5 p-6 text-center text-sm text-signal">
            Cause Room investigating… peer conflict before Causal Judge enters
          </div>
        ) : null}

        {!loading && messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-room-border bg-room-bg p-8 text-center text-sm text-room-muted">
            {emptyHint ??
              "Run Cause Room — hypotheses collide before the bridge cause survives."}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <AgentCard
            key={`${message.agentId}-${message.messageId ?? index}`}
            message={message}
            index={index}
          />
        ))}
      </div>
    </Panel>
  );
}
