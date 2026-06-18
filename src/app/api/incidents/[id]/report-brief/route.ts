import { getIncident } from "@/lib/incidents/store";
import { buildPdfBriefForInvestigation } from "@/lib/report/build-pdf-brief";

type RouteParams = { params: { id: string } };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteParams) {
  const incident = getIncident(params.id);
  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  const run = incident.investigations.filter((r) => r.status === "complete").at(-1);
  const brief = await buildPdfBriefForInvestigation({
    evidence: incident.evidence,
    run,
  });

  return Response.json(brief, {
    headers: { "Cache-Control": "no-store" },
  });
}
