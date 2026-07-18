import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Calendar, Building2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/employees/$id")({
  component: EmployeeDetail,
});

function EmployeeDetail() {
  const { id } = Route.useParams();
  const { data: e, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(name), sections(name), positions(name), supervisor:supervisor_id(id, full_name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!e) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Employee not found.</CardContent></Card>;

  const initials = e.full_name.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/employees"><ArrowLeft className="mr-2 h-4 w-4" /> Back to directory</Link>
      </Button>

      <Card>
        <CardContent className="flex flex-col items-start gap-6 pt-6 sm:flex-row">
          <Avatar className="h-24 w-24">
            <AvatarImage src={e.profile_picture_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{e.full_name}</h1>
              <Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{e.positions?.name ?? "—"}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <InfoRow icon={Mail} label={e.email} />
              {e.phone && <InfoRow icon={Phone} label={e.phone} />}
              {e.date_employed && <InfoRow icon={Calendar} label={`Joined ${new Date(e.date_employed).toLocaleDateString()}`} />}
              {e.departments?.name && <InfoRow icon={Building2} label={e.departments.name} />}
              {e.employee_code && <InfoRow icon={Briefcase} label={`Code: ${e.employee_code}`} />}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Department" v={e.departments?.name} />
            <Row k="Section" v={e.sections?.name} />
            <Row k="Position" v={e.positions?.name} />
            <Row k="Employment" v={e.employment_type?.replace("_", " ")} />
            <Row k="Supervisor" v={e.supervisor?.full_name} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Leave</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Annual balance" v={e.leave_balance != null ? `${e.leave_balance} days` : "—"} />
            <Row k="Gender" v={e.gender} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}
function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
}
