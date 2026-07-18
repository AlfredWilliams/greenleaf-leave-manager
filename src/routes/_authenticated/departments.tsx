import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/departments")({
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["departments-with-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, description, sections(id, name)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">BOPP organisational structure and sections.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((d) => (
            <Card key={d.id} className="transition hover:shadow-elevated">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{d.name}</CardTitle>
                    {d.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {d.sections && d.sections.length > 0 ? (
                    d.sections.map((s) => <Badge key={s.id} variant="secondary" className="font-normal">{s.name}</Badge>)
                  ) : (
                    <span className="text-xs text-muted-foreground">No sections defined.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
