import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { formatDate } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsInbox,
});

function ApprovalsInbox() {
  const { user, hasAnyRole } = useAuth();
  const isDeptHead = hasAnyRole(["dept_head"]);
  const isHR = hasAnyRole(["hr_officer", "system_admin"]);

  const { data: mine, isLoading } = useQuery({
    queryKey: ["approvals-inbox", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select(`
          id, start_date, end_date, working_days, status, reason, submitted_at,
          leave_types(name),
          employee:employees!leave_requests_employee_id_fkey(full_name, employee_code, departments(name))
        `)
        .in("status", ["pending_supervisor", "pending_dept_head", "pending_hr"])
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const bySup = (mine ?? []).filter((r: any) => r.status === "pending_supervisor");
  const byDept = (mine ?? []).filter((r: any) => r.status === "pending_dept_head");
  const byHR = (mine ?? []).filter((r: any) => r.status === "pending_hr");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Approvals Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">Requests awaiting your review.</p>
      </div>

      <Tabs defaultValue={bySup.length ? "supervisor" : byDept.length && isDeptHead ? "dept" : isHR ? "hr" : "supervisor"}>
        <TabsList>
          <TabsTrigger value="supervisor">Supervisor ({bySup.length})</TabsTrigger>
          {(isDeptHead || isHR) && <TabsTrigger value="dept">Dept. Head ({byDept.length})</TabsTrigger>}
          {isHR && <TabsTrigger value="hr">HR ({byHR.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="supervisor" className="mt-4">
          <RequestList requests={bySup} loading={isLoading} />
        </TabsContent>
        {(isDeptHead || isHR) && (
          <TabsContent value="dept" className="mt-4">
            <RequestList requests={byDept} loading={isLoading} />
          </TabsContent>
        )}
        {isHR && (
          <TabsContent value="hr" className="mt-4">
            <RequestList requests={byHR} loading={isLoading} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function RequestList({ requests, loading }: { requests: any[]; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (requests.length === 0)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Nothing to review</p>
          <p className="text-sm text-muted-foreground">Approved and rejected requests appear in reports.</p>
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <Link
          key={r.id}
          to="/leave-requests/$id"
          params={{ id: r.id }}
          className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{r.employee?.full_name}</p>
              <span className="text-xs text-muted-foreground">{r.employee?.departments?.name}</span>
              <LeaveStatusBadge status={r.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.leave_types?.name} · {formatDate(r.start_date)} → {formatDate(r.end_date)} · {r.working_days} day{r.working_days === 1 ? "" : "s"}
            </p>
            {r.reason && <p className="mt-1 truncate text-sm text-muted-foreground">{r.reason}</p>}
          </div>
          <p className="text-xs text-muted-foreground">Submitted {formatDate(r.submitted_at)}</p>
        </Link>
      ))}
    </div>
  );
}
