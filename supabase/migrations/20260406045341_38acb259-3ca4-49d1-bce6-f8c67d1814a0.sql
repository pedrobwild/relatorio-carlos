ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (
  role = ANY (
    ARRAY[
      'customer'::text,
      'staff'::text,
      'manager'::text,
      'admin'::text,
      'engineer'::text,
      'suprimentos'::text,
      'financeiro'::text,
      'gestor'::text,
      'cs'::text
    ]
  )
);