ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_product_type_check;
ALTER TABLE public.products ADD CONSTRAINT products_product_type_check
  CHECK (product_type IN ('car_seat', 'formula', 'medicine', 'food', 'other'));

ALTER TABLE public.first_foods
  ADD COLUMN IF NOT EXISTS is_packaged boolean,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_first_food_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF COALESCE(NEW.is_packaged, false) AND NULLIF(btrim(COALESCE(NEW.brand, '')), '') IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM public.children WHERE id = NEW.child_id;
    IF v_owner IS NULL THEN RETURN NEW; END IF;
    IF NEW.product_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.products WHERE id = NEW.product_id) THEN
      UPDATE public.products SET name = NEW.food_name, brand = NEW.brand, barcode = NEW.barcode,
        child_id = NEW.child_id WHERE id = NEW.product_id;
    ELSE
      INSERT INTO public.products (user_id, child_id, name, brand, barcode, category, product_type, notes)
      VALUES (v_owner, NEW.child_id, NEW.food_name, NEW.brand, NEW.barcode, 'Baby food', 'food',
              'Added from First Foods for recall tracking')
      RETURNING id INTO NEW.product_id;
    END IF;
  ELSIF NEW.product_id IS NOT NULL THEN
    DELETE FROM public.products WHERE id = NEW.product_id AND product_type = 'food';
    NEW.product_id := NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_first_food_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.product_id IS NOT NULL THEN
    DELETE FROM public.products WHERE id = OLD.product_id AND product_type = 'food';
  END IF;
  RETURN OLD;
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_first_food_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_first_food_product() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_first_foods_sync_product ON public.first_foods;
CREATE TRIGGER trg_first_foods_sync_product BEFORE INSERT OR UPDATE ON public.first_foods
  FOR EACH ROW EXECUTE FUNCTION public.sync_first_food_product();
DROP TRIGGER IF EXISTS trg_first_foods_delete_product ON public.first_foods;
CREATE TRIGGER trg_first_foods_delete_product AFTER DELETE ON public.first_foods
  FOR EACH ROW EXECUTE FUNCTION public.delete_first_food_product();

-- Existing scanned foods (have a barcode + brand) are packaged by definition.
UPDATE public.first_foods SET is_packaged = true
  WHERE barcode IS NOT NULL AND brand IS NOT NULL AND is_packaged IS NULL;