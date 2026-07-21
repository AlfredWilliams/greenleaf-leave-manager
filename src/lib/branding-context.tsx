import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Branding = {
  id: string;
  name: string;
  short_name: string;
  slogan: string | null;
  description: string | null;
  address: string | null;
  postal_address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  login_bg_url: string | null;
  welcome_banner_url: string | null;
  letterhead_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  social_links: Record<string, string>;
  email_signature: string | null;
  report_header: string | null;
  report_footer: string | null;
};

const BrandingCtx = createContext<{ branding: Branding | null; loading: boolean }>({
  branding: null,
  loading: true,
});

/** Convert a stored value (external URL or storage path) into a browser-usable src. */
export function brandingAssetSrc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
  // storage path: "logo/xxx.png"
  return `/api/public/branding-asset?path=${encodeURIComponent(value)}`;
}

async function fetchBranding(): Promise<Branding | null> {
  const { data } = await supabase
    .from("company_branding")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return (data as unknown as Branding) ?? null;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["company-branding"],
    queryFn: fetchBranding,
    staleTime: 5 * 60 * 1000,
  });

  // Apply CSS variables + favicon whenever branding changes
  useEffect(() => {
    if (!data || typeof document === "undefined") return;
    const root = document.documentElement;
    if (data.primary_color) root.style.setProperty("--brand-primary", data.primary_color);
    if (data.secondary_color) root.style.setProperty("--brand-secondary", data.secondary_color);
    if (data.accent_color) root.style.setProperty("--brand-accent", data.accent_color);
    const fav = brandingAssetSrc(data.favicon_url);
    if (fav) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = fav;
    }
    if (data.name) document.title = `${data.name} — Leave Management`;
  }, [data]);

  const value = useMemo(() => ({ branding: data ?? null, loading: isLoading }), [data, isLoading]);
  return <BrandingCtx.Provider value={value}>{children}</BrandingCtx.Provider>;
}

export function useBranding() {
  return useContext(BrandingCtx);
}
