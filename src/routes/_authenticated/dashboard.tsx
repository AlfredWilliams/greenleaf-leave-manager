import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, CheckCircle2, XCircle, Users, TrendingUp, Plus, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { formatDate } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, hasAnyRole } = useAuth();
  const isHR = hasAnyRole(["hr_officer", "system_admin"]);
  const isApprover = hasAnyRole(["supervisor", "dept_head", "hr_officer", "system_admin"]);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (await supabase.from("employees").select("full_name, leave_balance, employee_code, department_id, status").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: myStats } = useQuery({
    queryKey: ["my-leave-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("status").eq("employee_id", user!.id);
      const s = { pending: 0, approved: 0, rejected: 0 };
      (data ?? []).forEach((r) => {
        if (["pending_supervisor", "pending_dept_head", "pending_hr"].includes(r.status)) s.pending++;
        else if (r.status === "approved") s.approved++;
        else if (r.status === "rejected") s.rejected++;
      });
      return s;
    },
  });

  const { data: myRecent } = useQuery({
    queryKey: ["my-recent", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, status, working_days, leave_types(name)")
        .eq("employee_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5)).data ?? [],
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["pending-count", user?.id],
    enabled: !!user?.id && isApprover,
    queryFn: async () => {
      const { count } = await supabase
        .from("leave_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending_supervisor", "pending_dept_head", "pending_hr"]);
      return count ?? 0;
    },
  });

  const { data: hrStats } = useQuery({
    queryKey: ["hr-stats"],
    enabled: isHR,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: total }, { data: depts }, { count: onLeave }, { data: pending }] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("departments").select("id"),
        supabase.from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved")
          .lte("start_date", today)
          .gte("end_date", today),
        supabase.from("leave_requests")
          .select("id, start_date, end_date, status, employee:employees!leave_requests_employee_id_fkey(full_name), leave_types(name)")
          .in("status", ["pending_supervisor", "pending_dept_head", "pending_hr"])
          .order("submitted_at", { ascending: false })
          .limit(5),
      ]);
      return {
        totalEmployees: total ?? 0,
        departments: depts?.length ?? 0,
        onLeaveToday: onLeave ?? 0,
        recentPending: pending ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {meLoading ? <Skeleton className="h-8 w-64" /> : `Welcome, ${me?.full_name?.split(" ")[0] ?? "Employee"}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's an overview of your leave and pending activity.</p>
        </div>
        <Button asChild><Link to="/leave-requests/new"><Plus className="mr-2 h-4 w-4" /> New Request</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Leave balance" value={me?.leave_balance != null ? `${me.leave_balance} days` : "—"} hint="Annual leave remaining" tone="primary" />
        <StatCard icon={Clock} label="Pending" value={String(myStats?.pending ?? 0)} hint="Awaiting approval" tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(myStats?.approved ?? 0)} hint="All time" tone="success" />
        <StatCard icon={XCircle} label="Rejected" value={String(myStats?.rejected ?? 0)} hint="All time" tone="destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent requests</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/leave-requests">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(myRecent ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              myRecent!.map((r: any) => (
                <Link key={r.id} to="/leave-requests/$id" params={{ id: r.id }} className="flex items-center justify-between rounded-md border p-3 hover:border-primary/40">
                  <div>
                    <p className="text-sm font-medium">{r.leave_types?.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.start_date)} → {formatDate(r.end_date)} · {r.working_days}d</p>
                  </div>
                  <LeaveStatusBadge status={r.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {isApprover && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Approvals inbox</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link to="/approvals">Open inbox</Link></Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-md border p-4">
                <Inbox className="h-10 w-10 text-primary" />
                <div>
                  <p className="text-2xl font-semibold">{pendingCount ?? 0}</p>
                  <p className="text-sm text-muted-foreground">requests need review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {isHR && (
        <>
          <h2 className="pt-2 text-lg font-semibold">HR overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total employees" value={String(hrStats?.totalEmployees ?? "—")} hint="All statuses" tone="info" />
            <StatCard icon={CalendarDays} label="On leave today" value={String(hrStats?.onLeaveToday ?? 0)} hint="Approved & active" tone="primary" />
            <StatCard icon={Clock} label="Pending approvals" value={String(pendingCount ?? 0)} hint="All departments" tone="warning" />
            <StatCard icon={TrendingUp} label="Departments" value={String(hrStats?.departments ?? "—")} hint="Active" tone="success" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Latest pending requests</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link to="/approvals">Open inbox</Link></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(hrStats?.recentPending ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No pending requests.</p>
              ) : (
                hrStats!.recentPending.map((r: any) => (
                  <Link key={r.id} to="/leave-requests/$id" params={{ id: r.id }} className="flex items-center justify-between rounded-md border p-3 hover:border-primary/40">
                    <div>
                      <p className="text-sm font-medium">{r.employee?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.leave_types?.name} · {formatDate(r.start_date)} → {formatDate(r.end_date)}</p>
                    </div>
                    <LeaveStatusBadge status={r.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, hint, tone,
}: {
  icon: any; label: string; value: string; hint: string;
  tone: "primary" | "warning" | "success" | "destructive" | "info";
}) {
  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600",
    success: "bg-emerald-500/10 text-emerald-600",
    destructive: "bg-red-500/10 text-red-600",
    info: "bg-blue-500/10 text-blue-600",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
