-- ============================================================================
-- Migration: 20260925000004_create_storage_bucket_and_policies.sql
-- Description: Create private storage bucket 'loan-documents' and establish RLS
--              policies for borrower isolation and admin audit access.
-- Specification: Issue #26 and _docs/next_plan.md Section 2 (item 5)
-- ============================================================================

-- Ensure storage schema and tables exist for local compatibility
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner UUID NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  public BOOLEAN DEFAULT false,
  avif_autodetection BOOLEAN DEFAULT false,
  file_size_limit BIGINT NULL,
  allowed_mime_types TEXT[] NULL,
  owner_id TEXT NULL
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB,
  path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED
);

-- Enable Row Level Security on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Helper function to extract path folder tokens
CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[] LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN string_to_array(name, '/');
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Create and Configure 'loan-documents' Bucket
-- ----------------------------------------------------------------------------
-- Private bucket (public = false)
-- 10 MB file size limit (10485760 bytes = 10 * 1024 * 1024)
-- MIME type restriction: 'application/pdf'

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-documents',
  'loan-documents',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- ----------------------------------------------------------------------------
-- 2. Storage Row Level Security (RLS) Policies on storage.objects
-- ----------------------------------------------------------------------------

-- 2.1. Borrowers can only read files within their own borrower_id folder
DROP POLICY IF EXISTS "Borrowers can read own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can read own loan documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 2.2. Borrowers can only upload files within their own borrower_id folder
DROP POLICY IF EXISTS "Borrowers can upload own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can upload own loan documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 2.3. Borrowers can update own loan documents
DROP POLICY IF EXISTS "Borrowers can update own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can update own loan documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  )
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 2.4. Borrowers can delete own loan documents
DROP POLICY IF EXISTS "Borrowers can delete own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can delete own loan documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 2.5. Administrators have full access (read, download, list, manage) to all documents
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
