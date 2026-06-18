import { NextResponse } from "next/server";
import { resolveCrmForEvidence } from "@/lib/crm/lookup";
import { getIncident } from "@/lib/incidents/store";

type RouteParams = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  const incident = getIncident(params.id);

  if (!incident) {
    return NextResponse.json(
      { ok: false, error: "Incident not found" },
      { status: 404 },
    );
  }

  const crm = resolveCrmForEvidence(incident.evidence);

  return NextResponse.json({
    ok: true,
    incident,
    crmPreview: crm.lookup,
    crmLinkPreview: crm.link,
  });
}
