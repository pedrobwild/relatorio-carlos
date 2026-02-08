-- Habilitar a extensão pgcrypto que fornece a função digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Atualizar a função compute_formalization_hash para usar o schema correto
CREATE OR REPLACE FUNCTION public.compute_formalization_hash(p_formalization_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_json jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'customer_org_id', customer_org_id,
    'project_id', project_id,
    'unit_id', unit_id,
    'type', type,
    'title', title,
    'summary', summary,
    'body_md', body_md,
    'data', data,
    'created_at', created_at
  ) INTO v_json
  FROM public.formalizations
  WHERE id = p_formalization_id;
  
  IF v_json IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_hash := encode(extensions.digest(v_json::text, 'sha256'), 'hex');
  RETURN v_hash;
END;
$function$;