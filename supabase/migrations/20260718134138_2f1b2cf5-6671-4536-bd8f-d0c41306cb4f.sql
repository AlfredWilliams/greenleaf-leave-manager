
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('system_admin','hr_officer','dept_head','supervisor','employee');
CREATE TYPE public.employee_status AS ENUM ('active','inactive','on_leave','terminated');
CREATE TYPE public.employment_type AS ENUM ('permanent','contract','casual','intern');
CREATE TYPE public.gender_type AS ENUM ('male','female','other');

-- ============================================================
-- UTIL: updated_at trigger fn
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(_roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles));
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'system_admin'))
  WITH CHECK (public.has_role(auth.uid(),'system_admin'));

-- ============================================================
-- DEPARTMENTS & SECTIONS
-- ============================================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/hr manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, name)
);
GRANT SELECT ON public.sections TO authenticated;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any authenticated read sections" ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/hr manage sections" ON public.sections FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any authenticated read positions" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/hr manage positions" ON public.positions FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  gender public.gender_type,
  profile_picture_url TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  employment_type public.employment_type NOT NULL DEFAULT 'permanent',
  date_employed DATE,
  status public.employee_status NOT NULL DEFAULT 'active',
  leave_balance NUMERIC(6,2) NOT NULL DEFAULT 21,
  supervisor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee read own profile" ON public.employees
  FOR SELECT TO authenticated USING (
    id = auth.uid()
    OR public.current_user_has_any_role(ARRAY['system_admin','hr_officer','dept_head','supervisor']::public.app_role[])
  );
CREATE POLICY "employee update own profile limited" ON public.employees
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "hr/admin manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create employee profile + default 'employee' role on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.employees (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- LEAVE TYPES
-- ============================================================
CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  requires_document BOOLEAN NOT NULL DEFAULT false,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any authenticated read leave types" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr/admin manage leave types" ON public.leave_types FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));
CREATE TRIGGER trg_leave_types_updated BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PUBLIC HOLIDAYS
-- ============================================================
CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_holidays TO authenticated;
GRANT ALL ON public.public_holidays TO service_role;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any authenticated read holidays" ON public.public_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "hr/admin manage holidays" ON public.public_holidays FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin/hr read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[]));
CREATE POLICY "authenticated write audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SEED: Departments, Sections, Leave Types, Holidays
-- ============================================================
INSERT INTO public.departments (name) VALUES
  ('Estate'),('Technical'),('Process'),('Finance'),('Stores'),
  ('IT'),('Human Resource Management'),('Clinic'),('School'),
  ('Security'),('Club House')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.sections (department_id, name)
SELECT d.id, s.name FROM public.departments d
JOIN (VALUES
  ('Estate','Edumase'),('Estate','Ahwiram'),('Estate','Small Holder'),('Estate','Development'),
  ('Technical','Electrical'),('Technical','Process'),('Technical','EHS'),('Technical','Civil'),
  ('Technical','Workshop'),('Technical','Mechanical'),
  ('Finance','Accounts'),('Finance','Payroll'),
  ('Stores','Procurement'),
  ('IT','IT'),
  ('Human Resource Management','HR')
) AS s(dept, name) ON s.dept = d.name
ON CONFLICT DO NOTHING;

INSERT INTO public.leave_types (name, description, default_days, requires_document, is_paid) VALUES
  ('Annual Leave','Yearly paid leave',21,false,true),
  ('Sick Leave','Medical leave',14,true,true),
  ('Casual Leave','Short casual leave',6,false,true),
  ('Emergency Leave','Emergency situations',3,false,true),
  ('Study Leave','Approved study leave',10,true,true),
  ('Compassionate Leave','Bereavement / family emergency',5,false,true),
  ('Maternity Leave','Maternity leave',84,true,true),
  ('Paternity Leave','Paternity leave',7,false,true),
  ('Unpaid Leave','Leave without pay',0,false,false)
ON CONFLICT (name) DO NOTHING;

-- Ghana 2026 public holidays
INSERT INTO public.public_holidays (name, holiday_date) VALUES
  ('New Year Day','2026-01-01'),
  ('Constitution Day','2026-01-07'),
  ('Independence Day','2026-03-06'),
  ('Good Friday','2026-04-03'),
  ('Easter Monday','2026-04-06'),
  ('May Day','2026-05-01'),
  ('Eid ul-Fitr','2026-03-20'),
  ('Eid ul-Adha','2026-05-27'),
  ('Founders'' Day','2026-08-04'),
  ('Kwame Nkrumah Memorial Day','2026-09-21'),
  ('Farmers Day','2026-12-04'),
  ('Christmas Day','2026-12-25'),
  ('Boxing Day','2026-12-26')
ON CONFLICT (holiday_date) DO NOTHING;
