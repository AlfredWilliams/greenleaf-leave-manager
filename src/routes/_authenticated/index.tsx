import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Signed-in users hitting `/` land here — send them to the right dashboard based on role. */
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.user.id);
    const list = (roles ?? []).map((r: any) => r.role);
    if (list.length === 0) throw redirect({ to: "/access-denied" });
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
