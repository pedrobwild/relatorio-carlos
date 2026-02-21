
-- Add ON DELETE CASCADE to formalization child tables
-- This replaces manual JS cascade deletion in useDeleteFormalizacao

ALTER TABLE public.formalization_acknowledgements
  DROP CONSTRAINT formalization_acknowledgements_formalization_id_fkey,
  ADD CONSTRAINT formalization_acknowledgements_formalization_id_fkey
    FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE CASCADE;

ALTER TABLE public.formalization_events
  DROP CONSTRAINT formalization_events_formalization_id_fkey,
  ADD CONSTRAINT formalization_events_formalization_id_fkey
    FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE CASCADE;

ALTER TABLE public.formalization_evidence_links
  DROP CONSTRAINT formalization_evidence_links_formalization_id_fkey,
  ADD CONSTRAINT formalization_evidence_links_formalization_id_fkey
    FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE CASCADE;

ALTER TABLE public.formalization_attachments
  DROP CONSTRAINT formalization_attachments_formalization_id_fkey,
  ADD CONSTRAINT formalization_attachments_formalization_id_fkey
    FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE CASCADE;

ALTER TABLE public.formalization_versions
  DROP CONSTRAINT formalization_versions_formalization_id_fkey,
  ADD CONSTRAINT formalization_versions_formalization_id_fkey
    FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE CASCADE;

ALTER TABLE public.formalization_parties
  DROP CONSTRAINT formalization_parties_formalization_id_fkey,
  ADD CONSTRAINT formalization_parties_formalization_id_fkey
    FOREIGN KEY (formalization_id) REFERENCES public.formalizations(id) ON DELETE CASCADE;

-- Also cascade acknowledgements when a party is deleted
ALTER TABLE public.formalization_acknowledgements
  DROP CONSTRAINT formalization_acknowledgements_party_id_fkey,
  ADD CONSTRAINT formalization_acknowledgements_party_id_fkey
    FOREIGN KEY (party_id) REFERENCES public.formalization_parties(id) ON DELETE CASCADE;
