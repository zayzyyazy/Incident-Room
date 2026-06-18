import {
  addParticipantToRoom,
  resolveCauseRoomAgents,
} from "@/lib/band/multi-agent";
import { resolveLocalizationRoomAgents } from "@/lib/band/localization-multi-agent";
import {
  BandAgentProfile,
  getBandRoomHostApiKey,
  isLocalBandRoom,
} from "@/lib/band/client";
import {
  isNarratorBeat,
  postEarnedBeatToVisibleChat,
} from "@/lib/band/earned-band-chat";
import {
  InternalBandAgents,
  resolveInternalBandAgents,
} from "@/lib/band/internal-agents";
import { EarnedScriptBeat } from "@/lib/investigation/build-earned-script";

export type EarnedSpecialist =
  | "normalizer"
  | "verdict_judge"
  | "explanation_judge"
  | "execution_investigator"
  | "communication_investigator"
  | "workflow_investigator"
  | "policy_investigator";

export const EARNED_SPECIALIST_LABELS: Record<EarnedSpecialist, string> = {
  normalizer: "Normalizer",
  verdict_judge: "Verdict Judge",
  explanation_judge: "Explanation Judge",
  execution_investigator: "Execution Investigator",
  communication_investigator: "Communication Investigator",
  workflow_investigator: "Workflow Investigator",
  policy_investigator: "Policy Investigator",
};

const RECRUIT_MAP: Record<string, EarnedSpecialist> = {
  normalizer: "normalizer",
  verdict_judge: "verdict_judge",
  execution_investigator: "execution_investigator",
  communication_investigator: "communication_investigator",
  workflow_investigator: "workflow_investigator",
  policy_investigator: "policy_investigator",
};

const REMOTE_POST_ROLES = new Set<string>([
  "execution_investigator",
  "communication_investigator",
  "workflow_investigator",
  "policy_investigator",
]);

type AgentPools = {
  cause: Awaited<ReturnType<typeof resolveCauseRoomAgents>>;
  localization: Awaited<ReturnType<typeof resolveLocalizationRoomAgents>>;
  internal: InternalBandAgents;
};

type BeatPoster = {
  apiKey: string;
  profile: BandAgentProfile;
  displayName: string;
};

function causeRoleFor(specialist: EarnedSpecialist) {
  if (specialist === "execution_investigator") return "backend_witness" as const;
  if (specialist === "communication_investigator") return "claim_tracer" as const;
  return "causal_judge" as const;
}

function locRoleFor(specialist: EarnedSpecialist) {
  if (specialist === "workflow_investigator") return "control_flow_investigator" as const;
  if (specialist === "policy_investigator") return "policy_investigator" as const;
  return "localization_judge" as const;
}

export async function resolveEarnedAgentPools(): Promise<AgentPools> {
  const [cause, localization, internal] = await Promise.all([
    resolveCauseRoomAgents(),
    resolveLocalizationRoomAgents(),
    resolveInternalBandAgents(),
  ]);
  return { cause, localization, internal };
}

async function resolveHostPoster(pools: AgentPools): Promise<BeatPoster> {
  if (pools.internal.roomHost) {
    const a = pools.internal.roomHost;
    return {
      apiKey: a.apiKey,
      profile: a.profile,
      displayName: "Incident Room",
    };
  }
  const apiKey = getBandRoomHostApiKey();
  const { getAgentProfile } = await import("@/lib/band/client");
  const profile = await getAgentProfile();
  return {
    apiKey,
    profile,
    displayName: "Incident Room",
  };
}

function resolveRemotePoster(
  specialist: EarnedSpecialist,
  pools: AgentPools,
): BeatPoster {
  if (
    specialist === "workflow_investigator" ||
    specialist === "explanation_judge"
  ) {
    const role = locRoleFor(specialist);
    const agent = pools.localization[role];
    return {
      apiKey: agent.apiKey,
      profile: agent.profile,
      displayName: agent.displayName,
    };
  }

  const role = causeRoleFor(specialist);
  const agent = pools.cause[role];
  return {
    apiKey: agent.apiKey,
    profile: agent.profile,
    displayName: agent.displayName,
  };
}

async function resolveBeatPoster(
  beat: EarnedScriptBeat,
  pools: AgentPools,
): Promise<BeatPoster> {
  if (beat.kind === "EvidenceReturned") {
    const normalizer = pools.internal.normalizer;
    if (normalizer) {
      return {
        apiKey: normalizer.apiKey,
        profile: normalizer.profile,
        displayName: "Normalizer",
      };
    }
  }

  if (isNarratorBeat(beat)) {
    return resolveHostPoster(pools);
  }

  if (REMOTE_POST_ROLES.has(beat.agentRole)) {
    return resolveRemotePoster(beat.agentRole as EarnedSpecialist, pools);
  }

  return resolveHostPoster(pools);
}

export async function recruitSpecialistToRoom(input: {
  roomId: string;
  hostApiKey: string;
  pools: AgentPools;
  recruit: EarnedSpecialist;
}): Promise<boolean> {
  let participantId: string | undefined;

  if (input.recruit === "normalizer") {
    participantId = process.env.BAND_INTERNAL_NORMALIZER_ID?.trim();
  } else if (input.recruit === "verdict_judge") {
    participantId = process.env.BAND_INTERNAL_VERDICT_JUDGE_ID?.trim();
  } else if (input.recruit === "workflow_investigator") {
    participantId = input.pools.localization[locRoleFor(input.recruit)].profile.id;
  } else if (input.recruit === "policy_investigator") {
    participantId = input.pools.localization[locRoleFor(input.recruit)].profile.id;
  } else if (
    input.recruit === "execution_investigator" ||
    input.recruit === "communication_investigator"
  ) {
    participantId = input.pools.cause[causeRoleFor(input.recruit)].profile.id;
  } else if (input.recruit === "explanation_judge") {
    participantId = input.pools.localization.localization_judge.profile.id;
  }

  if (!participantId) {
    console.warn(
      `Band recruit ${input.recruit} skipped: no participant id (set BAND_INTERNAL_*_ID or remote keys)`,
    );
    return false;
  }

  const hostApiKey = getBandRoomHostApiKey(input.hostApiKey);
  const result = await addParticipantToRoom(
    input.roomId,
    hostApiKey,
    participantId,
  );
  if (result.ok || result.status === 409 || result.status === 422) {
    return true;
  }
  console.warn(
    `Band recruit ${input.recruit} failed (${result.status}):`,
    result.body,
  );
  return false;
}

export async function postEarnedBeat(input: {
  beat: EarnedScriptBeat;
  roomId: string;
  pools: AgentPools;
  recruited: Set<EarnedSpecialist>;
  metadata?: Record<string, unknown>;
}): Promise<{ post: { id: string; content?: string; metadata?: Record<string, unknown> }; roomId: string }> {
  const { beat, pools } = input;
  const roomId = input.roomId;
  const payload = {
    type: beat.kind,
    agent_role: beat.agentRole,
    room: beat.room,
    theory: beat.theory,
    recruit: beat.recruit,
    verdict: beat.verdict,
    withdraw_reason: beat.withdrawReason,
    confidence_before: beat.confidenceBefore,
    confidence_after: beat.confidenceAfter,
    line: beat.line,
    narrated: isNarratorBeat(beat),
    ...input.metadata,
  };

  if (beat.kind === "SpecialistRecruited" && beat.recruit) {
    const recruitKey = RECRUIT_MAP[beat.recruit];
    if (recruitKey && !input.recruited.has(recruitKey)) {
      const hostKey =
        pools.internal.roomHost?.apiKey ?? getBandRoomHostApiKey();
      await recruitSpecialistToRoom({
        roomId,
        hostApiKey: hostKey,
        pools,
        recruit: recruitKey,
      });
      input.recruited.add(recruitKey);
    }
  }

  if (
    beat.kind === "VerdictIssued" &&
    !input.recruited.has("verdict_judge")
  ) {
    const hostKey = pools.internal.roomHost?.apiKey ?? getBandRoomHostApiKey();
    await recruitSpecialistToRoom({
      roomId,
      hostApiKey: hostKey,
      pools,
      recruit: "verdict_judge",
    });
    input.recruited.add("verdict_judge");
  }

  if (
    beat.kind === "TheoryChallenged" &&
    beat.agentRole === "communication_investigator" &&
    !input.recruited.has("communication_investigator")
  ) {
    const hostKey = pools.internal.roomHost?.apiKey ?? getBandRoomHostApiKey();
    await recruitSpecialistToRoom({
      roomId,
      hostApiKey: hostKey,
      pools,
      recruit: "communication_investigator",
    });
    input.recruited.add("communication_investigator");
  }

  if (
    beat.kind === "TheoryProposed" &&
    beat.agentRole === "execution_investigator" &&
    !input.recruited.has("execution_investigator")
  ) {
    const hostKey = pools.internal.roomHost?.apiKey ?? getBandRoomHostApiKey();
    await recruitSpecialistToRoom({
      roomId,
      hostApiKey: hostKey,
      pools,
      recruit: "execution_investigator",
    });
    input.recruited.add("execution_investigator");
  }

  if (
    (beat.kind === "TheoryRefined" || beat.kind === "SpecialistRecruited") &&
    beat.recruit === "workflow_investigator" &&
    !input.recruited.has("workflow_investigator")
  ) {
    const hostKey = pools.internal.roomHost?.apiKey ?? getBandRoomHostApiKey();
    await recruitSpecialistToRoom({
      roomId,
      hostApiKey: hostKey,
      pools,
      recruit: "workflow_investigator",
    });
    input.recruited.add("workflow_investigator");
  }

  if (isLocalBandRoom(roomId)) {
    return {
      post: {
        id: crypto.randomUUID(),
        content: beat.line,
        metadata: payload,
      },
      roomId,
    };
  }

  const poster = await resolveBeatPoster(beat, pools);

  const post = await postEarnedBeatToVisibleChat({
    roomId,
    beat,
    poster,
    metadata: payload,
    recruited: input.recruited,
    quietMentionTargets: {
      backendWitnessId: pools.cause.backend_witness.profile.id,
      claimTracerId: pools.cause.claim_tracer.profile.id,
    },
    fallbacks: pools.internal.roomHost ? [] : undefined,
  });

  return { post, roomId };
}
