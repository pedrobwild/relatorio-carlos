
-- Drop existing customer policies
DROP POLICY IF EXISTS "Customers can insert meeting availability" ON public.journey_meeting_availability;
DROP POLICY IF EXISTS "Customers can update their own pending availability" ON public.journey_meeting_availability;
DROP POLICY IF EXISTS "Customers can view meeting availability for their projects" ON public.journey_meeting_availability;

-- Recreate using has_project_access which covers project_members, project_customers, and project_engineers
CREATE POLICY "Users can view meeting availability for their projects"
  ON public.journey_meeting_availability FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Users can insert meeting availability"
  ON public.journey_meeting_availability FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by
    AND public.has_project_access(auth.uid(), project_id)
  );

CREATE POLICY "Users can update their own pending availability"
  ON public.journey_meeting_availability FOR UPDATE
  USING (
    submitted_by = auth.uid()
    AND status = 'pending_confirmation'
  );

CREATE POLICY "Users can delete their own pending availability"
  ON public.journey_meeting_availability FOR DELETE
  USING (
    submitted_by = auth.uid()
    AND status = 'pending_confirmation'
  );
