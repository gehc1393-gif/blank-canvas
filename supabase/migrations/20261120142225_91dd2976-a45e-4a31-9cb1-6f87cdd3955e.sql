CREATE TABLE public.recipe_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  yield_units integer NOT NULL CHECK (yield_units > 0),
  unit_weight_grams numeric CHECK (unit_weight_grams > 0),
  prep_minutes integer CHECK (prep_minutes >= 0),
  oven_minutes integer CHECK (oven_minutes >= 0),
  oven_temperature_c numeric CHECK (oven_temperature_c > 0),
  instructions text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_sheets_user_code_unique UNIQUE (user_id, code),
  CONSTRAINT recipe_sheets_code_valid CHECK (code = upper(btrim(code)) AND code !~ '^\s*$'),
  CONSTRAINT recipe_sheets_name_nonempty CHECK (name !~ '^\s*$'),
  CONSTRAINT recipe_sheets_category_nonempty CHECK (category !~ '^\s*$')
);
GRANT SELECT, INSERT, UPDATE ON public.recipe_sheets TO authenticated;
GRANT ALL ON public.recipe_sheets TO service_role;
REVOKE ALL ON public.recipe_sheets FROM anon, PUBLIC;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.recipe_sheets FROM authenticated;
ALTER TABLE public.recipe_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY recipe_sheets_select ON public.recipe_sheets FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY recipe_sheets_insert ON public.recipe_sheets FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY recipe_sheets_update ON public.recipe_sheets FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE FUNCTION public.normalize_recipe_sheet_code() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.code = upper(btrim(NEW.code));
  RETURN NEW;
END;
$$;
CREATE TRIGGER normalize_recipe_sheet_code BEFORE INSERT OR UPDATE ON public.recipe_sheets FOR EACH ROW EXECUTE FUNCTION public.normalize_recipe_sheet_code();
CREATE TRIGGER touch_recipe_sheets_updated_at BEFORE UPDATE ON public.recipe_sheets FOR EACH ROW EXECUTE FUNCTION public.touch_business_updated_at();