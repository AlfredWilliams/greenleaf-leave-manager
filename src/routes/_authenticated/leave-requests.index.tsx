import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { formatDate, type LeaveStatus, STATUS_LABEL } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/leave-requests/")({
  component: LeaveRequestsList,
});

const STATUSES: LeaveStatus[] = [
  "draft",
  "pending_supervisor",
  "pending_dept_head",
  "pending_hr",
  "approved",
  "rejected",
  "cancelled",
  "changes_requested",
];

function LeaveRequestsList() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [leaveType, setLeaveType] = useState<string>("all");

  const { data: me } = useQuery({
    queryKey: ["me-balance", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("leave_balance, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: types } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => (await supabase.from("leave_types").select("id, name").eq("is_active", true)).data ?? [],
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, working_days, status, reason, created_at, leave_type_id, leave_types(name)")
        .eq("employee_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (requests ?? []).filter((r: any) => {
      if (status !== "all" && r.status !== status) return false;
      if (leaveType !== "all" && r.leave_type_id !== leaveType) return false;
      if (q && !(r.leave_types?.name?.toLowerCase().includes(q.toLowerCase()) || r.reason?.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [requests, status, leaveType, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Leave Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Balance:{" "}
            <span className="font-semibold text-foreground">{me?.leave_balance ?? "—"} days</span> available
          </p>
        </div>
        <Button asChild>
          <Link to="/leave-requests/new">
            <Plus className="mr-2 h-4 w-4" /> New Request
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search leave type or reason..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={leaveType} onValueChange={setLeaveType}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Leave type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(types ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No leave requests</p>
              <p className="text-sm text-muted-foreground">Create your first leave request to get started.</p>
            </div>
            <Button asChild size="sm">
              <Link to="/leave-requests/new"><Plus className="mr-2 h-4 w-4" /> New Request</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => (
            <Link
              key={r.id}
              to="/leave-requests/$id"
              params={{ id: r.id }}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition hover:border-primary/40 hover:shadow-soft sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.leave_types?.name ?? "Leave"}</p>
                  <LeaveStatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(r.start_date)} → {formatDate(r.end_date)} · {r.working_days} working day{r.working_days === 1 ? "" : "s"}
                </p>
                {r.reason && <p className="mt-1 truncate text-sm text-muted-foreground">{r.reason}</p>}
              </div>
              <p className="text-xs text-muted-foreground">Created {formatDate(r.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
