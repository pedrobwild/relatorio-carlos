-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('engineer', 'admin', 'customer');

-- 2. Create user_roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Create projects (obras) table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_name TEXT,
  address TEXT,
  planned_start_date DATE NOT NULL,
  planned_end_date DATE NOT NULL,
  actual_start_date DATE,
  actual_end_date DATE,
  contract_value DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create project_engineers table (which engineers manage which projects)
CREATE TABLE public.project_engineers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  engineer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, engineer_user_id)
);

-- 5. Create project_customers table (which customers have access to which projects)
CREATE TABLE public.project_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  invitation_sent_at TIMESTAMP WITH TIME ZONE,
  invitation_accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, customer_email)
);

-- 6. Create project_documents table
CREATE TABLE public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'project_3d', 'executive_project', 'addendum', 'other')),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'project-documents',
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Create project_payments table (parcelas)
CREATE TABLE public.project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_proof_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, installment_number)
);

-- 8. Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;

-- 9. Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 10. Create function to check if user is engineer or admin
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('engineer', 'admin')
  )
$$;

-- 11. Create function to check if user has access to project
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Admin has access to all
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
    UNION
    -- Engineer assigned to project
    SELECT 1 FROM public.project_engineers WHERE engineer_user_id = _user_id AND project_id = _project_id
    UNION
    -- Customer linked to project
    SELECT 1 FROM public.project_customers WHERE customer_user_id = _user_id AND project_id = _project_id
  )
$$;

-- 12. RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 13. RLS Policies for projects
CREATE POLICY "Staff can view projects they have access to"
ON public.projects FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  EXISTS (SELECT 1 FROM public.project_engineers WHERE engineer_user_id = auth.uid() AND project_id = id)
);

CREATE POLICY "Customers can view their projects"
ON public.projects FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.project_customers WHERE customer_user_id = auth.uid() AND project_id = id)
);

CREATE POLICY "Staff can create projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Staff can update their projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  EXISTS (SELECT 1 FROM public.project_engineers WHERE engineer_user_id = auth.uid() AND project_id = id)
);

-- 14. RLS Policies for project_engineers
CREATE POLICY "Staff can view project engineers"
ON public.project_engineers FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage project engineers"
ON public.project_engineers FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()));

-- 15. RLS Policies for project_customers
CREATE POLICY "Staff can manage project customers"
ON public.project_customers FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Customers can view their own record"
ON public.project_customers FOR SELECT
TO authenticated
USING (customer_user_id = auth.uid());

-- 16. RLS Policies for project_documents
CREATE POLICY "Users with project access can view documents"
ON public.project_documents FOR SELECT
TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage documents"
ON public.project_documents FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 17. RLS Policies for project_payments
CREATE POLICY "Users with project access can view payments"
ON public.project_payments FOR SELECT
TO authenticated
USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage payments"
ON public.project_payments FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 18. Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false);

-- 19. Storage policies for project-documents bucket
CREATE POLICY "Staff can upload project documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-documents' AND public.is_staff(auth.uid()));

CREATE POLICY "Users with access can view project documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-documents');

-- 20. Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_project_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_project_updated_at();

-- 21. Function to assign default role on signup (customer by default)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role app_role;
BEGIN
  -- Check if role was specified in metadata, default to customer
  assigned_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'customer'::app_role
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();