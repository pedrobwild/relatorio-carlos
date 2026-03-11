-- Fix existing unlinked record for lumilito@uol.com.br
UPDATE public.project_customers 
SET customer_user_id = 'fa87efaa-a053-4f6c-9512-2342a194bdbf' 
WHERE id = 'ef55d48f-7ef8-4561-9a94-aaea18a5c1d5' 
AND customer_user_id IS NULL;