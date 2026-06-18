"use client";

import { useEffect, useRef, useState } from "react";
import {
  InvestigationStep,
  stepsFromInvestigationRun,
} from "@/lib/demo/investigation-steps";
import { bandRoomUrl, isTheoryInvestigationDemo } from "@/lib/demo/investigation-verdict-view";
import { isLocalBandRoom } from "@/lib/band/client";
import { InvestigationRun } from "@/lib/incidents/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { InvestigationGameLevel } from "@/components/demo/InvestigationGameLevel";
import type { KlausDemoGraph } from "@/lib/workflow/klaus-demo-graph";
import { dialogueSummary } from "@/lib/demo/game-level";
import { getAgentDefinition } from "@/lib/agents/registry";

const COLLABORATION_KINDS = new Set([
  "agent_challenge",
  "CauseDefenseRequest",
  "CauseDefenseDecision",
  "CauseRevisionRequest",
  "CauseRevisionDecision",
  "defense_backend_witness",
  "defense_claim_tracer",
  "revision_claim_tracer",
  "revision_backend_witness",
  "investigator_admission",
  "surface_attack",
  "surface_counterattack",
  "SpecialistRecruited",
  "EvidenceRequested",
  "EvidenceReturned",
  "RoomChallenge",
  "ConfidenceChanged",
  "TheoryChallenged",
  "TheoryWithdrawn",
  "TheoryProposed",
  "TheorySupported",
  "TheoryRefined",
  "TheoryAccepted",
]);

const THEORY_KINDS = new Set([
  "TheoryOpening",
  "TheoryChallenge",
  "TheoryWithdrawal",
  "TheoryCounter",
  "TheorySynthesis",
  "IncidentFinding",
]);

function stepConfidence(step: InvestigationStep) {
  const pctByKind: Record<string, number> = {
    TheoryChallenge: 72,
    TheoryChallenged: 72,
    TheoryProposed: 74,
    TheorySupported: 81,
    TheoryRefined: 78,
    TheoryAccepted: 86,
    agent_challenge: 72,
    TheoryOpening: 68,
    TheoryCounter: 58,
    TheoryWithdrawal: 45,
    TheoryWithdrawn: 45,
    ConfidenceChanged: 22,
    RoomChallenge: 40,
    TheorySynthesis: 81,
    IncidentFinding: 88,
  };
  const pct = pctByKind[step.kind] ?? 64;
  const label = pct >= 70 ? "High" : pct >= 60 ? "Medium" : "Low";
  return { pct, label };
}

function stepActionLabel(kind: string) {
  const map: Record<string, string> = {
    TheoryChallenge: "Challenges",
    agent_challenge: "Challenges",
    TheoryOpening: "Introduces theory",
    TheoryCounter: "Counters",
    TheoryWithdrawal: "Withdraws",
    TheorySynthesis: "Synthesizes",
    IncidentFinding: "Finds",
    claim_tracer_initial: "Opens",
    backend_witness_initial: "Opens",
  };
  return map[kind] ?? "Updates";
}

function relativeBeatTime(index: number, total: number) {
  const ago = total - index - 1;
  if (ago <= 0) return "Just now";
  return `${ago} min ago`;
}

function AgentNode({
  agentId,
  active,
  size = "sm",
}: {
  agentId: string;
  active?: boolean;
  size?: "sm" | "lg";
}) {
  const agent = getAgentDefinition(agentId);
  const sizeClass = size === "lg" ? "h-12 w-12 text-[11px]" : "h-7 w-7 text-[9px]";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border font-mono font-bold uppercase transition-all ${sizeClass} ${
        active
          ? `${agent?.borderClass ?? "border-trace/50"} ${agent?.accentClass ?? "text-trace"} bg-room-elevated ring-2 ring-current/40 scale-105`
          : "border-room-border bg-room-panel text-room-muted"
      }`}
    >
      {agent?.shortLabel ?? agentId.slice(0, 3)}
    </div>
  );
}

function FlowBeat({
  step,
  active,
  index,
  total,
}: {
  step: InvestigationStep;
  active: boolean;
  index: number;
  total: number;
}) {
  const agent = getAgentDefinition(step.agentId);
  const { pct, label } = stepConfidence(step);
  const action = stepActionLabel(step.kind);
  const isChallenge = step.kind === "TheoryChallenge" || step.kind === "agent_challenge";

  return (
    <div
      className={`flex gap-3 border-b border-room-border/50 px-1 py-3 last:border-0 ${
        active ? "bg-room-elevated/30" : ""
      }`}
    >
      <AgentNode agentId={step.agentId} active={active} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-room-muted">
            {relativeBeatTime(index, total)}
          </span>
          <span className={`text-xs font-semibold ${agent?.accentClass ?? ""}`}>
            {step.agentShort} {step.agentLabel.split(" ")[0]}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              isChallenge
                ? "bg-alert/15 text-alert"
                : step.kind === "TheoryWithdrawal"
                  ? "bg-signal/15 text-signal"
                  : "bg-trace/10 text-trace"
            }`}
          >
            {action}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-foreground">
          {dialogueSummary(step, 100)}
        </p>
        {step.subline ? (
          <p className="mt-1 text-xs text-room-muted">{step.subline}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-foreground">{pct}%</p>
        <p className="text-[10px] text-room-muted">{label}</p>
      </div>
    </div>
  );
}

export function LiveInvestigationTheater({
  incidentId,
  evidence,
  initialRun,
  onComplete,
  onStatusChange,
  onGoToReports,
}: {
  incidentId: string;
  evidence: VoiceIncidentEvidence;
  workflow?: KlausDemoGraph | null;
  initialRun?: InvestigationRun | null;
  onComplete?: (run: InvestigationRun) => void;
  onStatusChange?: (
    status: "idle" | "connecting" | "live" | "complete" | "error",
  ) => void;
  onGoToReports?: () => void;
}) {
  const hydrated = initialRun ? stepsFromInvestigationRun(initialRun) : [];
  const [status, setStatus] = useState<
    "idle" | "connecting" | "live" | "complete" | "error"
  >(initialRun?.status === "complete" ? "complete" : "idle");
  const [steps, setSteps] = useState<InvestigationStep[]>(hydrated);
  const [currentIndex, setCurrentIndex] = useState(
    hydrated.length > 0 ? hydrated.length - 1 : -1,
  );
  const [error, setError] = useState<string | null>(
    initialRun?.status === "failed" ? (initialRun.error ?? null) : null,
  );
  const [run, setRun] = useState<InvestigationRun | null>(initialRun ?? null);
  const [showEvidence, setShowEvidence] = useState(false);

  const bandRoomId = run?.earnedInvestigation?.verdictRoomId ?? run?.roomId;
  const bandIsLocal = Boolean(bandRoomId && isLocalBandRoom(bandRoomId));
  const bandUrl = bandRoomUrl(bandRoomId);
  const hasRemoteBandPosts =
    run?.bandMessageIds &&
    Object.values(run.bandMessageIds).some((id) => !String(id).startsWith("local"));

  const eventSourceRef = useRef<EventSource | null>(null);
  const liveFeedRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);
  const intentionalCloseRef = useRef(false);

  statusRef.current = status;

  const live = status === "connecting" || status === "live";
  const complete = status === "complete";

  const theoryDemo = isTheoryInvestigationDemo(evidence);

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  const theorySteps = steps.filter((s) => THEORY_KINDS.has(s.kind));

  const collaborationSteps = steps.filter(
    (s) =>
      s.line.includes("@") ||
      COLLABORATION_KINDS.has(s.kind) ||
      THEORY_KINDS.has(s.kind) ||
      s.crossRoom ||
      s.hero,
  );

  const liveFeedSteps = theoryDemo
    ? theorySteps.length > 0
      ? theorySteps
      : steps.filter((s) => s.kind === "NormalizerRouting" || COLLABORATION_KINDS.has(s.kind))
    : collaborationSteps.length > 0
      ? collaborationSteps
      : steps;
  const setStatusBoth = (
    next: "idle" | "connecting" | "live" | "complete" | "error",
  ) => {
    statusRef.current = next;
    setStatus(next);
    onStatusChange?.(next);
  };

  function start() {
    eventSourceRef.current?.close();
    intentionalCloseRef.current = false;
    setSteps([]);
    setCurrentIndex(-1);
    setError(null);
    setRun(null);
    setShowEvidence(false);
    setStatusBoth("connecting");

    const es = new EventSource(
      `/api/incidents/${incidentId}/investigate/stream`,
    );
    eventSourceRef.current = es;

    es.onopen = () => setStatusBoth("live");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          step?: InvestigationStep;
          run?: InvestigationRun;
          error?: string;
        };

        if (data.type === "step" && data.step) {
          setSteps((prev) => {
            const next = [...prev, data.step!];
            setCurrentIndex(next.length - 1);
            return next;
          });
        }

        if (data.type === "complete" && data.run) {
          setRun(data.run);
          setStatusBoth("complete");
          setCurrentIndex((i) => (i < 0 ? 0 : i));
          intentionalCloseRef.current = true;
          onComplete?.(data.run);
          es.close();
        }

        if (data.type === "error") {
          setError(data.error ?? "Investigation failed");
          setStatusBoth("error");
          if (data.run) setRun(data.run);
          intentionalCloseRef.current = true;
          es.close();
        }
      } catch {
        setError("Invalid stream payload");
        setStatusBoth("error");
        intentionalCloseRef.current = true;
        es.close();
      }
    };

    es.onerror = () => {
      if (intentionalCloseRef.current) return;
      if (statusRef.current === "complete" || statusRef.current === "error") {
        return;
      }
      setError("Stream disconnected before investigation finished");
      setStatusBoth("error");
      es.close();
    };
  }

  useEffect(() => {
    if (liveFeedRef.current) {
      liveFeedRef.current.scrollTop = liveFeedRef.current.scrollHeight;
    }
  }, [currentIndex, steps.length]);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <div className="space-y-5">
      {bandIsLocal && (complete || live) ? (
        <div className="rounded-xl border border-signal/40 bg-signal/[0.08] px-4 py-3 text-sm text-room-muted">
          <p className="font-medium text-signal">Band room limit reached (100/100)</p>
          <p className="mt-1 text-xs leading-relaxed">
            Posts ran in local-only mode — nothing appears on app.band.ai. Add{" "}
            <code className="text-trace">BAND_REUSE_ROOM_ID</code> to{" "}
            <code className="text-trace">.env.local</code> (UUID of an existing Band
            chat), restart dev server, then Run again.
          </p>
        </div>
      ) : null}

      {!bandIsLocal && bandUrl && (live || (complete && hasRemoteBandPosts)) ? (
        <a
          href={bandUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-lg border border-trace/40 bg-trace/[0.06] px-3 py-2 text-xs font-medium text-trace hover:bg-trace/10"
        >
          Open Band room ↗
        </a>
      ) : null}
      {!live && !complete ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-room-border bg-room-panel px-5 py-4">
          <p className="text-sm text-room-muted">Recruit specialists · contest theories · earn a call outcome.</p>
          <button
            type="button"
            onClick={start}
            className="rounded-lg border border-signal/50 bg-signal/15 px-5 py-2.5 text-sm font-semibold text-signal transition hover:bg-signal/25"
          >
            Run investigation
          </button>
        </div>
      ) : null}

      {(live || complete) && (steps.length > 0 || live) ? (
        <InvestigationGameLevel
          steps={steps}
          activeIndex={currentIndex}
          live={live}
          complete={complete}
          immersive={live && !complete}
          bandUrl={bandIsLocal ? undefined : bandUrl}
        />
      ) : null}

      {complete && !live ? (
        <div className="rounded-xl border border-trace/40 bg-trace/[0.08] px-4 py-3 text-sm text-room-muted">
          <p className="font-semibold text-trace">Done — open Reports for the audit memo.</p>
          {onGoToReports ? (
            <button
              type="button"
              onClick={onGoToReports}
              className="mt-2 rounded-lg border border-trace/50 bg-trace/15 px-3 py-1.5 text-xs font-semibold text-trace hover:bg-trace/25"
            >
              Reports →
            </button>
          ) : null}
        </div>
      ) : null}

      {complete && !live ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={start}
            className="rounded-lg border border-room-border bg-room-elevated px-4 py-2 text-xs text-room-muted hover:text-foreground"
          >
            Run again
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </div>
      ) : null}

      {(live || complete) && liveFeedSteps.length > 0 && !live ? (
        <details className="group rounded-xl border border-room-border/60 bg-room-panel/50">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-room-muted marker:content-none hover:text-foreground">
            <span className="flex items-center justify-between">
              <span>Band transcript · {liveFeedSteps.length} beats</span>
              <span className="text-trace group-open:rotate-180 transition-transform">▾</span>
            </span>
          </summary>
          <div ref={liveFeedRef} className="max-h-[320px] overflow-y-auto border-t border-room-border px-4">
            {[...liveFeedSteps].reverse().map((step, i) => {
              const index = liveFeedSteps.length - 1 - i;
              return (
                <FlowBeat
                  key={step.id}
                  step={step}
                  active={step.id === currentStep?.id}
                  index={index}
                  total={liveFeedSteps.length}
                />
              );
            })}
          </div>
        </details>
      ) : null}

      {steps.length > 0 && !live && (showEvidence || complete) ? (
        <div className="rounded-xl border border-room-border bg-room-panel">
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-room-muted">
                Evidence trail
              </p>
              <p className="mt-0.5 text-xs text-room-muted">
                {collaborationSteps.length} collaboration beats · {steps.length} total
                {showEvidence ? " · expanded" : " · collapsed"}
              </p>
            </div>
            <span className="text-sm text-trace">{showEvidence ? "▾" : "▸"}</span>
          </button>

          {showEvidence ? (
            <div className="max-h-[320px] overflow-y-auto border-t border-room-border px-4">
              {steps.map((step, index) => (
                <FlowBeat
                  key={step.id}
                  step={step}
                  active={step.id === currentStep?.id}
                  index={index}
                  total={steps.length}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {steps.length > 0 && !live && !showEvidence ? (
        <button
          type="button"
          onClick={() => setShowEvidence(true)}
          className="w-full rounded-lg border border-room-border bg-room-elevated/40 px-4 py-2 text-left text-xs text-room-muted transition hover:bg-room-elevated/70"
        >
          Show evidence trail · {steps.length} Band messages
        </button>
      ) : null}
    </div>
  );
}
