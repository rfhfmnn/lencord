import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ElectronicSignatureModal } from '@/components/legal/ElectronicSignatureModal';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import type { Loan, LegalContract } from '@/types';

describe('ElectronicSignatureModal Component (Issue #67)', () => {
  const mockLoan: Loan = {
    id: 'loan-test-67',
    borrower_id: 'prof-sme-001',
    amount_requested: 2500000,
    amount_funded: 2500000,
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 42,
    platform_spread: 8,
    borrower_rate: 50,
    base_uva_value: null,
    category: 'WORKING_CAPITAL',
    status: 'funded',
    funding_deadline: '2026-11-01T00:00:00.000Z',
    created_at: '2026-10-01T12:00:00.000Z',
  };

  let services: ReturnType<typeof createServices>;

  beforeEach(() => {
    services = createServices({ useMocks: true });
    // Seed loan into mock store so legal service can generate contracts
    (services.loans as any).store?.loans?.push?.(mockLoan);
    vi.clearAllMocks();
  });

  it('renders structured legal contract summary and preview', async () => {
    render(
      <ServiceProvider services={services}>
        <ElectronicSignatureModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          borrowerName="Metalúrgica Quilmes S.R.L."
          signerName="Juan Pérez"
          signerRole="borrower"
        />
      </ServiceProvider>
    );

    expect(screen.getByText('Firma Electrónica de Contrato y Pagaré')).toBeInTheDocument();
    expect(screen.getByTestId('summary-borrower-name')).toHaveTextContent('Metalúrgica Quilmes S.R.L.');
    expect(screen.getByTestId('summary-principal-amount')).toHaveTextContent('$ 2.500.000');
    expect(screen.getByTestId('summary-term')).toHaveTextContent('6 meses');
    expect(screen.getByTestId('download-pdf-link')).toHaveAttribute('href', expect.stringContaining('.pdf'));
    expect(screen.getByTestId('contract-clauses-preview')).toBeInTheDocument();
  });

  it('enforces mandatory oath consent checkbox before allowing signature', async () => {
    render(
      <ServiceProvider services={services}>
        <ElectronicSignatureModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          borrowerName="Metalúrgica Quilmes S.R.L."
        />
      </ServiceProvider>
    );

    const signBtn = screen.getByTestId('btn-sign-contract');
    const checkbox = screen.getByTestId('consent-checkbox');

    // Button should be disabled initially
    expect(signBtn).toBeDisabled();

    // Check oath box
    fireEvent.click(checkbox);
    expect(signBtn).not.toBeDisabled();

    // Uncheck oath box
    fireEvent.click(checkbox);
    expect(signBtn).toBeDisabled();
  });

  it('generates cryptographic SHA-256 hash and registers electronic signature with audit metadata', async () => {
    const onSuccessMock = vi.fn();
    const signSpy = vi.spyOn(services.legal, 'signContract');

    render(
      <ServiceProvider services={services}>
        <ElectronicSignatureModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          signerId="user-pyme-123"
          signerRole="borrower"
          borrowerName="Metalúrgica Quilmes S.R.L."
          onSuccess={onSuccessMock}
        />
      </ServiceProvider>
    );

    await screen.findByTestId('download-pdf-link');

    const checkbox = screen.getByTestId('consent-checkbox');
    fireEvent.click(checkbox);

    const signBtn = screen.getByTestId('btn-sign-contract');
    fireEvent.click(signBtn);

    await waitFor(() => {
      expect(signSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          signature_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
          signer_id: 'user-pyme-123',
          signer_role: 'borrower',
          signer_user_agent: expect.any(String),
          signer_ip: expect.any(String),
        })
      );
      expect(onSuccessMock).toHaveBeenCalled();
    });

    // Badge should be displayed once signed
    expect(await screen.findByTestId('signed-status-pill')).toHaveTextContent('Firmado electrónicamente');
    expect(screen.getByTestId('signed-hash-prefix')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-sign-contract')).not.toBeInTheDocument();
  });

  it('renders signed badge, audit date and hash prefix when contract is already signed', async () => {
    const signedContract: LegalContract = {
      id: 'contract-signed-001',
      loan_id: mockLoan.id,
      document_type: 'mutuo',
      document_url: 'https://storage.lencord.ar/contracts/signed.pdf',
      signer_id: 'user-pyme-123',
      signer_role: 'borrower',
      signature_hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      signed_at: '2026-10-01T14:30:00.000Z',
    };

    render(
      <ServiceProvider services={services}>
        <ElectronicSignatureModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          contract={signedContract}
        />
      </ServiceProvider>
    );

    expect(screen.getByTestId('signed-status-pill')).toHaveTextContent('Firmado electrónicamente');
    expect(screen.getByTestId('signed-hash-prefix')).toHaveTextContent('a1b2c3d4e5f67890');
    expect(screen.queryByTestId('consent-checkbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-sign-contract')).not.toBeInTheDocument();
  });
});
