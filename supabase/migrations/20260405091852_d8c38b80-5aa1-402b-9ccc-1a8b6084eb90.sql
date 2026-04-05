
-- Prevent duplicate customers on retry
ALTER TABLE public.project_customers
  ADD CONSTRAINT project_customers_project_email_unique
  UNIQUE (project_id, customer_email);

-- Prevent duplicate studio info on retry
ALTER TABLE public.project_studio_info
  ADD CONSTRAINT project_studio_info_project_id_unique
  UNIQUE (project_id);
