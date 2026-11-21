ALTER TABLE public.recipe_sheets ADD COLUMN updated_by uuid;

CREATE TABLE public.recipe_sheet_versions (
  user_id uuid NOT NULL,
  recipe_sheet_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  changed_at timestamptz NOT NULL,
  changed_by uuid,
  action text NOT NULL CHECK (action IN ('baseline', 'created', 'edited', 'deactivated', 'reactivated')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  PRIMARY KEY (user_id, recipe_sheet_id, version),
  FOREIGN KEY (user_id, recipe_sheet_id) REFERENCES public.recipe_sheets (user_id, id)
);

ALTER TABLE public.recipe_sheet_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recipe_sheet_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.recipe_sheet_versions TO authenticated;
CREATE POLICY own_recipe_versions ON public.recipe_sheet_versions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

INSERT INTO public.recipe_sheet_versions (user_id, recipe_sheet_id, version, changed_at, action, snapshot)
SELECT r.user_id, r.id, 1, r.updated_at, 'baseline',
       to_jsonb(r) - ARRAY['id', 'user_id', 'created_at', 'updated_at', 'updated_by']
FROM public.recipe_sheets r;

CREATE FUNCTION public.set_recipe_sheet_audit_metadata()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Recipe identity cannot change';
    END IF;
    NEW.created_at := OLD.created_at;
    IF (to_jsonb(NEW) - ARRAY['updated_at', 'updated_by'])
       IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'updated_by']) THEN
      NEW.updated_at := OLD.updated_at;
      NEW.updated_by := OLD.updated_by;
      RETURN NEW;
    END IF;
  ELSE
    NEW.created_at := statement_timestamp();
  END IF;
  NEW.updated_at := statement_timestamp();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.record_recipe_sheet_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  revision integer := 1;
  event text := 'created';
  payload jsonb := to_jsonb(NEW) - ARRAY['id', 'user_id', 'created_at', 'updated_at', 'updated_by'];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF payload IS NOT DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['id', 'user_id', 'created_at', 'updated_at', 'updated_by']) THEN
      RETURN NULL;
    END IF;
    -- The recipe UPDATE holds the row lock until this version commits.
    SELECT COALESCE(MAX(v.version), 0) + 1 INTO revision
    FROM public.recipe_sheet_versions v
    WHERE v.user_id = NEW.user_id AND v.recipe_sheet_id = NEW.id;
    event := CASE WHEN NEW.active IS DISTINCT FROM OLD.active
                  THEN CASE WHEN NEW.active THEN 'reactivated' ELSE 'deactivated' END
                  ELSE 'edited' END;
  END IF;
  INSERT INTO public.recipe_sheet_versions (user_id, recipe_sheet_id, version, changed_at, changed_by, action, snapshot)
  VALUES (NEW.user_id, NEW.id, revision, NEW.updated_at, NEW.updated_by, event, payload);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_recipe_sheet_audit_metadata() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_recipe_sheet_version() FROM PUBLIC, anon, authenticated;

DROP TRIGGER touch_recipe_sheets_updated_at ON public.recipe_sheets;
CREATE TRIGGER set_recipe_sheet_audit_metadata
  BEFORE INSERT OR UPDATE ON public.recipe_sheets FOR EACH ROW
  EXECUTE FUNCTION public.set_recipe_sheet_audit_metadata();
CREATE TRIGGER record_recipe_sheet_version
  AFTER INSERT OR UPDATE ON public.recipe_sheets FOR EACH ROW
  EXECUTE FUNCTION public.record_recipe_sheet_version();
