
-- Helper: shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CUSTOMERS (owned by installer)
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  company text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own customers" ON public.customers
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX customers_owner_idx ON public.customers(owner_id);

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','configured','quoted','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own projects" ON public.projects
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = projects.customer_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = projects.customer_id AND c.owner_id = auth.uid()));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX projects_customer_idx ON public.projects(customer_id);

-- CONFIGURATIONS
CREATE TABLE public.configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  option_name text NOT NULL,
  option_value text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configurations TO authenticated;
GRANT ALL ON public.configurations TO service_role;
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own configurations" ON public.configurations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = configurations.project_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = configurations.project_id AND c.owner_id = auth.uid()));
CREATE INDEX configurations_project_idx ON public.configurations(project_id);

-- PROJECT_QUOTES (renamed to avoid clash with existing quotes table)
CREATE TABLE public.project_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_number text NOT NULL DEFAULT public.generate_quote_number(),
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_quotes TO authenticated;
GRANT ALL ON public.project_quotes TO service_role;
ALTER TABLE public.project_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own project_quotes" ON public.project_quotes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = project_quotes.project_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id
    WHERE p.id = project_quotes.project_id AND c.owner_id = auth.uid()));
CREATE INDEX project_quotes_project_idx ON public.project_quotes(project_id);

-- PROJECT_QUOTE_ITEMS
CREATE TABLE public.project_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.project_quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_quote_items TO authenticated;
GRANT ALL ON public.project_quote_items TO service_role;
ALTER TABLE public.project_quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own project_quote_items" ON public.project_quote_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_quotes q
    JOIN public.projects p ON p.id = q.project_id
    JOIN public.customers c ON c.id = p.customer_id
    WHERE q.id = project_quote_items.quote_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_quotes q
    JOIN public.projects p ON p.id = q.project_id
    JOIN public.customers c ON c.id = p.customer_id
    WHERE q.id = project_quote_items.quote_id AND c.owner_id = auth.uid()));
CREATE INDEX project_quote_items_quote_idx ON public.project_quote_items(quote_id);
