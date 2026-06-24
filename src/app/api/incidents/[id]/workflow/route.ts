import { NextResponse } from "next/server";
import { getIncidentForRequest } from "@/lib/incidents/resolve";
import { loadLeapingAgentSlice } from "@/lib/localization-room/load-artifact";
import { buildKlausDemoGraph } from "@/lib/workflow/klaus-demo-graph";

type RouteParams = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  const incident = await getIncidentForRequest(params.id);
  if (!incident) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  try {
    const slice = loadLeapingAgentSlice("pflegemittelbox-klaus-slice");
    const graph = buildKlausDemoGraph(slice);
    return NextResponse.json({ ok: true, graph });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load workflow";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
