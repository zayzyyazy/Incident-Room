import {
  BandAgentProfile,
  BandMessageRecord,
  getBandRoomHostApiKey,
  isBandDemoQuiet,
  isLocalBandRoom,
  postChatMessageAsAgent,
} from "@/lib/band/client";
import { ensureRoomParticipant } from "@/lib/band/multi-agent";
import { EarnedScriptBeat } from "@/lib/investigation/build-earned-script";

const REMOTE_SPECIALIST_LABELS: Record<string, string> = {
  normalizer: "Normalizer",
  verdict_judge: "Verdict Judge",
  execution_investigator: "Execution Investigator",
  communication_investigator: "Communication Investigator",
  workflow_investigator: "Workflow Investigator",
  policy_investigator: "Policy Investigator",
};

const EVENT_LABEL: Partial<Record<EarnedScriptBeat["kind"], string>> = {
  InvestigationOpened: "INVESTIGATION OPENED",
  EvidenceRequested: "EVIDENCE REQUEST",
  EvidenceReturned: "EVIDENCE RETURNED",
  SpecialistRecruited: "SPECIALIST RECRUITED",
  TheoryProposed: "THEORY PROPOSED",
  TheorySupported: "THEORY SUPPORTED",
  TheoryChallenged: "THEORY CHALLENGED",
  TheoryRefined: "THEORY REFINED",
  TheoryWithdrawn: "THEORY WITHDRAWN",
  TheoryAccepted: "THEORY ACCEPTED",
  ConfidenceChanged: "CONFIDENCE CHANGED",
  RoomChallenge: "ROOM CHALLENGE",
  VerdictIssued: "FINAL VERDICT",
  ExplanationIssued: "SURVIVING EXPLANATION",
  FixTargetIssued: "FIX TARGET",
};

const NARRATOR_BEATS = new Set<EarnedScriptBeat["kind"]>([
  "InvestigationOpened",
  "EvidenceRequested",
  "EvidenceReturned",
  "SpecialistRecruited",
  "RoomChallenge",
  "TheoryAccepted",
  "VerdictIssued",
  "ExplanationIssued",
  "FixTargetIssued",
]);

export function isNarratorBeat(beat: EarnedScriptBeat): boolean {
  return NARRATOR_BEATS.has(beat.kind);
}

function internalAgentIds(): Set<string> {
  return new Set(
    [
      process.env.BAND_INTERNAL_NORMALIZER_ID?.trim(),
      process.env.BAND_INTERNAL_VERDICT_JUDGE_ID?.trim(),
    ].filter(Boolean) as string[],
  );
}

export type QuietMentionTargets = {
  backendWitnessId?: string;
  claimTracerId?: string;
};

type RecruitedSet = Set<string>;

function buildMentionsForBeat(
  beat: EarnedScriptBeat,
  posterId: string,
  quietTargets?: QuietMentionTargets,
  recruited?: RecruitedSet,
) {
  const mentions: Array<{ id: string; handle?: string; name?: string }> = [];
  const blocked = internalAgentIds();
  const handles = {
    normalizer:
      process.env.BAND_INTERNAL_NORMALIZER_HANDLE?.trim() ?? "normaliezer",
    verdictJudge:
      process.env.BAND_INTERNAL_VERDICT_JUDGE_HANDLE?.trim() ?? "verdictjudge",
  };
  const ids = {
    normalizer: process.env.BAND_INTERNAL_NORMALIZER_ID?.trim(),
    verdictJudge: process.env.BAND_INTERNAL_VERDICT_JUDGE_ID?.trim(),
  };

  function add(id: string | undefined, handle: string, name: string) {
    if (!id || id === posterId) return;
    if (mentions.some((m) => m.id === id)) return;
    mentions.push({ id, handle: handle.replace(/^@/, ""), name });
  }

  if (isBandDemoQuiet()) {
    if (recruited?.has("verdict_judge") && beat.kind === "VerdictIssued") {
      add(ids.verdictJudge, handles.verdictJudge, "Verdictjudge");
    }
    if (mentions.length > 0) return mentions;

    const candidates = [
      quietTargets?.backendWitnessId,
      quietTargets?.claimTracerId,
    ].filter(
      (id): id is string =>
        typeof id === "string" && id !== posterId && !blocked.has(id),
    );

    const targetId = candidates[0];
    if (targetId) {
      mentions.push({ id: targetId, name: "Investigation" });
    }
    return mentions;
  }

  const seen = new Set<string>();

  function addLegacy(id: string | undefined, handle: string, name: string) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    mentions.push({ id, handle: handle.replace(/^@/, ""), name });
  }

  if (
    beat.kind === "EvidenceRequested" ||
    beat.kind === "EvidenceReturned"
  ) {
    return mentions;
  }

  if (beat.line.toLowerCase().includes("normalizer")) {
    addLegacy(ids.normalizer, handles.normalizer, "Normaliezer");
  }

  if (beat.kind === "VerdictIssued") {
    addLegacy(ids.verdictJudge, handles.verdictJudge, "Verdictjudge");
  }

  if (mentions.length === 0) {
    addLegacy(ids.normalizer, handles.normalizer, "Normaliezer");
  }

  return mentions;
}

function theorySlug(theory?: string): string {
  if (!theory) return "execution_failure_alone";
  return theory === "execution_failure" ? "execution_failure_alone" : theory;
}

export function formatEarnedBeatChatContent(beat: EarnedScriptBeat): string {
  const eventLabel =
    EVENT_LABEL[beat.kind] ??
    beat.kind.replace(/([A-Z])/g, " $1").trim().toUpperCase();

  if (beat.kind === "EvidenceReturned") {
    return `📦 **EVIDENCE RETURNED**\n\n${beat.line}`;
  }

  if (beat.kind === "EvidenceRequested") {
    return `📦 **EVIDENCE REQUEST**\n\n${beat.line}`;
  }

  if (beat.kind === "TheoryWithdrawn") {
    const slug = theorySlug(beat.theory);
    const reason =
      beat.withdrawReason ??
      "Failed execution explains system state but not customer belief.";
    return `❌ **THEORY WITHDRAWN — ${slug}**\n\n**Reason:** ${reason}`;
  }

  if (beat.kind === "TheoryAccepted" && beat.theory) {
    return `✅ **THEORY ACCEPTED — ${beat.theory.replace(/_/g, " ")}**\n\n**Incident Room**: ${beat.line}`;
  }

  if (beat.kind === "TheorySupported" && beat.theory) {
    const delta =
      beat.confidenceBefore && beat.confidenceAfter
        ? `\n\n**Confidence:** ${beat.confidenceBefore} → ${beat.confidenceAfter}`
        : "";
    const speaker =
      REMOTE_SPECIALIST_LABELS[beat.agentRole] ??
      beat.agentRole.replace(/_/g, " ");
    return `📈 **THEORY SUPPORTED — ${beat.theory.replace(/_/g, " ")}**\n\n**${speaker}**: ${beat.line}${delta}`;
  }

  if (beat.kind === "TheoryRefined" && beat.theory) {
    const speaker =
      REMOTE_SPECIALIST_LABELS[beat.agentRole] ??
      beat.agentRole.replace(/_/g, " ");
    return `🔧 **THEORY REFINED — ${beat.theory.replace(/_/g, " ")}**\n\n**${speaker}**: ${beat.line}`;
  }

  if (beat.kind === "ConfidenceChanged") {
    const speaker =
      REMOTE_SPECIALIST_LABELS[beat.agentRole] ??
      beat.agentRole.replace(/_/g, " ");
    const delta =
      beat.confidenceBefore && beat.confidenceAfter
        ? `**${beat.confidenceBefore}** → **${beat.confidenceAfter}**`
        : "";
    return `📊 **CONFIDENCE CHANGED**\n\n**${speaker}**: ${beat.line}${delta ? `\n\n${delta}` : ""}`;
  }

  if (beat.kind === "RoomChallenge") {
    return `⚠️ **ROOM CHALLENGE**\n\n**Incident Room**: ${beat.line}`;
  }

  if (beat.kind === "SpecialistRecruited" && beat.recruit) {
    const recruitLabel =
      REMOTE_SPECIALIST_LABELS[beat.recruit] ??
      beat.recruit.replace(/_/g, " ");
    return `**${eventLabel}**\n\n**Incident Room** recruited **${recruitLabel}**.\n\n${beat.line}`;
  }

  if (beat.kind === "VerdictIssued") {
    return `**${eventLabel}**\n\n**Incident Room**: ${beat.line}`;
  }

  if (isNarratorBeat(beat)) {
    return `**${eventLabel}**\n\n**Incident Room**: ${beat.line}`;
  }

  const speaker =
    REMOTE_SPECIALIST_LABELS[beat.agentRole] ??
    beat.agentRole.replace(/_/g, " ");
  return `**${eventLabel}**\n\n**${speaker}**: ${beat.line}`;
}

export async function postEarnedBeatToVisibleChat(input: {
  roomId: string;
  beat: EarnedScriptBeat;
  poster: { apiKey: string; profile: BandAgentProfile; displayName: string };
  metadata: Record<string, unknown>;
  recruited?: RecruitedSet;
  quietMentionTargets?: QuietMentionTargets;
  fallbacks?: Array<{ apiKey: string; profile: BandAgentProfile; displayName: string }>;
}): Promise<BandMessageRecord> {
  if (isLocalBandRoom(input.roomId)) {
    return {
      id: crypto.randomUUID(),
      content: formatEarnedBeatChatContent(input.beat),
      metadata: input.metadata,
    };
  }

  const content = formatEarnedBeatChatContent(input.beat);
  const hostKey = getBandRoomHostApiKey(input.poster.apiKey);
  let mentions = buildMentionsForBeat(
    input.beat,
    input.poster.profile.id,
    input.quietMentionTargets,
    input.recruited,
  );

  if (mentions.length === 0) {
    const fallbackId =
      input.quietMentionTargets?.backendWitnessId ??
      input.quietMentionTargets?.claimTracerId;
    if (fallbackId && fallbackId !== input.poster.profile.id) {
      mentions = [{ id: fallbackId, name: "Investigation" }];
    }
  }

  const posters = [input.poster, ...(input.fallbacks ?? [])].filter(
    (p, i, arr) => arr.findIndex((x) => x.apiKey === p.apiKey) === i,
  );

  let lastError: unknown;
  for (const poster of posters) {
    await ensureRoomParticipant(input.roomId, poster.profile.id, hostKey);
    try {
      return await postChatMessageAsAgent(input.roomId, content, {
        apiKey: poster.apiKey,
        metadata: input.metadata,
        mentions,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("All Band chat post attempts failed");
}
