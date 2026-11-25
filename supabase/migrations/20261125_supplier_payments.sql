-- Supplier payments against purchase orders / supplier invoices.
-- Recorded after invoice upload + stock receive (partial payments allowed).

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  purchase_order_id TEXT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer'
    CHECK (payment_method IN (
      'Cash',
      'PhonePe',
      'Google Pay',
      'UPI',
      'Bank Transfer',
      'Cheque'
    )),
  reference_number TEXT,
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_payments_po_id_idx
  ON public.supplier_payments(purchase_order_id);
CREATE INDEX IF NOT EXISTS supplier_payments_company_id_idx
  ON public.supplier_payments(company_id);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_payments'
      AND policyname = 'auth_all_supplier_payments'
  ) THEN
    CREATE POLICY auth_all_supplier_payments ON public.supplier_payments
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
