"use client";

import { useEffect, useMemo, useState } from "react";
import { InvestigationStep } from "@/lib/demo/investigation-steps";
import {
  bubbleAccentClass,
  bubbleDisplayLine,
  bubbleKindForStep,
  bubbleTailDirection,
  derivePresentAgents,
  BubbleKind,
  resolveAgentSlot,
  StageSlot,
} from "@/lib/demo/bubble-theater";

function StickNormalizer({ active, carrying }: { active?: boolean; carrying?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 72"
      className={`h-[4.5rem] w-12 transition-all duration-500 ${
        active ? "scale-110 text-trace" : "text-room-muted"
      }`}
      aria-hidden
    >
      <circle cx="24" cy="10" r="7" fill="currentColor" opacity={active ? 1 : 0.7} />
      <line x1="24" y1="17" x2="24" y2="44" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="24" y1="26" x2="10" y2="36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="26" x2="36" y2="32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="44" x2="14" y2="62" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="44" x2="34" y2="62" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {carrying ? (
        <g className="animate-bubble-carry">
          <rect x="30" y="20" width="14" height="18" rx="2" fill="currentColor" opacity="0.35" />
          <line x1="33" y1="26" x2="41" y2="26" stroke="var(--room-bg)" strokeWidth="1.5" />
          <line x1="33" y1="30" x2="41" y2="30" stroke="var(--room-bg)" strokeWidth="1.5" />
        </g>
      ) : null}
    </svg>
  );
}

function AgentFigure({
  slot,
  speaking,
  entering,
}: {
  slot: StageSlot;
  speaking?: boolean;
  entering?: boolean;
}) {
  const isNormalizer = slot.id === "evidence_normalizer";

  return (
    <div
      className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-all duration-700 ${
        entering ? "animate-agent-enter" : ""
      }`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      {speaking ? (
        <span className="absolute -inset-3 rounded-full border border-current/30 animate-speak-ring" />
      ) : null}
      {isNormalizer ? (
        <StickNormalizer active={speaking} carrying={speaking} />
      ) : (
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 font-mono text-[10px] font-bold uppercase transition-all duration-300 ${slot.border} ${slot.accent} ${
            speaking
              ? `bg-room-elevated ${slot.glow} scale-110 ring-2 ring-current/30`
              : "bg-room-panel/90 text-room-muted scale-100"
          }`}
        >
          {slot.shortLabel}
        </div>
      )}
      <span
        className={`max-w-[5.5rem] text-center text-[9px] font-semibold uppercase tracking-wide ${
          speaking ? slot.accent : "text-room-muted"
        }`}
      >
        {slot.label}
      </span>
    </div>
  );
}

function BubbleTail({
  direction,
  kind,
}: {
  direction: "left" | "right" | "down" | "up";
  kind: BubbleKind;
}) {
  const color =
    kind === "thought"
      ? "border-alert/50"
      : kind === "evidence"
        ? "border-trace/60"
        : kind === "verdict"
          ? "border-command/60"
          : "border-foreground/20";

  const pos =
    direction === "up"
      ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(100%-2px)] border-b-0 border-r-0"
      : direction === "down"
        ? "top-0 left-1/2 -translate-x-1/2 -translate-y-[calc(100%-2px)] border-t-0 border-l-0"
        : direction === "left"
          ? "right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%-2px)] border-r-0 border-t-0"
          : "left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%-2px)] border-l-0 border-b-0";

  return (
    <span
      className={`pointer-events-none absolute h-3 w-3 rotate-45 border bg-inherit ${color} ${pos}`}
      aria-hidden
    />
  );
}

function InvestigationBubble({
  step,
  slot,
  prominent,
}: {
  step: InvestigationStep;
  slot: StageSlot;
  prominent?: boolean;
}) {
  const kind = bubbleKindForStep(step.kind);
  const tail = bubbleTailDirection(slot);
  const line = bubbleDisplayLine(step);

  const kindLabel =
    kind === "thought"
      ? "Thinking"
      : kind === "evidence"
        ? "Evidence"
        : kind === "verdict"
          ? "Verdict"
          : kind === "system"
            ? "System"
            : "Says";

  const offsetY = slot.y < 35 ? 18 : slot.y > 65 ? -22 : -8;
  const offsetX = slot.x < 25 ? 8 : slot.x > 75 ? -8 : 0;

  return (
    <div
      className={`absolute z-30 max-w-[min(340px,42vw)] -translate-x-1/2 ${
        prominent ? "animate-bubble-pop" : "animate-bubble-ghost"
      }`}
      style={{
        left: `calc(${slot.x}% + ${offsetX}px)`,
        top: `calc(${slot.y}% + ${offsetY}px)`,
      }}
    >
      <div
        className={`relative rounded-2xl border px-4 py-3 backdrop-blur-md ${bubbleAccentClass(kind)} ${
          kind === "thought" ? "rounded-[1.4rem]" : ""
        } ${prominent ? "shadow-lg" : "opacity-70"}`}
      >
        <BubbleTail direction={tail} kind={kind} />
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`text-[9px] font-bold uppercase tracking-[0.18em] ${slot.accent}`}
          >
            {step.agentLabel}
          </span>
          <span className="rounded bg-room-bg/60 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-room-muted">
            {kindLabel}
          </span>
          <span className="text-[8px] text-room-muted">{step.headline}</span>
        </div>
        <p
          className={`leading-snug text-foreground ${
            prominent ? "text-sm md:text-[15px]" : "text-xs"
          }`}
        >
          {line}
        </p>
        {step.subline && prominent ? (
          <p
            className={`mt-2 text-xs ${
              step.kind === "ConfidenceChanged"
                ? "font-mono font-semibold text-alert"
                : "text-room-muted"
            }`}
          >
            {step.subline}
          </p>
        ) : null}
        {kind === "evidence" && prominent ? (
          <div className="mt-2 h-0.5 overflow-hidden rounded bg-room-border">
            <div className="h-full w-1/3 animate-scan-sweep bg-trace" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BeatFilmstrip({
  steps,
  activeIndex,
}: {
  steps: InvestigationStep[];
  activeIndex: number;
}) {
  const window = steps.slice(Math.max(0, activeIndex - 7), activeIndex + 1);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 pt-2">
      {window.map((step, i) => {
        const globalIdx = Math.max(0, activeIndex - 7) + i;
        const active = globalIdx === activeIndex;
        return (
          <div
            key={step.id}
            className={`shrink-0 rounded-lg border px-2.5 py-1.5 transition-all ${
              active
                ? "border-trace/50 bg-trace/10 scale-105"
                : "border-room-border/60 bg-room-bg/40 opacity-60"
            }`}
          >
            <p className="text-[8px] font-semibold uppercase tracking-wider text-room-muted">
              {step.headline}
            </p>
            <p className="mt-0.5 max-w-[8rem] truncate text-[10px] text-foreground">
              {bubbleDisplayLine(step).slice(0, 48)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function InvestigationBubbleTheater({
  steps,
  activeIndex,
  live,
  complete,
}: {
  steps: InvestigationStep[];
  activeIndex: number;
  live: boolean;
  complete: boolean;
}) {
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;
  const [enteredAgents, setEnteredAgents] = useState<Set<string>>(new Set(["incident_room"]));

  const presentAgents = useMemo(
    () => derivePresentAgents(steps, Math.max(0, activeIndex)),
    [steps, activeIndex],
  );

  const trailSteps = useMemo(() => {
    if (activeIndex < 1) return [];
    return steps.slice(Math.max(0, activeIndex - 3), activeIndex);
  }, [steps, activeIndex]);

  useEffect(() => {
    if (!activeStep) return;
    const slot = resolveAgentSlot(activeStep);
    setEnteredAgents((prev) => {
      if (prev.has(slot.id)) return prev;
      const next = new Set(prev);
      next.add(slot.id);
      return next;
    });
  }, [activeStep]);

  return (
    <div className="overflow-hidden rounded-2xl border border-room-border bg-[#0a0d14] shadow-[inset_0_0_80px_rgba(78,205,196,0.04)]">
      <div className="flex items-center justify-between border-b border-room-border/80 px-4 py-3 md:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-trace">
            Investigation theater
          </p>
          <p className="mt-0.5 text-xs text-room-muted">
            {live
              ? "Live Band beats · speech & thought bubbles"
              : complete
                ? `${steps.length} beats replayed`
                : "Waiting to start"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1.5 rounded-full border border-alert/40 bg-alert/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-alert">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-alert" />
              Live
            </span>
          ) : null}
          <span className="font-mono text-xs text-room-muted">
            {activeIndex + 1}/{steps.length || "—"}
          </span>
        </div>
      </div>

      <div className="relative min-h-[420px] md:min-h-[480px]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 50% at 50% 55%, rgba(78,205,196,0.08), transparent 70%)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-[12%] top-[28%] h-[38%] rounded-[50%] border border-room-border/30 bg-room-panel/[0.03]" />

        {presentAgents.map((slot) => (
          <AgentFigure
            key={slot.id}
            slot={slot}
            speaking={activeStep ? resolveAgentSlot(activeStep).id === slot.id : false}
            entering={enteredAgents.has(slot.id) && slot.id !== "incident_room"}
          />
        ))}

        {trailSteps.map((step) => (
          <InvestigationBubble
            key={`ghost-${step.id}`}
            step={step}
            slot={resolveAgentSlot(step)}
          />
        ))}

        {activeStep ? (
          <InvestigationBubble step={activeStep} slot={resolveAgentSlot(activeStep)} prominent />
        ) : live ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="animate-pulse text-sm text-room-muted">Connecting specialists…</p>
          </div>
        ) : null}

        {activeStep?.kind === "VerdictIssued" ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 animate-verdict-flash rounded-xl border border-command/40 bg-command/10 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-command">
            Final verdict on record
          </div>
        ) : null}
      </div>

      <div className="border-t border-room-border/80 bg-room-panel/40 px-4 py-2 md:px-5">
        <BeatFilmstrip steps={steps} activeIndex={activeIndex} />
      </div>
    </div>
  );
}
