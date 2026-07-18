import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: () => (
    <ComingSoon
      title="Approvals inbox"
      phase="Phase 2"
      description="Supervisors, Department Heads and HR will review pending leave requests, approve or reject with comments, and see the full audit trail here."
    />
  ),
});
