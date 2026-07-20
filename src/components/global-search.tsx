import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Users, ClipboardList, Building2, CalendarDays, Bell } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/leave-utils";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{
    employees: any[]; leaves: any[]; depts: any[]; notifs: any[];
  }>({ employees: [], leaves: [], depts: [], notifs: [] });
  const nav = useNavigate();
  const { hasAnyRole } = useAuth();
  const canSeeEmployees = hasAnyRole(["hr_officer", "system_admin", "dept_head", "supervisor"]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults({ employees: [], leaves: [], depts: [], notifs: [] });
      return;
    }
    const t = setTimeout(async () => {
      const term = `%${q.trim()}%`;
      const [emps, lvs, dps, nfs] = await Promise.all([
        canSeeEmployees
          ? supabase.from("employees").select("id, full_name, email, employee_code").or(`full_name.ilike.${term},email.ilike.${term},employee_code.ilike.${term}`).limit(5)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("leave_requests").select("id, start_date, end_date, status, reason, leave_types(name)").or(`reason.ilike.${term}`).limit(5),
        supabase.from("departments").select("id, name").ilike("name", term).limit(5),
        supabase.from("notifications").select("id, title, body, link, created_at").or(`title.ilike.${term},body.ilike.${term}`).limit(5),
      ]);
      setResults({
        employees: emps.data ?? [],
        leaves: lvs.data ?? [],
        depts: dps.data ?? [],
        notifs: nfs.data ?? [],
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, canSeeEmployees]);

  const go = (to: string, params?: any) => {
    setOpen(false);
    nav({ to, params } as any);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="hidden gap-2 text-muted-foreground sm:inline-flex">
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-2 rounded bg-muted px-1.5 text-[10px]">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="sm:hidden">
        <Search className="h-5 w-5" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search employees, leaves, departments…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>{q.length < 2 ? "Type at least 2 characters…" : "No results"}</CommandEmpty>

          {results.employees.length > 0 && (
            <CommandGroup heading="Employees">
              {results.employees.map((e) => (
                <CommandItem key={e.id} onSelect={() => go("/employees/$id", { id: e.id })}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>{e.full_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{e.employee_code ?? e.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.leaves.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Leave requests">
                {results.leaves.map((l) => (
                  <CommandItem key={l.id} onSelect={() => go("/leave-requests/$id", { id: l.id })}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    <span>{l.leave_types?.name} · {formatDate(l.start_date)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{l.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {results.depts.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Departments">
                {results.depts.map((d) => (
                  <CommandItem key={d.id} onSelect={() => go("/departments")}>
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>{d.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {results.notifs.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Notifications">
                {results.notifs.map((n) => (
                  <CommandItem key={n.id} onSelect={() => go("/notifications")}>
                    <Bell className="mr-2 h-4 w-4" />
                    <span>{n.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Quick links">
            <CommandItem onSelect={() => go("/leave-requests/new")}>
              <ClipboardList className="mr-2 h-4 w-4" /> New leave request
            </CommandItem>
            <CommandItem onSelect={() => go("/calendar")}>
              <CalendarDays className="mr-2 h-4 w-4" /> Leave calendar
            </CommandItem>
            <CommandItem onSelect={() => go("/reports")}>
              <ClipboardList className="mr-2 h-4 w-4" /> Reports
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
