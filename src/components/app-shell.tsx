import { type ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Building2,
  Settings,
  LogOut,
  Menu,
  UserCircle,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { BoppLogo } from "@/components/bopp-logo";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notification-bell";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: AppRole[];
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leave-requests", label: "My Leave", icon: ClipboardList },
  { to: "/approvals", label: "Approvals", icon: FileText, roles: ["supervisor", "dept_head", "hr_officer", "system_admin"] },
  { to: "/employees", label: "Employees", icon: Users, roles: ["hr_officer", "system_admin", "dept_head"] },
  { to: "/departments", label: "Departments", icon: Building2, roles: ["hr_officer", "system_admin"] },
  { to: "/leave-types", label: "Leave Types", icon: CalendarDays, roles: ["hr_officer", "system_admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["hr_officer", "system_admin", "dept_head"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["system_admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" className="w-64 border-r border-sidebar-border bg-sidebar p-0">
          <SidebarContent onNavigate={() => setOpenMobile(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setOpenMobile(true)} />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { roles } = useAuth();
  const location = useLocation();
  const visible = NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));

  return (
    <>
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <BoppLogo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visible.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        <div className="font-medium text-sidebar-foreground">BOPP</div>
        <div className="mt-0.5">Adum Banso Estate</div>
      </div>
    </>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("full_name, profile_picture_url").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const initials = (profile?.full_name ?? user?.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const primaryRole =
    roles.includes("system_admin") ? "System Admin"
    : roles.includes("hr_officer") ? "HR Officer"
    : roles.includes("dept_head") ? "Department Head"
    : roles.includes("supervisor") ? "Supervisor"
    : "Employee";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <NotificationBell />
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full p-1 pr-3 transition hover:bg-accent">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.profile_picture_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-tight">{profile?.full_name ?? user?.email}</div>
              <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px] font-normal">{primaryRole}</Badge>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{profile?.full_name ?? "Employee"}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
            <UserCircle className="mr-2 h-4 w-4" /> My profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
