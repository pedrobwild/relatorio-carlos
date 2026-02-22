
-- Fix: Allow customers with project access to SEE formalizations linked to their project
DROP POLICY IF EXISTS "formalizations_select_policy" ON formalizations;
CREATE POLICY "formalizations_select_policy" ON formalizations
  FOR SELECT USING (
    user_belongs_to_org(auth.uid(), customer_org_id)
    OR (project_id IS NOT NULL AND has_project_access(auth.uid(), project_id))
  );

-- Fix: Allow customers with project access to SEE acknowledgements
DROP POLICY IF EXISTS "formalization_acknowledgements_select_policy" ON formalization_acknowledgements;
CREATE POLICY "formalization_acknowledgements_select_policy" ON formalization_acknowledgements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM formalizations f
      WHERE f.id = formalization_acknowledgements.formalization_id
        AND (
          user_belongs_to_org(auth.uid(), f.customer_org_id)
          OR (f.project_id IS NOT NULL AND has_project_access(auth.uid(), f.project_id))
        )
    )
  );

-- Fix: Allow customers with project access to SEE parties
DROP POLICY IF EXISTS "formalization_parties_select_policy" ON formalization_parties;
CREATE POLICY "formalization_parties_select_policy" ON formalization_parties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM formalizations f
      WHERE f.id = formalization_parties.formalization_id
        AND (
          user_belongs_to_org(auth.uid(), f.customer_org_id)
          OR (f.project_id IS NOT NULL AND has_project_access(auth.uid(), f.project_id))
        )
    )
  );

-- Fix: Allow customers with project access to SEE events
DROP POLICY IF EXISTS "formalization_events_select_policy" ON formalization_events;
CREATE POLICY "formalization_events_select_policy" ON formalization_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM formalizations f
      WHERE f.id = formalization_events.formalization_id
        AND (
          user_belongs_to_org(auth.uid(), f.customer_org_id)
          OR (f.project_id IS NOT NULL AND has_project_access(auth.uid(), f.project_id))
        )
    )
  );

-- Fix: Allow customers with project access to INSERT events (for signing)
DROP POLICY IF EXISTS "formalization_events_insert_policy" ON formalization_events;
CREATE POLICY "formalization_events_insert_policy" ON formalization_events
  FOR INSERT WITH CHECK (
    ((actor_user_id = auth.uid()) OR (actor_user_id IS NULL))
    AND (EXISTS (
      SELECT 1 FROM formalizations f
      WHERE f.id = formalization_events.formalization_id
        AND (
          user_belongs_to_org(auth.uid(), f.customer_org_id)
          OR (f.project_id IS NOT NULL AND has_project_access(auth.uid(), f.project_id))
        )
    ))
  );
