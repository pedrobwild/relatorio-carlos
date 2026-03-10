
-- Convert RESTRICT FK constraints on projects to CASCADE
ALTER TABLE pending_items DROP CONSTRAINT pending_items_project_id_fkey;
ALTER TABLE pending_items ADD CONSTRAINT pending_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE formalizations DROP CONSTRAINT formalizations_project_id_fkey;
ALTER TABLE formalizations ADD CONSTRAINT formalizations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE project_documents DROP CONSTRAINT project_documents_project_id_fkey;
ALTER TABLE project_documents ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE project_payments DROP CONSTRAINT project_payments_project_id_fkey;
ALTER TABLE project_payments ADD CONSTRAINT project_payments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE project_members DROP CONSTRAINT project_members_project_id_fkey;
ALTER TABLE project_members ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE domain_events DROP CONSTRAINT domain_events_project_id_fkey;
ALTER TABLE domain_events ADD CONSTRAINT domain_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE files DROP CONSTRAINT files_project_id_fkey;
ALTER TABLE files ADD CONSTRAINT files_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE invitations DROP CONSTRAINT invitations_project_id_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
