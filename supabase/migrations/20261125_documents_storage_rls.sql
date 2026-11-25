-- Fix Documents vault: create missing table + authenticated RLS + storage bucket/policies.
-- Upload was failing with "new row violates row-level security policy" because:
-- 1) the documents table was never applied on the live project
-- 2) the documents storage bucket had no storage.objects INSERT policy

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
DROP POLICY IF EXISTS auth_select_documents ON public.documents;
DROP POLICY IF EXISTS auth_insert_documents ON public.documents;
DROP POLICY IF EXISTS auth_update_documents ON public.documents;
DROP POLICY IF EXISTS auth_delete_documents ON public.documents;

CREATE POLICY auth_select_documents ON public.documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY auth_insert_documents ON public.documents
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY auth_update_documents ON public.documents
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_delete_documents ON public.documents
  FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'application/json'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS auth_documents_storage_select ON storage.objects;
DROP POLICY IF EXISTS auth_documents_storage_insert ON storage.objects;
DROP POLICY IF EXISTS auth_documents_storage_update ON storage.objects;
DROP POLICY IF EXISTS auth_documents_storage_delete ON storage.objects;

CREATE POLICY auth_documents_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY auth_documents_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY auth_documents_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY auth_documents_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
