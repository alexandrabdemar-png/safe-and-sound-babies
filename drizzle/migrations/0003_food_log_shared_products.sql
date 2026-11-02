-- First Foods becomes an everyday Food Log: parents log the same pouch or
-- snack day after day so every packaged food the baby eats stays in the
-- recall scan. Until now each first_foods insert mirrored its own row into
-- public.products, so logging "Once Upon a Farm Tractor Wheels" every day
-- would have filled the Products list with duplicates (and scanned each one
-- separately for recalls).
--
-- Now every log entry for the same packaged food (same child, product
-- name, brand and barcode) points at ONE mirrored product:
--   * a new entry reuses the matching food product if one exists;
--   * editing one entry of a shared product moves just that entry to a
--     matching/new product instead of renaming the product under the
--     other entries;
--   * the mirrored product is only deleted once no entry points at it.

CREATE OR REPLACE FUNCTION public.sync_first_food_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_name text := public.first_food_product_name(NEW.food_name);
  v_brand text := NULLIF(btrim(COALESCE(NEW.brand, '')), '');
  v_barcode text := NULLIF(btrim(COALESCE(NEW.barcode, '')), '');
  v_existing public.products%ROWTYPE;
  v_found boolean := false;
  v_shared boolean := false;
  v_match uuid;
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
      v_found := FOUND;
    END IF;

    IF v_found
       AND v_existing.name IS NOT DISTINCT FROM v_name
       AND v_existing.brand IS NOT DISTINCT FROM v_brand
       AND v_existing.barcode IS NOT DISTINCT FROM v_barcode THEN
      -- Still the same product (e.g. only notes/date changed).
      IF v_existing.child_id IS DISTINCT FROM NEW.child_id THEN
        UPDATE public.products SET child_id = NEW.child_id WHERE id = NEW.product_id;
      END IF;
      RETURN NEW;
    END IF;

    IF v_found THEN
      v_shared := EXISTS (
        SELECT 1 FROM public.first_foods
        WHERE product_id = NEW.product_id
          AND (TG_OP = 'INSERT' OR id <> NEW.id)
      );
    END IF;

    -- Another log entry already tracks this exact product: share it.
    SELECT p.id INTO v_match
      FROM public.products p
      WHERE p.product_type = 'food'
        AND p.user_id = v_owner
        AND p.child_id IS NOT DISTINCT FROM NEW.child_id
        AND p.name IS NOT DISTINCT FROM v_name
        AND p.brand IS NOT DISTINCT FROM v_brand
        AND p.barcode IS NOT DISTINCT FROM v_barcode
        AND p.id IS DISTINCT FROM NEW.product_id
        AND EXISTS (SELECT 1 FROM public.first_foods f WHERE f.product_id = p.id)
      ORDER BY p.created_at
      LIMIT 1;

    IF v_match IS NOT NULL THEN
      NEW.product_id := v_match;
    ELSIF v_found AND NOT v_shared THEN
      -- Only this entry uses the product: edit it in place, and drop the
      -- old matches since they described the food it used to be.
      DELETE FROM public.product_recalls WHERE product_id = NEW.product_id;
      UPDATE public.products
        SET name = v_name, brand = v_brand, barcode = v_barcode, child_id = NEW.child_id,
            recalled = false, recall_checked_at = NULL
        WHERE id = NEW.product_id;
    ELSE
      INSERT INTO public.products (user_id, child_id, name, brand, barcode, category, product_type, notes)
      VALUES (v_owner, NEW.child_id, v_name, v_brand, v_barcode, 'Baby food', 'food',
              'Added from the Food Log for recall tracking')
      RETURNING id INTO NEW.product_id;
    END IF;
  ELSE
    -- Unlink only; trg_first_foods_unlink_product deletes the product once
    -- nothing else points at it.
    NEW.product_id := NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_unlinked_first_food_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.product_id IS NOT NULL AND NEW.product_id IS DISTINCT FROM OLD.product_id
     AND NOT EXISTS (SELECT 1 FROM public.first_foods WHERE product_id = OLD.product_id) THEN
    DELETE FROM public.products WHERE id = OLD.product_id AND product_type = 'food';
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_first_food_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.product_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.first_foods WHERE product_id = OLD.product_id) THEN
    DELETE FROM public.products WHERE id = OLD.product_id AND product_type = 'food';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_first_food_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_unlinked_first_food_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_first_food_product() FROM PUBLIC, anon, authenticated;

UPDATE public.products SET notes = 'Added from the Food Log for recall tracking'
  WHERE product_type = 'food' AND notes = 'Added from First Foods for recall tracking';

NOTIFY pgrst, 'reload schema';
