
REVOKE EXECUTE ON FUNCTION public.submit_leave_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_leave_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_leave_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_leave_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_leave_changes(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_dept_head_of(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._notify(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._hr_officer_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_request_fill_days() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_working_days(date, date) FROM anon;
