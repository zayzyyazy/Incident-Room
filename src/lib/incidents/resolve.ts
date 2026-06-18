import { getFailureIncident } from "@/lib/incidents/failures";
import { cacheIncidentRecord, getIncident } from "@/lib/incidents/store";

export async function getIncidentForRequest(id: string) {
  const existing = getIncident(id);
  if (existing) {
    return existing;
  }

  const failure = await getFailureIncident(id);
  return failure ? cacheIncidentRecord(failure) : undefined;
}
