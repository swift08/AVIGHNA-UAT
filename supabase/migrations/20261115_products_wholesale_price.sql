-- Ensure wholesale_price exists on products (required by COA import + catalog pricing)

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.unit_price IS 'Catalog Selling Price (Retail/Standard)';
COMMENT ON COLUMN public.products.wholesale_price IS 'Catalog Wholesale Price (Dealer/Bulk)';

UPDATE public.products
SET wholesale_price = unit_price
WHERE wholesale_price = 0 AND unit_price > 0;
