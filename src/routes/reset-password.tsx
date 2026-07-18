import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BoppLogo } from "@/components/bopp-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase auto-detects the recovery token from the URL hash and signs in the user.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check current session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = z.string().min(8, "Password must be at least 8 characters").max(72).safeParse(password);
    if (!pw.success) return toast.error(pw.error.issues[0].message);
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.data });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Link to="/"><BoppLogo /></Link></div>
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>
              {ready ? "Choose a strong password for your account." : "Verifying your reset link…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rp-password">New password</Label>
                <Input id="rp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={!ready} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-confirm">Confirm password</Label>
                <Input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} disabled={!ready} />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !ready}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
