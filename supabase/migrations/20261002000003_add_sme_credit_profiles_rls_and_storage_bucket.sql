-- ============================================================================
-- Migration: 20261002000003_add_sme_credit_profiles_rls_and_storage_bucket.sql
-- Description: Add missing INSERT/UPDATE RLS policies for sme_credit_profiles,
--              create 'loan-documents' storage bucket, and set storage RLS policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Políticas RLS en public.sme_credit_profiles
-- ----------------------------------------------------------------------------

-- Permitir a las PyMEs registrar su propio perfil crediticio con su documentación
DROP POLICY IF EXISTS "Borrowers can insert own credit profile" ON public.sme_credit_profiles;
CREATE POLICY "Borrowers can insert own credit profile"
  ON public.sme_credit_profiles FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Permitir a las PyMEs actualizar su documentación / perfil crediticio
DROP POLICY IF EXISTS "Borrowers can update own credit profile" ON public.sme_credit_profiles;
CREATE POLICY "Borrowers can update own credit profile"
  ON public.sme_credit_profiles FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 2. Creación del Bucket 'loan-documents' en Supabase Storage
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-documents',
  'loan-documents',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];


-- ----------------------------------------------------------------------------
-- 3. Políticas RLS en storage.objects para el Bucket 'loan-documents'
-- ----------------------------------------------------------------------------

-- 3.1. Las PyMEs pueden subir PDFs dentro de su propia carpeta (auth.uid())
DROP POLICY IF EXISTS "Borrowers can upload own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can upload own loan documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND (name LIKE (auth.uid()::text || '/%'))
  );

-- 3.2. Las PyMEs pueden leer sus propios PDFs
DROP POLICY IF EXISTS "Borrowers can read own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can read own loan documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (name LIKE (auth.uid()::text || '/%'))
  );

-- 3.3. Las PyMEs pueden actualizar sus propios PDFs
DROP POLICY IF EXISTS "Borrowers can update own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can update own loan documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (name LIKE (auth.uid()::text || '/%'))
  )
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND (name LIKE (auth.uid()::text || '/%'))
  );

-- 3.4. Los administradores tienen acceso total para ver y descargar los documentos
DROP POLICY IF EXISTS "Admins have full access to loan documents" ON storage.objects;
CREATE POLICY "Admins have full access to loan documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND is_admin()
  )
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND is_admin()
  );
