"use client";

import { useState } from "react";
import { AgentFeedMessage } from "@/lib/agents/registry";

function summarizeMessage(m: AgentFeedMessage): string {
  const payload = m.payload;
  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    if (m.content) return m.content.split("\n")[0].replace(/^\*\*|\*\*$/g, "").slice(0, 80);
    return "…";
  }
  const type = String((payload as { type: string }).type);

  switch (type) {
    case "claim_tracer_initial":
      return "Claim Tracer: opening hypothesis";
    case "backend_witness_initial":
      return "Backend: execution failed (504)";
    case "agent_challenge":
      return `Challenge · ${(payload as { stance?: string }).stance ?? "conflict"}`;
    case "causal_judge_bridge":
      return "Causal Judge: bridge cause";
    case "cause_finding":
      return "CauseFinding artifact posted";
    case "CauseFinding":
      return "CauseFinding → Room 2";
    case "CauseDefenseRequest":
      return "Guard → Cause: attack causal necessity";
    case "CauseDefenseDecision":
      return "Causal Judge: DEFEND | REVISE | INSUFFICIENT";
    case "LocalizationDefenseVerdict":
      return "Guard: defense verdict";
    case "CauseRevisionRequest":
      return "Localization → Cause: revision request";
    case "CauseRevisionDecision":
      return "Causal Judge: REVISE cause";
    case "investigator_admission":
      return "Investigator: I was wrong";
    case "surface_opening":
      return "CFI: default handoff branch";
    case "surface_attack":
      return `${(payload as { attacker_role?: string }).attacker_role?.includes("policy") ? "Policy" : "Guard"}: rejects incomplete theory`;
    case "surface_counterattack":
      return "CFI: counterattack before breakthrough";
    case "mechanism_discovery":
      return "Policy: Schritt 1 before Schritt 3";
    case "InvestigationBreakthrough":
      return "Breakthrough artifact";
    case "investigator_yield":
      return "Investigator yields to mechanism";
    case "LocalizationConfidenceChallenge":
      return "CFI: could mechanism exist elsewhere?";
    case "surface_confidence_defense":
      return "Policy: surface earned";
    case "mechanism_formalization":
      return "Judge: formalizes (referee)";
    case "localization_finding":
      return "LocalizationFinding artifact";
    case "LocalizationFinding":
      return "LocalizationFinding posted";
    case "SpecialistRecruited":
      return `Recruited @${(payload as { recruit?: string }).recruit ?? "specialist"}`;
    case "EvidenceRequested":
      return "Evidence requested from Normalizer";
    case "EvidenceReturned":
      return "Normalizer returned evidence";
    case "InvestigationOpened":
      return "Investigation opened";
    case "FixTargetIssued":
      return "Fix target";
    case "TheoryWithdrawn":
      return "Theory withdrawn (hero)";
    case "RoomChallenge":
      return "Cross-room challenge";
    case "VerdictIssued":
      return "Verdict issued";
    case "ExplanationIssued":
      return "Explanation issued";
    case "ConfidenceChanged":
      return "Confidence changed";
    default:
      return type.replace(/_/g, " ");
  }
}

function FeedLine({
  room,
  message,
}: {
  room: "cause" | "localization";
  message: AgentFeedMessage;
}) {
  const [open, setOpen] = useState(false);
  const summary = summarizeMessage(message);
  const tone =
    room === "cause"
      ? "border-trace/30 text-trace"
      : "border-command/30 text-command";

  return (
    <div className={`rounded border ${tone} bg-room-bg/50`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs"
      >
        <span className="truncate">{summary}</span>
        <span className="shrink-0 text-[10px] text-room-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && message.content ? (
        <pre className="max-h-40 overflow-auto border-t border-room-border px-2 py-1.5 text-[10px] leading-relaxed text-room-muted">
          {message.content}
        </pre>
      ) : null}
    </div>
  );
}

export function BandActivityStrip({
  causeMessages,
  localizationMessages,
  causeRoomId,
  localizationRoomId,
  loading,
}: {
  causeMessages: AgentFeedMessage[];
  localizationMessages: AgentFeedMessage[];
  causeRoomId?: string;
  localizationRoomId?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-room-border bg-room-panel">
      <div className="border-b border-room-border px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-room-muted">
          Band · audit trail
        </p>
        <p className="mt-0.5 text-xs text-room-muted">
          Proof agents collaborated — expand for detail.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3" style={{ maxHeight: "72vh" }}>
        {loading ? (
          <p className="text-xs text-signal animate-pulse">Investigating…</p>
        ) : null}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase text-trace">
            Verdict Room
          </p>
          <div className="space-y-1">
            {causeMessages.length === 0 ? (
              <p className="text-xs text-room-muted">No posts yet.</p>
            ) : (
              causeMessages.map((m, i) => (
                <FeedLine key={`c-${m.messageId ?? i}`} room="cause" message={m} />
              ))
            )}
          </div>
          {causeRoomId ? (
            <a
              href={`https://app.band.ai/agent/chats/${causeRoomId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[10px] text-trace underline"
            >
              Open in Band ↗
            </a>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase text-command">
            Explanation Room
          </p>
          <div className="space-y-1">
            {localizationMessages.length === 0 ? (
              <p className="text-xs text-room-muted">Waiting on specialists…</p>
            ) : (
              localizationMessages.map((m, i) => (
                <FeedLine
                  key={`l-${m.messageId ?? i}`}
                  room="localization"
                  message={m}
                />
              ))
            )}
          </div>
          {localizationRoomId ? (
            <a
              href={`https://app.band.ai/agent/chats/${localizationRoomId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[10px] text-command underline"
            >
              Open in Band ↗
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
