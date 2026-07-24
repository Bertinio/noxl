
-- Add owner column to quotes
ALTER TABLE public.quotes ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Anyone can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Anyone can create quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Anyone can view quote items" ON public.quote_items;

-- Revoke anon access
REVOKE ALL ON public.quotes FROM anon;
REVOKE ALL ON public.quote_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quotes TO service_role;
GRANT ALL ON public.quote_items TO service_role;

-- Owner-scoped policies on quotes
CREATE POLICY "Users view own quotes" ON public.quotes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own quotes" ON public.quotes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own quotes" ON public.quotes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own quotes" ON public.quotes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Quote items follow parent quote ownership
CREATE POLICY "Users view own quote items" ON public.quote_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid())
  );
CREATE POLICY "Users insert own quote items" ON public.quote_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid())
  );
CREATE POLICY "Users update own quote items" ON public.quote_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid())
  );
CREATE POLICY "Users delete own quote items" ON public.quote_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid())
  );
