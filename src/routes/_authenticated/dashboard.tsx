import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays, Clock, CheckCircle2, XCircle, Users, TrendingUp, Plus, Inbox,
  Briefcase, UserCheck, UserX, Building2, ShieldCheck, Activity, Database,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { formatDate, formatDateTime, leaveTypeColor, monthLabel, PENDING_STATUSES, isoDate } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, hasAnyRole, roles } = useAuth();
  const isAdmin = hasAnyRole(["system_admin"]);
  const isHR = hasAnyRole(["hr_officer", "system_admin"]);
  const isDeptHead = hasAnyRole(["dept_head"]);
  const isSupervisor = hasAnyRole(["supervisor"]);
  const isApprover = hasAnyRole(["supervisor", "dept_head", "hr_officer", "system_admin"]);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me-dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (await supabase.from("employees").select("full_name, leave_balance, employee_code, department_id, status, employment_type").eq("id", user!.id).maybeSingle()).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {meLoading ? <Skeleton className="h-8 w-64" /> : `Welcome, ${me?.full_name?.split(" ")[0] ?? "Employee"}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "System administration overview." :
             isHR ? "HR overview across all departments." :
             isDeptHead ? "Department performance and approvals." :
             isSupervisor ? "Team leave and approvals." :
             "Your leave summary and recent activity."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/calendar"><CalendarDays className="mr-2 h-4 w-4" /> Calendar</Link></Button>
          <Button asChild><Link to="/leave-requests/new"><Plus className="mr-2 h-4 w-4" /> New Request</Link></Button>
        </div>
      </div>

      {/* Every role sees personal section */}
      <EmployeeSection me={me} />

      {isApprover && <ApproverSection isHR={isHR} isDeptHead={isDeptHead} isSupervisor={isSupervisor} deptId={me?.department_id ?? null} />}
      {isDeptHead && !isHR && <DeptHeadSection deptId={me?.department_id ?? null} />}
      {isHR && <HRSection />}
      {isAdmin && <AdminSection />}
    </div>
  );
}

function EmployeeSection({ me }: { me: any }) {
  const { user } = useAuth();

  const { data: myStats } = useQuery({
    queryKey: ["my-leave-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("status, working_days, leave_types(name)").eq("employee_id", user!.id);
      const s = { pending: 0, approved: 0, rejected: 0, byType: {} as Record<string, number> };
      (data ?? []).forEach((r: any) => {
        if (PENDING_STATUSES.includes(r.status)) s.pending++;
        else if (r.status === "approved") { s.approved++; const n = r.leave_types?.name ?? "Other"; s.byType[n] = (s.byType[n] ?? 0) + Number(r.working_days ?? 0); }
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

  const today = isoDate(new Date());
  const { data: upcoming } = useQuery({
    queryKey: ["my-upcoming", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (await supabase.from("leave_requests").select("id, start_date, end_date, working_days, leave_types(name)").eq("employee_id", user!.id).eq("status", "approved").gte("end_date", today).order("start_date").limit(3)).data ?? [],
  });

  const pieData = Object.entries(myStats?.byType ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Leave balance" value={me?.leave_balance != null ? `${me.leave_balance}` : "—"} hint="days remaining" tone="primary" />
        <StatCard icon={Clock} label="Pending" value={String(myStats?.pending ?? 0)} hint="Awaiting approval" tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(myStats?.approved ?? 0)} hint="All time" tone="success" />
        <StatCard icon={XCircle} label="Rejected" value={String(myStats?.rejected ?? 0)} hint="All time" tone="destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent requests</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/leave-requests">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(myRecent ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              myRecent!.map((r: any) => (
                <Link key={r.id} to="/leave-requests/$id" params={{ id: r.id }} className="flex items-center justify-between rounded-md border p-3 transition hover:border-primary/40">
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

        <Card>
          <CardHeader><CardTitle className="text-base">Leave usage</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No approved leave yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70} label={(e: any) => `${e.value}d`}>
                    {pieData.map((e) => <Cell key={e.name} fill={leaveTypeColor(e.name)} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {(upcoming?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming leave</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {upcoming!.map((r: any) => (
              <div key={r.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{r.leave_types?.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(r.start_date)} → {formatDate(r.end_date)}</p>
                <p className="mt-1 text-xs">{r.working_days} working days</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApproverSection({ isHR, isDeptHead, isSupervisor, deptId }: { isHR: boolean; isDeptHead: boolean; isSupervisor: boolean; deptId: string | null }) {
  const { user } = useAuth();
  const today = isoDate(new Date());

  const { data: pending } = useQuery({
    queryKey: ["approver-pending", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("leave_requests")
        .select("id, start_date, end_date, status, working_days, employee:employees!leave_requests_employee_id_fkey(full_name), leave_types(name)")
        .in("status", PENDING_STATUSES as any)
        .order("submitted_at", { ascending: false })
        .limit(6);
      if (isSupervisor && !isHR && !isDeptHead) q = q.eq("supervisor_id", user!.id).eq("status", "pending_supervisor");
      return (await q).data ?? [];
    },
  });

  const { data: onLeave } = useQuery({
    queryKey: ["approver-on-leave", deptId, isHR, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("leave_requests")
        .select("id, start_date, end_date, employee:employees!leave_requests_employee_id_fkey(full_name, department_id), leave_types(name)")
        .eq("status", "approved").lte("start_date", today).gte("end_date", today).limit(10);
      if (!isHR && deptId) q = q.eq("department_id", deptId);
      if (isSupervisor && !isHR && !isDeptHead) q = q.eq("supervisor_id", user!.id);
      return (await q).data ?? [];
    },
  });

  return (
    <>
      <h2 className="pt-2 text-lg font-semibold">
        {isHR ? "HR approvals" : isDeptHead ? "Department approvals" : "Team approvals"}
      </h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Awaiting your review</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/approvals">Open inbox</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pending ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing to review.</p>
            ) : pending!.map((r: any) => (
              <Link key={r.id} to="/leave-requests/$id" params={{ id: r.id }} className="flex items-center justify-between rounded-md border p-3 hover:border-primary/40">
                <div>
                  <p className="text-sm font-medium">{r.employee?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{r.leave_types?.name} · {formatDate(r.start_date)} → {formatDate(r.end_date)} · {r.working_days}d</p>
                </div>
                <LeaveStatusBadge status={r.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Currently on leave</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(onLeave ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No one on leave today.</p>
            ) : onLeave!.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{r.employee?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{r.leave_types?.name} · until {formatDate(r.end_date)}</p>
                </div>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: leaveTypeColor(r.leave_types?.name) }} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function DeptHeadSection({ deptId }: { deptId: string | null }) {
  const { data } = useQuery({
    queryKey: ["dept-trends", deptId],
    enabled: !!deptId,
    queryFn: async () => {
      const start = new Date(); start.setMonth(start.getMonth() - 5); start.setDate(1);
      const { data: rows } = await supabase
        .from("leave_requests")
        .select("start_date, working_days, status")
        .eq("department_id", deptId!)
        .eq("status", "approved")
        .gte("start_date", isoDate(start));
      const buckets: Record<string, number> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); d.setDate(1);
        buckets[d.toISOString().slice(0, 7)] = 0;
      }
      (rows ?? []).forEach((r: any) => {
        const k = r.start_date.slice(0, 7);
        if (k in buckets) buckets[k] += Number(r.working_days ?? 0);
      });
      return Object.entries(buckets).map(([k, v]) => ({ month: monthLabel(k), days: v }));
    },
  });

  return (
    <>
      <h2 className="pt-2 text-lg font-semibold">Department trends</h2>
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly leave days (last 6 months)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="days" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}

function HRSection() {
  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 86400000));

  const { data } = useQuery({
    queryKey: ["hr-dashboard"],
    queryFn: async () => {
      const [
        totalEmp, perm, contract, active, onLeave, pending, depts, returning, byDept, trends
      ] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("employment_type", "permanent"),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("employment_type", "contract"),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "approved").lte("start_date", today).gte("end_date", today),
        supabase.from("leave_requests").select("*", { count: "exact", head: true }).in("status", PENDING_STATUSES as any),
        supabase.from("departments").select("id, name"),
        supabase.from("leave_requests").select("id, employee:employees!leave_requests_employee_id_fkey(full_name)").eq("status", "approved").eq("end_date", today),
        supabase.from("leave_requests").select("department_id, working_days").eq("status", "approved").gte("start_date", isoDate(new Date(Date.now() - 90 * 86400000))),
        supabase.from("leave_requests").select("start_date, working_days").eq("status", "approved").gte("start_date", isoDate(new Date(Date.now() - 180 * 86400000))),
      ]);

      const deptMap = new Map((depts.data ?? []).map((d: any) => [d.id, d.name]));
      const deptAgg: Record<string, number> = {};
      (byDept.data ?? []).forEach((r: any) => {
        const n = deptMap.get(r.department_id) ?? "Unassigned";
        deptAgg[n] = (deptAgg[n] ?? 0) + Number(r.working_days ?? 0);
      });
      const deptChart = Object.entries(deptAgg).map(([name, days]) => ({ name, days })).sort((a, b) => b.days - a.days).slice(0, 10);

      const buckets: Record<string, number> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); d.setDate(1);
        buckets[d.toISOString().slice(0, 7)] = 0;
      }
      (trends.data ?? []).forEach((r: any) => {
        const k = r.start_date.slice(0, 7);
        if (k in buckets) buckets[k] += Number(r.working_days ?? 0);
      });
      const trendChart = Object.entries(buckets).map(([k, v]) => ({ month: monthLabel(k), days: v }));

      return {
        totalEmp: totalEmp.count ?? 0,
        perm: perm.count ?? 0,
        contract: contract.count ?? 0,
        active: active.count ?? 0,
        onLeave: onLeave.count ?? 0,
        pending: pending.count ?? 0,
        deptCount: depts.data?.length ?? 0,
        returning: returning.data ?? [],
        deptChart,
        trendChart,
      };
    },
  });

  return (
    <>
      <h2 className="pt-2 text-lg font-semibold">HR overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total employees" value={String(data?.totalEmp ?? "—")} hint="All statuses" tone="info" />
        <StatCard icon={Briefcase} label="Permanent" value={String(data?.perm ?? 0)} hint="Full-time staff" tone="primary" />
        <StatCard icon={UserCheck} label="Contract" value={String(data?.contract ?? 0)} hint="Contract workers" tone="warning" />
        <StatCard icon={CalendarDays} label="On leave today" value={String(data?.onLeave ?? 0)} hint="Approved & active" tone="success" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UserX} label="Returning today" value={String(data?.returning.length ?? 0)} hint="End date is today" tone="info" />
        <StatCard icon={Clock} label="Pending HR" value={String(data?.pending ?? 0)} hint="All stages" tone="warning" />
        <StatCard icon={Building2} label="Departments" value={String(data?.deptCount ?? 0)} hint="Active units" tone="success" />
        <StatCard icon={TrendingUp} label="Active" value={String(data?.active ?? 0)} hint="Currently working" tone="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Leave days by department (last 90d)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.deptChart ?? []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="days" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Monthly leave trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data?.trendChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="days" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {(data?.returning?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Returning today</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data!.returning.map((r: any) => (
              <span key={r.id} className="rounded-full border bg-muted/40 px-3 py-1 text-xs">{r.employee?.full_name}</span>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function AdminSection() {
  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [users, active, leaves, holidays, types, audits, recentAudits] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("leave_requests").select("*", { count: "exact", head: true }),
        supabase.from("public_holidays").select("*", { count: "exact", head: true }),
        supabase.from("leave_types").select("*", { count: "exact", head: true }),
        supabase.from("audit_logs").select("*", { count: "exact", head: true }),
        supabase.from("audit_logs").select("id, action, entity, created_at, user_id").order("created_at", { ascending: false }).limit(8),
      ]);
      return {
        users: users.count ?? 0, active: active.count ?? 0, leaves: leaves.count ?? 0,
        holidays: holidays.count ?? 0, types: types.count ?? 0, audits: audits.count ?? 0,
        recent: recentAudits.data ?? [],
      };
    },
  });

  return (
    <>
      <h2 className="pt-2 text-lg font-semibold">System administration</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={String(data?.users ?? 0)} hint="Registered" tone="primary" />
        <StatCard icon={Activity} label="Active users" value={String(data?.active ?? 0)} hint="Status: active" tone="success" />
        <StatCard icon={Database} label="Leave records" value={String(data?.leaves ?? 0)} hint="All time" tone="info" />
        <StatCard icon={ShieldCheck} label="Audit entries" value={String(data?.audits ?? 0)} hint="Full log" tone="warning" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarDays} label="Leave types" value={String(data?.types ?? 0)} hint="Configured" tone="primary" />
        <StatCard icon={CalendarDays} label="Holidays" value={String(data?.holidays ?? 0)} hint="On record" tone="info" />
        <Card>
          <CardContent className="flex h-full items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Settings /></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Manage</p>
              <Button asChild variant="link" className="h-auto p-0"><Link to="/settings">Open settings</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent audit events</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/audit-logs">Full log</Link></Button>
        </CardHeader>
        <CardContent className="divide-y">
          {(data?.recent ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No audit entries yet.</p>
          ) : data!.recent.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">{a.entity ?? "system"}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
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

// Need to import Settings icon inline
import { Settings } from "lucide-react";
