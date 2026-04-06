-- Fix orcamentos RLS: drop and recreate with explicit WITH CHECK
DROP POLICY IF EXISTS "Staff can manage orcamentos" ON public.orcamentos;
CREATE POLICY "Staff can manage orcamentos" ON public.orcamentos
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage orcamento_sections" ON public.orcamento_sections;
CREATE POLICY "Staff can manage orcamento_sections" ON public.orcamento_sections
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage orcamento_items" ON public.orcamento_items;
CREATE POLICY "Staff can manage orcamento_items" ON public.orcamento_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage orcamento_notas" ON public.orcamento_notas;
CREATE POLICY "Staff can manage orcamento_notas" ON public.orcamento_notas
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage orcamento_eventos" ON public.orcamento_eventos;
CREATE POLICY "Staff can manage orcamento_eventos" ON public.orcamento_eventos
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can manage orcamento_adjustments" ON public.orcamento_adjustments;
CREATE POLICY "Staff can manage orcamento_adjustments" ON public.orcamento_adjustments
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));