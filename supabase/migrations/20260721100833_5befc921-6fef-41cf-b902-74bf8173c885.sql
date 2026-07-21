
-- ============================================================
-- PHASE 4a MIGRATION
-- 1) Fix RLS on leave_approvals and leave_documents (audience-scoped)
-- 2) Add update policy for leave_documents (owner)
-- 3) Revoke EXECUTE on internal helpers from authenticated
-- 4) company_branding table + RLS + audit trigger
-- 5) is_demo columns on demo-relevant tables
-- 6) company-branding storage bucket policies
-- ============================================================

-- 1) leave_approvals: replace permissive SELECT policy
DROP POLICY IF EXISTS "approvals viewable by request audience" ON public.leave_approvals;
DROP POLICY IF EXISTS "leave_approvals_select_audience" ON public.leave_approvals;

CREATE POLICY "leave_approvals_select_audience"
ON public.leave_approvals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leave_requests lr
    WHERE lr.id = leave_approvals.leave_request_id
      AND (
        lr.employee_id = auth.uid()
        OR lr.supervisor_id = auth.uid()
        OR public.is_dept_head_of(lr.department_id)
        OR public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[])
      )
  )
);

-- 2) leave_documents: replace permissive SELECT + add UPDATE policy
DROP POLICY IF EXISTS "docs viewable by request audience" ON public.leave_documents;
DROP POLICY IF EXISTS "leave_documents_select_audience" ON public.leave_documents;

CREATE POLICY "leave_documents_select_audience"
ON public.leave_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leave_requests lr
    WHERE lr.id = leave_documents.leave_request_id
      AND (
        lr.employee_id = auth.uid()
        OR lr.supervisor_id = auth.uid()
        OR public.is_dept_head_of(lr.department_id)
        OR public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[])
      )
  )
);

DROP POLICY IF EXISTS "leave_documents_update_owner" ON public.leave_documents;
CREATE POLICY "leave_documents_update_owner"
ON public.leave_documents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leave_requests lr
    WHERE lr.id = leave_documents.leave_request_id
      AND lr.employee_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leave_requests lr
    WHERE lr.id = leave_documents.leave_request_id
      AND lr.employee_id = auth.uid()
  )
);

-- 3) Revoke direct EXECUTE on internal helpers (only callable from SECURITY DEFINER context)
REVOKE EXECUTE ON FUNCTION public._notify(uuid, text, text, text) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public._audit(text, text, uuid, jsonb) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public._hr_officer_ids() FROM PUBLIC, authenticated, anon;

-- 4) company_branding table
CREATE TABLE IF NOT EXISTS public.company_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  name text NOT NULL DEFAULT 'Benso Oil Palm Plantation Limited',
  short_name text NOT NULL DEFAULT 'BOPP',
  slogan text,
  description text,
  address text,
  postal_address text,
  email text,
  phone text,
  website text,
  logo_url text,
  favicon_url text,
  login_bg_url text,
  welcome_banner_url text,
  letterhead_url text,
  primary_color text NOT NULL DEFAULT '#2e7a4b',
  secondary_color text NOT NULL DEFAULT '#1f5533',
  accent_color text NOT NULL DEFAULT '#f4b942',
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_signature text,
  report_header text,
  report_footer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active branding row
CREATE UNIQUE INDEX IF NOT EXISTS company_branding_one_active
  ON public.company_branding (is_active) WHERE is_active = true;

GRANT SELECT ON public.company_branding TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.company_branding TO authenticated;
GRANT ALL ON public.company_branding TO service_role;

ALTER TABLE public.company_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branding_read_all" ON public.company_branding;
CREATE POLICY "branding_read_all"
ON public.company_branding FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "branding_admin_write" ON public.company_branding;
CREATE POLICY "branding_admin_write"
ON public.company_branding FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'))
WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER company_branding_updated_at
BEFORE UPDATE ON public.company_branding
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit branding changes
CREATE OR REPLACE FUNCTION public.audit_branding_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, meta)
  VALUES (
    auth.uid(),
    TG_OP,
    'company_branding',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('name', COALESCE(NEW.name, OLD.name))
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER company_branding_audit
AFTER INSERT OR UPDATE OR DELETE ON public.company_branding
FOR EACH ROW EXECUTE FUNCTION public.audit_branding_change();

-- Seed default row if none exists
INSERT INTO public.company_branding (name, short_name, slogan, description, email, address, postal_address)
SELECT
  'Benso Oil Palm Plantation Limited',
  'BOPP',
  'Growing sustainably. Serving people.',
  'Enterprise leave management for Benso Oil Palm Plantation Limited.',
  'hr.bopp@gh.wilmar-intl.com',
  'Adum Banso Estate, Western Region, Ghana',
  'P.O. Box 470, Takoradi'
WHERE NOT EXISTS (SELECT 1 FROM public.company_branding);

-- 5) is_demo flags on demo-relevant tables
ALTER TABLE public.employees      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.audit_logs     ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 6) Storage RLS for company-branding bucket (bucket itself created via tool)
DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-branding');

DROP POLICY IF EXISTS "branding_admin_write" ON storage.objects;
CREATE POLICY "branding_admin_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-branding' AND public.has_role(auth.uid(), 'system_admin'));

DROP POLICY IF EXISTS "branding_admin_update" ON storage.objects;
CREATE POLICY "branding_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-branding' AND public.has_role(auth.uid(), 'system_admin'));

DROP POLICY IF EXISTS "branding_admin_delete" ON storage.objects;
CREATE POLICY "branding_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-branding' AND public.has_role(auth.uid(), 'system_admin'));
