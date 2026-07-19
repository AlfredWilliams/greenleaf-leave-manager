import type { Database } from "@/integrations/supabase/types";

export type LeaveStatus = Database["public"]["Enums"]["leave_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  draft: "Draft",
  pending_supervisor: "Pending Supervisor",
  pending_dept_head: "Pending Dept. Head",
  pending_hr: "Pending HR",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  changes_requested: "Changes Requested",
};

export const STATUS_TONE: Record<LeaveStatus, "muted" | "info" | "warning" | "success" | "destructive"> = {
  draft: "muted",
  pending_supervisor: "warning",
  pending_dept_head: "warning",
  pending_hr: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "muted",
  changes_requested: "info",
};

export const TONE_CLASS: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  destructive: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Client-side working-day calc mirroring the DB function. */
export function calcWorkingDays(startISO: string, endISO: string, holidayDates: Set<string>) {
  const result = { calendar: 0, weekends: 0, holidays: 0, working: 0 };
  if (!startISO || !endISO) return result;
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  if (end < start) return result;
  const d = new Date(start);
  while (d <= end) {
    result.calendar++;
    const dow = d.getDay();
    const iso = d.toISOString().slice(0, 10);
    if (dow === 0 || dow === 6) result.weekends++;
    else if (holidayDates.has(iso)) result.holidays++;
    else result.working++;
    d.setDate(d.getDate() + 1);
  }
  return result;
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];
export const ALLOWED_DOC_EXTENSIONS = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
export const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10 MB
