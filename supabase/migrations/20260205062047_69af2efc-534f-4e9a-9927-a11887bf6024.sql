-- Create RLS policy for admin-only project deletion
CREATE POLICY "Only admins can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));