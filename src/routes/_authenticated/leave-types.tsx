import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/leave-types")({
  component: LeaveTypesPage,
});

function LeaveTypesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leave-types-all"],
    queryFn: async () => (await supabase.from("leave_types").select("*").order("name")).data ?? [],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave types</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configured leave categories, entitlements and document requirements.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((t) => (
            <Card key={t.id} className={!t.is_active ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                  </div>
                  <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                    {t.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="font-normal">{t.default_days} days / yr</Badge>
                  <Badge variant="outline" className="font-normal">
                    <DollarSign className="mr-1 h-3 w-3" />
                    {t.is_paid ? "Paid" : "Unpaid"}
                  </Badge>
                  {t.requires_document && (
                    <Badge variant="outline" className="font-normal">
                      <FileText className="mr-1 h-3 w-3" />
                      Document required
                    </Badge>
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
