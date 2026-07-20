import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["hr_officer", "system_admin"]);
  const isAdmin = hasAnyRole(["system_admin"]);

  if (!canManage) return <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">Settings are restricted to HR and administrators.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage organizational structure, leave policies and user roles.</p>
      </div>

      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="leave-types">Leave Policies</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          {isAdmin && <TabsTrigger value="roles">User Roles</TabsTrigger>}
        </TabsList>

        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="sections"><SectionsTab /></TabsContent>
        <TabsContent value="leave-types"><LeaveTypesTab /></TabsContent>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        {isAdmin && <TabsContent value="roles"><RolesTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

function DepartmentsTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["settings-depts"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      if (edit) {
        const { error } = await supabase.from("departments").update({ name: name.trim(), description: desc.trim() || null }).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert({ name: name.trim(), description: desc.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings-depts"] }); toast.success("Saved"); setOpen(false); setEdit(null); setName(""); setDesc(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("departments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings-depts"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Departments ({data.length})</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEdit(null); setName(""); setDesc(""); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} department</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 h-4 w-4" /> Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="divide-y">
        {(data as any[]).map((d) => (
          <div key={d.id} className="flex items-center justify-between py-2">
            <div><p className="font-medium">{d.name}</p>{d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}</div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEdit(d); setName(d.name); setDesc(d.description ?? ""); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => remove.mutate(d.id)} label={d.name} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SectionsTab() {
  const qc = useQueryClient();
  const { data: depts = [] } = useQuery({ queryKey: ["settings-depts"], queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [] });
  const { data = [] } = useQuery({ queryKey: ["settings-sections"], queryFn: async () => (await supabase.from("sections").select("*, departments(name)").order("name")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [name, setName] = useState(""); const [deptId, setDeptId] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !deptId) throw new Error("Name and department required");
      if (edit) {
        const { error } = await supabase.from("sections").update({ name: name.trim(), department_id: deptId }).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sections").insert({ name: name.trim(), department_id: deptId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings-sections"] }); toast.success("Saved"); setOpen(false); setEdit(null); setName(""); setDeptId(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sections").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings-sections"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Sections ({data.length})</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEdit(null); setName(""); setDeptId(""); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} section</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Department</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>{(depts as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="divide-y">
        {(data as any[]).map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2">
            <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.departments?.name}</p></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEdit(s); setName(s.name); setDeptId(s.department_id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <ConfirmDelete onConfirm={() => remove.mutate(s.id)} label={s.name} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LeaveTypesTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["settings-types"], queryFn: async () => (await supabase.from("leave_types").select("*").order("name")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "", default_days: 0, is_paid: true, requires_document: false, is_active: true });

  const openNew = () => { setEdit(null); setForm({ name: "", description: "", default_days: 0, is_paid: true, requires_document: false, is_active: true }); setOpen(true); };
  const openEdit = (t: any) => { setEdit(t); setForm({ name: t.name, description: t.description ?? "", default_days: t.default_days, is_paid: t.is_paid, requires_document: t.requires_document, is_active: t.is_active }); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const payload = { ...form, name: form.name.trim(), description: form.description.trim() || null, default_days: Number(form.default_days) };
      if (edit) { const { error } = await supabase.from("leave_types").update(payload).eq("id", edit.id); if (error) throw error; }
      else { const { error } = await supabase.from("leave_types").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings-types"] }); toast.success("Saved"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Leave policies ({data.length})</CardTitle>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {(data as any[]).map((t) => (
            <div key={t.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline">{t.default_days} days/yr</Badge>
                <Badge variant="outline">{t.is_paid ? "Paid" : "Unpaid"}</Badge>
                {t.requires_document && <Badge variant="outline">Doc required</Badge>}
                {!t.is_active && <Badge variant="secondary">Inactive</Badge>}
              </div>
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} leave policy</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Annual entitlement (days)</Label><Input type="number" min={0} value={form.default_days} onChange={(e) => setForm({ ...form, default_days: Number(e.target.value) })} /></div>
              <div className="flex items-center justify-between"><Label>Paid leave</Label><Switch checked={form.is_paid} onCheckedChange={(v) => setForm({ ...form, is_paid: v })} /></div>
              <div className="flex items-center justify-between"><Label>Document required</Label><Switch checked={form.requires_document} onCheckedChange={(v) => setForm({ ...form, requires_document: v })} /></div>
              <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">System rules (enforced automatically)</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>Weekends (Sat/Sun) are excluded from working-day counts.</li>
                  <li>Ghana public holidays are excluded from working-day counts.</li>
                  <li>Approval workflow: Supervisor → Dept. Head → HR.</li>
                  <li>Paid leave deducts from employee balance on final approval.</li>
                </ul>
              </div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function CompanyTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Company information</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Company</Label><Input value="Benso Oil Palm Plantation Limited" readOnly /></div>
          <div><Label>Estate</Label><Input value="Adum Banso Estate" readOnly /></div>
          <div><Label>Postal</Label><Input value="P.O. Box 470, Takoradi" readOnly /></div>
          <div><Label>HR contact</Label><Input value="hr.bopp@gh.wilmar-intl.com" readOnly /></div>
        </div>
        <p className="text-xs text-muted-foreground">Core company details are read-only. To change them, contact the system administrator.</p>
      </CardContent>
    </Card>
  );
}

function RolesTab() {
  const qc = useQueryClient();
  const { data: employees = [] } = useQuery({ queryKey: ["settings-employees"], queryFn: async () => (await supabase.from("employees").select("id, full_name, email").order("full_name")).data ?? [] });
  const { data: roles = [] } = useQuery({ queryKey: ["settings-roles"], queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [] });

  const rolesByUser = (roles as any[]).reduce((acc: Record<string, string[]>, r) => { (acc[r.user_id] ??= []).push(r.role); return acc; }, {});

  const toggle = useMutation({
    mutationFn: async ({ userId, role, on }: { userId: string; role: string; on: boolean }) => {
      if (on) { const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any }); if (error) throw error; }
      else { const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings-roles"] }); toast.success("Role updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ROLES = ["system_admin", "hr_officer", "dept_head", "supervisor", "employee"];
  const ROLE_LABEL: Record<string, string> = { system_admin: "Admin", hr_officer: "HR", dept_head: "Dept Head", supervisor: "Supervisor", employee: "Employee" };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">User roles ({employees.length} users)</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {(employees as any[]).map((u) => {
          const has = rolesByUser[u.id] ?? [];
          return (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-medium">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
              <div className="flex flex-wrap gap-1">
                {ROLES.map((r) => {
                  const on = has.includes(r);
                  return (
                    <Button key={r} variant={on ? "default" : "outline"} size="sm" onClick={() => toggle.mutate({ userId: u.id, role: r, on: !on })}>
                      {ROLE_LABEL[r]}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete {label}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Records referencing it may fail.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
