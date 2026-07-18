
-- profile-pictures: users manage their own folder (userId as first path segment)
CREATE POLICY "profile-pictures owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-pictures' AND (auth.uid()::text = (storage.foldername(name))[1]
    OR public.current_user_has_any_role(ARRAY['system_admin','hr_officer']::public.app_role[])));
CREATE POLICY "profile-pictures owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "profile-pictures owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "profile-pictures owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- leave-documents
CREATE POLICY "leave-documents owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'leave-documents' AND (auth.uid()::text = (storage.foldername(name))[1]
    OR public.current_user_has_any_role(ARRAY['system_admin','hr_officer','dept_head','supervisor']::public.app_role[])));
CREATE POLICY "leave-documents owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'leave-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "leave-documents owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'leave-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
