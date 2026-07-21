import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Palette, Save, Image as ImageIcon } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBranding, brandingAssetSrc, type Branding } from "@/lib/branding-context";
import { uploadBrandingAsset } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/branding")({
  component: BrandingPage,
});

const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];
const MAX = 5 * 1024 * 1024;

type FormState = Partial<Branding>;

function BrandingPage() {
  const { hasRole, loading } = useAuth();
  if (!loading && !hasRole("system_admin")) throw redirect({ to: "/access-denied" });

  const qc = useQueryClient();
  const uploadFn = useServerFn(uploadBrandingAsset);
  const { branding } = useBranding();
  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    if (branding) setForm(branding);
  }, [branding]);

  const set = <K extends keyof Branding>(k: K, v: Branding[K] | null) => setForm((f) => ({ ...f, [k]: v as any }));

  const save = useMutation({
    mutationFn: async () => {
      const schema = z.object({
        name: z.string().trim().min(1).max(200),
        short_name: z.string().trim().min(1).max(50),
        email: z.string().email().optional().or(z.literal("")).nullable(),
        website: z.string().url().optional().or(z.literal("")).nullable(),
        primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      });
      const parsed = schema.parse(form);
      const payload: any = { ...form, ...parsed };
      if (branding?.id) {
        const { error } = await supabase.from("company_branding").update(payload).eq("id", branding.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_branding").insert({ ...payload, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-branding"] });
      toast.success("Branding saved — applied across the app");
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const uploadFile = async (file: File, field: keyof Branding) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Only PNG, JPG, SVG, WEBP or ICO files are allowed");
      return;
    }
    if (file.size > MAX) {
      toast.error("File exceeds 5 MB limit");
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => {
        const s = String(r.result);
        resolve(s.slice(s.indexOf(",") + 1));
      };
      r.readAsDataURL(file);
    });
    try {
      const { path } = await uploadFn({
        data: { filename: file.name, contentType: file.type, base64 },
      });
      set(field, path as any);
      toast.success("Uploaded — remember to save");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Palette className="h-6 w-6 text-primary" /> Company Branding
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Applied everywhere in the app: login, sidebar, dashboards, reports, PDFs, favicon.
        </p>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="flex-wrap">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="assets">Logo & Assets</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="content">Reports & Email</TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <Card>
            <CardHeader><CardTitle className="text-base">Company identity</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Company name"><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Short name"><Input value={form.short_name ?? ""} onChange={(e) => set("short_name", e.target.value)} /></Field>
              <Field label="Slogan / motto" className="md:col-span-2">
                <Input value={form.slogan ?? ""} onChange={(e) => set("slogan", e.target.value)} />
              </Field>
              <Field label="Description" className="md:col-span-2">
                <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo, favicon, backgrounds</CardTitle>
              <CardDescription>PNG, JPG, SVG, WEBP or ICO. Max 5 MB per file.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <AssetUploader label="Logo" value={form.logo_url ?? null} onFile={(f) => uploadFile(f, "logo_url")} onClear={() => set("logo_url", null)} />
              <AssetUploader label="Favicon" value={form.favicon_url ?? null} onFile={(f) => uploadFile(f, "favicon_url")} onClear={() => set("favicon_url", null)} />
              <AssetUploader label="Login page background" value={form.login_bg_url ?? null} onFile={(f) => uploadFile(f, "login_bg_url")} onClear={() => set("login_bg_url", null)} />
              <AssetUploader label="Dashboard welcome banner" value={form.welcome_banner_url ?? null} onFile={(f) => uploadFile(f, "welcome_banner_url")} onClear={() => set("welcome_banner_url", null)} />
              <AssetUploader label="Printable letterhead" value={form.letterhead_url ?? null} onFile={(f) => uploadFile(f, "letterhead_url")} onClear={() => set("letterhead_url", null)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors">
          <Card>
            <CardHeader><CardTitle className="text-base">Brand colors</CardTitle><CardDescription>Live preview updates across the app after saving.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <ColorField label="Primary" value={form.primary_color ?? "#2e7a4b"} onChange={(v) => set("primary_color", v)} />
              <ColorField label="Secondary" value={form.secondary_color ?? "#1f5533"} onChange={(v) => set("secondary_color", v)} />
              <ColorField label="Accent" value={form.accent_color ?? "#f4b942"} onChange={(v) => set("accent_color", v)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card>
            <CardHeader><CardTitle className="text-base">Contact & social</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Website"><Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" /></Field>
              <Field label="Address"><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="Postal address"><Input value={form.postal_address ?? ""} onChange={(e) => set("postal_address", e.target.value)} /></Field>
              {(["facebook", "twitter", "linkedin", "instagram", "youtube"] as const).map((k) => (
                <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)} URL`}>
                  <Input
                    value={(form.social_links as any)?.[k] ?? ""}
                    onChange={(e) => set("social_links", { ...(form.social_links ?? {}), [k]: e.target.value } as any)}
                    placeholder="https://…"
                  />
                </Field>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader><CardTitle className="text-base">Reports & email</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Report header"><Textarea value={form.report_header ?? ""} onChange={(e) => set("report_header", e.target.value)} /></Field>
              <Field label="Report footer"><Textarea value={form.report_footer ?? ""} onChange={(e) => set("report_footer", e.target.value)} /></Field>
              <Field label="Default email signature"><Textarea value={form.email_signature ?? ""} onChange={(e) => set("email_signature", e.target.value)} rows={5} /></Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg" className="shadow-elevated">
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save branding
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 cursor-pointer rounded border" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function AssetUploader({
  label,
  value,
  onFile,
  onClear,
}: {
  label: string;
  value: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const src = brandingAssetSrc(value);
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
          {src ? (
            <img src={src} alt="" className="max-h-16 max-w-16 object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent">
            <Upload className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          {value && (
            <Button variant="ghost" size="sm" onClick={onClear}>Remove</Button>
          )}
        </div>
      </div>
    </div>
  );
}
