import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/branding-asset")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        if (!path || path.includes("..")) {
          return new Response("Bad path", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("company-branding").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buf = await data.arrayBuffer();
        // Infer content-type from extension
        const ext = path.split(".").pop()?.toLowerCase();
        const type =
          ext === "svg" ? "image/svg+xml"
          : ext === "png" ? "image/png"
          : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
          : ext === "webp" ? "image/webp"
          : ext === "ico" ? "image/x-icon"
          : "application/octet-stream";
        return new Response(buf, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
