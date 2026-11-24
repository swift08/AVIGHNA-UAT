-- Allow accounts (authenticated) to delete suppliers they manage.
-- App still enforces suppliers.manage via requirePermission.
DROP POLICY IF EXISTS auth_delete_suppliers ON public.suppliers;
CREATE POLICY auth_delete_suppliers ON public.suppliers
  FOR DELETE TO authenticated USING (true);
