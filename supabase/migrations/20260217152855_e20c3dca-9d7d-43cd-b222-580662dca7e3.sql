-- Drop the restrictive customer-only SELECT policy
DROP POLICY IF EXISTS "Customers can view team members" ON public.journey_team_members;

-- Create a new policy that checks both project_customers AND project_members
CREATE POLICY "Users with project access can view team members"
ON public.journey_team_members
FOR SELECT
USING (has_project_access(auth.uid(), project_id));