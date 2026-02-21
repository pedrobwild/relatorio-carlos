
-- Fix the Staff full access policy to also match 'engineer' and 'manager' role values
-- (the existing policy only checks for 'admin', 'gestor', 'engenheiro' which are legacy values)
DROP POLICY IF EXISTS "Staff full access on meeting availability" ON public.journey_meeting_availability;

CREATE POLICY "Staff full access on meeting availability"
ON public.journey_meeting_availability
FOR ALL
USING (
  user_is_staff_or_above(auth.uid())
)
WITH CHECK (
  user_is_staff_or_above(auth.uid())
);
