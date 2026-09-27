import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  STORAGE_BUCKET_LOAN_DOCUMENTS,
  MAX_DOCUMENT_SIZE_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  validateLoanDocument,
  buildDocumentStoragePath,
  isDocumentPathAllowedForBorrower,
  SupabaseStorageService,
} from '@/services/supabase/storage';
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
  createSupabaseBrowserClient,
} from '@/services/supabase';

describe('Supabase Storage Bucket Setup and Document Security Policies (Issue #26)', () => {
  const rootDir = process.cwd();
  const migrationsDir = path.resolve(rootDir, 'supabase', 'migrations');
  const migrationFile = path.resolve(
    migrationsDir,
    '20260925000004_create_storage_bucket_and_policies.sql'
  );

  // ---------------------------------------------------------------------------
  // 1. Migration File & Bucket Configuration Verification
  // ---------------------------------------------------------------------------
  describe('Migration & Storage Bucket Configuration', () => {
    it('migration file exists in supabase/migrations directory', () => {
      expect(fs.existsSync(migrationFile)).toBe(true);
    });

    const sqlContent = fs.existsSync(migrationFile)
      ? fs.readFileSync(migrationFile, 'utf-8')
      : '';

    it('criterion 1: configures bucket loan-documents as private (public access disabled)', () => {
      expect(sqlContent).toMatch(/INSERT INTO storage\.buckets/i);
      expect(sqlContent).toMatch(/'loan-documents'/i);
      // public = false
      expect(sqlContent).toMatch(/public[\s\S]*?false/i);
      expect(STORAGE_BUCKET_LOAN_DOCUMENTS).toBe('loan-documents');
    });

    it('criterion 2: enforces file size limit of 10 MB (10485760 bytes) and application/pdf restriction', () => {
      expect(sqlContent).toMatch(/10485760/);
      expect(sqlContent).toMatch(/ARRAY\['application\/pdf'\]/i);
      expect(MAX_DOCUMENT_SIZE_BYTES).toBe(10 * 1024 * 1024);
      expect(ALLOWED_DOCUMENT_MIME_TYPES).toContain('application/pdf');
    });

    it('criterion 3: defines storage RLS policies ensuring borrowers can only access loan-documents/{borrower_id}/*', () => {
      expect(sqlContent).toMatch(/ALTER TABLE storage\.objects ENABLE ROW LEVEL SECURITY;/i);
      expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can read own loan documents"/i);
      expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can upload own loan documents"/i);
      expect(sqlContent).toMatch(/auth\.uid\(\)::text/i);
    });

    it('criterion 4: defines storage RLS policies allowing admin role to read and download all documents', () => {
      expect(sqlContent).toMatch(/CREATE POLICY "Admins have full access to loan documents"/i);
      expect(sqlContent).toMatch(/is_admin\(\)/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Document Validation Unit Logic
  // ---------------------------------------------------------------------------
  describe('Document Validation Rules (Size & MIME type)', () => {
    it('accepts valid PDF within 10 MB limit', () => {
      const validFile = {
        size: 5 * 1024 * 1024, // 5 MB
        type: 'application/pdf',
      };
      const result = validateLoanDocument(validFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects files larger than 10 MB with descriptive error', () => {
      const oversizedFile = {
        size: 11 * 1024 * 1024, // 11 MB
        type: 'application/pdf',
      };
      const result = validateLoanDocument(oversizedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/excede el límite permitido de 10 MB/i);
    });

    it('rejects non-PDF mime types (e.g. image/png, application/zip, text/plain)', () => {
      const invalidTypes = ['image/png', 'image/jpeg', 'application/zip', 'text/plain'];

      invalidTypes.forEach((type) => {
        const result = validateLoanDocument({ size: 1024, type });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/Solo se aceptan documentos en formato PDF/i);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Storage Path Construction & Isolation
  // ---------------------------------------------------------------------------
  describe('Borrower Storage Path Construction & Isolation Verification', () => {
    const borrowerId = '11111111-2222-3333-4444-555555555555';
    const unauthorizedBorrowerId = '99999999-8888-7777-6666-555555555555';

    it('builds canonical storage path under borrower folder', () => {
      const path = buildDocumentStoragePath(borrowerId, 'balance_sheet_2025.pdf');
      expect(path).toBe(`${borrowerId}/balance_sheet_2025.pdf`);
    });

    it('sanitizes malicious directory traversal attempts in filename', () => {
      const path = buildDocumentStoragePath(borrowerId, '../../etc/passwd.pdf');
      expect(path).not.toContain('..');
      expect(path.startsWith(`${borrowerId}/`)).toBe(true);
    });

    it('validates folder ownership and prevents cross-borrower access', () => {
      const ownPath = `${borrowerId}/f931.pdf`;
      const otherPath = `${unauthorizedBorrowerId}/f931.pdf`;

      expect(isDocumentPathAllowedForBorrower(borrowerId, ownPath)).toBe(true);
      expect(isDocumentPathAllowedForBorrower(borrowerId, otherPath)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Supabase Storage Service Client Permissions & Rejection Verification
  // ---------------------------------------------------------------------------
  describe('Storage Access Permissions, Admin Access, and Public Rejection Simulation', () => {
    const borrowerId = 'user-borrower-123';
    const otherBorrowerId = 'user-borrower-999';

    it('criterion 3 & 4: authenticated borrower can upload and download own document', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: `${borrowerId}/f931.pdf` }, error: null });
      const mockDownload = vi.fn().mockResolvedValue({ data: new Blob(['%PDF-1.4']), error: null });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            download: mockDownload,
          }),
        },
      } as any;

      const service = new SupabaseStorageService(mockClient);
      const uploadRes = await service.uploadLoanDocument({
        borrowerId,
        fileName: 'f931.pdf',
        file: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      });

      expect(uploadRes.success).toBe(true);
      expect(uploadRes.path).toBe(`${borrowerId}/f931.pdf`);
      expect(mockUpload).toHaveBeenCalledWith(
        `${borrowerId}/f931.pdf`,
        expect.any(Blob),
        expect.objectContaining({ contentType: 'application/pdf', upsert: true })
      );

      const downloadRes = await service.downloadLoanDocument(`${borrowerId}/f931.pdf`);
      expect(downloadRes.data).toBeDefined();
      expect(downloadRes.error).toBeNull();
    });

    it('criterion 4: admin can generate signed URLs to inspect any document in the bucket', async () => {
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://supabase.co/storage/v1/object/sign/loan-documents/user-123/f931.pdf?token=xyz' },
        error: null,
      });

      const mockAdminClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: mockCreateSignedUrl,
          }),
        },
      } as any;

      const adminService = new SupabaseStorageService(mockAdminClient);
      const res = await adminService.createSignedDocumentUrl('user-123/f931.pdf', 900);

      expect(res.signedUrl).toContain('token=xyz');
      expect(res.error).toBeNull();
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-123/f931.pdf', 900);
    });

    it('criterion 5 & 6: unauthenticated / unauthorized requests return access denied (HTTP 403)', async () => {
      // Simulate storage rejecting unauthenticated or unauthorized borrower cross-access with 403
      const mockForbiddenUpload = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Access Denied: row-level security policy violated', statusCode: '403' },
      });

      const mockForbiddenDownload = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Access Denied: row-level security policy violated', statusCode: '403' },
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockForbiddenUpload,
            download: mockForbiddenDownload,
          }),
        },
      } as any;

      const service = new SupabaseStorageService(mockClient);

      // Attempting to download someone else's document as an unauthorized user
      const downloadRes = await service.downloadLoanDocument(`${otherBorrowerId}/private_balance.pdf`);
      expect(downloadRes.data).toBeNull();
      expect(downloadRes.error).toBeDefined();
      expect(downloadRes.error?.message).toMatch(/Access Denied/i);

      // Attempting upload with client that lacks proper permissions
      const uploadRes = await service.uploadLoanDocument({
        borrowerId: otherBorrowerId,
        fileName: 'malicious.pdf',
        file: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      });
      expect(uploadRes.success).toBe(false);
      expect(uploadRes.error).toMatch(/Access Denied/i);
    });

    it('validates that public unauthenticated URLs are not exposed', () => {
      // The bucket is private so getPublicUrl is not used or yields unauthorized / protected endpoints
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/v1/object/public/loan-documents/file.pdf' },
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            getPublicUrl: mockGetPublicUrl,
          }),
        },
      } as any;

      // Ensure our service does not expose getPublicUrl for loan-documents
      const service = new SupabaseStorageService(mockClient);
      expect((service as any).getPublicUrl).toBeUndefined();
    });
  });
});
