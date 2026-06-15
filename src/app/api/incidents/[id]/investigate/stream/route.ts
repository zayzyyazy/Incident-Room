import { resolveCrmForEvidence } from "@/lib/crm/lookup";
import { InvestigationStep, demoStepPaceMs } from "@/lib/demo/investigation-steps";
import {
  completeInvestigation,
  failInvestigation,
  getIncident,
  startInvestigation,
} from "@/lib/incidents/store";
import { runFullIncidentInvestigation } from "@/lib/orchestrator/run-full-incident-investigation";
import { runRealityCollisionInvestigation } from "@/lib/orchestrator/run-reality-collision-investigation";
import { shouldUseTheoryInvestigation } from "@/lib/reality/types";
import { routeEvidence } from "@/lib/normalizer/route-evidence";
import { buildReconciledIncidentReport } from "@/lib/normalizer/build-reconciled-report";
import { loadLeapingAgentSlice } from "@/lib/localization-room/load-artifact";

type RouteParams = { params: { id: string } };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteParams) {
  const incident = getIncident(params.id);

  if (!incident) {
    return new Response("Incident not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const run = startInvestigation(params.id);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      };

      try {
        send({ type: "started", runId: run.id, incidentId: params.id });

        const crm = resolveCrmForEvidence(incident.evidence);
        const stepTimeline: InvestigationStep[] = [];

        if (shouldUseTheoryInvestigation(incident.evidence.incident_id, incident.evidence)) {
          const result = await runRealityCollisionInvestigation(incident.evidence, {
            onStep: async (step: InvestigationStep) => {
              stepTimeline.push(step);
              send({ type: "step", step });
              await new Promise((r) => setTimeout(r, demoStepPaceMs(step)));
            },
          });

          const completed = completeInvestigation(params.id, run.id, {
            pipeline: "reality_collision",
            roomId: result.investigationRoomId,
            localizationRoomId: result.investigationRoomId,
            distinctBandAgents: result.distinctBandAgents,
            bandMessageIds: result.bandMessageIds,
            stepTimeline,
            realityCollision: result,
            crmLink: crm.link,
            crmLookup: crm.lookup,
          });

          send({
            type: "complete",
            run: completed,
            demoPath: "reality_collision",
            customerRealityRoomId: result.investigationRoomId,
            systemRealityRoomId: result.investigationRoomId,
            reconciliationRoomId: result.investigationRoomId,
          });
          return;
        }

        const result = await runFullIncidentInvestigation(incident.evidence, {
          onStep: async (step: InvestigationStep) => {
            stepTimeline.push(step);
            send({ type: "step", step });
            await new Promise((r) => setTimeout(r, demoStepPaceMs(step)));
          },
        });

        const causeRoom = {
          distinctBandAgents: result.cause.distinctBandAgents,
          bandMessageIds: result.cause.bandMessageIds,
          claimTracerInitial: result.cause.claimTracerInitial,
          backendWitnessInitial: result.cause.backendWitnessInitial,
          claimTracerChallenge1: result.cause.claimTracerChallenge1,
          backendWitnessChallenge1: result.cause.backendWitnessChallenge1,
          causalJudgeTask: result.cause.causalJudgeTask,
          causalJudgeBridge: result.cause.causalJudgeBridge,
          claimTracerChallenge2: result.cause.claimTracerChallenge2,
          backendWitnessChallenge2: result.cause.backendWitnessChallenge2,
          causalJudgeRefinement: result.cause.causalJudgeRefinement,
          causeFinding: result.cause.causeFinding,
          causeFindingArtifact: result.cause.causeFindingArtifact,
          revisionDecision: result.cause.revisionDecision,
          feedTimeline: result.cause.feedTimeline,
        };

        const localizationRoom = {
          distinctBandAgents: result.localization.distinctBandAgents,
          roomId: result.localization.roomId,
          causeRoomId: result.localization.causeRoomId,
          inputCauseFindingArtifact: result.localization.inputCauseFindingArtifact,
          phase: result.localization.phase,
          causeDefenseRequest: result.localization.causeDefenseRequest,
          causeDefenseDecision: result.localization.causeDefenseDecision,
          causeDefenseFeedTimeline: result.localization.causeDefenseFeedTimeline,
          localizationDefenseVerdict: result.localization.localizationDefenseVerdict,
          causeRevisionRequest: result.localization.causeRevisionRequest,
          arc: result.localization.arc,
          surfaceCandidates: result.localization.surfaceCandidates,
          localizationFinding: result.localization.localizationFinding,
          localizationFindingArtifact:
            result.localization.localizationFindingArtifact,
          investigationBreakthrough: result.localization.investigationBreakthrough,
          feedTimeline: result.localization.feedTimeline,
          bandMessageIds: result.localization.bandMessageIds,
        };

        const completed = completeInvestigation(params.id, run.id, {
          pipeline: "full",
          roomId: result.cause.roomId,
          localizationRoomId: result.localization.roomId,
          distinctBandAgents: result.cause.distinctBandAgents,
          distinctLocalizationAgents: result.localization.distinctBandAgents,
          bandMessageIds: result.cause.bandMessageIds,
          stepTimeline,
          causeRoom: causeRoom,
          localizationRoom,
          crmLink: crm.link,
          crmLookup: crm.lookup,
          realityCollision: {
            investigationRoomId: result.cause.roomId,
            customerRealityRoomId: result.cause.roomId,
            systemRealityRoomId: result.cause.roomId,
            reconciliationRoomId: result.localization.roomId,
            customerReality: {
              type: "CustomerRealityVerdict" as const,
              belief: "",
              promise_made: false,
              promise_type: "",
              evidence: [],
              confidence: "MEDIUM" as const,
            },
            systemReality: {
              type: "SystemRealityVerdict" as const,
              actual_state: "",
              side_effect_created: false,
              failed_or_missing_action: "",
              evidence: [],
              confidence: "MEDIUM" as const,
            },
            investigationVerdict: {
              type: "InvestigationVerdict" as const,
              finding: "",
              customer_reality: "",
              system_reality: "",
              architecture_reason: "",
              fix_target: "",
              where_to_fix: "",
            },
            incidentReport: buildReconciledIncidentReport({
              evidence: incident.evidence,
              routed: (() => {
                let artifact = null;
                try {
                  artifact = loadLeapingAgentSlice("pflegemittelbox-klaus-slice");
                } catch {
                  artifact = null;
                }
                return routeEvidence({
                  evidence: incident.evidence,
                  definitionArtifact: artifact,
                });
              })(),
              cause: causeRoom,
              localization: localizationRoom,
              steps: stepTimeline,
            }),
            conflicts: true,
            feedTimeline: [],
            bandMessageIds: {},
            distinctBandAgents: result.cause.distinctBandAgents,
          },
        });

        send({
          type: "complete",
          run: completed,
          demoPath: result.demoPath,
          causeRoomId: result.cause.roomId,
          localizationRoomId: result.localization.roomId,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Investigation failed";
        const failed = failInvestigation(params.id, run.id, message);
        send({ type: "error", error: message, run: failed });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
