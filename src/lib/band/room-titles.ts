import { VoiceIncidentEvidence } from "@/lib/evidence/types";

/** Human label for Band room list — e.g. "Klaus" from "Klaus — callback confirmed…" */
export function callerLabelFromEvidence(evidence: VoiceIncidentEvidence): string {
  const fromTitle = evidence.title.split(/\s[—–-]\s/)[0]?.trim();
  if (fromTitle && fromTitle.length > 0 && fromTitle.length < 48) {
    return fromTitle;
  }
  return evidence.incident_id;
}

export function bandRoomTitle(
  evidence: VoiceIncidentEvidence,
  room: "Cause Room" | "Localization Room",
): string {
  return `${callerLabelFromEvidence(evidence)} · ${room}`;
}
