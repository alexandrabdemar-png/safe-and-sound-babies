UPDATE public.products p
SET recalled = false
WHERE p.recalled = true
  AND NOT EXISTS (
    SELECT 1 FROM public.product_recalls pr WHERE pr.product_id = p.id
  );