/** Hackathon submission demo path — hero Retell + Klaus backup. */
export const DEMO_SUBMISSION_INCIDENT_IDS = [
  "retell_call_clinic_44102",
  "PMB-2026-0617-elena-pause-confusion",
  "PMB-2024-0847",
] as const;

export type DemoSubmissionIncidentId =
  (typeof DEMO_SUBMISSION_INCIDENT_IDS)[number];

export function isDemoSubmissionIncident(id: string): boolean {
  return (DEMO_SUBMISSION_INCIDENT_IDS as readonly string[]).includes(id);
}
