import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["notifications-full", user?.id],
    enabled: !!user?.id,
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const filtered = useMemo(() => {
    let out = rows as any[];
    if (filter === "unread") out = out.filter((n) => !n.read);
    if (filter === "read") out = out.filter((n) => n.read);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      out = out.filter((n) => (n.title ?? "").toLowerCase().includes(t) || (n.body ?? "").toLowerCase().includes(t));
    }
    return out;
  }, [rows, filter, q]);

  const unreadCount = rows.filter((n: any) => !n.read).length;

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-full", user!.id] }),
  });
  const toggleOne = useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      await supabase.from("notifications").update({ read }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications-full", user!.id] }); qc.invalidateQueries({ queryKey: ["notifications", user!.id] }); },
  });
  const removeOne = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notifications").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications-full", user!.id] }); qc.invalidateQueries({ queryKey: ["notifications", user!.id] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notification Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unreadCount} unread of {rows.length} notifications.</p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <Check className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="read">Read ({rows.length - unreadCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input placeholder="Search notifications…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No notifications</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="divide-y p-0">
          {filtered.map((n: any) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 transition ${!n.read ? "bg-primary/5" : ""}`}>
              <button
                className="flex-1 text-left"
                onClick={() => {
                  if (!n.read) toggleOne.mutate({ id: n.id, read: true });
                  if (n.link) nav({ to: n.link });
                }}
              >
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  <p className="font-medium">{n.title}</p>
                </div>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </button>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => toggleOne.mutate({ id: n.id, read: !n.read })} title={n.read ? "Mark unread" : "Mark read"}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeOne.mutate(n.id)} title="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
