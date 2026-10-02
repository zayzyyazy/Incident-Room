"use client";

import { ReactNode } from "react";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { InvestigationRun } from "@/lib/incidents/types";
import { InvestigationBreakthrough } from "@/lib/localization-room/types";
import { KlausDemoGraph } from "@/lib/workflow/klaus-demo-graph";
import { WorkflowViewer } from "@/components/demo/WorkflowViewer";

function DemoCard({
  step,
  title,
  children,
  hero,
  locked,
}: {
  step: number;
  title: string;
  children: ReactNode;
  hero?: boolean;
  locked?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border bg-room-panel p-4 transition ${
        hero
          ? "border-command/50 bg-command/5 shadow-glow-command ring-1 ring-command/25"
          : "border-room-border"
      } ${locked ? "opacity-40" : ""}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-room-muted">
        {step}. {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function extractContradiction(evidence: VoiceIncidentEvidence) {
  const agentLine =
    evidence.layer1_conversation.segments.find((s) => s.turn_id === "T05")
      ?.text ?? "Agent confirmed callback was booked.";
  const failedCall = evidence.layer2_execution.function_calls.find(
    (c) => c.status === "timeout" || c.http_status === 504,
  );
  const backend =
    failedCall?.http_status === 504
      ? "Backend returned 504"
      : (failedCall?.error_message ?? "Backend execution failed");
  const sideEffects = evidence.layer2_execution.side_effects;
  const systemLine = `${backend} · appointment_created=${String(sideEffects.appointment_created)}`;
  return { agentLine, systemLine };
}

export function DemoStoryboard({
  evidence,
  run,
  workflow,
  breakthrough,
  highlightStageId,
  investigating,
}: {
  evidence: VoiceIncidentEvidence;
  run?: InvestigationRun | null;
  workflow?: KlausDemoGraph | null;
  breakthrough?: InvestigationBreakthrough | null;
  highlightStageId?: string | null;
  investigating?: boolean;
}) {
  const complete = run?.status === "complete";
  const cause = run?.causeRoom?.causeFinding;
  const loc = run?.localizationRoom?.localizationFinding;
  const { agentLine, systemLine } = extractContradiction(evidence);

  return (
    <div className="space-y-4">
      <DemoCard step={1} title="Incident contradiction" locked={!complete && !investigating}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-signal/30 bg-signal/5 p-3">
            <p className="text-[10px] uppercase text-signal">Customer heard</p>
            <p className="mt-1 text-sm leading-relaxed">
              Customer believed callback was booked.
            </p>
            <p className="mt-2 text-xs italic text-room-muted">&ldquo;{agentLine}&rdquo;</p>
          </div>
          <div className="rounded-lg border border-alert/30 bg-alert/5 p-3">
            <p className="text-[10px] uppercase text-alert">System reality</p>
            <p className="mt-1 text-sm leading-relaxed">{systemLine}</p>
          </div>
        </div>
        <p className="mt-4 text-center text-lg font-bold tracking-tight text-foreground">
          Said success.{" "}
          <span className="text-alert">System failed.</span>
        </p>
      </DemoCard>

      <DemoCard
        step={2}
        title="Cause Room"
        locked={!cause}
      >
        {cause ? (
          <>
            <p className="font-mono text-sm uppercase text-trace">
              {hypothesisClassLabel(cause.cause_class)}
            </p>
            <p className="mt-2 text-base leading-relaxed">{cause.cause}</p>
            {run?.localizationRoom?.causeDefenseRequest ? (
              <div className="mt-4 rounded-lg border border-alert/30 bg-alert/5 p-3 text-sm">
                <p className="text-[10px] uppercase text-alert">
                  Cross-room challenge
                </p>
                <p className="mt-1 italic text-room-muted">
                  &ldquo;{run.localizationRoom.causeDefenseRequest.challenge}&rdquo;
                </p>
                {run.localizationRoom.causeDefenseDecision ? (
                  <p className="mt-2 text-foreground">
                    <span className="font-mono text-xs uppercase text-trace">
                      Cause Room: {run.localizationRoom.causeDefenseDecision.decision}
                    </span>
                    {" — "}
                    {run.localizationRoom.causeDefenseDecision.defense}
                  </p>
                ) : null}
                {run.localizationRoom.localizationDefenseVerdict ? (
                  <p className="mt-2 text-foreground">
                    <span className="font-mono text-xs uppercase text-command">
                      Localization: {run.localizationRoom.localizationDefenseVerdict.verdict}
                    </span>
                    {" — "}
                    {run.localizationRoom.localizationDefenseVerdict.rationale_en}
                  </p>
                ) : null}
              </div>
            ) : null}
            {run?.causeRoom?.revisionDecision ? (
              <div className="mt-4 rounded-lg border border-command/30 bg-command/5 p-3 text-sm">
                <p className="text-[10px] uppercase text-command">
                  Cause revised
                </p>
                <p className="mt-1 font-mono text-xs text-command">
                  {run.causeRoom.revisionDecision.old_cause_class} →{" "}
                  {run.causeRoom.revisionDecision.new_cause_class}
                </p>
                <p className="mt-2 text-foreground">
                  {run.causeRoom.revisionDecision.reason}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-room-muted">Waiting for CauseFinding…</p>
        )}
      </DemoCard>

      <DemoCard
        step={3}
        title="Localization breakthrough"
        hero
        locked={!breakthrough && !loc}
      >
        {breakthrough || loc ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-command">
              Breakthrough
            </p>
            <p className="mt-1 text-xl font-semibold leading-snug text-foreground">
              {breakthrough?.headline ??
                "Confirmation happens before success check"}
            </p>
            <p className="mt-3 text-base leading-relaxed text-command">
              {breakthrough?.human_sentence ?? loc?.mechanism_explanation}
            </p>
          </>
        ) : (
          <p className="text-sm text-room-muted">
            Investigators attacking surface theories…
          </p>
        )}
      </DemoCard>

      <DemoCard step={4} title="Implementation surface" locked={!loc}>
        {loc && workflow ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-lg font-semibold text-signal">
                {loc.primary_surface.pointer.native_label}
              </p>
              <p className="mt-2 font-mono text-xs text-trace break-all">
                {loc.primary_surface.pointer.native_pointer}
              </p>
            </div>
            <WorkflowViewer
              graph={workflow}
              highlightStageId={highlightStageId ?? workflow.primaryStageId}
              showHighlight={Boolean(loc)}
              compact
            />
          </div>
        ) : (
          <p className="text-sm text-room-muted">Pointer appears after localization.</p>
        )}
      </DemoCard>

      <DemoCard step={5} title="Final artifact" locked={!loc}>
        {loc ? (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-room-muted">
                Mechanism
              </p>
              <p className="mt-1 font-mono text-sm uppercase text-command">
                {loc.implementation_mechanism.canonical_id}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-room-muted">
                Surface (evidence)
              </p>
              <p className="mt-1 text-sm font-medium text-signal">
                {loc.primary_surface.pointer.native_label}
              </p>
            </div>
            {loc.supporting_surfaces.length > 0 ? (
              <details className="text-xs text-room-muted">
                <summary className="cursor-pointer text-room-muted hover:text-foreground">
                  Supporting surfaces ({loc.supporting_surfaces.length})
                </summary>
                <ul className="mt-2 space-y-1 pl-4">
                  {loc.supporting_surfaces.map((s) => (
                    <li key={s.surface_id}>{s.pointer.native_label}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </DemoCard>
    </div>
  );
}
