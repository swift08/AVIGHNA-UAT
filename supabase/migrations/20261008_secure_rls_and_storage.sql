-- ============================================================================
-- Avighna One — close open RLS + private storage buckets
-- CRITICAL: anon key must not read/write business data.
-- Authenticated users may access app tables; deletes restricted to super_admin.
-- ============================================================================

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

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname ILIKE 'Public %'
        OR qual::text = 'true'
        OR with_check::text = 'true'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Reference / catalog: authenticated read
CREATE POLICY "auth_select_companies" ON public.companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_roles" ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Profiles: read authenticated; write own / super_admin
CREATE POLICY "auth_select_user_profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_own_user_profiles" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR auth_user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "auth_all_user_company_access" ON public.user_company_access
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "auth_select_user_permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "auth_write_user_permissions_admin" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Business tables: authenticated CRUD; DELETE only super_admin
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'leads', 'products', 'inventory_logs', 'orders', 'order_items',
    'invoices', 'payments', 'deliveries', 'purchase_orders', 'field_visits',
    'tasks', 'notifications', 'audit_logs', 'credit_notes', 'vehicles'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      'auth_select_' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      'auth_insert_' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      'auth_update_' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin())',
      'auth_delete_' || t, t
    );
  END LOOP;
END $$;

-- Private storage buckets for POD / staff docs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('staff-docs', 'staff-docs', false, 4194304, ARRAY['application/pdf']::text[]),
  ('delivery-photos', 'delivery-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('delivery-signatures', 'delivery-signatures', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Strip public storage policies on private buckets
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        qual::text ILIKE '%staff-docs%'
        OR qual::text ILIKE '%delivery-photos%'
        OR qual::text ILIKE '%delivery-signatures%'
        OR with_check::text ILIKE '%staff-docs%'
        OR with_check::text ILIKE '%delivery-photos%'
        OR with_check::text ILIKE '%delivery-signatures%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Authenticated users may upload/read delivery evidence for their sessions;
-- staff-docs remains service-role / signed-URL only (no broad policies).
CREATE POLICY "auth_delivery_photos_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id IN ('delivery-photos', 'delivery-signatures'))
  WITH CHECK (bucket_id IN ('delivery-photos', 'delivery-signatures'));
