-- Product batches + COA attachments (extends inventory; does not replace products)

CREATE OR REPLACE FUNCTION public.jwt_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(
    auth.jwt() -> 'user_metadata' ->> 'role',
    (SELECT role_id FROM public.user_profiles
      WHERE id = auth.uid() OR auth_user_id = auth.uid()
      LIMIT 1),
    ''
  ));
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.jwt_app_role() = 'super_admin';
$$;

CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  batch_number TEXT NOT NULL,
  manufacturer_name TEXT,
  supplier_name TEXT,
  product_grade TEXT,
  product_description TEXT,
  mfg_date DATE,
  expiry_date DATE,
  analysis_date DATE,
  dispatch_date DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  package_count NUMERIC,
  package_weight NUMERIC,
  package_unit TEXT,
  coa_storage_path TEXT,
  coa_file_name TEXT,
  coa_mime_type TEXT,
  ocr_payload JSONB,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS product_batches_product_id_idx ON public.product_batches(product_id);
CREATE INDEX IF NOT EXISTS product_batches_company_id_idx ON public.product_batches(company_id);

CREATE TABLE IF NOT EXISTS public.batch_quality_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  specification TEXT,
  result_value TEXT,
  compliance_status TEXT,
  remarks TEXT,
  confidence NUMERIC,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS batch_quality_results_batch_id_idx ON public.batch_quality_results(batch_id);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_quality_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_batches' AND policyname = 'auth_select_product_batches'
  ) THEN
    CREATE POLICY auth_select_product_batches ON public.product_batches FOR SELECT TO authenticated USING (true);
    CREATE POLICY auth_insert_product_batches ON public.product_batches FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY auth_update_product_batches ON public.product_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY auth_delete_product_batches ON public.product_batches FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'batch_quality_results' AND policyname = 'auth_select_batch_quality_results'
  ) THEN
    CREATE POLICY auth_select_batch_quality_results ON public.batch_quality_results FOR SELECT TO authenticated USING (true);
    CREATE POLICY auth_insert_batch_quality_results ON public.batch_quality_results FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY auth_update_batch_quality_results ON public.batch_quality_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY auth_delete_batch_quality_results ON public.batch_quality_results FOR DELETE TO authenticated USING (public.is_super_admin());
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'coa-docs',
  'coa-docs',
  false,
  8388608,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
