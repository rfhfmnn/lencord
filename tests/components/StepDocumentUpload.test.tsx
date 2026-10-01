import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  StepDocumentUpload,
  MAX_FILE_SIZE_BYTES,
} from '@/components/solicitar/StepDocumentUpload';

describe('StepDocumentUpload Component (Issue #64)', () => {
  const mockOnBack = vi.fn();
  const mockOnContinue = vi.fn();
  const mockBorrowerId = 'usr-borrower-uuid-1234';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all document upload cards with badges', () => {
    render(
      <StepDocumentUpload
        borrowerId={mockBorrowerId}
        onBack={mockOnBack}
        onContinue={mockOnContinue}
      />
    );

    expect(screen.getByTestId('upload-card-afip')).toBeInTheDocument();
    expect(screen.getByTestId('upload-card-extractos')).toBeInTheDocument();
    expect(screen.getByTestId('upload-card-balance')).toBeInTheDocument();
    expect(screen.getByTestId('upload-card-f931')).toBeInTheDocument();

    // Check mandatory badge
    expect(screen.getByText('Obligatorio')).toBeInTheDocument();
  });

  it('validates that only PDF files are allowed', () => {
    render(
      <StepDocumentUpload
        borrowerId={mockBorrowerId}
        onBack={mockOnBack}
        onContinue={mockOnContinue}
      />
    );

    const invalidFile = new File(['image-content'], 'foto_factura.png', {
      type: 'image/png',
    });
    const fileInput = screen.getByTestId('input-file-afip');

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(
      screen.getByText(/Solo se permiten archivos en formato PDF/i)
    ).toBeInTheDocument();
    expect(mockOnContinue).not.toHaveBeenCalled();
  });

  it('rejects PDF files exceeding 10 MB limit', () => {
    render(
      <StepDocumentUpload
        borrowerId={mockBorrowerId}
        onBack={mockOnBack}
        onContinue={mockOnContinue}
      />
    );

    const oversizedBuffer = new Uint8Array(MAX_FILE_SIZE_BYTES + 1024);
    const oversizedFile = new File([oversizedBuffer], 'balance_gigante.pdf', {
      type: 'application/pdf',
    });

    const fileInput = screen.getByTestId('input-file-balance');
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(
      screen.getByText(/El archivo supera el tamaño máximo permitido de 10 MB/i)
    ).toBeInTheDocument();
  });

  it('sanitizes file names before building storage path and uploads successfully', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null });
    const mockStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
        }),
      },
    } as any;

    render(
      <StepDocumentUpload
        borrowerId={mockBorrowerId}
        supabaseClient={mockStorageClient}
        onBack={mockOnBack}
        onContinue={mockOnContinue}
      />
    );

    // File with spaces and accents/special symbols in name
    const validPdf = new File(['fake-pdf-content'], 'constancia afip 2026! @#$.pdf', {
      type: 'application/pdf',
    });

    const fileInput = screen.getByTestId('input-file-afip');
    fireEvent.change(fileInput, { target: { files: [validPdf] } });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(1);
    });

    // Check that path contains borrowerId and sanitized filename
    const [calledPath, calledFile, calledOptions] = mockUpload.mock.calls[0];
    expect(calledPath).toContain(`${mockBorrowerId}/afip_constancia-constancia_afip_2026_____`);
    expect(calledPath.endsWith('.pdf')).toBe(true);
    expect(calledOptions.contentType).toBe('application/pdf');
    expect(calledOptions.upsert).toBe(true);
  });

  it('handles RLS policy violation or expired session gracefully with friendly error message', async () => {
    const mockUpload = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('new row violates row-level security policy for table "objects"'),
    });
    const mockStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
        }),
      },
    } as any;

    render(
      <StepDocumentUpload
        borrowerId={mockBorrowerId}
        supabaseClient={mockStorageClient}
        onBack={mockOnBack}
        onContinue={mockOnContinue}
      />
    );

    const validPdf = new File(['fake-pdf'], 'afip.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('input-file-afip');
    fireEvent.change(fileInput, { target: { files: [validPdf] } });

    expect(
      await screen.findByText(/Tu sesión ha expirado o no cuenta con permisos suficientes/i)
    ).toBeInTheDocument();
  });

  it('resets error state and allows uploading another file after removing', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });
    const mockStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
        }),
      },
    } as any;

    render(
      <StepDocumentUpload
        borrowerId={mockBorrowerId}
        supabaseClient={mockStorageClient}
        onBack={mockOnBack}
        onContinue={mockOnContinue}
      />
    );

    const fileInput = screen.getByTestId('input-file-afip');
    const validPdf = new File(['pdf1'], 'constancia1.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [validPdf] } });

    await waitFor(() => {
      expect(screen.getByTestId('badge-afip-file')).toBeInTheDocument();
    });

    // Remove file
    fireEvent.click(screen.getByTestId('remove-afip-file'));
    expect(screen.queryByTestId('badge-afip-file')).not.toBeInTheDocument();

    // Re-upload second file
    const secondInput = screen.getByTestId('input-file-afip');
    const secondPdf = new File(['pdf2'], 'constancia2.pdf', { type: 'application/pdf' });
    fireEvent.change(secondInput, { target: { files: [secondPdf] } });

    await waitFor(() => {
      expect(screen.getByTestId('badge-afip-file')).toBeInTheDocument();
    });
  });

  it('blocks continue to Step 4 if mandatory AFIP constancia is missing, and proceeds when present', () => {
    render(
      <StepDocumentUpload
        borrowerId={mockBorrowerId}
        onBack={mockOnBack}
        onContinue={mockOnContinue}
      />
    );

    // Try to continue without AFIP
    fireEvent.click(screen.getByTestId('step3-continue-button'));
    expect(
      screen.getByText('La Constancia de inscripción AFIP / ARCA es obligatoria para continuar.')
    ).toBeInTheDocument();
    expect(mockOnContinue).not.toHaveBeenCalled();

    // Provide AFIP
    const fileInput = screen.getByTestId('input-file-afip');
    const validPdf = new File(['pdf'], 'afip.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [validPdf] } });

    // Click continue
    fireEvent.click(screen.getByTestId('step3-continue-button'));
    expect(mockOnContinue).toHaveBeenCalledTimes(1);
    expect(mockOnContinue.mock.calls[0][0].afip_constancia).toEqual({
      name: 'afip.pdf',
      size: 3,
      type: 'application/pdf',
    });
  });
});
