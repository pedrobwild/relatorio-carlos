-- Add budget summary fields to orcamentos
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS total_value numeric,
  ADD COLUMN IF NOT EXISTS total_sale numeric,
  ADD COLUMN IF NOT EXISTS total_cost numeric,
  ADD COLUMN IF NOT EXISTS avg_bdi numeric,
  ADD COLUMN IF NOT EXISTS net_margin numeric;

-- Add detailed fields to orcamento_sections
ALTER TABLE public.orcamento_sections
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS included_bullets text[],
  ADD COLUMN IF NOT EXISTS excluded_bullets text[],
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS cost numeric,
  ADD COLUMN IF NOT EXISTS bdi_percentage numeric,
  ADD COLUMN IF NOT EXISTS item_count integer;

-- Add detailed fields to orcamento_items
ALTER TABLE public.orcamento_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS included_rooms text[],
  ADD COLUMN IF NOT EXISTS excluded_rooms text[],
  ADD COLUMN IF NOT EXISTS coverage_type text,
  ADD COLUMN IF NOT EXISTS reference_url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Create orcamento_adjustments table
CREATE TABLE IF NOT EXISTS public.orcamento_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  external_id text,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  sign integer NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_adjustments_orcamento ON public.orcamento_adjustments(orcamento_id);

ALTER TABLE public.orcamento_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage orcamento_adjustments"
  ON public.orcamento_adjustments
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'engineer'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'cs'::app_role)
  );