import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranding, brandingAssetSrc } from "@/lib/branding-context";

export function BoppLogo({ className, showText = true }: { className?: string; showText?: boolean }) {
  const { branding } = useBranding();
  const logoSrc = brandingAssetSrc(branding?.logo_url ?? null);
  const shortName = branding?.short_name ?? "BOPP";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={`${branding?.name ?? "Company"} logo`}
          className="h-9 w-9 rounded-lg object-contain shadow-soft"
        />
      ) : (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground shadow-soft"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        >
          <Leaf className="h-5 w-5" strokeWidth={2.25} />
        </div>
      )}
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">{shortName}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Leave System</span>
        </div>
      )}
    </div>
  );
}
