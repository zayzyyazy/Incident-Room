"use client";

import { useEffect, useMemo, useState } from "react";
import { InvestigationStep } from "@/lib/demo/investigation-steps";
import { GameCharacterSprite } from "@/components/demo/GameCharacterSprite";
import {
  CHARACTER_POSITIONS,
  deriveRecruitedAgents,
  dialogueLine,
  gameActionForStep,
  investigationPhase,
  InvestigationPhase,
  isRecruitBeat,
  PARTY_ROSTER,
  PHASE_LABELS,
  recruitDisplayName,
  recruitSlotId,
  resolveAgentSlot,
  STAGE_SLOTS,
  StageSlot,
  AgentSlotId,
} from "@/lib/demo/game-level";
import {
  agentStanceOnFocus,
  deriveTheoryBoard,
  isTheoryBeat,
  stanceGlyph,
  TheoryStanceKind,
} from "@/lib/demo/game-theory-board";
import { stageVfxForStep } from "@/lib/demo/game-level-motion";

function StanceBadge({ kind }: { kind: TheoryStanceKind }) {
  const tone =
    kind === "supports" || kind === "accepts"
      ? "game-stance-agree"
      : kind === "challenges"
        ? "game-stance-dispute"
        : kind === "proposed"
          ? "game-stance-propose"
          : "game-stance-neutral";
  const labels: Record<TheoryStanceKind, string> = {
    proposed: "proposed",
    supports: "agrees",
    challenges: "disputes",
    refines: "refines",
    withdraws: "withdraws",
    accepts: "accepts",
  };
  return (
    <span className={`game-stance-badge ${tone}`} title={labels[kind]}>
      {stanceGlyph(kind)}
    </span>
  );
}

function RecruitBeam({ slotId }: { slotId: AgentSlotId }) {
  const pos = CHARACTER_POSITIONS[slotId];
  const fromLeft = pos.x <= 50;
  return (
    <div
      className={`game-recruit-beam ${fromLeft ? "game-recruit-beam-left" : "game-recruit-beam-right"}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      aria-hidden
    />
  );
}

function GameCharacter({
  slot,
  speaking,
  justRecruited,
  recruiting,
  exiting,
  stance,
}: {
  slot: StageSlot;
  speaking: boolean;
  justRecruited?: boolean;
  recruiting?: boolean;
  exiting?: boolean;
  stance?: TheoryStanceKind | null;
}) {
  const pos = CHARACTER_POSITIONS[slot.id];
  const exitClass =
    exiting && pos.x <= 35
      ? "animate-crew-exit-left"
      : exiting && pos.x >= 65
        ? "animate-crew-exit-right"
        : exiting
          ? "animate-crew-exit-center"
          : "";

  if (recruiting) {
    return (
      <>
        <RecruitBeam slotId={slot.id} />
        <div
          className="absolute z-15 -translate-x-1/2 -translate-y-full"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          <div className="game-recruit-pending animate-game-slot-pulse">
            <span className="text-lg">🌀</span>
          </div>
          <p className="mt-1 text-center text-[8px] font-bold uppercase tracking-wider text-amber-warm">
            recruiting…
          </p>
        </div>
      </>
    );
  }

  return (
    <div
      className={`absolute z-20 -translate-x-1/2 -translate-y-full ${exitClass} ${
        justRecruited ? "animate-game-spawn" : ""
      }`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      {stance ? (
        <div className="absolute -right-1 -top-1 z-30">
          <StanceBadge kind={stance} />
        </div>
      ) : null}

      {speaking && !exiting ? <div className="game-spotlight" aria-hidden /> : null}

      <div
        className={`game-character-pedestal ${speaking && !exiting ? slot.glow : ""} ${
          justRecruited ? "animate-crew-vent-exit" : ""
        }`}
      >
        <GameCharacterSprite
          slotId={slot.id}
          slot={slot}
          speaking={speaking && !exiting}
          facing={pos.face === "left" ? "left" : pos.face === "right" ? "right" : "center"}
        />
      </div>

      {justRecruited ? (
        <p className="game-joined-tag animate-game-recruit-flash">joined</p>
      ) : null}

      <p
        className={`mt-1 max-w-[5.5rem] text-center text-[8px] font-bold uppercase tracking-wide ${
          speaking ? slot.accent : "text-room-muted"
        }`}
      >
        {slot.label}
      </p>
    </div>
  );
}

function PartyRoster({
  recruited,
  speakingId,
  recruitingKey,
  horizontal,
}: {
  recruited: AgentSlotId[];
  speakingId?: AgentSlotId;
  recruitingKey?: string;
  horizontal?: boolean;
}) {
  const visible = PARTY_ROSTER.filter((m) => recruited.includes(m.id));

  return (
    <div
      className={
        horizontal
          ? "flex min-h-[3.25rem] items-center gap-2 overflow-x-auto px-3 py-2"
          : "flex flex-col gap-2 p-3"
      }
    >
      {!horizontal ? <p className="game-panel-label">Crew on deck</p> : null}
      {visible.length === 0 ? (
        <p className="text-[10px] text-room-muted">Waiting for recruits…</p>
      ) : null}
      {visible.map((member) => {
        const slot = STAGE_SLOTS[member.id];
        const isSpeaking = speakingId === member.id;
        const incoming = recruitingKey === member.recruitKey;
        return (
          <div
            key={member.id}
            className={`game-party-card animate-game-roster-in ${
              isSpeaking
                ? `game-party-card-active ${slot.border}`
                : incoming
                  ? "game-party-card-incoming"
                  : ""
            }`}
          >
            <div className="game-party-portrait">
              <GameCharacterSprite
                slotId={member.id}
                slot={slot}
                speaking={isSpeaking}
                facing="right"
                size="tiny"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[10px] font-semibold ${slot.accent}`}>
                {slot.shortLabel}
              </p>
              <p className="truncate text-[8px] text-room-muted">{slot.label}</p>
            </div>
            {incoming ? (
              <span className="ml-auto animate-pulse text-[8px] font-bold text-amber-warm">NEW</span>
            ) : isSpeaking ? (
              <span className="ml-auto animate-pulse text-[8px] text-alert">●</span>
            ) : (
              <span className="ml-auto text-[8px] text-trace">✓</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuestLog({ steps, activeIndex }: { steps: InvestigationStep[]; activeIndex: number }) {
  const entries = steps.slice(0, activeIndex + 1).slice(-10);
  return (
    <div className="flex flex-col gap-1.5 p-3">
      <p className="game-panel-label">Quest log</p>
      <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
        {entries.map((step, i) => {
          const isActive = i === entries.length - 1;
          const action = gameActionForStep(step);
          return (
            <div key={step.id} className={`game-quest-entry ${isActive ? "game-quest-entry-active" : ""}`}>
              <p className="font-semibold text-[9px]">
                <span className="mr-1">{action.icon}</span>
                {step.headline}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BeatDialogue({
  step,
  slot,
  live,
}: {
  step: InvestigationStep;
  slot: StageSlot;
  live: boolean;
}) {
  const action = gameActionForStep(step);
  const body = dialogueLine(step).replace(/\*\*/g, "").trim();
  const preview = body.length > 200 ? `${body.slice(0, 197)}…` : body;
  const agentName =
    step.kind === "EvidenceReturned" ||
    step.kind === "EvidenceRequested" ||
    step.kind === "NormalizerRouting"
      ? slot.label
      : step.agentLabel;
  const toneClass =
    action.tone === "recruit"
      ? "game-dialogue-recruit"
      : action.tone === "challenge"
        ? "game-dialogue-challenge"
        : action.tone === "evidence"
          ? "game-dialogue-evidence"
          : action.tone === "verdict"
            ? "game-dialogue-verdict"
            : "game-dialogue-neutral";

  return (
    <div className={`game-dialogue-box border ${toneClass} animate-game-dialogue-in`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-room-border/40 bg-black/30 px-3 py-2">
        <span className={`game-dialogue-portrait ${slot.sprite}`}>{slot.shortLabel}</span>
        <p className={`text-[11px] font-bold uppercase ${slot.accent}`}>{agentName}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-room-muted">
          {action.icon} {action.verb}
        </p>
        {step.subline && !["SpecialistRecruited", "ConfidenceChanged"].includes(step.kind) ? (
          <span className="game-theory-chip">{step.subline}</span>
        ) : null}
      </div>
      <p className="px-3 py-3 text-sm leading-relaxed text-foreground line-clamp-3">
        {preview}
        {live && body.length > preview.length ? (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-trace" />
        ) : null}
      </p>
    </div>
  );
}

function TheoryStrip({
  board,
}: {
  board: ReturnType<typeof deriveTheoryBoard>;
}) {
  const focus = board.theories.find((t) => t.id === board.focusTheoryId);
  if (!focus) return null;

  const latestByAgent = new Map<string, (typeof focus.stances)[0]>();
  for (const stance of focus.stances) {
    latestByAgent.set(stance.slotId, stance);
  }
  const voters = [...latestByAgent.values()];

  return (
    <div className="game-theory-strip border-b border-room-border/50 bg-room-bg/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-room-muted">Theory</span>
        <span className="font-mono text-xs font-bold uppercase text-foreground">{focus.label}</span>
        {focus.confidence ? (
          <span className="font-mono text-[10px] text-alert">{focus.confidence}</span>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-1">
          {voters.map((v) => (
            <span key={`${v.slotId}-${v.beatId}`} className="game-theory-vote-chip">
              {v.shortLabel} {stanceGlyph(v.kind)}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function RecruitOverlay({ name, role }: { name: string; role: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/60 animate-game-recruit-flash">
      <div className="animate-game-recruit-banner text-center">
        <p className="game-recruit-kicker">⚡ crewmate joined</p>
        <p className="mt-3 font-mono text-3xl font-black uppercase tracking-wide text-white md:text-4xl">
          {name}
        </p>
        <p className="mt-2 text-sm uppercase tracking-[0.2em] text-amber-warm">{role}</p>
        <p className="mt-4 text-xs text-trace">emerged from the vent</p>
      </div>
    </div>
  );
}

function PhaseBanner({ phase }: { phase: InvestigationPhase }) {
  const copy: Record<InvestigationPhase, string> = {
    briefing: "Mission briefing — case opened",
    evidence: "Evidence run — packets incoming",
    debate: "Theory combat — challenge everything",
    verdict: "Final phase — call outcome & next steps",
  };
  return (
    <div className="game-phase-banner" key={phase}>
      <span>{PHASE_LABELS[phase]}</span>
      <span className="text-room-muted"> · {copy[phase]}</span>
    </div>
  );
}

function StageEnvironment({ phase, combat }: { phase: InvestigationPhase; combat: boolean }) {
  return (
    <>
      <div className="game-stage-wall" />
      <div className="game-stage-ship-floor" />
      <div className="game-stage-grid" />
      <div className="game-stage-floor" />
      <div className={`game-stage-phase-glow game-stage-phase-${phase}`} aria-hidden />
      {combat ? <div className="game-combat-slash" aria-hidden /> : null}
      <div className="game-scanlines pointer-events-none absolute inset-0 z-[5] opacity-[0.05]" aria-hidden />
      <div className="game-hud-corner game-hud-corner-tl" />
      <div className="game-hud-corner game-hud-corner-tr" />
      <div className="game-hud-corner game-hud-corner-bl" />
      <div className="game-hud-corner game-hud-corner-br" />
    </>
  );
}

function SlotAnchors({ recruited }: { recruited: AgentSlotId[] }) {
  return (
    <>
      {PARTY_ROSTER.filter((m) => recruited.includes(m.id)).map((member) => {
        const pos = CHARACTER_POSITIONS[member.id];
        return (
          <div
            key={member.id}
            className="game-slot-anchor pointer-events-none absolute z-[8] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            aria-hidden
          />
        );
      })}
    </>
  );
}

function StageVfx({ kind }: { kind: ReturnType<typeof stageVfxForStep> }) {
  if (!kind) return null;
  if (kind === "evidence_drop") {
    return (
      <div className="pointer-events-none absolute left-1/2 top-[42%] z-30 -translate-x-1/2 animate-evidence-drop">
        <span className="text-2xl">📦</span>
      </div>
    );
  }
  if (kind === "debate_clash") {
    return <div className="game-debate-clash pointer-events-none absolute inset-0 z-25" aria-hidden />;
  }
  if (kind === "recruit") {
    return (
      <div className="pointer-events-none absolute left-[6%] bottom-[24%] z-30 h-8 w-12 animate-vent-burst rounded bg-teal-400/20 blur-md" />
    );
  }
  if (kind === "verdict") {
    return (
      <div className="pointer-events-none absolute inset-0 z-25 bg-violet-500/10 animate-game-recruit-flash" />
    );
  }
  return null;
}

function ClearedOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/40 animate-game-recruit-flash">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-trace">Investigation cleared</p>
        <p className="mt-2 font-mono text-2xl font-black uppercase text-white">Crew dismissed</p>
        <p className="mt-2 text-xs text-room-muted">Open Reports for the audit memo</p>
      </div>
    </div>
  );
}

export function InvestigationGameLevel({
  steps,
  activeIndex,
  live,
  complete,
  immersive,
  bandUrl,
}: {
  steps: InvestigationStep[];
  activeIndex: number;
  live: boolean;
  complete: boolean;
  immersive?: boolean;
  bandUrl?: string;
}) {
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;
  const [recruitFlash, setRecruitFlash] = useState<{ name: string; role: string } | null>(null);
  const [lastRecruitKey, setLastRecruitKey] = useState<string | null>(null);
  const [phaseFlash, setPhaseFlash] = useState<InvestigationPhase | null>(null);

  const recruited = useMemo(
    () => deriveRecruitedAgents(steps, Math.max(0, activeIndex)),
    [steps, activeIndex],
  );

  const phase = investigationPhase(steps, activeIndex);
  const progress = steps.length > 0 ? ((activeIndex + 1) / steps.length) * 100 : 0;
  const speakingSlot = activeStep ? resolveAgentSlot(activeStep) : null;
  const action = activeStep ? gameActionForStep(activeStep) : null;
  const isCombat = action?.tone === "challenge";
  const recruitingKey =
    activeStep && isRecruitBeat(activeStep) ? activeStep.subline : undefined;
  const showCleared = complete && !live;
  const crewExiting = showCleared;
  const stageVfx = stageVfxForStep(activeStep);
  const theoryBoard = useMemo(
    () => deriveTheoryBoard(steps, Math.max(0, activeIndex)),
    [steps, activeIndex],
  );
  const showTheoryBoard =
    Boolean(theoryBoard.focusTheoryId) &&
    (phase === "debate" || isTheoryBeat(activeStep));
  const [recruitRevealed, setRecruitRevealed] = useState<Set<string>>(
    () => new Set(["incident_room"]),
  );

  useEffect(() => {
    if (!activeStep || !isRecruitBeat(activeStep)) return;
    const slot = recruitSlotId(activeStep.subline ?? "");
    if (!slot) return;
    setRecruitRevealed((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });
    const t = window.setTimeout(() => {
      setRecruitRevealed((prev) => new Set(prev).add(slot));
    }, 820);
    return () => window.clearTimeout(t);
  }, [activeStep?.id]);

  useEffect(() => {
    if (!activeStep || !isRecruitBeat(activeStep)) return;
    const name = recruitDisplayName(activeStep.subline);
    const role = STAGE_SLOTS[recruitSlotId(activeStep.subline) ?? "unknown"]?.role ?? "Specialist";
    if (activeStep.subline === lastRecruitKey) return;
    setLastRecruitKey(activeStep.subline ?? null);
    setRecruitFlash({ name, role });
    const t = setTimeout(() => setRecruitFlash(null), 2400);
    return () => clearTimeout(t);
  }, [activeStep, lastRecruitKey]);

  useEffect(() => {
    setPhaseFlash(phase);
    const t = setTimeout(() => setPhaseFlash(null), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className={`game-level-frame overflow-hidden ${immersive ? "game-level-immersive" : ""}`}>
      <div className="game-hud-top">
        <div>
          <p className="game-level-title">Incident Room · Investigation Bay</p>
          <p className="text-[10px] text-room-muted">{PHASE_LABELS[phase]}</p>
          {bandUrl && (live || complete) ? (
            <a
              href={bandUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[9px] font-semibold text-trace hover:underline"
            >
              Band room ↗ {recruited.length - 1} specialists recruited
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {live && !complete ? (
            <span className="game-live-badge">
              <span className="h-2 w-2 animate-pulse rounded-full bg-alert" />
              LIVE
            </span>
          ) : showCleared ? (
            <span className="rounded border border-trace/40 bg-trace/10 px-2 py-1 text-[10px] font-bold uppercase text-trace">
              Cleared ✓
            </span>
          ) : null}
          {!showCleared ? (
            <div className="text-right">
              <p className="font-mono text-sm text-foreground">
                Beat {activeIndex + 1}
                <span className="text-room-muted">/{steps.length || "—"}</span>
              </p>
              <p className="text-[9px] uppercase tracking-wider text-room-muted">quest progress</p>
            </div>
          ) : null}
        </div>
      </div>

      {phaseFlash && live && !complete ? <PhaseBanner phase={phaseFlash} /> : null}

      <div className="relative h-2 bg-room-bg">
        <div
          className="h-full bg-gradient-to-r from-trace via-signal to-command transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 game-xp-ticks" aria-hidden />
      </div>

      <div
        className={
          immersive
            ? "game-grid-immersive"
            : "grid min-h-[560px] grid-cols-1 lg:grid-cols-[168px_1fr_168px]"
        }
      >
        {!immersive ? (
          <aside className="hidden border-r border-room-border/50 bg-room-bg/60 lg:block">
            <PartyRoster
              recruited={recruited}
              speakingId={speakingSlot?.id}
              recruitingKey={recruitingKey}
            />
          </aside>
        ) : null}

        {immersive ? (
          <div className="border-b border-room-border/40 bg-room-bg/50">
            <PartyRoster
              recruited={recruited}
              speakingId={speakingSlot?.id}
              recruitingKey={recruitingKey}
              horizontal
            />
          </div>
        ) : null}

        <div className={`relative flex flex-col ${immersive ? "min-h-0 flex-1" : "min-h-[400px]"}`}>
          <div
            className={`game-stage relative flex-1 ${
              immersive ? "game-stage-immersive min-h-[min(58vh,520px)]" : "min-h-[340px]"
            }`}
          >
            <StageEnvironment phase={phase} combat={Boolean(isCombat)} />
            <SlotAnchors recruited={recruited} />
            <StageVfx kind={live && !showCleared ? stageVfx : null} />

            {PARTY_ROSTER.map((member) => {
              const slot = STAGE_SLOTS[member.id];
              const isRecruited = recruited.includes(member.id);
              if (!isRecruited) return null;

              const revealed = recruitRevealed.has(member.id);
              const speaking = !crewExiting && speakingSlot?.id === member.id;
              const onRecruitBeat = Boolean(
                activeStep &&
                  isRecruitBeat(activeStep) &&
                  activeStep.subline === member.recruitKey,
              );
              const justRecruited = onRecruitBeat && revealed;
              const isRecruiting = onRecruitBeat && !revealed;
              const stance = agentStanceOnFocus(theoryBoard, member.id);

              return (
                <GameCharacter
                  key={member.id}
                  slot={slot}
                  speaking={speaking}
                  justRecruited={justRecruited}
                  recruiting={isRecruiting}
                  exiting={crewExiting && isRecruited}
                  stance={showTheoryBoard ? stance : null}
                />
              );
            })}

            {recruitFlash && live ? (
              <RecruitOverlay name={recruitFlash.name} role={recruitFlash.role} />
            ) : null}

            {showCleared ? <ClearedOverlay /> : null}

            {!immersive ? (
              <div className="absolute bottom-3 left-2 right-2 z-30 flex gap-1 overflow-x-auto lg:hidden">
              {PARTY_ROSTER.map((member) => {
                const slot = STAGE_SLOTS[member.id];
                const isIn = recruited.includes(member.id);
                const isSpeaking = speakingSlot?.id === member.id;
                if (!isIn) return null;
                return (
                  <div
                    key={member.id}
                    className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-bold uppercase ${
                      isSpeaking
                        ? `${slot.border} ${slot.accent} bg-room-bg/90`
                        : "border-room-border/50 text-room-muted bg-room-bg/70"
                    }`}
                  >
                    {slot.shortLabel}
                  </div>
                );
              })}
              </div>
            ) : null}

            {steps.length > 0 && live && !complete ? (
              <div className="absolute bottom-3 left-1/2 z-20 hidden max-w-[92%] -translate-x-1/2 lg:block">
                <div className="game-beat-strip">
                  {steps.slice(Math.max(0, activeIndex - 5), activeIndex + 2).map((step) => {
                    const stepAction = gameActionForStep(step);
                    const isActive = step.id === activeStep?.id;
                    return (
                      <div
                        key={step.id}
                        className={`game-beat-chip ${isActive ? "game-beat-chip-active" : ""}`}
                        title={step.headline}
                      >
                        <span>{stepAction.icon}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!activeStep && live ? (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3">
                <div className="game-loading-ring" />
                <p className="animate-pulse font-mono text-sm text-trace">Entering incident room…</p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-room-border/60 bg-room-bg/95">
            {showTheoryBoard && activeStep && !showCleared ? (
              <TheoryStrip board={theoryBoard} />
            ) : null}
            <div className={immersive ? "p-2" : "p-3 md:p-4"}>
              {showCleared ? (
                <div className="game-dialogue-box border border-trace/40 px-3 py-3 text-center text-sm text-trace">
                  Investigation cleared — open Reports for the cited memo
                </div>
              ) : activeStep ? (
                <BeatDialogue step={activeStep} slot={speakingSlot!} live={live && !complete} />
              ) : (
                <div className="game-dialogue-box border border-room-border px-3 py-4 text-center text-sm text-room-muted">
                  Run investigation to enter the bay
                </div>
              )}
            </div>
          </div>
        </div>

        {!immersive ? (
          <aside className="hidden border-l border-room-border/50 bg-room-bg/60 lg:block">
            <QuestLog steps={steps} activeIndex={activeIndex} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
