import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Loader2, Save, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calcWorkingDays } from "@/lib/leave-utils";

export const Route = createFileRoute("/_authenticated/leave-requests/new")({
  component: NewLeaveRequest,
});

const schema = z.object({
  leave_type_id: z.string().uuid("Select a leave type"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  reason: z.string().trim().min(3, "Please give a reason (min 3 chars)").max(1000),
});

function NewLeaveRequest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: types = [] } = useQuery({
    queryKey: ["leave-types-active"],
    queryFn: async () =>
      (await supabase
        .from("leave_types")
        .select("id, name, default_days, is_paid, requires_document, description")
        .eq("is_active", true)
        .order("name")).data ?? [],
  });

  const { data: me } = useQuery({
    queryKey: ["me-balance", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (await supabase.from("employees").select("leave_balance, employment_type").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["public-holidays"],
    queryFn: async () =>
      (await supabase.from("public_holidays").select("holiday_date, name").order("holiday_date")).data ?? [],
  });

  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays]);
  const breakdown = useMemo(
    () => calcWorkingDays(form.start_date, form.end_date, holidaySet),
    [form.start_date, form.end_date, holidaySet],
  );

  const selectedType = types.find((t) => t.id === form.leave_type_id);
  const balance = me?.leave_balance ?? 0;
  const overBalance = selectedType?.is_paid && breakdown.working > balance;

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
        setErrors(errs);
        throw new Error("Please fix the form errors");
      }
      if (new Date(form.end_date) < new Date(form.start_date)) {
        throw new Error("End date must be after start date");
      }
      if (breakdown.working <= 0) throw new Error("Selected range has no working days");
      setErrors({});

      const { data, error } = await supabase
        .from("leave_requests")
        .insert({
          employee_id: user!.id,
          leave_type_id: form.leave_type_id,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason.trim(),
        })
        .select("id")
        .single();
      if (error) throw error;

      if (submit) {
        const { error: subErr } = await supabase.rpc("submit_leave_request", { _id: data.id });
        if (subErr) throw subErr;
      }
      return data.id;
    },
    onSuccess: (id, submit) => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["me-balance"] });
      toast.success(submit ? "Leave request submitted" : "Draft saved");
      navigate({ to: "/leave-requests/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/leave-requests"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">New Leave Request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Available balance: <span className="font-semibold text-foreground">{balance} days</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request details</CardTitle>
          <CardDescription>All fields are required unless marked optional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Leave type *</Label>
            <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_paid ? "" : "(unpaid)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType?.description && <p className="text-xs text-muted-foreground">{selectedType.description}</p>}
            {selectedType?.requires_document && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This leave type requires a supporting document. You can upload it after saving.
              </p>
            )}
            {errors.leave_type_id && <p className="text-xs text-destructive">{errors.leave_type_id}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start date *</Label>
              <Input
                type="date"
                value={form.start_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date}</p>}
            </div>
            <div className="space-y-2">
              <Label>End date *</Label>
              <Input
                type="date"
                value={form.end_date}
                min={form.start_date || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
              {errors.end_date && <p className="text-xs text-destructive">{errors.end_date}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Briefly describe the reason for your leave..."
              rows={4}
              maxLength={1000}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>
        </CardContent>
      </Card>

      {form.start_date && form.end_date && (
        <Card>
          <CardHeader><CardTitle className="text-base">Working days breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Calendar days" value={breakdown.calendar} />
              <Stat label="Weekend days" value={breakdown.weekends} tone="muted" />
              <Stat label="Public holidays" value={breakdown.holidays} tone="muted" />
              <Stat label="Working days" value={breakdown.working} tone="primary" />
            </div>
            {overBalance && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  Insufficient balance: you have {balance} days but requested {breakdown.working} working days.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={save.isPending}
          onClick={() => save.mutate(false)}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save as draft
        </Button>
        <Button
          disabled={save.isPending || overBalance}
          onClick={() => save.mutate(true)}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit for approval
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "muted" | "primary" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "primary" ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "primary" ? "text-primary" : tone === "muted" ? "text-muted-foreground" : ""}`}>
        {value}
      </p>
    </div>
  );
}
