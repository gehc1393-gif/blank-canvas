DROP POLICY IF EXISTS packaging_categories_read ON public.packaging_categories;
CREATE POLICY packaging_categories_read ON public.packaging_categories
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);