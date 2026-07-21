import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/access-denied")({
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-elevated">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have a role assigned yet. Please contact your system administrator or HR to be granted access.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            Sign out
          </Button>
          <Button onClick={() => navigate({ to: "/" })}>Home</Button>
        </div>
      </div>
    </div>
  );
}
