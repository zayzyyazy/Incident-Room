"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  InvestigationStep,
  stepsFromInvestigationRun,
} from "@/lib/demo/investigation-steps";
import {
  buildIncidentReportView,
  buildTheoryConflictView,
  bandRoomUrl,
  isTheoryInvestigationDemo,
} from "@/lib/demo/investigation-verdict-view";
import { getAgentDefinition } from "@/lib/agents/registry";
import { InvestigationRun } from "@/lib/incidents/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { IncidentReportHero } from "@/components/demo/IncidentReportHero";
import { TheoryConflictPanel } from "@/components/demo/TheoryConflictPanel";
import { WorkflowViewer } from "@/components/demo/WorkflowViewer";
import {
  KlausDemoGraph,
  stageIdFromPointer,
} from "@/lib/workflow/klaus-demo-graph";

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
]);

const THEORY_KINDS = new Set([
  "TheoryOpening",
  "TheoryChallenge",
  "TheoryWithdrawal",
  "TheoryCounter",
  "TheorySynthesis",
  "IncidentFinding",
]);

const HIGHLIGHT_THEORY_KINDS = new Set([
  "TheoryChallenge",
  "TheoryWithdrawal",
  "TheoryCounter",
  "NormalizerRouting",
  "NormalizerEvidenceRequest",
]);

const ROOM_DISPLAY: Record<string, string> = {
  cause: "Cause Room",
  localization: "Architecture Room",
  customer_reality: "Customer Reality Room",
  system_reality: "System Reality Room",
  theory_investigation: "Theory investigation",
};

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

function LiveSpotlight({ step }: { step: InvestigationStep }) {
  const agent = getAgentDefinition(step.agentId);
  const isConflict =
    step.line.includes("@") ||
    HIGHLIGHT_THEORY_KINDS.has(step.kind) ||
    step.kind === "agent_challenge";

  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-500 animate-fade-up ${
        isConflict
          ? "border-alert/50 bg-alert/10 ring-1 ring-alert/25"
          : step.kind === "TheoryWithdrawal"
            ? "border-signal/50 bg-signal/10 ring-1 ring-signal/25"
            : step.room === "theory_investigation"
              ? "border-trace/40 bg-trace/[0.06]"
              : step.room === "cause"
                ? "border-trace/40 bg-trace/[0.06]"
                : "border-command/40 bg-command/[0.06]"
      }`}
    >
      <div className="flex items-start gap-4">
        <AgentNode agentId={step.agentId} active size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${agent?.accentClass ?? ""}`}
            >
              {step.headline}
            </span>
            <span className="text-[10px] text-room-muted">
              {step.agentLabel} · {ROOM_DISPLAY[step.room] ?? step.room}
            </span>
            {step.crossRoom ? (
              <span className="text-[10px] font-semibold uppercase text-alert">
                ⇄ cross-room
              </span>
            ) : null}
          </div>
          <p
            className={`mt-3 text-lg font-semibold leading-snug ${
              step.line.includes("@") ? "font-mono text-[15px] text-foreground" : "text-foreground"
            }`}
          >
            {step.line}
          </p>
          {step.subline ? (
            <p className="mt-2 text-sm text-room-muted">{step.subline}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FlowBeat({
  step,
  active,
}: {
  step: InvestigationStep;
  active: boolean;
}) {
  const agent = getAgentDefinition(step.agentId);
  const isConflict =
    step.line.includes("@") ||
    HIGHLIGHT_THEORY_KINDS.has(step.kind) ||
    step.crossRoom;

  return (
    <div
      className={`flex gap-2.5 rounded-lg border px-3 py-2 transition-all ${
        active
          ? "border-signal/50 bg-signal/5 ring-1 ring-signal/20"
          : isConflict
            ? "border-alert/30 bg-alert/[0.04]"
            : step.kind === "TheoryWithdrawal"
              ? "border-signal/30 bg-signal/[0.04]"
              : "border-room-border/60 bg-room-elevated/40"
      }`}
    >
      <AgentNode agentId={step.agentId} active={active} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] font-semibold ${agent?.accentClass ?? ""}`}>
            {step.headline}
          </span>
          <span className="text-[9px] uppercase text-room-muted">
            {step.agentShort}
          </span>
        </div>
        <p
          className={`mt-0.5 text-xs leading-relaxed ${
            step.line.includes("@") ? "font-mono text-alert" : "text-foreground"
          }`}
        >
          {step.line}
        </p>
        {step.subline ? (
          <p className="mt-0.5 text-[10px] text-room-muted">{step.subline}</p>
        ) : null}
      </div>
    </div>
  );
}

export function LiveInvestigationTheater({
  incidentId,
  evidence,
  workflow,
  initialRun,
  onComplete,
  onStatusChange,
}: {
  incidentId: string;
  evidence: VoiceIncidentEvidence;
  workflow?: KlausDemoGraph | null;
  initialRun?: InvestigationRun | null;
  onComplete?: (run: InvestigationRun) => void;
  onStatusChange?: (
    status: "idle" | "connecting" | "live" | "complete" | "error",
  ) => void;
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
  const [showArgument, setShowArgument] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const liveFeedRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);
  const intentionalCloseRef = useRef(false);

  statusRef.current = status;

  const live = status === "connecting" || status === "live";
  const complete = status === "complete";

  const theoryDemo = isTheoryInvestigationDemo(evidence);

  const report = useMemo(
    () => buildIncidentReportView(evidence, run),
    [evidence, run],
  );

  const conflict = useMemo(
    () => buildTheoryConflictView(run, steps),
    [run, steps],
  );

  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

  const highlightStageId =
    run?.localizationRoom?.localizationFinding?.primary_surface.pointer
      .native_pointer &&
    stageIdFromPointer(
      run.localizationRoom.localizationFinding.primary_surface.pointer
        .native_pointer,
    );

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
  const recentLiveSteps = liveFeedSteps.slice(-6);

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
    setShowArgument(false);
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
          if (HIGHLIGHT_THEORY_KINDS.has(data.step.kind)) {
            setShowArgument(true);
          }
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

  const bandUrl = bandRoomUrl(
    run?.realityCollision?.investigationRoomId ?? run?.roomId,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-room-border bg-room-panel px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-room-muted">
            {complete
              ? "Investigation complete"
              : live
                ? "Live · competing theories"
                : "Ready to investigate"}
          </p>
          <p className="mt-0.5 text-xs text-room-muted">
            {complete
              ? theoryDemo
                ? "Incident report — theories tested until one survived."
                : "Review agent findings and evidence trail."
              : live
                ? theoryDemo
                  ? "Watch theories collide — challenges, counters, and withdrawals."
                  : "Watch agents challenge, withdraw, and revise in real time."
                : theoryDemo
                  ? "Two opening theories · one must lose."
                  : "Prove belief vs reality, then show where to fix."}
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={live}
          className="rounded-lg border border-signal/50 bg-signal/15 px-4 py-2 text-sm font-semibold text-signal transition hover:bg-signal/25 disabled:opacity-50"
        >
          {live ? "Investigating…" : complete ? "Run again" : "Run investigation"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </div>
      ) : null}

      {complete && run && report.finding !== "Investigation incomplete" ? (
        <>
          <IncidentReportHero report={report} bandRoomUrl={bandUrl} />

          {conflict.show ? (
            <TheoryConflictPanel
              conflict={conflict}
              collapsed={!showArgument}
              onToggle={() => setShowArgument((v) => !v)}
            />
          ) : null}
        </>
      ) : null}

      {live && currentStep ? (
        <LiveSpotlight step={currentStep} />
      ) : live ? (
        <div className="rounded-xl border border-room-border bg-room-panel px-4 py-8 text-center text-sm text-room-muted animate-pulse">
          Connecting to Band…
        </div>
      ) : null}

      {live && liveFeedSteps.length > 0 ? (
        <div className="rounded-xl border border-room-border bg-room-panel">
          <div className="border-b border-room-border px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-room-muted">
              {theoryDemo ? "Theory conflict" : "Live from Band"} · {liveFeedSteps.length}{" "}
              {theoryDemo ? "beats" : `of ${steps.length} beats`}
            </p>
          </div>
          <div
            ref={liveFeedRef}
            className="max-h-[220px] space-y-2 overflow-y-auto p-3"
          >
            {recentLiveSteps.map((step) => (
              <FlowBeat
                key={step.id}
                step={step}
                active={step.id === currentStep?.id}
              />
            ))}
          </div>
        </div>
      ) : null}

      {complete && run && workflow && highlightStageId ? (
        <div className="rounded-xl border border-signal/30 bg-room-panel p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-signal">
            Fix target in workflow
          </p>
          <div className="mt-3">
            <WorkflowViewer
              graph={workflow}
              highlightStageId={highlightStageId}
              showHighlight
              compact
            />
          </div>
        </div>
      ) : null}

      {steps.length > 0 && (!complete || showEvidence) ? (
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
            <div className="max-h-[320px] space-y-2 overflow-y-auto border-t border-room-border p-3">
              {steps.map((step) => (
                <FlowBeat
                  key={step.id}
                  step={step}
                  active={step.id === currentStep?.id}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {complete && !showEvidence ? (
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
