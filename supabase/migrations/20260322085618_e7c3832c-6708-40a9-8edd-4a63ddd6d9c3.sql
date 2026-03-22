
-- Drop the overly permissive insert policy
DROP POLICY "Authenticated users can insert notifications" ON public.notifications;

-- Create a security definer function for inserting notifications (used by edge functions/triggers)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _type public.notification_type,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _project_id UUID DEFAULT NULL,
  _action_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, type, title, body, project_id, action_url)
  VALUES (_user_id, _type, _title, _body, _project_id, _action_url)
  RETURNING id;
$$;
