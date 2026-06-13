import { NextResponse } from "next/server";
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

  return NextResponse.json({ ok: true, incident });
}
