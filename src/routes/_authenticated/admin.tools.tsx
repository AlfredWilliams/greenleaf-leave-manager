import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Database, RotateCcw, Bell, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDemoUsers,
  seedDemoData,
  resetDemoData,
  clearMyNotifications,
  sendPasswordReset,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/tools")({
  component: AdminToolsPage,
});

function AdminToolsPage() {
  const { hasRole, loading } = useAuth();
  if (!loading && !hasRole("system_admin")) {
    throw redirect({ to: "/access-denied" });
  }

  const createUsersFn = useServerFn(createDemoUsers);
  const seedFn = useServerFn(seedDemoData);
  const resetFn = useServerFn(resetDemoData);
  const clearFn = useServerFn(clearMyNotifications);
  const resetPwFn = useServerFn(sendPasswordReset);

  const [busy, setBusy] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");

  const run = async (key: string, fn: () => Promise<any>, successMsg: string) => {
    setBusy(key);
    try {
      const r = await fn();
      toast.success(successMsg);
      console.log(`[${key}] result`, r);
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ShieldCheck className="h-6 w-6 text-primary" /> Administrator Tools
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Utility actions for demonstrations, testing and account maintenance. All actions are recorded in the audit log.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Create demo users</CardTitle>
            <CardDescription>
              Creates admin@bopp.com, hr@bopp.com, depthead@bopp.com, supervisor@bopp.com and employee@bopp.com with password <code className="rounded bg-muted px-1">Password@123</code>. Existing accounts have their password reset to the default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={busy === "users"}
              onClick={() => run("users", () => createUsersFn(), "Demo users ready")}
            >
              {busy === "users" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create / refresh demo users
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Seed demo data</CardTitle>
            <CardDescription>
              Populates leave requests, notifications and departments so dashboards and reports have realistic content. Run "Create demo users" first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={busy === "seed"}
              onClick={() => run("seed", () => seedFn(), "Demo data seeded")}
            >
              {busy === "seed" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Seed demo data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><RotateCcw className="h-4 w-4" /> Reset demo data</CardTitle>
            <CardDescription>Removes all rows tagged as demo (leave requests, notifications, audit logs). Real data is not touched.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              disabled={busy === "reset"}
              onClick={() => run("reset", () => resetFn(), "Demo data cleared")}
            >
              {busy === "reset" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset demo data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Clear my notifications</CardTitle>
            <CardDescription>Delete all your own notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              disabled={busy === "clear"}
              onClick={() => run("clear", () => clearFn(), "Notifications cleared")}
            >
              {busy === "clear" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clear notifications
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Send password reset</CardTitle>
            <CardDescription>Generate a password recovery link for a specific user email.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <Label>User email</Label>
              <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="user@bopp.com" />
            </div>
            <Button
              disabled={!resetEmail || busy === "pw"}
              onClick={() => run("pw", () => resetPwFn({ data: { email: resetEmail } }), "Recovery link generated")}
            >
              {busy === "pw" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
