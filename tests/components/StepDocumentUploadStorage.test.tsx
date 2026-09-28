import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepDocumentUpload } from '@/components/forms/StepDocumentUpload';
import { STORAGE_BUCKET_LOAN_DOCUMENTS } from '@/services/supabase/storage';

describe('Secure PDF Document Upload Integration in Loan Wizard (Issue #34)', () => {
  const mockBorrowerId = 'usr-borrower-test-456';

  let mockUploadFn: any;
  let mockStorageClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFn = vi.fn().mockResolvedValue({ data: { path: 'uploaded-path' }, error: null });
    mockStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUploadFn,
        }),
      },
    };
  });

  describe('Client-Side File Validation', () => {
    it('validates selected files for MIME type (application/pdf) and displays accessible inline error alert', () => {
      render(
        <StepDocumentUpload
          borrowerId={mockBorrowerId}
          supabaseClient={mockStorageClient}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('input-file-balance');
      const invalidFile = new File(['dummy jpeg content'], 'balance.jpg', {
        type: 'image/jpeg',
      });

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Solo se permiten archivos en formato PDF.');
      expect(screen.queryByTestId('badge-balance-file')).not.toBeInTheDocument();
      expect(mockUploadFn).not.toHaveBeenCalled();
    });

    it('rejects files exceeding 10 MB with an accessible inline error alert', () => {
      render(
        <StepDocumentUpload
          borrowerId={mockBorrowerId}
          supabaseClient={mockStorageClient}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('input-file-f931');
      const largeFile = new File(['dummy content'], 'f931_large.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(largeFile, 'size', { value: 12 * 1024 * 1024 }); // 12 MB

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('El archivo supera el tamaño máximo permitido de 10 MB.');
      expect(screen.queryByTestId('badge-f931-file')).not.toBeInTheDocument();
      expect(mockUploadFn).not.toHaveBeenCalled();
    });
  });

  describe('Supabase Storage Direct Upload to loan-documents Bucket', () => {
    it('uploads balance sheet directly to loan-documents bucket under ${borrower_id}/${fileId}.pdf', async () => {
      render(
        <StepDocumentUpload
          borrowerId={mockBorrowerId}
          supabaseClient={mockStorageClient}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('input-file-balance');
      const validPdf = new File(['balance binary content'], 'balance_general_2025.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(validPdf, 'size', { value: 2 * 1024 * 1024 }); // 2 MB

      fireEvent.change(fileInput, { target: { files: [validPdf] } });

      // Verifies the target bucket
      expect(mockStorageClient.storage.from).toHaveBeenCalledWith(STORAGE_BUCKET_LOAN_DOCUMENTS);

      await waitFor(() => {
        expect(mockUploadFn).toHaveBeenCalledTimes(1);
      });

      const [uploadPath, uploadedFile, options] = mockUploadFn.mock.calls[0];
      expect(uploadPath).toMatch(new RegExp(`^${mockBorrowerId}/balance_sheet-[^/]+\\.pdf$`));
      expect(uploadedFile).toBe(validPdf);
      expect(options).toEqual(
        expect.objectContaining({
          contentType: 'application/pdf',
          upsert: true,
        })
      );
    });

    it('uploads AFIP/ARCA F.931 directly to loan-documents bucket under ${borrower_id}/${fileId}.pdf', async () => {
      render(
        <StepDocumentUpload
          borrowerId={mockBorrowerId}
          supabaseClient={mockStorageClient}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('input-file-f931');
      const validPdf = new File(['f931 binary content'], 'f931_agosto_2026.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(validPdf, 'size', { value: 1.5 * 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [validPdf] } });

      expect(mockStorageClient.storage.from).toHaveBeenCalledWith('loan-documents');

      await waitFor(() => {
        expect(mockUploadFn).toHaveBeenCalledTimes(1);
      });

      const [uploadPath] = mockUploadFn.mock.calls[0];
      expect(uploadPath).toMatch(new RegExp(`^${mockBorrowerId}/f931-[^/]+\\.pdf$`));
    });

    it('renders progress spinner during upload and records file storage keys on completion', async () => {
      let resolveUpload: (val: any) => void;
      mockUploadFn.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
      );

      const onContinueMock = vi.fn();

      render(
        <StepDocumentUpload
          borrowerId={mockBorrowerId}
          supabaseClient={mockStorageClient}
          onBack={vi.fn()}
          onContinue={onContinueMock}
        />
      );

      // Upload mandatory AFIP
      const afipInput = screen.getByTestId('input-file-afip');
      const afipPdf = new File(['afip content'], 'constancia_afip.pdf', {
        type: 'application/pdf',
      });
      fireEvent.change(afipInput, { target: { files: [afipPdf] } });

      // Upload Balance Sheet
      const balanceInput = screen.getByTestId('input-file-balance');
      const balancePdf = new File(['balance content'], 'balance.pdf', {
        type: 'application/pdf',
      });
      fireEvent.change(balanceInput, { target: { files: [balancePdf] } });

      // In-flight spinner should be present
      expect(screen.getByTestId('upload-spinner-balance')).toBeInTheDocument();

      // Resolve the upload
      resolveUpload!({ data: { path: `${mockBorrowerId}/balance_sheet-balance.pdf` }, error: null });

      await waitFor(() => {
        expect(screen.queryByTestId('upload-spinner-balance')).not.toBeInTheDocument();
      });

      // Submit step
      fireEvent.click(screen.getByTestId('step3-continue-button'));

      expect(onContinueMock).toHaveBeenCalledTimes(1);
      const submittedStepData = onContinueMock.mock.calls[0][0];

      // Verifies storage key/path is recorded in payload
      expect(submittedStepData.balance_sheet_url).toMatch(
        new RegExp(`^${mockBorrowerId}/balance_sheet-[^/]+\\.pdf$`)
      );
      expect(submittedStepData.afip_constancia_url).toMatch(
        new RegExp(`^${mockBorrowerId}/afip_constancia-[^/]+\\.pdf$`)
      );
    });
  });

  describe('Remove and Replace Flow', () => {
    it('allows users to remove or replace an uploaded PDF before final submission', async () => {
      render(
        <StepDocumentUpload
          borrowerId={mockBorrowerId}
          supabaseClient={mockStorageClient}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      const fileInput = screen.getByTestId('input-file-balance');
      const initialFile = new File(['v1'], 'balance_2024.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [initialFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('badge-balance-file')).toBeInTheDocument();
      });

      // Remove file
      fireEvent.click(screen.getByTestId('remove-balance-file'));
      expect(screen.queryByTestId('badge-balance-file')).not.toBeInTheDocument();

      // Re-upload replacement file
      const replacementInput = screen.getByTestId('input-file-balance');
      const replacementFile = new File(['v2'], 'balance_2025_audited.pdf', {
        type: 'application/pdf',
      });
      fireEvent.change(replacementInput, { target: { files: [replacementFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('badge-balance-file')).toHaveTextContent(
          'balance_2025_audited.pdf'
        );
      });
      expect(mockUploadFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Upload Failure and Inline Retry Flow', () => {
    it('surfaces an inline retry button on upload failure without resetting other form inputs', async () => {
      mockUploadFn
        .mockResolvedValueOnce({ data: { path: 'afip-ok' }, error: null })
        .mockRejectedValueOnce(new Error('Network upload failure'))
        .mockResolvedValueOnce({ data: { path: 'balance-ok' }, error: null });

      render(
        <StepDocumentUpload
          borrowerId={mockBorrowerId}
          supabaseClient={mockStorageClient}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      // Pre-fill AFIP document
      const afipInput = screen.getByTestId('input-file-afip');
      const afipFile = new File(['afip'], 'afip.pdf', { type: 'application/pdf' });
      fireEvent.change(afipInput, { target: { files: [afipFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('badge-afip-file')).toBeInTheDocument();
      });

      // Upload balance sheet which will fail
      const balanceInput = screen.getByTestId('input-file-balance');
      const balanceFile = new File(['balance'], 'balance.pdf', { type: 'application/pdf' });
      fireEvent.change(balanceInput, { target: { files: [balanceFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('error-upload-balance')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-upload-balance')).toHaveTextContent('Network upload failure');

      // Crucial: other form inputs (AFIP document) must remain intact
      expect(screen.getByTestId('badge-afip-file')).toBeInTheDocument();

      // Retry button is available
      const retryBtn = screen.getByTestId('retry-upload-balance');
      expect(retryBtn).toBeInTheDocument();

      // Click retry
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('error-upload-balance')).not.toBeInTheDocument();
      });

      expect(mockUploadFn).toHaveBeenCalledTimes(3); // 1 afip + 1 failed balance + 1 retried balance
    });
  });
});
