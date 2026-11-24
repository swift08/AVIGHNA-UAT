-- Documents library: COA, Purchase Orders, Purchase Invoices, Sales Invoices
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL DEFAULT 'all',
  category TEXT NOT NULL CHECK (category IN ('coa', 'purchase_order', 'purchase_invoice', 'sales_invoice')),
  title TEXT NOT NULL,
  notes TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  uploaded_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read documents" ON public.documents;
CREATE POLICY "Public read documents" ON public.documents FOR ALL USING (true);
