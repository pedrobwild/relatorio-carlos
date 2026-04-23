ALTER TABLE public.project_purchases DROP CONSTRAINT IF EXISTS project_purchases_status_check;

ALTER TABLE public.project_purchases ADD CONSTRAINT project_purchases_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'awaiting_approval'::text,
    'approved'::text,
    'purchased'::text,
    'ordered'::text,
    'in_transit'::text,
    'delivered'::text,
    'sent_to_site'::text,
    'cancelled'::text,
    'delayed'::text
  ]));