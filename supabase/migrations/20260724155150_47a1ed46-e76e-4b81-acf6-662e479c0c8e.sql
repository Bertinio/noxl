
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. Customers: link to auth user (nullable — invite may be pending)
ALTER TABLE public.customers ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Projects: total_price
ALTER TABLE public.projects ADD COLUMN total_price numeric NOT NULL DEFAULT 0;

-- 4. Seed admin role for all existing owners
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT owner_id, 'admin'::app_role FROM public.customers
ON CONFLICT DO NOTHING;

-- 5. Rewrite RLS: admin manages own; customer reads own (via auth_user_id join)
-- CUSTOMERS
DROP POLICY IF EXISTS "Owner manages own customers" ON public.customers;
CREATE POLICY "Admin manages own customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid());
CREATE POLICY "Customer reads own record" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'customer') AND auth_user_id = auth.uid());

-- PROJECTS
DROP POLICY IF EXISTS "Owner manages own projects" ON public.projects;
CREATE POLICY "Admin manages own projects" ON public.projects
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = projects.customer_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = projects.customer_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Customer reads own projects" ON public.projects
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = projects.customer_id AND c.auth_user_id = auth.uid() AND public.has_role(auth.uid(), 'customer')));

-- CONFIGURATIONS
DROP POLICY IF EXISTS "Owner manages own configurations" ON public.configurations;
CREATE POLICY "Admin manages own configurations" ON public.configurations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
                 WHERE p.id = configurations.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
                      WHERE p.id = configurations.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Customer reads own configurations" ON public.configurations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
                 WHERE p.id = configurations.project_id AND c.auth_user_id = auth.uid() AND public.has_role(auth.uid(), 'customer')));

-- PROJECT_QUOTES
DROP POLICY IF EXISTS "Owner manages own project_quotes" ON public.project_quotes;
CREATE POLICY "Admin manages own project_quotes" ON public.project_quotes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
                 WHERE p.id = project_quotes.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
                      WHERE p.id = project_quotes.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Customer reads own project_quotes" ON public.project_quotes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
                 WHERE p.id = project_quotes.project_id AND c.auth_user_id = auth.uid() AND public.has_role(auth.uid(), 'customer')));

-- PROJECT_QUOTE_ITEMS
DROP POLICY IF EXISTS "Owner manages own project_quote_items" ON public.project_quote_items;
CREATE POLICY "Admin manages own project_quote_items" ON public.project_quote_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_quotes q JOIN public.projects p ON p.id = q.project_id JOIN public.customers c ON c.id = p.customer_id
                 WHERE q.id = project_quote_items.quote_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_quotes q JOIN public.projects p ON p.id = q.project_id JOIN public.customers c ON c.id = p.customer_id
                      WHERE q.id = project_quote_items.quote_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Customer reads own project_quote_items" ON public.project_quote_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_quotes q JOIN public.projects p ON p.id = q.project_id JOIN public.customers c ON c.id = p.customer_id
                 WHERE q.id = project_quote_items.quote_id AND c.auth_user_id = auth.uid() AND public.has_role(auth.uid(), 'customer')));

-- 6. Trigger: mark project as 'quoted' when a quote is created
CREATE OR REPLACE FUNCTION public.mark_project_quoted()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.projects SET status = 'quoted', updated_at = now()
  WHERE id = NEW.project_id AND status <> 'accepted';
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_project_quoted AFTER INSERT ON public.project_quotes
  FOR EACH ROW EXECUTE FUNCTION public.mark_project_quoted();
