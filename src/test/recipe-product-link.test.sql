-- Run only in an isolated PostgreSQL test database after the project migrations.
-- Never run against the connected Supabase: all fixtures are synthetic.
BEGIN;
DO $test$
DECLARE
  u uuid := '11111111-1111-4111-8111-111111111111';
  sheet uuid := '22222222-2222-4222-8222-222222222222';
  inactive_sheet uuid := '33333333-3333-4333-8333-333333333333';
  foreign_sheet uuid := '44444444-4444-4444-8444-444444444444';
  payload jsonb;
  original jsonb;
  rev integer;
  rejected boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', u::text, true);
  INSERT INTO public.recipe_sheets(id,user_id,code,name,category,yield_units,active) VALUES
    (sheet,u,'ACTIVE','Active','Test',12,true),
    (inactive_sheet,u,'INACTIVE','Inactive','Test',12,false),
    (foreign_sheet,'55555555-5555-4555-8555-555555555555','FOREIGN','Foreign','Test',12,true);
  payload := jsonb_build_object(
    'materials','[]'::jsonb,'movements','[]'::jsonb,'sales','[]'::jsonb,'expenses','[]'::jsonb,
    'prices',jsonb_build_object('linked',5),
    'products',jsonb_build_array(
      jsonb_build_object('id','linked','name','Linked','batchYield',12,'recipe','[]'::jsonb,
        'producedUnits',12,'createdAt','2026-11-20T15:00:00Z',
        'recipe_sheet_id',sheet,'units_per_presentation',6),
      jsonb_build_object('id','shared','name','Shared','batchYield',12,'recipe','[]'::jsonb,
        'producedUnits',0,'createdAt','2026-11-20T15:00:00Z',
        'recipe_sheet_id',sheet,'units_per_presentation',3),
      jsonb_build_object('id','legacy','name','Legacy','batchYield',12,'recipe','[]'::jsonb,
        'producedUnits',0,'createdAt','2026-11-20T15:00:00Z')),
    'productions',jsonb_build_array(jsonb_build_object('id','done','productId','linked',
      'batches',1,'units',12,'createdAt','2026-11-20T15:00:00Z','ingredient_cost',7.5))
  );
  rev := public.save_business_data(0,payload);
  IF rev <> 1 THEN RAISE EXCEPTION 'Revision must increment to 1'; END IF;
  IF (SELECT count(*) FROM public.products WHERE user_id=u AND recipe_sheet_id=sheet) <> 2 THEN
    RAISE EXCEPTION 'Two products must be able to share one sheet';
  END IF;
  IF (SELECT recipe_sheet_id IS NOT NULL OR units_per_presentation IS NOT NULL FROM public.products WHERE user_id=u AND id='legacy') THEN
    RAISE EXCEPTION 'Legacy fields must remain null';
  END IF;
  payload := public.read_business_data();
  IF NOT ((payload->'products'->0) ? 'recipe_sheet_id') OR NOT ((payload->'products'->0) ? 'units_per_presentation')
    OR NOT ((payload->'productions'->0) ? 'ingredient_cost') THEN
    RAISE EXCEPTION 'Read must return all three new fields';
  END IF;
  original := payload;

  -- Old clients omit both product fields and production costs.
  payload := jsonb_set(payload,'{products}',(SELECT jsonb_agg(value-'recipe_sheet_id'-'units_per_presentation') FROM jsonb_array_elements(payload->'products')));
  payload := jsonb_set(payload,'{productions}',(SELECT jsonb_agg(value-'ingredient_cost') FROM jsonb_array_elements(payload->'productions')));
  rev := public.save_business_data(rev,payload);
  IF (SELECT recipe_sheet_id IS DISTINCT FROM sheet OR units_per_presentation IS DISTINCT FROM 6 FROM public.products WHERE user_id=u AND id='linked') THEN
    RAISE EXCEPTION 'Old clients must preserve the sheet and six units';
  END IF;
  IF (SELECT ingredient_cost IS DISTINCT FROM 7.5 FROM public.productions WHERE user_id=u AND id='done') THEN
    RAISE EXCEPTION 'Old clients must preserve the original 7.5 cost';
  END IF;
  IF (SELECT price IS DISTINCT FROM 5 FROM public.product_prices WHERE user_id=u AND "productId"='linked') THEN
    RAISE EXCEPTION 'The existing price of 5 must be preserved';
  END IF;

  -- Even explicit replacement costs cannot rewrite a finalized production.
  payload := public.read_business_data();
  payload := jsonb_set(payload,'{productions,0,ingredient_cost}','99');
  rev := public.save_business_data(rev,payload);
  IF (SELECT ingredient_cost IS DISTINCT FROM 7.5 FROM public.productions WHERE user_id=u AND id='done') THEN
    RAISE EXCEPTION 'A finalized cost must remain 7.5, not 99';
  END IF;
  UPDATE public.recipe_sheets SET active=false WHERE id=sheet AND user_id=u;
  rev := public.save_business_data(rev,public.read_business_data());
  IF (SELECT recipe_sheet_id IS DISTINCT FROM sheet FROM public.products WHERE user_id=u AND id='linked') THEN
    RAISE EXCEPTION 'Existing inactive links must be retained';
  END IF;

  -- New/changed inactive, foreign, missing and malformed links must be rejected.
  FOREACH sheet IN ARRAY ARRAY[inactive_sheet,foreign_sheet,'66666666-6666-4666-8666-666666666666'::uuid] LOOP
    payload := public.read_business_data();
    payload := jsonb_set(payload,'{products,0,recipe_sheet_id}',to_jsonb(sheet));
    rejected := false;
    BEGIN
      PERFORM public.save_business_data(rev,payload);
    EXCEPTION WHEN SQLSTATE '22023' THEN
      IF SQLERRM <> 'INVALID_RECIPE_LINK' THEN RAISE; END IF;
      rejected := true;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'Invalid link was accepted: %',sheet; END IF;
  END LOOP;
  payload := public.read_business_data();
  payload := jsonb_set(payload,'{products,0,recipe_sheet_id}','"not-a-uuid"');
  rejected := false;
  BEGIN
    PERFORM public.save_business_data(rev,payload);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM <> 'INVALID_RECIPE_LINK' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Malformed link must be rejected'; END IF;
  IF (SELECT revision FROM public.business_revisions WHERE user_id=u) <> rev THEN
    RAISE EXCEPTION 'Rejected saves must not increment revision';
  END IF;

  -- Linked units: zero and null both violate the positive quantity rule.
  FOREACH payload IN ARRAY ARRAY['0'::jsonb,'null'::jsonb] LOOP
    rejected := false;
    BEGIN
      PERFORM public.save_business_data(rev,jsonb_set(public.read_business_data(),'{products,0,units_per_presentation}',payload));
    EXCEPTION WHEN check_violation THEN rejected := true;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'Linked units must be positive and present'; END IF;
  END LOOP;

  -- Newly recorded costs must be nonnegative; zero is valid.
  payload := public.read_business_data();
  payload := jsonb_set(payload,'{productions}',jsonb_build_array(jsonb_build_object(
    'id','new','productId','linked','batches',1,'units',12,
    'createdAt','2026-11-20T15:00:00Z','ingredient_cost',-1)));
  rejected := false;
  BEGIN
    PERFORM public.save_business_data(rev,payload);
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'A cost of -1 must be rejected'; END IF;
  payload := jsonb_set(payload,'{productions,0,ingredient_cost}','0');
  rev := public.save_business_data(rev,payload);
  IF (SELECT ingredient_cost IS DISTINCT FROM 0 FROM public.productions WHERE user_id=u AND id='new') THEN
    RAISE EXCEPTION 'A zero cost must be accepted';
  END IF;

  -- Historical unknown cost stays unknown, even if a client supplies a cost.
  payload := public.read_business_data();
  payload := jsonb_set(payload,'{productions,0,id}','"unknown"');
  payload := jsonb_set(payload,'{productions,0,ingredient_cost}','null');
  rev := public.save_business_data(rev,payload);
  payload := jsonb_set(public.read_business_data(),'{productions,0,ingredient_cost}','8');
  rev := public.save_business_data(rev,payload);
  IF (SELECT ingredient_cost IS NOT NULL FROM public.productions WHERE user_id=u AND id='unknown') THEN
    RAISE EXCEPTION 'Unknown finalized costs must remain null';
  END IF;
  rejected := false;
  BEGIN
    PERFORM public.save_business_data(rev-1,original);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'STALE_REVISION' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Stale revision must be rejected'; END IF;

  -- A linked product always takes its recipe from the sheet, not the payload.
  payload := jsonb_set(public.read_business_data(),'{products,0,recipe}',
    '[{"materialId":"ignored","quantity":1}]'::jsonb);
  rev := public.save_business_data(rev,payload);
  IF (SELECT recipe <> '[]'::jsonb FROM public.products WHERE user_id=u AND id='linked') THEN
    RAISE EXCEPTION 'Linked recipes must be an empty array';
  END IF;

  -- An explicit null unlinks the product and restores the legacy recipe flow.
  payload := jsonb_set(public.read_business_data(),'{products,0,recipe_sheet_id}','null');
  payload := jsonb_set(payload,'{products,0,recipe}',
    '[{"materialId":"legacy-material","quantity":2}]'::jsonb);
  rev := public.save_business_data(rev,payload);
  IF (SELECT recipe_sheet_id IS NOT NULL OR recipe <> '[{"materialId":"legacy-material","quantity":2}]'::jsonb
      FROM public.products WHERE user_id=u AND id='linked') THEN
    RAISE EXCEPTION 'Explicit unlink must restore the legacy recipe';
  END IF;
END
$test$;
ROLLBACK;