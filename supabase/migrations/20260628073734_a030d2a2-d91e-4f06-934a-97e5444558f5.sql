
-- 1) domain_events: restrict SELECT to staff only
DROP POLICY IF EXISTS "Users can view events from their projects" ON public.domain_events;
DROP POLICY IF EXISTS "Staff can view domain events" ON public.domain_events;
CREATE POLICY "Staff can view domain events"
  ON public.domain_events FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2) project_studio_info: restrict SELECT to staff with project access
DROP POLICY IF EXISTS "Members can view studio info" ON public.project_studio_info;
DROP POLICY IF EXISTS "Staff can view studio info" ON public.project_studio_info;
CREATE POLICY "Staff can view studio info"
  ON public.project_studio_info FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 3) project_purchases: restrict SELECT to staff with project access (hides supplier payment credentials from customers)
DROP POLICY IF EXISTS "Users with project access can view purchases" ON public.project_purchases;
DROP POLICY IF EXISTS "Staff can view project purchases" ON public.project_purchases;
CREATE POLICY "Staff can view project purchases"
  ON public.project_purchases FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 4) storage.objects: drop broad public SELECT on email-assets (objects remain reachable via signed/public URLs, but listing is removed)
DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;
CREATE POLICY "Email assets readable by authenticated staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'email-assets' AND public.is_staff(auth.uid()));
