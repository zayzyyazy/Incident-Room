import { getFailureIncident } from "@/lib/incidents/failures";
import { getImportedIncident } from "@/lib/incidents/imported";
import { cacheIncidentRecord, getIncident } from "@/lib/incidents/store";

export async function getIncidentForRequest(id: string) {
  const existing = getIncident(id);
  if (existing) {
    return existing;
  }

  const failure = await getFailureIncident(id);
  if (failure) {
    return cacheIncidentRecord(failure);
  }

  const imported = await getImportedIncident(id);
  return imported ? cacheIncidentRecord(imported) : undefined;
}
