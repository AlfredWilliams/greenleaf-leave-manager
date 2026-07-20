import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, leaveTypeColor, isoDate } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { hasAnyRole, user } = useAuth();
  const [tab, setTab] = useState("company");
  const isPrivileged = hasAnyRole(["supervisor", "dept_head", "hr_officer", "system_admin"]);
  const defaultTab = isPrivileged ? "company" : "upcoming";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Leave Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Company-wide, departmental, holiday and upcoming leave.</p>
      </div>

      <Tabs value={tab || defaultTab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap">
          {isPrivileged && <TabsTrigger value="company">Company</TabsTrigger>}
          {isPrivileged && <TabsTrigger value="department">Department</TabsTrigger>}
          <TabsTrigger value="holidays">Public Holidays</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Leave</TabsTrigger>
        </TabsList>

        {isPrivileged && <TabsContent value="company"><MonthCalendar scope="company" userId={user!.id} /></TabsContent>}
        {isPrivileged && <TabsContent value="department"><MonthCalendar scope="department" userId={user!.id} /></TabsContent>}
        <TabsContent value="holidays"><HolidaysList /></TabsContent>
        <TabsContent value="upcoming"><UpcomingList /></TabsContent>
      </Tabs>
    </div>
  );
}

function MonthCalendar({ scope, userId }: { scope: "company" | "department"; userId: string }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const monthStart = new Date(cursor);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  const { data: deptId } = useQuery({
    queryKey: ["me-dept", userId],
    enabled: scope === "department",
    queryFn: async () => (await supabase.from("employees").select("department_id").eq("id", userId).maybeSingle()).data?.department_id,
  });

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["cal-leaves", scope, deptId, isoDate(monthStart)],
    enabled: scope === "company" || !!deptId,
    queryFn: async () => {
      let q = supabase.from("leave_requests")
        .select("id, start_date, end_date, employee:employees!leave_requests_employee_id_fkey(full_name), leave_types(name)")
        .eq("status", "approved")
        .lte("start_date", isoDate(monthEnd))
        .gte("end_date", isoDate(monthStart));
      if (scope === "department" && deptId) q = q.eq("department_id", deptId);
      return (await q).data ?? [];
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["cal-holidays", cursor.getFullYear()],
    queryFn: async () => (await supabase.from("public_holidays").select("holiday_date, name").gte("holiday_date", `${cursor.getFullYear()}-01-01`).lte("holiday_date", `${cursor.getFullYear()}-12-31`)).data ?? [],
  });

  const days = useMemo(() => {
    const first = new Date(cursor);
    const startWeekday = first.getDay();
    const lastDay = monthEnd.getDate();
    const cells: Array<{ date: Date | null; iso?: string }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      cells.push({ date: dt, iso: isoDate(dt) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor, monthEnd]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    (leaves as any[]).forEach((l) => {
      const s = new Date(l.start_date); const e = new Date(l.end_date);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const iso = isoDate(d);
        (map[iso] ??= []).push(l);
      }
    });
    return map;
  }, [leaves]);

  const holidayByDay = useMemo(() => Object.fromEntries((holidays as any[]).map((h) => [h.holiday_date, h.name])), [holidays]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>
        {isLoading ? <Skeleton className="h-96 w-full" /> : (
          <div className="grid grid-cols-7 gap-1">
            {days.map((c, i) => {
              if (!c.date) return <div key={i} className="min-h-[80px] rounded-md bg-muted/20" />;
              const iso = c.iso!;
              const dow = c.date.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isHoliday = holidayByDay[iso];
              const ev = eventsByDay[iso] ?? [];
              const isToday = iso === isoDate(new Date());
              return (
                <div key={i} className={`min-h-[80px] rounded-md border p-1.5 text-xs ${isWeekend ? "bg-muted/30" : ""} ${isHoliday ? "bg-red-500/5 border-red-500/20" : ""} ${isToday ? "ring-2 ring-primary" : ""}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`font-medium ${isToday ? "text-primary" : ""}`}>{c.date.getDate()}</span>
                    {isHoliday && <span className="rounded bg-red-500/10 px-1 text-[9px] font-medium text-red-600">H</span>}
                  </div>
                  {isHoliday && <p className="mb-0.5 truncate text-[10px] text-red-600">{isHoliday}</p>}
                  <div className="space-y-0.5">
                    {ev.slice(0, 3).map((e) => (
                      <div key={e.id} className="flex items-center gap-1 truncate rounded px-1 text-[10px]" style={{ background: leaveTypeColor(e.leave_types?.name) + "22", color: leaveTypeColor(e.leave_types?.name) }}>
                        <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: leaveTypeColor(e.leave_types?.name) }} />
                        <span className="truncate">{e.employee?.full_name?.split(" ")[0]}</span>
                      </div>
                    ))}
                    {ev.length > 3 && <p className="text-[9px] text-muted-foreground">+{ev.length - 3}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HolidaysList() {
  const { data = [] } = useQuery({
    queryKey: ["holidays-full"],
    queryFn: async () => (await supabase.from("public_holidays").select("*").order("holiday_date")).data ?? [],
  });
  const upcoming = data.filter((h: any) => h.holiday_date >= isoDate(new Date()));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Upcoming public holidays</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {upcoming.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No upcoming holidays.</p> :
          upcoming.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between py-2">
              <p className="font-medium">{h.name}</p>
              <p className="text-sm text-muted-foreground">{formatDate(h.holiday_date)}</p>
            </div>
          ))
        }
      </CardContent>
    </Card>
  );
}

function UpcomingList() {
  const { user, hasAnyRole } = useAuth();
  const isApprover = hasAnyRole(["supervisor", "dept_head", "hr_officer", "system_admin"]);
  const today = isoDate(new Date());
  const { data = [] } = useQuery({
    queryKey: ["upcoming-leaves", user?.id, isApprover],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from("leave_requests")
        .select("id, start_date, end_date, working_days, employee:employees!leave_requests_employee_id_fkey(full_name), leave_types(name)")
        .eq("status", "approved").gte("start_date", today).order("start_date").limit(50);
      if (!isApprover) q = q.eq("employee_id", user!.id);
      return (await q).data ?? [];
    },
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Upcoming approved leave</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {data.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled.</p> :
          (data as any[]).map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{r.employee?.full_name ?? "You"}</p>
                <p className="text-xs text-muted-foreground">{r.leave_types?.name} · {r.working_days}d</p>
              </div>
              <p className="text-sm">{formatDate(r.start_date)} → {formatDate(r.end_date)}</p>
            </div>
          ))
        }
      </CardContent>
    </Card>
  );
}
