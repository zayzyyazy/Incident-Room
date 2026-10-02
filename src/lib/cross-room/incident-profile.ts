/** Frozen demo paths for scripted Klaus/Marta/Stefan replays; live = evidence-driven. */
export type FrozenDemoPath = "klaus" | "marta" | "stefan" | "live";

const FROZEN_INCIDENT_IDS = {
  klaus: "PMB-2024-0847",
  marta: "REV-2026-001",
  stefan: "SYN-2026-0615-stefan",
} as const;

export function resolveFrozenDemoPath(incidentId: string): FrozenDemoPath {
  if (incidentId === FROZEN_INCIDENT_IDS.marta) {
    return "marta";
  }
  if (incidentId === FROZEN_INCIDENT_IDS.stefan) {
    return "stefan";
  }
  if (incidentId === FROZEN_INCIDENT_IDS.klaus) {
    return "klaus";
  }
  return "live";
}

export function isFrozenDemoPath(path: FrozenDemoPath): path is "klaus" | "marta" | "stefan" {
  return path !== "live";
}

/** @deprecated Use resolveFrozenDemoPath */
export type CrossRoomDemoMode =
  | "klaus_defense"
  | "defense_only"
  | "revision_required";

/** @deprecated Use resolveFrozenDemoPath */
export function resolveCrossRoomDemoMode(incidentId: string): CrossRoomDemoMode {
  const path = resolveFrozenDemoPath(incidentId);
  if (path === "marta") return "revision_required";
  if (path === "stefan") return "defense_only";
  return "klaus_defense";
}

export const FROZEN_DEMO_PATHS = {
  klaus: {
    incident_id: "PMB-2024-0847",
    cause_class: "premature_confirmation_after_failed_execution",
    mechanism: "confirmation_before_backend_success",
    surface: "Anliegenaufnahme + Email",
    cross_room_outcome: "DEFEND" as const,
    localization_verdict: "ACCEPTED" as const,
  },
  marta: {
    incident_id: "REV-2026-001",
    initial_cause_class: "premature_confirmation_after_failed_execution",
    revised_cause_class: "confirmation_without_tool_execution",
    mechanism: "success_confirmation_on_unreachable_tool_path",
    surface: "Intent Router · cancel_subscription",
    cross_room_outcome: "REVISE" as const,
    localization_verdict: "REJECTED" as const,
  },
  stefan: {
    incident_id: "SYN-2026-0615-stefan",
    cross_room_outcome: "INSUFFICIENT_EVIDENCE" as const,
    localization_verdict: "INSUFFICIENT" as const,
    cause_finding_status: "OPEN" as const,
  },
} as const;
