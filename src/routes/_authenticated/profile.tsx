import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  employee_code: z.string().trim().max(30).optional().or(z.literal("")),
  department_id: z.string().uuid().optional().nullable(),
  section_id: z.string().uuid().optional().nullable(),
  position_id: z.string().uuid().optional().nullable(),
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments-all"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });
  const { data: sections } = useQuery({
    queryKey: ["sections-all"],
    queryFn: async () => (await supabase.from("sections").select("id, name, department_id").order("name")).data ?? [],
  });
  const { data: positions } = useQuery({
    queryKey: ["positions-all"],
    queryFn: async () => (await supabase.from("positions").select("id, name").order("name")).data ?? [],
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    gender: "" as string,
    employee_code: "",
    department_id: "" as string,
    section_id: "" as string,
    position_id: "" as string,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        gender: profile.gender ?? "",
        employee_code: profile.employee_code ?? "",
        department_id: profile.department_id ?? "",
        section_id: profile.section_id ?? "",
        position_id: profile.position_id ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = profileSchema.safeParse({
        full_name: form.full_name,
        phone: form.phone,
        gender: form.gender || null,
        employee_code: form.employee_code,
        department_id: form.department_id || null,
        section_id: form.section_id || null,
        position_id: form.position_id || null,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase
        .from("employees")
        .update({
          full_name: parsed.data.full_name,
          phone: parsed.data.phone || null,
          gender: parsed.data.gender ?? null,
          employee_code: parsed.data.employee_code || null,
          department_id: parsed.data.department_id ?? null,
          section_id: parsed.data.section_id ?? null,
          position_id: parsed.data.position_id ?? null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["me", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-pictures").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("profile-pictures").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? null;
      const { error } = await supabase.from("employees").update({ profile_picture_url: url }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile picture updated");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["me", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const filteredSections = (sections ?? []).filter((s) => !form.department_id || s.department_id === form.department_id);
  const initials = (profile?.full_name ?? user?.email ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep your details current so your leave records stay accurate.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile picture</CardTitle>
          <CardDescription>PNG or JPG, up to 5MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile?.profile_picture_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
              {uploadAvatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAvatar.mutate(e.target.files[0])}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} />
          </Field>
          <Field label="Email">
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employee code">
            <Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} maxLength={30} placeholder="Assigned by HR" />
          </Field>
          <Field label="Date employed">
            <Input value={profile?.date_employed ?? ""} disabled placeholder="Set by HR" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignment</CardTitle>
          <CardDescription>Department, section and position. HR can change these later.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Department">
            <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v, section_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
              <SelectContent>
                {(departments ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Section">
            <Select value={form.section_id} onValueChange={(v) => setForm({ ...form, section_id: v })} disabled={!form.department_id}>
              <SelectTrigger><SelectValue placeholder={form.department_id ? "Select section…" : "Choose department first"} /></SelectTrigger>
              <SelectContent>
                {filteredSections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Position" className="sm:col-span-2">
            <Select value={form.position_id} onValueChange={(v) => setForm({ ...form, position_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select position…" /></SelectTrigger>
              <SelectContent>
                {(positions ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
