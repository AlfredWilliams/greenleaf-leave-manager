import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BoppLogo } from "@/components/bopp-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email address");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Password reset link sent");
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
            <CardTitle>Forgot password</CardTitle>
            <CardDescription>Enter your work email and we'll send a reset link.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-sm">
                <p>If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth"><ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <div className="text-center">
                  <Link to="/auth" className="text-xs text-primary hover:underline">
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
