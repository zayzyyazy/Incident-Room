import { createRoom, getRoomHistory } from "@/lib/band/client";
import {
  localizationAgentsAreDistinct,
  postLocalizationRoomEvent,
  resolveLocalizationRoomAgents,
  setupLocalizationRoomParticipants,
} from "@/lib/band/localization-multi-agent";
import { bandRoomTitle } from "@/lib/band/room-titles";
import {
  CauseFindingArtifact,
  CauseRevisionRequest,
  toLocalizationFindingArtifact,
} from "@/lib/cross-room/artifacts";
import {
  buildKlausCauseDefenseRequest,
  buildStefanCauseDefenseRequest,
  CauseDefenseDecision,
  CauseDefenseRequest,
} from "@/lib/cross-room/cause-defense";
import { runCauseRoomDefenseCycle } from "@/lib/cross-room/post-cause-defense";
import { buildRevisionCauseRevisionRequest } from "@/lib/cross-room/cause-revision";
import {
  assertMayProceedAfterDefense,
  buildLocalizationDefenseVerdict,
  LocalizationDefenseVerdict,
} from "@/lib/cross-room/localization-defense-verdict";
import { resolveFrozenDemoPath } from "@/lib/cross-room/incident-profile";
import {
  attachBandMessageIds,
  assertBreakthroughAllowed,
  selectLocalizationArcBuilder,
} from "@/lib/localization-room/collaboration";
import { buildEvidenceCauseDefenseRequest } from "@/lib/localization-room/collaboration-evidence";
import { analyzeEvidenceForLocalization } from "@/lib/localization-room/evidence-analysis";
import { buildRevisionPostRevisionArc } from "@/lib/localization-room/collaboration-revision";
import { loadRuntimeToolAliases } from "@/lib/localization-room/load-artifact";
import {
  InvestigationBreakthrough,
  LocalizationFinding,
  LocalizationInvestigationArc,
  SurfaceCandidate,
} from "@/lib/localization-room/types";
import { VoiceIncidentEvidence } from "@/lib/evidence/types";
import { CauseRoomFeedEntry } from "@/lib/cause-room/types";
import {
  createStepSink,
  InvestigationStep,
  stepFromFeedEntry,
} from "@/lib/demo/investigation-steps";

export type LocalizationFeedEntry = {
  agentId: string;
  messageId: string;
  bandEventKind: string;
  content: string;
  payload?: unknown;
};

export type LocalizationRoomInvestigationResult = {
  roomId: string;
  causeRoomId: string;
  distinctBandAgents: boolean;
  inputCauseFindingArtifact: CauseFindingArtifact;
  phase: "initial" | "post_revision";
  causeDefenseRequest?: CauseDefenseRequest;
  causeDefenseDecision?: CauseDefenseDecision;
  causeDefenseFeedTimeline?: CauseRoomFeedEntry[];
  localizationDefenseVerdict?: LocalizationDefenseVerdict;
  causeRevisionRequest?: CauseRevisionRequest;
  pendingCauseRevision?: boolean;
  arc: LocalizationInvestigationArc;
  investigationBreakthrough?: InvestigationBreakthrough;
  surfaceCandidates: SurfaceCandidate[];
  localizationFinding?: LocalizationFinding;
  localizationFindingArtifact?: ReturnType<typeof toLocalizationFindingArtifact>;
  feedTimeline: LocalizationFeedEntry[];
  bandMessageIds: Record<string, string>;
  history: Awaited<ReturnType<typeof getRoomHistory>>;
};

async function recordFeed(
  timeline: LocalizationFeedEntry[],
  entry: Omit<LocalizationFeedEntry, "content"> & { content?: string },
  stepSink?: ReturnType<typeof createStepSink>,
): Promise<void> {
  const row = { ...entry, content: entry.content ?? "" };
  timeline.push(row);
  if (stepSink) {
    const step = stepFromFeedEntry({
      room: "localization",
      agentId: row.agentId,
      messageId: row.messageId,
      bandEventKind: row.bandEventKind,
      content: row.content,
      payload: row.payload,
    });
    if (step) await stepSink.push(step);
  }
}

export async function runLocalizationRoomInvestigation(input: {
  evidence: VoiceIncidentEvidence;
  causeRoomId: string;
  causeFindingArtifact: CauseFindingArtifact;
  causeFindingArtifactMessageId?: string;
  phase?: "initial" | "post_revision";
  onStep?: (step: InvestigationStep) => void | Promise<void>;
}): Promise<LocalizationRoomInvestigationResult> {
  const phase = input.phase ?? "initial";
  const stepSink = createStepSink(input.onStep);
  const emit = async (
    timeline: LocalizationFeedEntry[],
    entry: Parameters<typeof recordFeed>[1],
  ) => recordFeed(timeline, entry, stepSink);
  const demoPath = resolveFrozenDemoPath(input.evidence.incident_id);
  const evidenceProfile =
    demoPath === "live"
      ? analyzeEvidenceForLocalization(input.evidence)
      : undefined;
  const agents = await resolveLocalizationRoomAgents();
  const distinctBandAgents = localizationAgentsAreDistinct(agents);

  const roomCreatorKey = distinctBandAgents
    ? agents.control_flow_investigator.apiKey
    : process.env.BAND_API_KEY!;

  const room = await createRoom({
    title: bandRoomTitle(input.evidence, "Localization Room"),
    apiKey: roomCreatorKey,
  });

  await setupLocalizationRoomParticipants(room.id, roomCreatorKey, agents);

  const aliasManifest =
    demoPath === "live"
      ? {
          platform: "leaping" as const,
          artifact: "runtime-trace",
          aliases: Object.fromEntries(
            input.evidence.layer2_execution.function_calls.map((call) => [
              call.name,
              call.name,
            ]),
          ),
        }
      : (loadRuntimeToolAliases(input.evidence.incident_id) ??
        ({
          platform: "leaping",
          artifact: "pflegemittelbox-klaus-slice",
          aliases: {
            lookup_customer: "get_customer_by_insurance_number",
            create_callback_appointment: "send_email",
          },
        } as const));

  let arc: LocalizationInvestigationArc =
    phase === "post_revision"
      ? buildRevisionPostRevisionArc({ causeArtifact: input.causeFindingArtifact })
      : selectLocalizationArcBuilder(input.evidence.incident_id)({
          evidence: input.evidence,
          causeArtifact: input.causeFindingArtifact,
          runtimeToolAliases: aliasManifest.aliases,
        });

  const feedTimeline: LocalizationFeedEntry[] = [];
  const bandMessageIds: Record<string, string> = {};
  const attackIds: string[] = [];
  const yieldIds: string[] = [];

  let causeDefenseRequest: CauseDefenseRequest | undefined;
  let causeDefenseDecision: CauseDefenseDecision | undefined;
  let causeDefenseFeedTimeline: CauseRoomFeedEntry[] | undefined;
  let causeRevisionRequest: CauseRevisionRequest | undefined;

  let localizationDefenseVerdict: LocalizationDefenseVerdict | undefined;

  const intakePost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: "localization_judge",
    agents,
    messageType: "task",
    content: `CauseFinding bound · ${input.causeFindingArtifact.cause_class}`,
    metadata: {
      type: "CauseFinding",
      artifact: input.causeFindingArtifact,
      source_cause_room_id: input.causeRoomId,
    },
  });
  bandMessageIds.causeFindingIntake = intakePost.id;
  await emit(feedTimeline, {
    agentId: "localization_judge",
    messageId: intakePost.id,
    bandEventKind: "task",
    content: intakePost.content,
    payload: input.causeFindingArtifact,
  });

  const artifactMessageId =
    input.causeFindingArtifactMessageId ?? intakePost.id;

  if (phase === "initial" && demoPath !== "marta") {
    causeDefenseRequest =
      demoPath === "live" && evidenceProfile
        ? buildEvidenceCauseDefenseRequest({
            profile: evidenceProfile,
            causeArtifact: input.causeFindingArtifact,
            causeFindingArtifactMessageId: artifactMessageId,
          })
        : demoPath === "stefan"
          ? buildStefanCauseDefenseRequest({
              causeArtifact: input.causeFindingArtifact,
              causeFindingArtifactMessageId: artifactMessageId,
            })
          : buildKlausCauseDefenseRequest({
              causeArtifact: input.causeFindingArtifact,
              causeFindingArtifactMessageId: artifactMessageId,
            });

    const defenseRequestPost = await postLocalizationRoomEvent({
      roomId: room.id,
      role: "control_flow_investigator",
      agents,
      messageType: "thought",
      content: causeDefenseRequest.challenge,
      metadata: {
        type: "CauseDefenseRequest",
        artifact: causeDefenseRequest,
      },
    });
    bandMessageIds.causeDefenseRequest = defenseRequestPost.id;
    await emit(feedTimeline, {
      agentId: "control_flow_investigator",
      messageId: defenseRequestPost.id,
      bandEventKind: "thought",
      content: defenseRequestPost.content,
      payload: causeDefenseRequest,
    });

    const defenseResult = await runCauseRoomDefenseCycle({
      causeRoomId: input.causeRoomId,
      causeArtifact: input.causeFindingArtifact,
      defenseRequest: causeDefenseRequest,
      defenseRequestMessageId: defenseRequestPost.id,
      evidence: demoPath === "live" ? input.evidence : undefined,
    });
    causeDefenseDecision = defenseResult.decision;
    causeDefenseFeedTimeline = defenseResult.feedTimeline;
    bandMessageIds.causeDefenseDecision = defenseResult.decisionMessageId;

    for (const entry of defenseResult.feedTimeline) {
      const step = stepFromFeedEntry({
        room: "cause",
        agentId: entry.agentId,
        messageId: entry.messageId,
        bandEventKind: entry.bandEventKind,
        content: entry.content,
        payload: entry.payload,
      });
      if (step && stepSink) await stepSink.push(step);
    }

    localizationDefenseVerdict = buildLocalizationDefenseVerdict({
      path: demoPath,
      defenseDecision: causeDefenseDecision,
      defenseDecisionMessageId: defenseResult.decisionMessageId,
      profile: evidenceProfile,
    });

    assertMayProceedAfterDefense({
      defenseDecision: causeDefenseDecision,
      verdict: localizationDefenseVerdict,
    });

    const verdictPost = await postLocalizationRoomEvent({
      roomId: room.id,
      role: "guard_investigator",
      agents,
      messageType: "task",
      content: `Defense ${localizationDefenseVerdict.verdict} · ${localizationDefenseVerdict.cause_finding_status}`,
      metadata: {
        type: "LocalizationDefenseVerdict",
        artifact: localizationDefenseVerdict,
      },
    });
    bandMessageIds.localizationDefenseVerdict = verdictPost.id;
    await emit(feedTimeline, {
      agentId: "guard_investigator",
      messageId: verdictPost.id,
      bandEventKind: "task",
      content: verdictPost.content,
      payload: localizationDefenseVerdict,
    });
  }

  if (phase === "post_revision") {
    localizationDefenseVerdict = {
      type: "LocalizationDefenseVerdict",
      verdict: "ACCEPTED",
      rationale_en:
        "Revised cause survives implementation scrutiny — confirmation_without_tool_execution sustained.",
      cause_finding_status: "SUSTAINED",
      cites_cause_defense_decision_id:
        bandMessageIds.causeDefenseDecision ?? intakePost.id,
      incident_id: input.evidence.incident_id,
    };
    const revisedVerdictPost = await postLocalizationRoomEvent({
      roomId: room.id,
      role: "guard_investigator",
      agents,
      messageType: "task",
      content: "Defense ACCEPTED · revised CauseFinding sustained.",
      metadata: {
        type: "LocalizationDefenseVerdict",
        artifact: localizationDefenseVerdict,
      },
    });
    bandMessageIds.localizationDefenseVerdict = revisedVerdictPost.id;
    await emit(feedTimeline, {
      agentId: "guard_investigator",
      messageId: revisedVerdictPost.id,
      bandEventKind: "task",
      content: revisedVerdictPost.content,
      payload: localizationDefenseVerdict,
    });
  }

  const openingPost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: "control_flow_investigator",
    agents,
    messageType: "thought",
    content: arc.opening.claim_en.split(".")[0] + ".",
    metadata: { type: "surface_opening", payload: arc.opening },
  });
  bandMessageIds.controlFlowOpening = openingPost.id;
  await emit(feedTimeline, {
    agentId: "control_flow_investigator",
    messageId: openingPost.id,
    bandEventKind: "thought",
    content: openingPost.content,
    payload: arc.opening,
  });

  for (let i = 0; i < arc.attacks.length; i++) {
    const attackPayload = {
      ...arc.attacks[i],
      cites_band_message_id:
        i === 0 ? openingPost.id : (attackIds[i - 1] ?? openingPost.id),
    };
    const role = attackPayload.attacker_role;
    const attackPost = await postLocalizationRoomEvent({
      roomId: room.id,
      role,
      agents,
      messageType: "thought",
      content: attackPayload.claim_en.split(".")[0] + ".",
      metadata: { type: "surface_attack", payload: attackPayload },
    });
    bandMessageIds[`attack${i}`] = attackPost.id;
    attackIds.push(attackPost.id);
    await emit(feedTimeline, {
      agentId: role,
      messageId: attackPost.id,
      bandEventKind: "thought",
      content: attackPost.content,
      payload: attackPayload,
    });
  }

  const lastAttackId = attackIds[attackIds.length - 1] ?? openingPost.id;
  const counterattack = {
    ...arc.counterattack,
    cites_band_message_id: lastAttackId,
  };
  const counterattackPost =
    arc.attacks.length > 0 || phase === "initial"
      ? await postLocalizationRoomEvent({
          roomId: room.id,
          role: "control_flow_investigator",
          agents,
          messageType: "thought",
          content:
            phase === "post_revision"
              ? "Restart with revised cause."
              : counterattack.claim_en.split(".")[0] + ".",
          metadata: { type: "surface_counterattack", payload: counterattack },
        })
      : null;
  const counterattackId = counterattackPost?.id ?? openingPost.id;
  if (counterattackPost) {
    bandMessageIds.counterattack = counterattackPost.id;
    await emit(feedTimeline, {
      agentId: "control_flow_investigator",
      messageId: counterattackPost.id,
      bandEventKind: "thought",
      content: counterattackPost.content,
      payload: counterattack,
    });
  }

  const admission = {
    ...arc.investigatorAdmission,
    cites_band_message_id: counterattackId,
  };
  const admissionPost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: admission.investigator_role,
    agents,
    messageType: "thought",
    content: admission.admission_en.split(".")[0] + ".",
    metadata: { type: "investigator_admission", payload: admission },
  });
  bandMessageIds.investigatorAdmission = admissionPost.id;
  await emit(feedTimeline, {
    agentId: admission.investigator_role,
    messageId: admissionPost.id,
    bandEventKind: "thought",
    content: admissionPost.content,
    payload: admission,
  });

  if (arc.pendingCauseRevision && phase === "initial") {
    causeRevisionRequest = buildRevisionCauseRevisionRequest({
      incidentId: input.evidence.incident_id,
      currentCauseClass: input.causeFindingArtifact.cause_class,
      localizationMessageIds: [
        openingPost.id,
        ...attackIds,
        counterattackId,
        admissionPost.id,
      ],
    });

    const revisionRequestPost = await postLocalizationRoomEvent({
      roomId: room.id,
      role: "control_flow_investigator",
      agents,
      messageType: "task",
      content:
        "@CausalJudge Which runtime evidence requires a cancellation attempt? I cannot find a reachable path to cancel_subscription. Challenge: cancellation failure impossible — cancel_subscription is unreachable on this routed branch.",
      metadata: {
        type: "CauseRevisionRequest",
        artifact: causeRevisionRequest,
      },
    });
    bandMessageIds.causeRevisionRequest = revisionRequestPost.id;
    await emit(feedTimeline, {
      agentId: "control_flow_investigator",
      messageId: revisionRequestPost.id,
      bandEventKind: "task",
      content: revisionRequestPost.content,
      payload: causeRevisionRequest,
    });

    const history = await getRoomHistory(room.id);
    return {
      roomId: room.id,
      causeRoomId: input.causeRoomId,
      distinctBandAgents,
      inputCauseFindingArtifact: input.causeFindingArtifact,
      phase,
      causeRevisionRequest,
      pendingCauseRevision: true,
      arc,
      surfaceCandidates: arc.surfaceCandidates,
      feedTimeline,
      bandMessageIds,
      history,
    };
  }

  assertBreakthroughAllowed({ admissionMessageId: admissionPost.id });

  const discoveryPost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: arc.mechanismDiscovery.discovered_by,
    agents,
    messageType: "task",
    content: arc.mechanismDiscovery.discovery_en.split(".")[0] + ".",
    metadata: {
      type: "mechanism_discovery",
      payload: arc.mechanismDiscovery,
    },
  });
  bandMessageIds.mechanismDiscovery = discoveryPost.id;
  await emit(feedTimeline, {
    agentId: arc.mechanismDiscovery.discovered_by,
    messageId: discoveryPost.id,
    bandEventKind: "task",
    content: discoveryPost.content,
    payload: arc.mechanismDiscovery,
  });

  const breakthroughPost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: arc.investigationBreakthrough.discovered_by,
    agents,
    messageType: "task",
    content: `Breakthrough: ${arc.investigationBreakthrough.headline}`,
    metadata: {
      type: "InvestigationBreakthrough",
      artifact: arc.investigationBreakthrough,
    },
  });
  bandMessageIds.investigationBreakthrough = breakthroughPost.id;
  await emit(feedTimeline, {
    agentId: arc.investigationBreakthrough.discovered_by,
    messageId: breakthroughPost.id,
    bandEventKind: "task",
    content: breakthroughPost.content,
    payload: arc.investigationBreakthrough,
  });

  for (let i = 0; i < arc.investigatorYields.length; i++) {
    const yieldPayload = arc.investigatorYields[i];
    const role = yieldPayload.investigator_role;
    const yieldPost = await postLocalizationRoomEvent({
      roomId: room.id,
      role,
      agents,
      messageType: "thought",
      content: yieldPayload.yield_en.split(".")[0] + ".",
      metadata: {
        type: "investigator_yield",
        payload: {
          ...yieldPayload,
          cites_discovery_message_id: discoveryPost.id,
        },
      },
    });
    bandMessageIds[`yield${i}`] = yieldPost.id;
    yieldIds.push(yieldPost.id);
    await emit(feedTimeline, {
      agentId: role,
      messageId: yieldPost.id,
      bandEventKind: "thought",
      content: yieldPost.content,
      payload: {
        ...yieldPayload,
        cites_discovery_message_id: discoveryPost.id,
      },
    });
  }

  const confidenceChallenge = {
    ...arc.confidenceChallenge,
    cites_band_message_id: breakthroughPost.id,
  };
  const confidenceChallengePost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: confidenceChallenge.challenger_role,
    agents,
    messageType: "thought",
    content: confidenceChallenge.question_en,
    metadata: {
      type: "LocalizationConfidenceChallenge",
      artifact: confidenceChallenge,
    },
  });
  bandMessageIds.confidenceChallenge = confidenceChallengePost.id;
  await emit(feedTimeline, {
    agentId: confidenceChallenge.challenger_role,
    messageId: confidenceChallengePost.id,
    bandEventKind: "thought",
    content: confidenceChallengePost.content,
    payload: confidenceChallenge,
  });

  const confidenceDefense = {
    ...arc.confidenceDefense,
    cites_challenge_message_id: confidenceChallengePost.id,
  };
  const confidenceDefensePost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: confidenceDefense.defender_role,
    agents,
    messageType: "thought",
    content: confidenceDefense.claim_en.split(".")[0] + ".",
    metadata: {
      type: "surface_confidence_defense",
      payload: confidenceDefense,
    },
  });
  bandMessageIds.confidenceDefense = confidenceDefensePost.id;
  await emit(feedTimeline, {
    agentId: confidenceDefense.defender_role,
    messageId: confidenceDefensePost.id,
    bandEventKind: "thought",
    content: confidenceDefensePost.content,
    payload: confidenceDefense,
  });

  const formalizationPost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: "localization_judge",
    agents,
    messageType: "thought",
    content: "Formalize: mechanism survives challenge.",
    metadata: {
      type: "mechanism_formalization",
      payload: {
        ...arc.judgeFormalization,
        cites_discovery_message_id: discoveryPost.id,
      },
    },
  });
  bandMessageIds.mechanismFormalization = formalizationPost.id;
  await emit(feedTimeline, {
    agentId: "localization_judge",
    messageId: formalizationPost.id,
    bandEventKind: "thought",
    content: formalizationPost.content,
    payload: {
      ...arc.judgeFormalization,
      cites_discovery_message_id: discoveryPost.id,
    },
  });

  arc = attachBandMessageIds(arc, {
    opening: openingPost.id,
    attacks: attackIds,
    counterattack: counterattackId,
    admission: admissionPost.id,
    discovery: discoveryPost.id,
    yields: yieldIds,
    confidenceChallenge: confidenceChallengePost.id,
    confidenceDefense: confidenceDefensePost.id,
    formalization: formalizationPost.id,
    finding: formalizationPost.id,
  });
  arc.investigationBreakthrough.cites_band_message_ids.push(
    breakthroughPost.id,
  );

  const localizationFinding = arc.finding;
  localizationFinding.input_cause_finding_artifact_id = intakePost.id;

  const findingPost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: "localization_judge",
    agents,
    messageType: "task",
    content: `${localizationFinding.implementation_mechanism.canonical_id} → ${localizationFinding.primary_surface.pointer.native_label}`,
    metadata: { type: "localization_finding", payload: localizationFinding },
  });
  bandMessageIds.localizationFinding = findingPost.id;
  localizationFinding.cites_band_message_ids.push(findingPost.id);
  await emit(feedTimeline, {
    agentId: "localization_judge",
    messageId: findingPost.id,
    bandEventKind: "task",
    content: findingPost.content,
    payload: localizationFinding,
  });

  const localizationFindingArtifact = toLocalizationFindingArtifact({
    incidentId: input.evidence.incident_id,
    localizationRoomId: room.id,
    causeBandRoomId: input.causeRoomId,
    causeFindingArtifactMessageId: intakePost.id,
    finding: localizationFinding,
    breakthrough: arc.investigationBreakthrough,
  });

  const artifactPost = await postLocalizationRoomEvent({
    roomId: room.id,
    role: "localization_judge",
    agents,
    messageType: "task",
    content: `Artifact: ${localizationFinding.implementation_mechanism.canonical_id}`,
    metadata: {
      type: "LocalizationFinding",
      artifact: localizationFindingArtifact,
    },
  });
  bandMessageIds.localizationFindingArtifact = artifactPost.id;
  await emit(feedTimeline, {
    agentId: "localization_judge",
    messageId: artifactPost.id,
    bandEventKind: "task",
    content: artifactPost.content,
    payload: localizationFindingArtifact,
  });

  const history = await getRoomHistory(room.id);

  return {
    roomId: room.id,
    causeRoomId: input.causeRoomId,
    distinctBandAgents,
    inputCauseFindingArtifact: input.causeFindingArtifact,
    phase,
    causeDefenseRequest,
    causeDefenseDecision,
    causeDefenseFeedTimeline,
    localizationDefenseVerdict,
    arc,
    investigationBreakthrough: arc.investigationBreakthrough,
    surfaceCandidates: arc.surfaceCandidates,
    localizationFinding,
    localizationFindingArtifact,
    feedTimeline,
    bandMessageIds,
    history,
  };
}
