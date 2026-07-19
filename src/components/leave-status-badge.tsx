import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE, TONE_CLASS, type LeaveStatus } from "@/lib/leave-utils";

export function LeaveStatusBadge({ status, className }: { status: LeaveStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[STATUS_TONE[status]],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
