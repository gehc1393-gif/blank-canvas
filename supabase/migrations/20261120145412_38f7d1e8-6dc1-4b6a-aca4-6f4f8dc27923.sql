-- Corrective migration: reject absent / wrongly typed ingredient fields.
-- jsonb_typeof() returns SQL NULL when the key is missing, and `NULL <> 'string'`
-- evaluates to NULL (not TRUE), so items without material_id / quantity / unit
-- slipped through. `IS DISTINCT FROM` treats NULL as a real difference.

CREATE OR REPLACE FUNCTION public.validate_recipe_sheet_ingredients()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item jsonb;
  mat_unit text;
  ing_unit text;
  seen text[] := '{}';
  mid text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.ingredients IS NOT DISTINCT FROM OLD.ingredients AND NEW.user_id = OLD.user_id THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.ingredients) <> 'array' THEN
    RAISE EXCEPTION 'ingredients must be an array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(NEW.ingredients) > 200 THEN
    RAISE EXCEPTION 'ingredients cannot exceed 200 items' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.ingredients) LOOP
    IF jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item->'material_id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
       OR jsonb_typeof(item->'unit') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'invalid ingredient object' USING ERRCODE = '22023';
    END IF;
    IF (item->>'quantity')::numeric <= 0 THEN
      RAISE EXCEPTION 'ingredient quantity must be greater than zero' USING ERRCODE = '22023';
    END IF;
    mid := item->>'material_id';
    ing_unit := item->>'unit';
    IF mid = ANY(seen) THEN
      RAISE EXCEPTION 'duplicate material_id %', mid USING ERRCODE = '23505';
    END IF;
    seen := array_append(seen, mid);
    SELECT m.unit INTO mat_unit FROM public.materials m WHERE m.id = mid AND m.user_id = NEW.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'material % not found for this user', mid USING ERRCODE = '23503';
    END IF;
    IF NOT (
      (mat_unit IN ('g','kg') AND ing_unit IN ('g','kg'))
      OR (mat_unit IN ('ml','L') AND ing_unit IN ('ml','L'))
      OR (mat_unit NOT IN ('g','kg','ml','L') AND ing_unit = mat_unit)
    ) THEN
      RAISE EXCEPTION 'unit % incompatible with material unit %', ing_unit, mat_unit USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Keep the trigger in place and re-bound to the corrected function.
DROP TRIGGER IF EXISTS validate_recipe_sheet_ingredients ON public.recipe_sheets;
CREATE TRIGGER validate_recipe_sheet_ingredients
BEFORE INSERT OR UPDATE ON public.recipe_sheets
FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_sheet_ingredients();