import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function BoppLogo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground shadow-soft"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden
      >
        <Leaf className="h-5 w-5" strokeWidth={2.25} />
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">BOPP</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Leave System</span>
        </div>
      )}
    </div>
  );
}
