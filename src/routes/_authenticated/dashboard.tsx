import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, CheckCircle2, XCircle, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, roles } = useAuth();
  const isHR = roles.includes("hr_officer") || roles.includes("system_admin");

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("full_name, leave_balance, employee_code, department_id, status")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["hr-stats"],
    enabled: isHR,
    queryFn: async () => {
      const [{ count: total }, { data: depts }] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("departments").select("id, name"),
      ]);
      return { totalEmployees: total ?? 0, departments: depts?.length ?? 0 };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {meLoading ? <Skeleton className="h-8 w-64" /> : `Welcome, ${me?.full_name?.split(" ")[0] ?? "Employee"}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's an overview of your leave and pending activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Leave balance"
          value={me?.leave_balance != null ? `${me.leave_balance} days` : "—"}
          hint="Annual leave remaining"
          tone="primary"
        />
        <StatCard icon={Clock} label="Pending requests" value="0" hint="Awaiting approval" tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value="0" hint="This year" tone="success" />
        <StatCard icon={XCircle} label="Rejected" value="0" hint="This year" tone="destructive" />
      </div>

      {isHR && (
        <>
          <h2 className="pt-2 text-lg font-semibold">HR overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total employees" value={String(stats?.totalEmployees ?? "—")} hint="All statuses" tone="info" />
            <StatCard icon={CalendarDays} label="On leave today" value="0" hint="Approved & active" tone="primary" />
            <StatCard icon={Clock} label="Pending approvals" value="0" hint="All departments" tone="warning" />
            <StatCard icon={TrendingUp} label="Departments" value={String(stats?.departments ?? "—")} hint="Active" tone="success" />
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Phase 1 is live.</strong> Authentication, role-based access,
            employee profiles, departments, sections, and leave-type catalogue are all wired up with row-level security.
          </p>
          <p>
            The leave-request workflow, approval chain, calendar, and reporting exports are queued as the next builds.
            Head to <span className="font-medium text-foreground">My profile</span> to complete your details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const toneMap = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof toneMap;
}) {
  return (
    <Card className="shadow-soft transition hover:shadow-elevated">
      <CardContent className="flex items-start gap-4 pt-6">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}
