"use client";

import { useEffect, useState } from "react";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";
import { InvestigationRun } from "@/lib/incidents/types";
import { Panel } from "@/components/ui/shell";

export type DemoStep =
  | "incident"
  | "cause"
  | "mechanism"
  | "pointer"
  | "highlight";

const STEPS: { id: DemoStep; label: string }[] = [
  { id: "incident", label: "Runtime incident" },
  { id: "cause", label: "Cause finding" },
  { id: "mechanism", label: "Implementation mechanism" },
  { id: "pointer", label: "Evidence pointer" },
  { id: "highlight", label: "Workflow highlight" },
];

export function InvestigationReveal({
  run,
  incidentTitle,
  customerBelief,
  autoPlay,
  onStepChange,
}: {
  run?: InvestigationRun | null;
  incidentTitle: string;
  customerBelief?: string;
  autoPlay?: boolean;
  onStepChange?: (step: DemoStep) => void;
}) {
  const [step, setStep] = useState<DemoStep>("incident");
  const complete = run?.status === "complete";
  const cause = run?.causeRoom?.causeFinding;
  const loc = run?.localizationRoom?.localizationFinding;

  useEffect(() => {
    if (!autoPlay || !complete) return;
    const order: DemoStep[] = STEPS.map((s) => s.id);
    let i = 0;
    setStep(order[0]);
    const timer = setInterval(() => {
      i += 1;
      if (i >= order.length) {
        clearInterval(timer);
        return;
      }
      setStep(order[i]);
    }, 1200);
    return () => clearInterval(timer);
  }, [autoPlay, complete]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  function stepIndex(s: DemoStep) {
    return STEPS.findIndex((x) => x.id === s);
  }

  function goNext() {
    const idx = stepIndex(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].id);
    }
  }

  const currentIdx = stepIndex(step);

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-room-border px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-room-muted">
          Investigation → Mechanism → Pointer → Highlight
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STEPS.map((s, i) => {
            const unlocked =
              complete &&
              (s.id === "incident" ||
                (s.id === "cause" && cause) ||
                (s.id === "mechanism" && loc) ||
                (s.id === "pointer" && loc) ||
                (s.id === "highlight" && loc));
            const active = s.id === step;
            const done = i < currentIdx;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && setStep(s.id)}
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
                  active
                    ? "border-command bg-command/15 text-command"
                    : done
                      ? "border-trace/40 text-trace"
                      : unlocked
                        ? "border-room-border text-room-muted hover:border-trace/40"
                        : "border-room-border/50 text-room-muted/40"
                }`}
              >
                {i + 1}. {s.label}
              </button>
            );
          })}
          {complete && currentIdx < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="ml-auto text-[10px] uppercase tracking-wider text-trace hover:underline"
            >
              Next →
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-[140px] p-4">
        {step === "incident" && (
          <div>
            <p className="text-lg font-semibold">{incidentTitle}</p>
            {customerBelief ? (
              <p className="mt-2 text-sm text-signal">
                Customer belief: {customerBelief}
              </p>
            ) : null}
            {!complete ? (
              <p className="mt-3 text-sm text-room-muted">
                Run full investigation to unlock the chain.
              </p>
            ) : null}
          </div>
        )}

        {step === "cause" && cause && (
          <div>
            <p className="text-xs font-mono uppercase text-trace">
              {hypothesisClassLabel(cause.cause_class)}
            </p>
            <p className="mt-2 text-sm leading-relaxed">{cause.cause}</p>
          </div>
        )}

        {step === "mechanism" && loc && (
          <div>
            <p className="text-xs font-mono uppercase text-command">
              {loc.implementation_mechanism.canonical_id}
            </p>
            <p className="mt-2 text-base font-medium leading-relaxed">
              {loc.mechanism_explanation}
            </p>
          </div>
        )}

        {step === "pointer" && loc && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-room-muted">
              Evidence pointer
            </p>
            <p className="mt-1 text-lg font-semibold text-signal">
              {loc.primary_surface.pointer.native_label}
            </p>
            <p className="mt-2 font-mono text-xs text-trace">
              {loc.primary_surface.pointer.native_pointer}
            </p>
            <p className="mt-3 text-xs text-room-muted">
              Mechanism generalizes. Pointer localizes.
            </p>
          </div>
        )}

        {step === "highlight" && loc && (
          <div>
            <p className="text-sm text-room-muted">
              Workflow node highlighted →{" "}
              <span className="font-semibold text-signal">
                {loc.primary_surface.pointer.native_label}
              </span>
            </p>
            <p className="mt-2 font-mono text-[10px] text-trace">
              stage {loc.primary_surface.pointer.native_pointer.match(/id=([^/]+)/)?.[1]?.slice(0, 8)}…
            </p>
            <p className="mt-3 text-sm font-medium text-signal">
              This is where the bug lives.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function demoStepShowsHighlight(step: DemoStep): boolean {
  return step === "highlight";
}
