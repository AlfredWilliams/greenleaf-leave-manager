import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/leave-requests")({
  component: () => (
    <ComingSoon
      title="My leave requests"
      phase="Phase 2"
      description="Submit new leave requests, view your history, and download approval documents. The 4-step Supervisor → Department Head → HR approval chain and working-day calculation (excluding weekends & Ghana holidays) land in Phase 2."
    />
  ),
});
