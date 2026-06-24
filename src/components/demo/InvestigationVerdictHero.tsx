"use client";

import { IncidentReportView } from "@/lib/demo/investigation-verdict-view";
import { IncidentReportHero } from "@/components/demo/IncidentReportHero";

/** @deprecated Use IncidentReportHero — kept for legacy import sites */
export function InvestigationVerdictHero({
  verdict,
  bandCustomerRoomUrl,
  bandReconciliationRoomUrl,
}: {
  verdict: IncidentReportView;
  bandCustomerRoomUrl?: string;
  bandSystemRoomUrl?: string;
  bandReconciliationRoomUrl?: string;
}) {
  return (
    <IncidentReportHero
      report={verdict}
      bandRoomUrl={bandCustomerRoomUrl ?? bandReconciliationRoomUrl}
    />
  );
}
