import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Users, CalendarCheck2, ShieldCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoppLogo } from "@/components/bopp-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";

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
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section
          className="relative overflow-hidden"
          style={{ background: "var(--gradient-hero)" }}
        >
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
                A single platform for BOPP employees, supervisors, department heads,
                and HR to request, review, and track leave across the plantation.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">
                    Sign in to your account <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="mailto:hr.bopp@gh.wilmar-intl.com">Contact HR</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CalendarCheck2, title: "Apply in minutes", desc: "Working days auto-calculated, weekends and Ghana holidays excluded." },
              { icon: Users, title: "4-step workflow", desc: "Supervisor → Department Head → HR, with comments at every stage." },
              { icon: ShieldCheck, title: "Role-based access", desc: "Employees see their leave. Approvers see their team. HR sees everything." },
              { icon: BarChart3, title: "Reports & calendar", desc: "Export PDF, Excel, CSV. Company & department leave calendars." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6 shadow-soft transition hover:shadow-elevated">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>© {new Date().getFullYear()} Benso Oil Palm Plantation Limited</div>
          <div>P.O. Box 470, Takoradi · Adum Banso Estate · hr.bopp@gh.wilmar-intl.com</div>
        </div>
      </footer>
    </div>
  );
}
