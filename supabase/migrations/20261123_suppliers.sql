-- Supplier master profiles (accounts-owned), parallel to customers.
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  gstin TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS suppliers_company_id_idx ON public.suppliers (company_id);
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON public.suppliers (lower(name));

INSERT INTO public.permissions (id, category, description)
VALUES
  ('suppliers.view', 'Procurement', 'View supplier profiles'),
  ('suppliers.manage', 'Procurement', 'Create and edit supplier profiles')
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions WHERE id IN ('suppliers.view', 'suppliers.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
  ('accounts', 'suppliers.view'),
  ('accounts', 'suppliers.manage')
ON CONFLICT DO NOTHING;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_select_suppliers ON public.suppliers;
DROP POLICY IF EXISTS auth_insert_suppliers ON public.suppliers;
DROP POLICY IF EXISTS auth_update_suppliers ON public.suppliers;
DROP POLICY IF EXISTS auth_delete_suppliers ON public.suppliers;

CREATE POLICY auth_select_suppliers ON public.suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_suppliers ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_suppliers ON public.suppliers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete_suppliers ON public.suppliers
  FOR DELETE TO authenticated USING (true);
