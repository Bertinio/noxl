CREATE POLICY "Installer manages own customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'installer') AND owner_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'installer') AND owner_id = auth.uid());

CREATE POLICY "Installer manages own projects" ON public.projects
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = projects.customer_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = projects.customer_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')));

CREATE POLICY "Installer manages own configurations" ON public.configurations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id WHERE p.id = configurations.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id WHERE p.id = configurations.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')));

CREATE POLICY "Installer manages own project_quotes" ON public.project_quotes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id WHERE p.id = project_quotes.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p JOIN public.customers c ON c.id = p.customer_id WHERE p.id = project_quotes.project_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')));

CREATE POLICY "Installer manages own project_quote_items" ON public.project_quote_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_quotes q JOIN public.projects p ON p.id = q.project_id JOIN public.customers c ON c.id = p.customer_id WHERE q.id = project_quote_items.quote_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_quotes q JOIN public.projects p ON p.id = q.project_id JOIN public.customers c ON c.id = p.customer_id WHERE q.id = project_quote_items.quote_id AND c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'installer')));