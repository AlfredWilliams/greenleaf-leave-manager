import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <ComingSoon
      title="System settings"
      phase="Phase 3"
      description="System Administrators will manage public holidays, promote user roles, view audit logs, and configure the approval workflow here."
    />
  ),
});
