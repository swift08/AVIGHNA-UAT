-- Prevent re-importing the same COA file for a company
ALTER TABLE public.product_batches
ADD COLUMN IF NOT EXISTS coa_content_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS product_batches_company_coa_hash_uidx
  ON public.product_batches (company_id, coa_content_hash)
  WHERE coa_content_hash IS NOT NULL;
