
-- Dynamic supplier categories
CREATE TABLE public.supplier_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  color text DEFAULT 'bg-muted text-muted-foreground',
  icon text DEFAULT NULL,
  is_default boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view supplier categories"
  ON public.supplier_categories FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage supplier categories"
  ON public.supplier_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_supplier_categories_updated_at
  BEFORE UPDATE ON public.supplier_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default categories
INSERT INTO public.supplier_categories (name, slug, color, is_default, sort_order) VALUES
  ('Materiais', 'materiais', 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', true, 1),
  ('Mão de Obra', 'mao_de_obra', 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', true, 2),
  ('Serviços', 'servicos', 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', true, 3),
  ('Equipamentos', 'equipamentos', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', true, 4),
  ('Outros', 'outros', 'bg-muted text-muted-foreground', true, 5);

-- Supplier settings key-value store
CREATE TABLE public.supplier_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view supplier settings"
  ON public.supplier_settings FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage supplier settings"
  ON public.supplier_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_supplier_settings_updated_at
  BEFORE UPDATE ON public.supplier_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings
INSERT INTO public.supplier_settings (key, value, description) VALUES
  ('avaliacao_obrigatoria', 'false', 'Exigir avaliação ao cadastrar fornecedor'),
  ('prazo_entrega_padrao', '30', 'Prazo de entrega padrão em dias'),
  ('documentos_obrigatorios', '[]', 'Lista de documentos obrigatórios para cadastro');
