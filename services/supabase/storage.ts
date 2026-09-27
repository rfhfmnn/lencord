/**
 * Supabase Storage Service and Validation Utilities for Loan Documentation.
 * Manages interactions with the private 'loan-documents' bucket.
 * Enforces 10 MB size limits, PDF MIME validation, borrower isolation, and signed URLs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET_LOAN_DOCUMENTS = 'loan-documents';
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
}

export interface StorageUploadOptions {
  borrowerId: string;
  file: File | Blob | ArrayBuffer;
  fileName: string;
  fileType?: string;
  fileSize?: number;
}

export interface StorageUploadResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Validates document file specifications (MIME type and file size).
 */
export function validateLoanDocument(file: {
  size: number;
  type: string;
}): DocumentValidationResult {
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `El archivo excede el límite permitido de 10 MB (tamaño actual: ${sizeInMb} MB).`,
    };
  }

  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'Formato no permitido. Solo se aceptan documentos en formato PDF (application/pdf).',
    };
  }

  return { valid: true };
}

/**
 * Builds the canonical storage path for a borrower's uploaded document.
 * Follows: `loan-documents/{borrowerId}/{fileName}`
 */
export function buildDocumentStoragePath(borrowerId: string, fileName: string): string {
  // Extract basename and remove directory traversal tokens
  const baseName = fileName.split(/[/\\]/).pop() || 'document.pdf';
  const cleanFileName = baseName
    .replace(/\.{2,}/g, '.')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `${borrowerId}/${cleanFileName}`;
}

/**
 * Verifies whether a given storage path belongs to the specified borrower.
 */
export function isDocumentPathAllowedForBorrower(borrowerId: string, path: string): boolean {
  if (!borrowerId || !path) return false;
  const segments = path.split('/');
  return segments[0] === borrowerId;
}

/**
 * Supabase Storage Service Class.
 */
export class SupabaseStorageService {
  constructor(private client: SupabaseClient) {}

  /**
   * Uploads a document to the borrower's directory in the private bucket.
   */
  async uploadLoanDocument(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const size = options.fileSize ?? (options.file instanceof Blob ? options.file.size : 0);
    const type = options.fileType ?? (options.file instanceof Blob ? options.file.type : 'application/pdf');

    const validation = validateLoanDocument({ size, type });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const storagePath = buildDocumentStoragePath(options.borrowerId, options.fileName);

    const { error } = await this.client.storage
      .from(STORAGE_BUCKET_LOAN_DOCUMENTS)
      .upload(storagePath, options.file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path: storagePath };
  }

  /**
   * Downloads a document file from the private bucket.
   */
  async downloadLoanDocument(path: string): Promise<{ data: Blob | null; error: Error | null }> {
    const { data, error } = await this.client.storage
      .from(STORAGE_BUCKET_LOAN_DOCUMENTS)
      .download(path);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  }

  /**
   * Generates a temporary signed URL for an authorized admin or borrower.
   * Default expiration: 900 seconds (15 minutes).
   */
  async createSignedDocumentUrl(
    path: string,
    expiresInSeconds: number = 900
  ): Promise<{ signedUrl: string | null; error: Error | null }> {
    const { data, error } = await this.client.storage
      .from(STORAGE_BUCKET_LOAN_DOCUMENTS)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      return { signedUrl: null, error: new Error(error?.message || 'Failed to generate signed URL') };
    }

    return { signedUrl: data.signedUrl, error: null };
  }
}
