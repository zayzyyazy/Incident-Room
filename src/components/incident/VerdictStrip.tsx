"use client";

import { InvestigationRun } from "@/lib/incidents/types";
import { hypothesisClassLabel } from "@/lib/cause-room/hypothesis-classes";
import { Panel } from "@/components/ui/shell";

export function VerdictStrip({
  run,
  roomId,
  localizationRoomId,
}: {
  run?: InvestigationRun | null;
  roomId?: string;
  localizationRoomId?: string;
}) {
  if (!run || run.status !== "complete") {
    return (
      <Panel className="mt-4 p-4">
        <p className="text-sm text-room-muted">
          Cause Finding + Implementation Mechanism appear here after full
          investigation (~90s).
        </p>
      </Panel>
    );
  }

  const cause = run.causeRoom?.causeFinding;
  const loc = run.localizationRoom?.localizationFinding;

  if (!cause) {
    return (
      <Panel className="mt-4 p-4">
        <p className="text-sm text-room-muted">Legacy investigation result.</p>
      </Panel>
    );
  }

  return (
    <Panel className="mt-4 space-y-4 p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-room-muted">
            Cause Room
          </div>
          <p className="mt-1 text-xs font-mono uppercase text-trace">
            {hypothesisClassLabel(cause.cause_class)}
          </p>
          <p className="mt-2 text-sm leading-relaxed">{cause.cause}</p>
          {(roomId ?? run.roomId) ? (
            <code className="mt-2 block text-[10px] text-room-muted">
              Band: {roomId ?? run.roomId}
            </code>
          ) : null}
        </div>

        {loc ? (
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-room-muted">
              Implementation Mechanism
            </div>
            <p className="mt-1 text-xs font-mono uppercase text-command">
              {loc.implementation_mechanism.canonical_id}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {loc.mechanism_explanation ?? loc.implementation_mechanism.statement}
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-room-muted">
              Evidence pointer
            </p>
            <p className="mt-1 text-sm text-signal">
              {loc.primary_surface.pointer.native_label}
            </p>
            <p className="mt-1 font-mono text-[10px] text-trace">
              {loc.primary_surface.pointer.native_pointer}
            </p>
            {loc.supporting_surfaces?.length ? (
              <p className="mt-2 text-xs text-room-muted">
                + {loc.supporting_surfaces.length} supporting surface
                {loc.supporting_surfaces.length === 1 ? "" : "s"}
              </p>
            ) : null}
            {(localizationRoomId ?? run.localizationRoomId) ? (
              <code className="mt-2 block text-[10px] text-room-muted">
                Band: {localizationRoomId ?? run.localizationRoomId}
              </code>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-room-muted">
            Localization Room not run for this investigation.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {(roomId ?? run.roomId) ? (
          <a
            href={`https://app.band.ai/agent/chats/${roomId ?? run.roomId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-trace underline-offset-2 hover:underline"
          >
            Open Cause Room in Band ↗
          </a>
        ) : null}
        {(localizationRoomId ?? run.localizationRoomId) ? (
          <a
            href={`https://app.band.ai/agent/chats/${localizationRoomId ?? run.localizationRoomId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-command underline-offset-2 hover:underline"
          >
            Open Localization Room in Band ↗
          </a>
        ) : null}
      </div>
    </Panel>
  );
}
