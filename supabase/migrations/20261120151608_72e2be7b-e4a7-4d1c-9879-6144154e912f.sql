ALTER TABLE public.recipe_sheets
  ADD CONSTRAINT recipe_sheets_user_id_id_key UNIQUE (user_id, id);

ALTER TABLE public.products
  ADD COLUMN recipe_sheet_id uuid,
  ADD COLUMN units_per_presentation integer,
  ADD CONSTRAINT products_recipe_sheet_fkey
    FOREIGN KEY (user_id, recipe_sheet_id)
    REFERENCES public.recipe_sheets (user_id, id),
  ADD CONSTRAINT products_linked_presentation_positive
    CHECK (recipe_sheet_id IS NULL OR (units_per_presentation IS NOT NULL AND units_per_presentation > 0)),
  ADD CONSTRAINT products_linked_recipe_empty
    CHECK (recipe_sheet_id IS NULL OR recipe = '[]'::jsonb);

ALTER TABLE public.productions
  ADD COLUMN ingredient_cost numeric,
  ADD CONSTRAINT productions_ingredient_cost_nonnegative
    CHECK (ingredient_cost IS NULL OR ingredient_cost >= 0);

CREATE OR REPLACE FUNCTION public.read_business_data()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  u uuid := auth.uid();
  result jsonb;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.business_revisions(user_id) VALUES(u) ON CONFLICT DO NOTHING;
  PERFORM revision FROM public.business_revisions WHERE user_id = u FOR SHARE;
  -- Whole-row JSON includes recipe_sheet_id, units_per_presentation and ingredient_cost,
  -- including null values on legacy records.
  SELECT jsonb_build_object(
    'revision', r.revision,
    'materials', COALESCE((SELECT jsonb_agg(to_jsonb(t)-'user_id'-'created_at'-'updated_at') FROM public.materials t WHERE user_id=u), '[]'::jsonb),
    'movements', COALESCE((SELECT jsonb_agg(to_jsonb(t)-'user_id'-'created_at'-'updated_at') FROM public.stock_movements t WHERE user_id=u), '[]'::jsonb),
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(t)-'user_id'-'created_at'-'updated_at') FROM public.products t WHERE user_id=u), '[]'::jsonb),
    'productions', COALESCE((SELECT jsonb_agg(to_jsonb(t)-'user_id'-'created_at'-'updated_at') FROM public.productions t WHERE user_id=u), '[]'::jsonb),
    'sales', COALESCE((SELECT jsonb_agg(to_jsonb(t)-'user_id'-'created_at'-'updated_at') FROM public.sales t WHERE user_id=u), '[]'::jsonb),
    'expenses', COALESCE((SELECT jsonb_agg(to_jsonb(t)-'user_id'-'created_at'-'updated_at') FROM public.expenses t WHERE user_id=u), '[]'::jsonb),
    'prices', COALESCE((SELECT jsonb_object_agg("productId",price) FROM public.product_prices WHERE user_id=u), '{}'::jsonb)
  ) INTO result FROM public.business_revisions r WHERE user_id=u;
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION public.save_business_data(expected_revision integer, payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  u uuid := auth.uid();
  current_revision integer;
  existing_products jsonb;
  existing_productions jsonb;
  normalized_products jsonb := '[]'::jsonb;
  normalized_productions jsonb := '[]'::jsonb;
  item jsonb;
  previous jsonb;
  link_id uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.business_revisions(user_id) VALUES(u) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM public.business_revisions WHERE user_id=u FOR UPDATE;
  IF current_revision <> expected_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;

  -- Snapshot the same account's records BEFORE the delete/reinsert cycle.
  SELECT COALESCE(jsonb_object_agg(id,to_jsonb(p)), '{}'::jsonb)
    INTO existing_products FROM public.products p WHERE user_id=u;
  SELECT COALESCE(jsonb_object_agg(id,to_jsonb(p)), '{}'::jsonb)
    INTO existing_productions FROM public.productions p WHERE user_id=u;

  FOR item IN SELECT value FROM jsonb_array_elements(payload->'products') LOOP
    previous := existing_products->(item->>'id');
    -- Presence, not COALESCE, distinguishes an old client from an explicit unlink.
    IF NOT (item ? 'recipe_sheet_id') THEN
      item := item || jsonb_build_object('recipe_sheet_id', previous->'recipe_sheet_id');
    END IF;
    IF NOT (item ? 'units_per_presentation') THEN
      item := item || jsonb_build_object('units_per_presentation', previous->'units_per_presentation');
    END IF;
    BEGIN
      link_id := (item->>'recipe_sheet_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_RECIPE_LINK' USING ERRCODE = '22023';
    END;
    IF link_id IS NOT NULL THEN
      IF link_id IS DISTINCT FROM (previous->>'recipe_sheet_id')::uuid THEN
        -- Lock the active sheet until commit so concurrent inactivation cannot
        -- race a new/changed link. Existing inactive links need no active check.
        PERFORM id FROM public.recipe_sheets
          WHERE user_id=u AND id=link_id AND active=true FOR SHARE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'INVALID_RECIPE_LINK' USING ERRCODE = '22023';
        END IF;
      END IF;
      item := item || jsonb_build_object('recipe', '[]'::jsonb);
    END IF;
    normalized_products := normalized_products || jsonb_build_array(item);
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(payload->'productions') LOOP
    previous := existing_productions->(item->>'id');
    -- Every existing production is finalized: its original cost (even null)
    -- is immutable, including when a new client supplies a different value.
    IF previous IS NOT NULL THEN
      item := item || jsonb_build_object('ingredient_cost', previous->'ingredient_cost');
    ELSIF NOT (item ? 'ingredient_cost') THEN
      item := item || jsonb_build_object('ingredient_cost', NULL);
    END IF;
    normalized_productions := normalized_productions || jsonb_build_array(item);
  END LOOP;

  DELETE FROM public.product_prices WHERE user_id=u;
  DELETE FROM public.sales WHERE user_id=u;
  DELETE FROM public.productions WHERE user_id=u;
  DELETE FROM public.stock_movements WHERE user_id=u;
  DELETE FROM public.products WHERE user_id=u;
  DELETE FROM public.materials WHERE user_id=u;
  DELETE FROM public.expenses WHERE user_id=u;

  INSERT INTO public.materials(id,user_id,name,unit,quantity,minimum,"unitCost")
    SELECT id,u,name,unit,quantity,minimum,"unitCost" FROM jsonb_to_recordset(payload->'materials') AS x(id text,name text,unit text,quantity numeric,minimum numeric,"unitCost" numeric);
  INSERT INTO public.products(id,user_id,name,"batchYield",recipe,"producedUnits","createdAt",recipe_sheet_id,units_per_presentation)
    SELECT id,u,name,"batchYield",recipe,"producedUnits","createdAt",recipe_sheet_id,units_per_presentation
    FROM jsonb_to_recordset(normalized_products) AS x(id text,name text,"batchYield" numeric,recipe jsonb,"producedUnits" numeric,"createdAt" timestamptz,recipe_sheet_id uuid,units_per_presentation integer);
  INSERT INTO public.stock_movements(id,user_id,"materialId",kind,quantity,note,"createdAt")
    SELECT id,u,"materialId",kind,quantity,note,"createdAt" FROM jsonb_to_recordset(payload->'movements') AS x(id text,"materialId" text,kind text,quantity numeric,note text,"createdAt" timestamptz);
  INSERT INTO public.productions(id,user_id,"productId",batches,units,"createdAt",ingredient_cost)
    SELECT id,u,"productId",batches,units,"createdAt",ingredient_cost
    FROM jsonb_to_recordset(normalized_productions) AS x(id text,"productId" text,batches numeric,units numeric,"createdAt" timestamptz,ingredient_cost numeric);
  INSERT INTO public.sales(id,user_id,"productId",quantity,"unitPrice","unitCost","soldAt")
    SELECT id,u,"productId",quantity,"unitPrice","unitCost","soldAt" FROM jsonb_to_recordset(payload->'sales') AS x(id text,"productId" text,quantity numeric,"unitPrice" numeric,"unitCost" numeric,"soldAt" timestamptz);
  INSERT INTO public.expenses(id,user_id,description,category,amount,"spentAt")
    SELECT id,u,description,category,amount,"spentAt" FROM jsonb_to_recordset(payload->'expenses') AS x(id text,description text,category text,amount numeric,"spentAt" date);
  INSERT INTO public.product_prices(user_id,"productId",price)
    SELECT u,key,value::numeric FROM jsonb_each_text(payload->'prices');
  UPDATE public.business_revisions SET revision=revision+1 WHERE user_id=u RETURNING revision INTO current_revision;
  RETURN current_revision;
END
$function$;