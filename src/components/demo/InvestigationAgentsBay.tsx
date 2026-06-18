"use client";

import { GameCharacterSprite } from "@/components/demo/GameCharacterSprite";
import { PARTY_ROSTER, STAGE_SLOTS } from "@/lib/demo/game-level";
import { AGENT_REGISTRY } from "@/lib/agents/registry";

const EARNED_IDS = new Set(PARTY_ROSTER.map((m) => m.id));

export function InvestigationAgentsBay({
  recruited = [],
}: {
  recruited?: string[];
}) {
  const earned = PARTY_ROSTER.map((m) => STAGE_SLOTS[m.id]);
  const backstage = AGENT_REGISTRY.filter((a) => a.enabled && !EARNED_IDS.has(a.id as never));

  return (
    <div className="space-y-6 p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-trace">
          Investigation party
        </p>
        <p className="mt-1 text-xs text-room-muted">
          Recruited live during earned investigations — same crew as the Theories bay.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {earned.map((slot) => {
            const active =
              recruited.length === 0
                ? slot.id === "incident_room"
                : recruited.includes(slot.id);
            return (
              <div
                key={slot.id}
                className={`game-agent-card ${active ? "game-agent-card-active" : "opacity-50"}`}
              >
                <div className="flex justify-center py-2">
                  <GameCharacterSprite
                    slotId={slot.id}
                    slot={slot}
                    speaking={false}
                    idle={!active}
                    facing="center"
                    size="party"
                  />
                </div>
                <p className={`text-center text-xs font-bold ${slot.accent}`}>{slot.label}</p>
                <p className="text-center text-[10px] text-room-muted">{slot.role}</p>
              </div>
            );
          })}
        </div>
      </div>

      {backstage.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-room-muted">
            Backstage · legacy pipeline
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {backstage.map((agent) => (
              <span
                key={agent.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${agent.borderClass} ${agent.accentClass} bg-room-bg/80`}
                title={agent.layer}
              >
                <span className="font-mono">{agent.shortLabel}</span>
                {agent.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
