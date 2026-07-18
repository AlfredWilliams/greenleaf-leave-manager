import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/employees/")({
  component: EmployeesList,
});

function EmployeesList() {
  const { hasAnyRole } = useAuth();
  const [q, setQ] = useState("");

  const canView = hasAnyRole(["hr_officer", "system_admin", "dept_head", "supervisor"]);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees-directory"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, email, employee_code, status, profile_picture_url, department_id, section_id, position_id, departments(name), sections(name), positions(name)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!employees) return [];
    const term = q.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) =>
      [e.full_name, e.email, e.employee_code].filter(Boolean).some((v) => v!.toLowerCase().includes(term)),
    );
  }, [employees, q]);

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          You don't have access to the employee directory.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Directory of BOPP staff, sections and positions.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email or code" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No employees found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const initials = e.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
            return (
              <Card key={e.id} className="transition hover:shadow-elevated">
                <CardContent className="flex items-start gap-4 pt-6">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={e.profile_picture_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/employees/$id"
                        params={{ id: e.id }}
                        className="truncate font-medium hover:underline"
                      >
                        {e.full_name}
                      </Link>
                      <Badge variant={e.status === "active" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                        {e.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{e.email}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {[e.positions?.name, e.departments?.name].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
