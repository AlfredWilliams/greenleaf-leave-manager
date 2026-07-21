import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_USERS = [
  { email: "admin@bopp.com", full_name: "Ama Administrator", role: "system_admin" as const },
  { email: "hr@bopp.com", full_name: "Kojo HR Officer", role: "hr_officer" as const },
  { email: "depthead@bopp.com", full_name: "Yaw Department Head", role: "dept_head" as const },
  { email: "supervisor@bopp.com", full_name: "Akua Supervisor", role: "supervisor" as const },
  { email: "employee@bopp.com", full_name: "Kwame Employee", role: "employee" as const },
];
const DEFAULT_PASSWORD = "Password@123";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "system_admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — system administrator only");
}

export const createDemoUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { email: string; created: boolean; note?: string }[] = [];

    // Pick a default department (first one, seed if none)
    let { data: depts } = await supabaseAdmin.from("departments").select("id, name").order("name").limit(1);
    if (!depts || depts.length === 0) {
      const { data: newDept } = await supabaseAdmin
        .from("departments")
        .insert({ name: "Administration", description: "Default department" })
        .select("id, name")
        .single();
      depts = newDept ? [newDept] : [];
    }
    const deptId = depts?.[0]?.id ?? null;

    const ids: Record<string, string> = {};

    for (const u of DEMO_USERS) {
      // find or create
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = existing?.users?.find((x: any) => x.email?.toLowerCase() === u.email);
      let userId = found?.id;
      if (!userId) {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (error) {
          results.push({ email: u.email, created: false, note: error.message });
          continue;
        }
        userId = created.user!.id;
        results.push({ email: u.email, created: true });
      } else {
        // ensure password resets (in case existing account has different password)
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEFAULT_PASSWORD, email_confirm: true });
        results.push({ email: u.email, created: false, note: "already exists — password reset to default" });
      }
      ids[u.role] = userId!;

      // Upsert employee row
      await supabaseAdmin.from("employees").upsert(
        {
          id: userId!,
          full_name: u.full_name,
          email: u.email,
          department_id: deptId,
          is_demo: true,
        },
        { onConflict: "id" },
      );

      // Give the target role (plus base employee role from trigger)
      await supabaseAdmin.from("user_roles").upsert({ user_id: userId!, role: u.role }, { onConflict: "user_id,role" });
      await supabaseAdmin.from("user_roles").upsert({ user_id: userId!, role: "employee" }, { onConflict: "user_id,role" });
    }

    // Wire reporting: employee -> supervisor -> dept_head; supervisor -> dept_head
    if (ids.employee && ids.supervisor) {
      await supabaseAdmin.from("employees").update({ supervisor_id: ids.supervisor }).eq("id", ids.employee);
    }
    if (ids.supervisor && ids.dept_head) {
      await supabaseAdmin.from("employees").update({ supervisor_id: ids.dept_head }).eq("id", ids.supervisor);
    }

    return { results, password: DEFAULT_PASSWORD };
  });

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Departments
    const deptNames = ["Plantation", "Mill", "Finance", "Human Resources", "Engineering", "Health & Safety", "Transport", "Security", "IT", "Administration"];
    for (const name of deptNames) {
      await supabaseAdmin.from("departments").upsert({ name }, { onConflict: "name" });
    }
    const { data: depts } = await supabaseAdmin.from("departments").select("id, name");
    const deptList = depts ?? [];

    // Leave types (idempotent by name)
    const leaveTypes: Array<{ name: string; default_days: number; is_paid: boolean; requires_document: boolean; is_active: boolean }> = [
      { name: "Annual Leave", default_days: 20, is_paid: true, requires_document: false, is_active: true },
      { name: "Sick Leave", default_days: 12, is_paid: true, requires_document: true, is_active: true },
      { name: "Casual Leave", default_days: 6, is_paid: true, requires_document: false, is_active: true },
    ];
    for (const lt of leaveTypes) {
      await supabaseAdmin.from("leave_types").upsert(lt, { onConflict: "name" });
    }
    const { data: types } = await supabaseAdmin.from("leave_types").select("id, name, is_paid");
    const annual = types?.find((t: any) => t.name === "Annual Leave");

    // Generate 100 demo employees (without auth accounts — profile-only records)
    // We use gen_random_uuid() via a passthrough - but employees.id references auth.users(id).
    // So we skip real inserts for demo employees and instead just tag existing demo user employees.
    // Instead: seed only leave requests/notifications for the existing demo user accounts.

    const { data: demoEmployees } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, department_id")
      .eq("is_demo", true);

    if (!demoEmployees || demoEmployees.length === 0) {
      return { note: "No demo employees found. Run 'Create demo users' first.", counts: {} };
    }

    // Delete previous demo leave requests to keep idempotent
    await supabaseAdmin.from("leave_requests").delete().eq("is_demo", true);
    await supabaseAdmin.from("notifications").delete().eq("is_demo", true);

    let inserted = 0;
    const today = new Date();
    const statuses: Array<"draft" | "pending_supervisor" | "pending_hr" | "approved" | "rejected" | "cancelled"> = [
      "draft", "pending_supervisor", "pending_hr", "approved", "rejected", "cancelled",
    ];
    if (!annual?.id) return { note: "No Annual Leave type available", counts: {} };
    for (const emp of demoEmployees) {
      for (let i = 0; i < 8; i++) {
        const start = new Date(today);
        start.setDate(today.getDate() + Math.floor(Math.random() * 120) - 60);
        const end = new Date(start);
        end.setDate(start.getDate() + Math.floor(Math.random() * 5) + 1);
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const { error } = await supabaseAdmin.from("leave_requests").insert({
          employee_id: emp.id,
          leave_type_id: annual.id,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          reason: "Demo leave request",
          status,
          department_id: emp.department_id,
          is_demo: true,
        });
        if (!error) inserted++;
      }
      // Notifications
      await supabaseAdmin.from("notifications").insert({
        user_id: emp.id,
        title: "Welcome to the demo",
        body: "This is a demo notification. Reset demo data any time from Admin Tools.",
        is_demo: true,
      });
    }

    return { counts: { departments: deptList.length, leaveRequests: inserted, employees: demoEmployees.length } };
  });

export const resetDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const a = await supabaseAdmin.from("leave_requests").delete().eq("is_demo", true);
    const b = await supabaseAdmin.from("notifications").delete().eq("is_demo", true);
    const c = await supabaseAdmin.from("audit_logs").delete().eq("is_demo", true);
    return {
      leave_requests: a.count ?? 0,
      notifications: b.count ?? 0,
      audit_logs: c.count ?? 0,
    };
  });

export const clearMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("notifications").delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: data.email });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadBrandingAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
        base64: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(data.contentType)) throw new Error("Unsupported file type");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.length > 5 * 1024 * 1024) throw new Error("File exceeds 5 MB limit");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${safeName}`;
    const { error } = await supabaseAdmin.storage
      .from("company-branding")
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (error) throw new Error(error.message);
    return { path };
  });
