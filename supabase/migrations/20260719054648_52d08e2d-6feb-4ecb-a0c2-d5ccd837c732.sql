
-- Enums
CREATE TYPE public.leave_status AS ENUM (
  'draft','pending_supervisor','pending_dept_head','pending_hr',
  'approved','rejected','cancelled','changes_requested'
);
CREATE TYPE public.approval_action AS ENUM (
  'submit','approve','reject','request_changes','cancel','comment'
);

-- Helper: department head check for current user
CREATE OR REPLACE FUNCTION public.is_dept_head_of(_department_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = auth.uid()
      AND e.department_id = _department_id
      AND public.has_role(auth.uid(), 'dept_head')
  );
$$;

-- Helper: calculate working days
CREATE OR REPLACE FUNCTION public.calculate_working_days(_start date, _end date)
RETURNS TABLE (calendar_days int, weekend_days int, holiday_days int, working_days int)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE d date; cal int := 0; we int := 0; ho int := 0; wd int := 0;
BEGIN
  IF _start IS NULL OR _end IS NULL OR _end < _start THEN
    RETURN QUERY SELECT 0,0,0,0; RETURN;
  END IF;
  FOR d IN SELECT generate_series(_start, _end, interval '1 day')::date LOOP
    cal := cal + 1;
    IF extract(dow from d) IN (0,6) THEN
      we := we + 1;
    ELSIF EXISTS (SELECT 1 FROM public.public_holidays WHERE holiday_date = d) THEN
      ho := ho + 1;
    ELSE
      wd := wd + 1;
    END IF;
  END LOOP;
  RETURN QUERY SELECT cal, we, ho, wd;
END; $$;

GRANT EXECUTE ON FUNCTION public.calculate_working_days(date, date) TO authenticated, anon;

-- leave_requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'draft',
  total_calendar_days int NOT NULL DEFAULT 0,
  weekend_days int NOT NULL DEFAULT 0,
  holiday_days int NOT NULL DEFAULT 0,
  working_days int NOT NULL DEFAULT 0,
  supervisor_id uuid REFERENCES public.employees(id),
  department_id uuid REFERENCES public.departments(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_supervisor ON public.leave_requests(supervisor_id);
CREATE INDEX idx_leave_requests_department ON public.leave_requests(department_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own or authorised" ON public.leave_requests FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[])
  OR (department_id IS NOT NULL AND public.is_dept_head_of(department_id))
);
CREATE POLICY "insert own" ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());
CREATE POLICY "update own draft" ON public.leave_requests FOR UPDATE TO authenticated
USING (employee_id = auth.uid() AND status IN ('draft','changes_requested'))
WITH CHECK (employee_id = auth.uid());
CREATE POLICY "delete own draft" ON public.leave_requests FOR DELETE TO authenticated
USING (employee_id = auth.uid() AND status = 'draft');

CREATE TRIGGER trg_leave_requests_updated BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-fill working days on insert/update via trigger
CREATE OR REPLACE FUNCTION public.leave_request_fill_days()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.calculate_working_days(NEW.start_date, NEW.end_date);
  NEW.total_calendar_days := r.calendar_days;
  NEW.weekend_days := r.weekend_days;
  NEW.holiday_days := r.holiday_days;
  NEW.working_days := r.working_days;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_leave_requests_days
BEFORE INSERT OR UPDATE OF start_date, end_date ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.leave_request_fill_days();

-- leave_documents
CREATE TABLE public.leave_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_documents_request ON public.leave_documents(leave_request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_documents TO authenticated;
GRANT ALL ON public.leave_documents TO service_role;
ALTER TABLE public.leave_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs viewable by request audience" ON public.leave_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.leave_requests lr WHERE lr.id = leave_request_id));
CREATE POLICY "docs insert by owner" ON public.leave_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.leave_requests lr WHERE lr.id = leave_request_id AND lr.employee_id = auth.uid())
);
CREATE POLICY "docs delete by owner" ON public.leave_documents FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.leave_requests lr WHERE lr.id = leave_request_id
          AND lr.employee_id = auth.uid()
          AND lr.status IN ('draft','changes_requested','pending_supervisor','pending_dept_head','pending_hr'))
);

-- leave_approvals
CREATE TABLE public.leave_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.employees(id),
  approver_role app_role NOT NULL,
  action approval_action NOT NULL,
  comment text,
  from_status leave_status,
  to_status leave_status,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_approvals_request ON public.leave_approvals(leave_request_id);

GRANT SELECT, INSERT ON public.leave_approvals TO authenticated;
GRANT ALL ON public.leave_approvals TO service_role;
ALTER TABLE public.leave_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approvals viewable by request audience" ON public.leave_approvals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.leave_requests lr WHERE lr.id = leave_request_id));

-- notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Notify helper (SECURITY DEFINER so RPCs can insert for any user)
CREATE OR REPLACE FUNCTION public._notify(_user uuid, _title text, _body text, _link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications(user_id, title, body, link) VALUES (_user, _title, _body, _link);
$$;

-- Audit helper
CREATE OR REPLACE FUNCTION public._audit(_action text, _entity text, _entity_id uuid, _meta jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, meta)
  VALUES (auth.uid(), _action, _entity, _entity_id, _meta);
$$;

-- Get HR officer IDs
CREATE OR REPLACE FUNCTION public._hr_officer_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.user_roles WHERE role IN ('hr_officer','system_admin');
$$;

-- Submit leave request (owner action)
CREATE OR REPLACE FUNCTION public.submit_leave_request(_id uuid)
RETURNS public.leave_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lr public.leave_requests; emp public.employees; lt public.leave_types; balance numeric;
BEGIN
  SELECT * INTO lr FROM public.leave_requests WHERE id = _id;
  IF lr IS NULL THEN RAISE EXCEPTION 'Leave request not found'; END IF;
  IF lr.employee_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF lr.status NOT IN ('draft','changes_requested') THEN RAISE EXCEPTION 'Cannot submit in status %', lr.status; END IF;
  IF lr.working_days <= 0 THEN RAISE EXCEPTION 'No working days in selected range'; END IF;
  IF lr.reason IS NULL OR length(trim(lr.reason)) = 0 THEN RAISE EXCEPTION 'Reason is required'; END IF;

  SELECT * INTO emp FROM public.employees WHERE id = lr.employee_id;
  SELECT * INTO lt FROM public.leave_types WHERE id = lr.leave_type_id;

  IF lt.is_paid AND lr.working_days > emp.leave_balance THEN
    RAISE EXCEPTION 'Insufficient leave balance (% days requested, % available)', lr.working_days, emp.leave_balance;
  END IF;

  -- Snapshot supervisor & department
  UPDATE public.leave_requests
  SET status = 'pending_supervisor',
      submitted_at = now(),
      supervisor_id = emp.supervisor_id,
      department_id = emp.department_id
  WHERE id = _id
  RETURNING * INTO lr;

  INSERT INTO public.leave_approvals(leave_request_id, approver_id, approver_role, action, from_status, to_status)
  VALUES (_id, auth.uid(), 'employee', 'submit', 'draft', lr.status);

  PERFORM public._audit('leave.submit', 'leave_request', _id, jsonb_build_object('working_days', lr.working_days));

  -- Notify supervisor (or HR if none)
  IF emp.supervisor_id IS NOT NULL THEN
    PERFORM public._notify(emp.supervisor_id, 'New leave request',
      emp.full_name || ' submitted a leave request', '/approvals');
  ELSE
    -- No supervisor: skip to dept head or HR
    UPDATE public.leave_requests SET status = 'pending_dept_head' WHERE id = _id RETURNING * INTO lr;
  END IF;

  PERFORM public._notify(lr.employee_id, 'Leave submitted',
    'Your leave request is now pending approval', '/leave-requests');

  RETURN lr;
END; $$;

-- Cancel
CREATE OR REPLACE FUNCTION public.cancel_leave_request(_id uuid)
RETURNS public.leave_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lr public.leave_requests;
BEGIN
  SELECT * INTO lr FROM public.leave_requests WHERE id = _id;
  IF lr IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF lr.employee_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF lr.status IN ('approved','rejected','cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel a % request', lr.status;
  END IF;
  UPDATE public.leave_requests SET status='cancelled', cancelled_at=now() WHERE id=_id RETURNING * INTO lr;
  INSERT INTO public.leave_approvals(leave_request_id, approver_id, approver_role, action, from_status, to_status, comment)
  VALUES (_id, auth.uid(), 'employee', 'cancel', lr.status, 'cancelled', 'Cancelled by employee');
  PERFORM public._audit('leave.cancel','leave_request',_id, NULL);
  PERFORM public._notify(lr.employee_id, 'Leave cancelled', 'Your leave request was cancelled', '/leave-requests');
  RETURN lr;
END; $$;

-- Approve
CREATE OR REPLACE FUNCTION public.approve_leave_request(_id uuid, _comment text)
RETURNS public.leave_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lr public.leave_requests; emp public.employees; my_role app_role; next_status leave_status; hr_id uuid;
BEGIN
  SELECT * INTO lr FROM public.leave_requests WHERE id=_id;
  IF lr IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  SELECT * INTO emp FROM public.employees WHERE id = lr.employee_id;

  -- Determine role of caller for this step
  IF lr.status = 'pending_supervisor' AND lr.supervisor_id = auth.uid() THEN
    my_role := 'supervisor'; next_status := 'pending_dept_head';
  ELSIF lr.status = 'pending_dept_head' AND (public.is_dept_head_of(lr.department_id) OR public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[])) THEN
    my_role := 'dept_head'; next_status := 'pending_hr';
  ELSIF lr.status = 'pending_hr' AND public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[]) THEN
    my_role := 'hr_officer'; next_status := 'approved';
  ELSE
    RAISE EXCEPTION 'Not authorized to approve at status %', lr.status;
  END IF;

  UPDATE public.leave_requests
  SET status = next_status,
      approved_at = CASE WHEN next_status='approved' THEN now() ELSE approved_at END
  WHERE id = _id
  RETURNING * INTO lr;

  INSERT INTO public.leave_approvals(leave_request_id, approver_id, approver_role, action, comment, from_status, to_status)
  VALUES (_id, auth.uid(), my_role, 'approve', _comment,
    CASE my_role WHEN 'supervisor' THEN 'pending_supervisor'::leave_status
                 WHEN 'dept_head' THEN 'pending_dept_head'::leave_status
                 ELSE 'pending_hr'::leave_status END,
    next_status);

  PERFORM public._audit('leave.approve','leave_request',_id, jsonb_build_object('role', my_role, 'comment', _comment));

  IF next_status = 'approved' THEN
    -- Deduct balance for paid leave
    UPDATE public.employees SET leave_balance = GREATEST(0, leave_balance - lr.working_days)
    WHERE id = lr.employee_id
      AND EXISTS (SELECT 1 FROM public.leave_types lt WHERE lt.id = lr.leave_type_id AND lt.is_paid);
    PERFORM public._notify(lr.employee_id, 'Leave approved',
      'Your leave request has been fully approved', '/leave-requests');
  ELSIF next_status = 'pending_dept_head' THEN
    -- notify dept head(s)
    FOR hr_id IN SELECT ur.user_id FROM public.user_roles ur
                 JOIN public.employees e ON e.id = ur.user_id
                 WHERE ur.role = 'dept_head' AND e.department_id = lr.department_id LOOP
      PERFORM public._notify(hr_id, 'Leave awaiting your approval',
        emp.full_name || '''s leave request needs your review', '/approvals');
    END LOOP;
    PERFORM public._notify(lr.employee_id, 'Supervisor approved your leave',
      'Awaiting Department Head approval', '/leave-requests');
  ELSIF next_status = 'pending_hr' THEN
    FOR hr_id IN SELECT * FROM public._hr_officer_ids() LOOP
      PERFORM public._notify(hr_id, 'Leave awaiting HR approval',
        emp.full_name || '''s leave request needs HR review', '/approvals');
    END LOOP;
    PERFORM public._notify(lr.employee_id, 'Department Head approved your leave',
      'Awaiting HR approval', '/leave-requests');
  END IF;

  RETURN lr;
END; $$;

-- Reject
CREATE OR REPLACE FUNCTION public.reject_leave_request(_id uuid, _comment text)
RETURNS public.leave_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lr public.leave_requests; my_role app_role;
BEGIN
  SELECT * INTO lr FROM public.leave_requests WHERE id=_id;
  IF lr IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF lr.status = 'pending_supervisor' AND lr.supervisor_id = auth.uid() THEN my_role := 'supervisor';
  ELSIF lr.status = 'pending_dept_head' AND (public.is_dept_head_of(lr.department_id) OR public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[])) THEN my_role := 'dept_head';
  ELSIF lr.status = 'pending_hr' AND public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[]) THEN my_role := 'hr_officer';
  ELSE RAISE EXCEPTION 'Not authorized to reject at status %', lr.status; END IF;

  UPDATE public.leave_requests SET status='rejected', rejected_at=now() WHERE id=_id RETURNING * INTO lr;
  INSERT INTO public.leave_approvals(leave_request_id, approver_id, approver_role, action, comment, from_status, to_status)
  VALUES (_id, auth.uid(), my_role, 'reject', _comment, lr.status, 'rejected');
  PERFORM public._audit('leave.reject','leave_request',_id, jsonb_build_object('role', my_role, 'comment', _comment));
  PERFORM public._notify(lr.employee_id, 'Leave rejected',
    COALESCE(_comment, 'Your leave request was rejected'), '/leave-requests');
  RETURN lr;
END; $$;

-- Request changes
CREATE OR REPLACE FUNCTION public.request_leave_changes(_id uuid, _comment text)
RETURNS public.leave_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lr public.leave_requests; my_role app_role;
BEGIN
  SELECT * INTO lr FROM public.leave_requests WHERE id=_id;
  IF lr IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF lr.status = 'pending_supervisor' AND lr.supervisor_id = auth.uid() THEN my_role := 'supervisor';
  ELSIF lr.status = 'pending_dept_head' AND (public.is_dept_head_of(lr.department_id) OR public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[])) THEN my_role := 'dept_head';
  ELSIF lr.status = 'pending_hr' AND public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[]) THEN my_role := 'hr_officer';
  ELSE RAISE EXCEPTION 'Not authorized at status %', lr.status; END IF;

  UPDATE public.leave_requests SET status='changes_requested' WHERE id=_id RETURNING * INTO lr;
  INSERT INTO public.leave_approvals(leave_request_id, approver_id, approver_role, action, comment, from_status, to_status)
  VALUES (_id, auth.uid(), my_role, 'request_changes', _comment, lr.status, 'changes_requested');
  PERFORM public._audit('leave.request_changes','leave_request',_id, jsonb_build_object('role', my_role, 'comment', _comment));
  PERFORM public._notify(lr.employee_id, 'Changes requested on your leave',
    COALESCE(_comment,'Please review and resubmit'), '/leave-requests');
  RETURN lr;
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_leave_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_leave_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_leave_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_leave_changes(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dept_head_of(uuid) TO authenticated;

-- Public holidays: allow HR/admin manage
GRANT INSERT, UPDATE, DELETE ON public.public_holidays TO authenticated;
DROP POLICY IF EXISTS "holidays manage by hr" ON public.public_holidays;
CREATE POLICY "holidays manage by hr" ON public.public_holidays FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['hr_officer','system_admin']::app_role[]));
