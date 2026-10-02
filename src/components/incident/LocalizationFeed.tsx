"use client";

import {
  AgentFeedMessage,
  getAgentDefinition,
  LOCALIZATION_ROOM_AGENTS,
} from "@/lib/agents/registry";
import {
  EliminatedExplanation,
  InvestigatorYield,
  LocalizationFinding,
  MechanismDiscovery,
  MechanismFormalization,
  SurfaceAttack,
  SurfaceOpening,
} from "@/lib/localization-room/types";
import { Panel } from "@/components/ui/shell";

function EventKindBadge({ kind }: { kind?: string }) {
  if (!kind) return null;
  const tone: Record<string, string> = {
    thought: "text-room-muted border-room-border bg-room-bg",
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

function LocalizationBody({ payload }: { payload: AgentFeedMessage["payload"] }) {
  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    return null;
  }

  const type = String((payload as { type: string }).type);

  if (type === "surface_opening") {
    const p = payload as SurfaceOpening;
    return (
      <>
        <p className="mt-2 text-xs uppercase text-signal">Opening theory</p>
        <p className="mt-2 text-sm font-medium leading-relaxed">{p.claim_en}</p>
        <p className="mt-2 font-mono text-[10px] text-room-muted">
          {p.suspected_surface.pointer.native_label}
        </p>
      </>
    );
  }

  if (type === "surface_attack") {
    const p = payload as SurfaceAttack;
    return (
      <>
        <p className="mt-2 text-xs uppercase text-alert">Attack</p>
        <p className="mt-2 text-sm font-medium leading-relaxed">{p.claim_en}</p>
        <p className="mt-2 text-xs text-room-muted">
          vs {p.challenged_surface_id.replace(/_/g, " ")}
        </p>
      </>
    );
  }

  if (type === "eliminated_explanations") {
    const items =
      "items" in (payload as { items?: EliminatedExplanation[] })
        ? (payload as { items: EliminatedExplanation[] }).items
        : [];
    return (
      <ul className="mt-2 space-y-2 text-sm leading-relaxed">
        {items.map((e) => (
          <li key={e.ruled_out_surface_id} className="text-room-muted">
            <span className="text-alert line-through">{e.ruled_out_label}</span>
            {" — "}
            {e.reason_en}
          </li>
        ))}
      </ul>
    );
  }

  if (type === "mechanism_discovery") {
    const p = payload as MechanismDiscovery;
    return (
      <>
        <p className="mt-2 text-xs font-semibold uppercase text-command">
          Discovery — {p.discovered_by.replace(/_/g, " ")}
        </p>
        <p className="mt-2 text-sm font-medium leading-relaxed text-command">
          {p.discovery_en}
        </p>
        <p className="mt-3 text-xs font-mono uppercase text-trace">
          {p.mechanism.canonical_id}
        </p>
      </>
    );
  }

  if (type === "investigator_yield") {
    const p = payload as InvestigatorYield;
    return (
      <>
        <p className="mt-2 text-xs uppercase text-trace">Yield</p>
        <p className="mt-2 text-sm leading-relaxed">{p.yield_en}</p>
      </>
    );
  }

  if (type === "mechanism_formalization") {
    const p = payload as MechanismFormalization;
    return (
      <>
        <p className="mt-2 text-xs uppercase text-room-muted">Referee formalization</p>
        <p className="mt-2 text-sm leading-relaxed">{p.formalization_en}</p>
      </>
    );
  }

  if (type === "localization_finding") {
    const p = payload as LocalizationFinding;
    return (
      <>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-room-muted">
          Implementation Mechanism
        </p>
        <p className="mt-1 text-xs font-mono uppercase text-command">
          {p.implementation_mechanism.canonical_id}
        </p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-room-muted">
          Explanation
        </p>
        <p className="mt-1 text-sm leading-relaxed">{p.mechanism_explanation}</p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-room-muted">
          Primary Surface
        </p>
        <p className="mt-1 text-sm text-signal">
          {p.primary_surface.pointer.native_label}
        </p>
        <p className="mt-1 font-mono text-[10px] text-trace">
          {p.primary_surface.pointer.native_pointer}
        </p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-room-muted">
          Supporting Surfaces
        </p>
        <ul className="mt-1 space-y-1 text-xs text-room-muted">
          {p.supporting_surfaces.map((s, i) => (
            <li key={s.surface_id}>
              {i + 1}. {s.pointer.native_label}
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (type === "CauseFinding") {
    const p = payload as { cause_class?: string; cause?: string; cause_statement?: string };
    return (
      <>
        <p className="mt-2 text-xs uppercase text-room-muted">Cross-room intake</p>
        <p className="mt-1 text-sm">{p.cause ?? p.cause_statement}</p>
      </>
    );
  }

  return null;
}

function LocalizationCard({
  message,
  index,
}: {
  message: AgentFeedMessage;
  index: number;
}) {
  const agent = getAgentDefinition(message.agentId);
  if (!agent) return null;

  const type =
    message.payload &&
    typeof message.payload === "object" &&
    "type" in message.payload
      ? String((message.payload as { type: string }).type)
      : undefined;

  const isDiscovery = type === "mechanism_discovery";

  return (
    <article
      className={`animate-fade-up rounded-xl border bg-room-elevated p-4 ${agent.borderClass} ${isDiscovery ? "shadow-glow-command ring-1 ring-command/30" : ""}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-xs font-bold ${agent.borderClass} ${agent.accentClass}`}
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
      {type ? (
        <LocalizationBody payload={message.payload} />
      ) : message.content ? (
        <pre className="mt-3 whitespace-pre-wrap text-sm text-room-muted">
          {message.content}
        </pre>
      ) : null}
    </article>
  );
}

export function LocalizationFeed({
  messages,
  loading,
  emptyHint,
}: {
  messages: AgentFeedMessage[];
  loading?: boolean;
  emptyHint?: string;
}) {
  return (
    <Panel title="Localization Room" className="min-h-[520px]">
      <div className="space-y-4 p-4">
        <p className="text-xs text-room-muted">
          Surfaces are attacked → incomplete explanations eliminated →{" "}
          <span className="text-command">mechanism discovered</span> → localized
          to evidence pointer.
        </p>
        <div className="flex flex-wrap gap-2">
          {LOCALIZATION_ROOM_AGENTS.filter((a) => a.enabled).map((agent) => (
            <span
              key={agent.id}
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${agent.borderClass} ${agent.accentClass}`}
            >
              {agent.shortLabel}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="rounded-lg border border-command/30 bg-command/5 p-6 text-center text-sm text-command">
            Specialists disagreeing… mechanism emerging from conflict
          </div>
        ) : null}

        {!loading && messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-room-border bg-room-bg p-8 text-center text-sm text-room-muted">
            {emptyHint ??
              "Run full investigation — Cause Finding feeds Localization Room via Band artifact."}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <LocalizationCard
            key={`${message.agentId}-${message.messageId ?? index}`}
            message={message}
            index={index}
          />
        ))}
      </div>
    </Panel>
  );
}
