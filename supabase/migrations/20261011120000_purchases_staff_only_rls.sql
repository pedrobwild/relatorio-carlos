-- Compras são 100% internas: o cliente não deve enxergar nada de compras,
-- nem pelo menu nem pela API. Esta migration fecha as últimas policies de
-- compras que ainda liberavam leitura/escrita a qualquer usuário com acesso
-- à obra (has_project_access sem is_staff).
--
-- project_purchases já foi restrito a staff em 20260628073734.
-- Demais tabelas de compras (purchase_receipts, purchase_payment_schedule,
-- material_requisitions*, requisition_quotes, fornecedor*, supplier_*,
-- stock_*) já exigem is_staff desde a criação.

-- ------------------------------------------------------------------
-- 1) purchase_payment_flows: SELECT só para staff com acesso à obra
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users with project access can view payment flows" ON public.purchase_payment_flows;
DROP POLICY IF EXISTS "Staff can view payment flows" ON public.purchase_payment_flows;
CREATE POLICY "Staff can view payment flows"
  ON public.purchase_payment_flows FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- ------------------------------------------------------------------
-- 2) project_purchase_attachments: SELECT / INSERT / DELETE só staff
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "ppa_select_project_access" ON public.project_purchase_attachments;
DROP POLICY IF EXISTS "ppa_select_staff" ON public.project_purchase_attachments;
CREATE POLICY "ppa_select_staff"
  ON public.project_purchase_attachments FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "ppa_insert_project_access" ON public.project_purchase_attachments;
DROP POLICY IF EXISTS "ppa_insert_staff" ON public.project_purchase_attachments;
CREATE POLICY "ppa_insert_staff"
  ON public.project_purchase_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), project_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "ppa_delete_uploader_or_staff" ON public.project_purchase_attachments;
DROP POLICY IF EXISTS "ppa_delete_staff" ON public.project_purchase_attachments;
CREATE POLICY "ppa_delete_staff"
  ON public.project_purchase_attachments FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- ------------------------------------------------------------------
-- 3) storage bucket purchase-attachments: SELECT / INSERT / DELETE só staff
--    (primeiro segmento do path = project_id)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "purchase_attachments_select" ON storage.objects;
CREATE POLICY "purchase_attachments_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'purchase-attachments'
    AND public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "purchase_attachments_insert" ON storage.objects;
CREATE POLICY "purchase_attachments_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'purchase-attachments'
    AND public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "purchase_attachments_delete" ON storage.objects;
CREATE POLICY "purchase_attachments_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'purchase-attachments'
    AND public.is_staff(auth.uid())
  );
