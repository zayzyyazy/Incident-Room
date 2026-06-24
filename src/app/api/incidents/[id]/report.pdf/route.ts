import { getIncidentForRequest } from "@/lib/incidents/resolve";
import { buildIncidentPdf } from "@/lib/report/build-incident-pdf";
import { buildPdfBriefForInvestigation } from "@/lib/report/build-pdf-brief";

type RouteParams = { params: { id: string } };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteParams) {
  const incident = await getIncidentForRequest(params.id);
  if (!incident) {
    return new Response("Incident not found", { status: 404 });
  }

  const run = incident.investigations.filter((r) => r.status === "complete").at(-1);
  const brief = await buildPdfBriefForInvestigation({
    evidence: incident.evidence,
    run,
  });

  const pdf = await buildIncidentPdf({
    evidence: incident.evidence,
    brief,
  });

  const filename = `${incident.id.replace(/[^a-zA-Z0-9_-]+/g, "_")}-report.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
