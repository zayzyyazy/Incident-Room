import { resolveCrmForEvidence } from "@/lib/crm/lookup";
import { InvestigationStep, demoStepPaceMs } from "@/lib/demo/investigation-steps";
import {
  completeInvestigation,
  failInvestigation,
  getIncident,
  startInvestigation,
} from "@/lib/incidents/store";
import { runEarnedInvestigation } from "@/lib/orchestrator/run-earned-investigation";
import { runNoActionableReview, shouldSkipFullInvestigation } from "@/lib/orchestrator/run-no-actionable-review";
import {
  buildCustomerRealityVerdict,
  buildInvestigationVerdict,
  buildSystemRealityVerdict,
} from "@/lib/reality/build-verdicts";

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

        const skipAssessment = shouldSkipFullInvestigation(incident.evidence);
        if (skipAssessment) {
          const review = await runNoActionableReview({
            evidence: incident.evidence,
            assessment: skipAssessment,
            onStep: async (step: InvestigationStep) => {
              stepTimeline.push(step);
              send({ type: "step", step });
              await new Promise((r) => setTimeout(r, demoStepPaceMs(step)));
            },
          });

          const completed = completeInvestigation(params.id, run.id, {
            pipeline: "no_actionable",
            roomId: review.roomId,
            stepTimeline: review.steps,
            crmLink: crm.link,
            crmLookup: crm.lookup,
          });

          send({ type: "complete", run: completed, demoPath: "no_actionable" });
          return;
        }

        const earned = await runEarnedInvestigation(incident.evidence, {
          onStep: async (step: InvestigationStep) => {
            stepTimeline.push(step);
            send({ type: "step", step });
            await new Promise((r) => setTimeout(r, demoStepPaceMs(step)));
          },
        });

        const customerReality = buildCustomerRealityVerdict(incident.evidence);
        const systemReality = buildSystemRealityVerdict(incident.evidence);
        const investigationVerdict = buildInvestigationVerdict({
          evidence: incident.evidence,
          customer: customerReality,
          system: systemReality,
        });
        investigationVerdict.finding = earned.incidentReport.finding;
        investigationVerdict.architecture_reason = earned.explanation.primary;
        investigationVerdict.fix_target = earned.incidentReport.fix_target;
        investigationVerdict.where_to_fix =
          earned.incidentReport.fix_detail ?? earned.incidentReport.fix_target;

        const completed = completeInvestigation(params.id, run.id, {
          pipeline: "earned_investigation",
          roomId: earned.verdictRoomId,
          localizationRoomId: earned.explanationRoomId,
          distinctBandAgents: earned.distinctBandAgents,
          bandMessageIds: earned.bandMessageIds,
          stepTimeline,
          earnedInvestigation: earned,
          crmLink: crm.link,
          crmLookup: crm.lookup,
          realityCollision: {
            investigationRoomId: earned.verdictRoomId,
            customerRealityRoomId: earned.verdictRoomId,
            systemRealityRoomId: earned.verdictRoomId,
            reconciliationRoomId: earned.explanationRoomId,
            customerReality,
            systemReality,
            investigationVerdict,
            incidentReport: earned.incidentReport,
            conflicts: earned.verdict === "NOT_JUSTIFIED",
            feedTimeline: [],
            bandMessageIds: earned.bandMessageIds,
            distinctBandAgents: earned.distinctBandAgents,
          },
        });

        send({
          type: "complete",
          run: completed,
          demoPath: "earned_investigation",
          verdictRoomId: earned.verdictRoomId,
          explanationRoomId: earned.explanationRoomId,
          normalizerRoomId: earned.normalizerRoomId,
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
