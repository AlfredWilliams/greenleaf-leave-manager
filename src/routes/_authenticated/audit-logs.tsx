import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: AuditLogsPage,
});

const PAGE_SIZE = 30;

function AuditLogsPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole(["hr_officer", "system_admin"]);

  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [page, setPage] = useState(0);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", action, entity, start, end],
    enabled: canView,
    queryFn: async () => {
      let sel = supabase.from("audit_logs").select("id, action, entity, entity_id, meta, user_id, created_at").order("created_at", { ascending: false }).limit(1000);
      if (action !== "all") sel = sel.eq("action", action);
      if (entity !== "all") sel = sel.eq("entity", entity);
      if (start) sel = sel.gte("created_at", `${start}T00:00:00`);
      if (end) sel = sel.lte("created_at", `${end}T23:59:59`);
      return (await sel).data ?? [];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(logs.map((l: any) => l.user_id).filter(Boolean))), [logs]);
  const { data: users = [] } = useQuery({
    queryKey: ["audit-users", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => (await supabase.from("employees").select("id, full_name, email").in("id", userIds)).data ?? [],
  });
  const userMap = useMemo(() => new Map((users as any[]).map((u) => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    if (!q.trim()) return logs;
    const t = q.trim().toLowerCase();
    return logs.filter((l: any) => {
      const u = userMap.get(l.user_id);
      return (u?.full_name ?? "").toLowerCase().includes(t) ||
        (u?.email ?? "").toLowerCase().includes(t) ||
        (l.action ?? "").toLowerCase().includes(t) ||
        (l.entity ?? "").toLowerCase().includes(t) ||
        JSON.stringify(l.meta ?? "").toLowerCase().includes(t);
    });
  }, [logs, q, userMap]);

  const actions = useMemo(() => Array.from(new Set(logs.map((l: any) => l.action))).sort(), [logs]);
  const entities = useMemo(() => Array.from(new Set(logs.map((l: any) => l.entity).filter(Boolean))).sort(), [logs]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  if (!canView) {
    return <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">Audit logs are restricted to HR and administrators.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every leave action recorded across the system.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2"><Label>Search</Label><Input placeholder="User, action, entity…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
          <div className="space-y-1.5"><Label>Action</Label>
            <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {actions.map((a: any) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Module</Label>
            <Select value={entity} onValueChange={(v) => { setEntity(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {entities.map((e: any) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>From</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>To</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{isLoading ? "Loading…" : `${filtered.length} events`}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 && (<TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No events match your filters.</TableCell></TableRow>)}
                {paged.map((l: any) => {
                  const u = userMap.get(l.user_id);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(l.created_at)}</TableCell>
                      <TableCell>{u?.full_name ?? <span className="text-muted-foreground">system</span>}</TableCell>
                      <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                      <TableCell className="text-xs">{l.entity ?? "—"}</TableCell>
                      <TableCell className="max-w-md truncate font-mono text-[11px] text-muted-foreground">{l.meta ? JSON.stringify(l.meta) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page + 1} of {pageCount}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
