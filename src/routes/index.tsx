import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Users, CalendarCheck2, ShieldCheck, BarChart3, LayoutDashboard, Briefcase, Building2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoppLogo } from "@/components/bopp-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <BoppLogo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Benso Oil Palm Plantation Limited
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Leave management, <span className="text-primary">rooted in clarity.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                A single platform for BOPP employees, supervisors, department heads, and HR to request, review, and track leave across the plantation.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg"><Link to="/auth">Sign in to your account <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline"><a href="mailto:hr.bopp@gh.wilmar-intl.com">Contact HR</a></Button>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard preview tabs */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <Badge variant="secondary" className="mb-3">Role-based dashboards</Badge>
            <h2 className="text-2xl font-bold sm:text-3xl">One system, five perspectives</h2>
            <p className="mt-2 text-muted-foreground">Preview what each role sees. Sign in to access your personalized dashboard.</p>
          </div>

          <Tabs defaultValue="employee">
            <TabsList className="mx-auto flex w-full max-w-3xl flex-wrap justify-center">
              <TabsTrigger value="employee"><LayoutDashboard className="mr-1.5 h-4 w-4" /> Employee</TabsTrigger>
              <TabsTrigger value="supervisor"><Users className="mr-1.5 h-4 w-4" /> Supervisor</TabsTrigger>
              <TabsTrigger value="dept"><Building2 className="mr-1.5 h-4 w-4" /> Dept. Head</TabsTrigger>
              <TabsTrigger value="hr"><Briefcase className="mr-1.5 h-4 w-4" /> HR</TabsTrigger>
              <TabsTrigger value="admin"><UserCog className="mr-1.5 h-4 w-4" /> Admin</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="employee"><DashPreview title="Employee dashboard" items={["Leave balance & upcoming leave", "Pending / approved / rejected counts", "Recent leave history", "Leave-type usage chart", "Quick apply-leave button", "Notifications"]} /></TabsContent>
              <TabsContent value="supervisor"><DashPreview title="Supervisor dashboard" items={["Team requests awaiting your approval", "Team members currently on leave", "Upcoming team leave schedule", "Team leave statistics", "One-click approve / reject / request changes"]} /></TabsContent>
              <TabsContent value="dept"><DashPreview title="Department Head dashboard" items={["Department-wide statistics", "Pending approvals across sections", "Employees currently on leave", "Department leave calendar", "Monthly leave trend chart"]} /></TabsContent>
              <TabsContent value="hr"><DashPreview title="HR dashboard" items={["Total employees, permanent vs contract", "On leave today & returning today", "Pending HR approvals", "Department leave breakdown", "6-month leave trend line chart", "Leave balances overview"]} /></TabsContent>
              <TabsContent value="admin"><DashPreview title="System Admin dashboard" items={["Total & active users", "Database record counts", "Audit log summary", "Leave policy summary", "User role management", "Recent system activity"]} /></TabsContent>
            </div>
          </Tabs>
        </section>

        <section className="border-t border-border/60 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: CalendarCheck2, title: "Apply in minutes", desc: "Working days auto-calculated, weekends and Ghana holidays excluded." },
                { icon: Users, title: "4-step workflow", desc: "Supervisor → Department Head → HR, with comments at every stage." },
                { icon: ShieldCheck, title: "Role-based access", desc: "Employees see their leave. Approvers see their team. HR sees everything." },
                { icon: BarChart3, title: "Reports & calendar", desc: "Export PDF, Excel, CSV. Company & department leave calendars." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border bg-card p-6 shadow-soft transition hover:shadow-elevated">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>© {new Date().getFullYear()} Benso Oil Palm Plantation Limited</div>
          <div>P.O. Box 470, Takoradi · Adum Banso Estate · hr.bopp@gh.wilmar-intl.com</div>
        </div>
      </footer>
    </div>
  );
}

function DashPreview({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i} className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{i}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button asChild variant="default" size="sm"><Link to="/auth">Sign in to view <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
