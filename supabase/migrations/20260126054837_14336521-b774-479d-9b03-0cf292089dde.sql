-- Add boleto_path column to project_payments
ALTER TABLE public.project_payments 
ADD COLUMN boleto_path text;

-- Add column to track if notification was sent
ALTER TABLE public.project_payments 
ADD COLUMN notification_sent_at timestamp with time zone;

-- RLS policies for payment-boletos bucket (simpler approach - members can view, admins can modify)
CREATE POLICY "Project members can view boletos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-boletos'
);

-- Only admins can upload boletos
CREATE POLICY "Admins can upload boletos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-boletos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Only admins can update boletos  
CREATE POLICY "Admins can update boletos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-boletos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Only admins can delete boletos
CREATE POLICY "Admins can delete boletos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-boletos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);