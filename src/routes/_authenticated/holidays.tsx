import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/leave-utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/holidays")({
  component: HolidaysAdmin,
});

function HolidaysAdmin() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["hr_officer", "system_admin"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["public-holidays-admin"],
    queryFn: async () =>
      (await supabase.from("public_holidays").select("id, name, holiday_date").order("holiday_date")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !date) throw new Error("Name and date required");
      const { error } = await supabase.from("public_holidays").insert({ name: name.trim(), holiday_date: date });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-holidays-admin"] });
      qc.invalidateQueries({ queryKey: ["public-holidays"] });
      toast.success("Holiday added");
      setOpen(false); setName(""); setDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-holidays-admin"] });
      qc.invalidateQueries({ queryKey: ["public-holidays"] });
      toast.success("Holiday removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = holidays.reduce((acc: Record<string, any[]>, h) => {
    const y = new Date(h.holiday_date).getFullYear().toString();
    (acc[y] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ghana Public Holidays</h1>
          <p className="mt-1 text-sm text-muted-foreground">These dates are automatically excluded from all leave calculations.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Holiday</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add public holiday</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Independence Day" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => add.mutate()} disabled={add.isPending}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No holidays yet</p>
          </CardContent>
        </Card>
      ) : (
        Object.keys(grouped).sort().reverse().map((year) => (
          <Card key={year}>
            <CardHeader><CardTitle className="text-base">{year}</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {grouped[year].map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(h.holiday_date)}</p>
                  </div>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete holiday?</AlertDialogTitle>
                          <AlertDialogDescription>{h.name} — {formatDate(h.holiday_date)}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(h.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
