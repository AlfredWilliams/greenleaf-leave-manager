# Phase 4a — Production Readiness (Part 1 of 2)

Focus: the two priorities you picked. Import/export, printing, email templates, error pages, and full QA will come in Phase 4b.

## 1. Security fixes (RLS findings)

`leave_approvals` and `leave_documents` currently let any signed-in user read every record. Migration will replace both SELECT policies with the same audience logic already used on `leave_requests`:

- The employee who owns the request
- The supervisor snapshotted on the request
- A department head of the request's department
- HR officers / system admins

Also: add an owner-scoped UPDATE policy on `leave_documents` (currently missing — flagged as warning), and revoke `EXECUTE` on internal helper functions (`_notify`, `_audit`, `_hr_officer_ids`) from `authenticated` so only other SECURITY DEFINER functions can call them.

## 2. Single login + role-based redirect

- After sign-in on `/auth`, resolve the user's highest role and redirect:
  - `system_admin` → `/admin`
  - `hr_officer` → `/dashboard` (HR view, already role-aware)
  - `dept_head` → `/dashboard` (dept-head view)
  - `supervisor` → `/dashboard` (supervisor view)
  - `employee` → `/dashboard` (employee view)
  - No role → `/access-denied`
- New `/access-denied` public route with a "contact your administrator" message and sign-out button.
- New `/_authenticated/index.tsx` redirect-only route so hitting `/` while signed-in lands on the right dashboard.
- `AppShell` route-guard helper `useRequireRole([...])` so admin-only pages redirect to `/access-denied` instead of rendering an empty state.

## 3. Company Branding module

New table `public.company_branding` (single active row, admin-managed):

```text
name, short_name, address, postal_address, email, phone, website,
slogan, description,
logo_url, favicon_url, login_bg_url, welcome_banner_url, letterhead_url,
primary_color, secondary_color, accent_color,
social_links (jsonb: facebook/twitter/linkedin/instagram/youtube),
email_signature (rich text),
report_header, report_footer,
is_active bool
```

RLS: anyone signed-in can SELECT the active row; only `system_admin` can INSERT/UPDATE/DELETE. Every change writes an entry to `audit_logs` via trigger.

New public storage bucket `company-branding` for logo/favicon/banner uploads (5 MB cap, PNG/JPG/JPEG/SVG/WEBP validated client-side).

New route `/_authenticated/settings/branding.tsx` (admin only) with:
- Live logo preview + crop (react-easy-crop) + replace/delete
- Favicon upload
- Login background + welcome banner uploads
- Color pickers for primary/secondary/accent (writes CSS variables live)
- All text fields with Zod validation
- Social links repeater
- Email signature editor
- Report header/footer + letterhead fields
- "Save" writes to DB, invalidates `useBranding` query, toasts success

New `useBranding()` hook + `<BrandingProvider>` in `__root.tsx` that:
- Fetches the active branding row once, caches it
- Injects `--brand-primary/-secondary/-accent` CSS variables
- Sets the favicon `<link>` dynamically
- Exposes `logoUrl`, `companyName`, etc. to consumers

Consumers updated to read from branding instead of hardcoded values:
- `BoppLogo` → renders uploaded logo when available, falls back to leaf icon
- `/auth`, `/reset-password`, `/forgot-password`, `/index` → logo + name from branding
- `AppShell` sidebar/topbar → logo + company name
- Reports PDF/Excel exports → header uses branding
- Landing page hero → uses slogan/description if configured

## 4. Demo users + demo data + Admin Tools

New route `/_authenticated/admin/tools.tsx` (system_admin only) with buttons:

- **Create demo users** — server function using `supabaseAdmin.auth.admin.createUser` (idempotent by email). Creates the 5 accounts you listed (admin/hr/supervisor/depthead/employee @bopp.com, `Password@123`, email pre-confirmed). Assigns roles and wires supervisor→dept_head→hr reporting.
- **Seed demo data** — server function that generates 100 employees across departments with realistic names, positions, and hire dates; ~250 leave requests spread across draft/pending/approved/rejected/cancelled; matching approvals, notifications, audit entries. Idempotent (checks a `demo_seed` marker in a settings table).
- **Reset demo data** — deletes rows tagged `is_demo=true`, keeps real data intact.
- **Clear notifications** — for current user.
- **Reset password for a user** — admin sends recovery email.

To keep this idempotent, the migration adds an `is_demo boolean default false` column to `employees`, `leave_requests`, `notifications`, `audit_logs`. Real data (created outside these tools) always has `is_demo=false`; the reset only touches demo rows.

Server functions live in `src/lib/admin.functions.ts`, use `requireSupabaseAuth` + verify `has_role(system_admin)`, then dynamic-import `supabaseAdmin` inside the handler.

## Files touched

**Migrations (one migration call):**
- Fix leave_approvals + leave_documents SELECT policies
- Add leave_documents UPDATE policy
- Revoke EXECUTE on `_notify`/`_audit`/`_hr_officer_ids`
- Create `company_branding` table + RLS + audit trigger
- Add `is_demo` columns to demo-relevant tables

**Storage:** create `company-branding` bucket (public).

**New files:**
- `src/lib/branding-context.tsx` — `<BrandingProvider>` + `useBranding()`
- `src/lib/admin.functions.ts` — server functions for demo tools
- `src/components/branded-logo.tsx` — replaces hardcoded `BoppLogo` uses
- `src/routes/access-denied.tsx`
- `src/routes/_authenticated/index.tsx` (redirect)
- `src/routes/_authenticated/admin/tools.tsx`
- `src/routes/_authenticated/settings/branding.tsx`

**Modified:**
- `src/routes/__root.tsx` — wrap in `<BrandingProvider>`, dynamic favicon
- `src/routes/auth.tsx` — post-login role redirect + branded header
- `src/routes/_authenticated/route.tsx` — role-based first-hit routing
- `src/routes/_authenticated/settings.tsx` — add "Branding" tab link (admin only)
- `src/routes/_authenticated/reports.tsx` — PDF/Excel header uses branding
- `src/components/app-shell.tsx` — logo + brand name from branding
- `src/routes/index.tsx` — landing hero reads branding
- `package.json` — add `react-easy-crop`

## Out of scope (Phase 4b)

CSV/Excel employee import, printable leave letters, HTML email templates, professional 404/500 pages, duplicate/overlap validation on leave submission, full QA sweep. Called out so you know what's still to come.

## Technical notes

- Demo user creation uses `supabaseAdmin.auth.admin.createUser({ email_confirm: true })` — no email verification round-trip, so `Password@123` works immediately.
- Live color preview writes to `document.documentElement.style` on change; saves to DB on submit.
- Favicon swap uses `document.querySelector("link[rel=icon]").href = ...` after branding loads.
- Branding query has 5-minute staleTime + is invalidated on save to feel instant without hammering the DB.

Reply "go" to proceed, or tell me what to adjust.