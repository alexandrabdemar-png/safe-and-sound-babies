-- Follow-up to 20260925145206: hardens the First Foods -> products mirror
-- that puts packaged foods into the 30-minute recall scan.
--
-- 1. The mirrored product name drops the "(Allergen)" tag the food log
--    appends (e.g. "Oat Puffs (Wheat)"). The matcher requires every word in
--    the name to appear in the recall notice, so the extra "wheat" token
--    would have made a real recall for the brand's Oat Puffs fail to match.
-- 2. When a food's name, brand or barcode is edited, the old recall matches
--    no longer describe this product. They are removed and the product goes
--    back to "not yet checked" until the next scan re-checks it, instead of
--    keeping a match for the food it used to be.
-- 3. Marking a food "not packaged" (or clearing its brand) failed with
--    "tuple to be updated was already modified by an operation triggered by
--    the current command": the BEFORE trigger deleted the product, whose
--    ON DELETE SET NULL then tried to update the same first_foods row. The
--    BEFORE trigger now only unlinks; an AFTER trigger deletes the product.
-- 4. Deleting the mirrored product from the Products list sets the food's
--    product_id to NULL via that same FK, which fired the trigger and
--    immediately re-created the product. That FK-only change is now left
--    alone; the food shows "Not checked" until it is saved again.

CREATE OR REPLACE FUNCTION public.first_food_product_name(p_food_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(regexp_replace(
    p_food_name,
    '\s*\((Milk|Eggs|Fish|Shellfish|Tree nuts|Peanuts|Wheat|Soy|Sesame)\)\s*$',
    ''
  ));
$$;

CREATE OR REPLACE FUNCTION public.sync_first_food_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_name text := public.first_food_product_name(NEW.food_name);
  v_brand text := NULLIF(btrim(COALESCE(NEW.brand, '')), '');
  v_barcode text := NULLIF(btrim(COALESCE(NEW.barcode, '')), '');
  v_existing public.products%ROWTYPE;
BEGIN
  -- Product deleted from the Products list (FK set product_id to NULL) with
  -- nothing else on the food changing: respect the delete.
  IF TG_OP = 'UPDATE' AND OLD.product_id IS NOT NULL AND NEW.product_id IS NULL
     AND ROW(NEW.food_name, NEW.brand, NEW.barcode, NEW.is_packaged)
         IS NOT DISTINCT FROM ROW(OLD.food_name, OLD.brand, OLD.barcode, OLD.is_packaged) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_packaged, false) AND v_brand IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM public.children WHERE id = NEW.child_id;
    IF v_owner IS NULL THEN RETURN NEW; END IF;

    IF NEW.product_id IS NOT NULL THEN
      SELECT * INTO v_existing FROM public.products WHERE id = NEW.product_id;
    END IF;

    IF FOUND AND NEW.product_id IS NOT NULL THEN
      IF v_existing.name IS DISTINCT FROM v_name
         OR v_existing.brand IS DISTINCT FROM v_brand
         OR v_existing.barcode IS DISTINCT FROM v_barcode THEN
        DELETE FROM public.product_recalls WHERE product_id = NEW.product_id;
        UPDATE public.products
          SET name = v_name, brand = v_brand, barcode = v_barcode, child_id = NEW.child_id,
              recalled = false, recall_checked_at = NULL
          WHERE id = NEW.product_id;
      ELSIF v_existing.child_id IS DISTINCT FROM NEW.child_id THEN
        UPDATE public.products SET child_id = NEW.child_id WHERE id = NEW.product_id;
      END IF;
    ELSE
      INSERT INTO public.products (user_id, child_id, name, brand, barcode, category, product_type, notes)
      VALUES (v_owner, NEW.child_id, v_name, v_brand, v_barcode, 'Baby food', 'food',
              'Added from First Foods for recall tracking')
      RETURNING id INTO NEW.product_id;
    END IF;
  ELSE
    -- Unlink only; trg_first_foods_unlink_product deletes the product.
    NEW.product_id := NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_unlinked_first_food_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.product_id IS NOT NULL AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    DELETE FROM public.products WHERE id = OLD.product_id AND product_type = 'food';
  END IF;
  RETURN NULL;
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_first_food_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_unlinked_first_food_product() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_first_foods_unlink_product ON public.first_foods;
CREATE TRIGGER trg_first_foods_unlink_product AFTER UPDATE ON public.first_foods
  FOR EACH ROW EXECUTE FUNCTION public.delete_unlinked_first_food_product();

-- Clean up names already mirrored with the allergen tag.
UPDATE public.products p
  SET name = public.first_food_product_name(p.name)
  FROM public.first_foods f
  WHERE f.product_id = p.id
    AND p.product_type = 'food'
    AND p.name IS DISTINCT FROM public.first_food_product_name(p.name);
