import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <ComingSoon
      title="Reports"
      phase="Phase 3"
      description="Export leave utilisation by department, staff on leave, balance summaries, and audit reports as PDF or Excel. Full analytics dashboard with charts is included."
    />
  ),
});
