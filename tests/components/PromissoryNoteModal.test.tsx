import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Installment, LegalContract, Loan, Profile } from '@/types';
import { PromissoryNoteModal } from '@/components/legal/PromissoryNoteModal';
import { BorrowerDashboard } from '@/components/dashboard/BorrowerDashboard';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { MockStateStore } from '@/services/mock/mockState';

describe('PromissoryNoteModal Component & Signing Flow (Issue #16)', () => {
  let store: MockStateStore;
  let services: ReturnType<typeof createServices>;

  const sampleBorrower: Profile = {
    id: 'prof-sme-004',
    role: 'sme',
    tax_id: '30715566772',
    legal_name: 'TecnoAgro Rosario SAS',
    phone: '+54 341 480-5544',
    kyc_status: 'approved',
    bank_cbu_cvu: '2850321040000011223344',
    created_at: '2026-02-20T11:00:00.000Z',
  };

  const sampleFundedLoan: Loan = {
    id: 'loan-seed-004',
    borrower_id: 'prof-sme-004',
    amount_requested: 30_000_000,
    amount_funded: 30_000_000,
    term_months: 12,
    rate_type: 'CER_VARIABLE',
    investor_rate: 12.5,
    platform_spread: 2.0,
    borrower_rate: 14.5,
    base_uva_value: 1240.0,
    category: 'expansion',
    status: 'funded',
    funding_deadline: '2026-09-30T23:59:59.000Z',
    created_at: '2026-08-25T11:30:00.000Z',
  };

  const sampleInstallments: Installment[] = [
    {
      id: 'inst-seed-001',
      loan_id: 'loan-seed-004',
      installment_number: 1,
      due_date: '2026-10-30',
      principal_amount: 2_500_000,
      interest_borrower: 362_500,
      interest_investors: 312_500,
      interest_lencord: 50_000,
      uva_value_applied: 1240.0,
      status: 'pending',
      paid_at: null,
    },
    {
      id: 'inst-seed-002',
      loan_id: 'loan-seed-004',
      installment_number: 2,
      due_date: '2026-11-30',
      principal_amount: 2_500_000,
      interest_borrower: 332_291.67,
      interest_investors: 286_458.33,
      interest_lencord: 45_833.34,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
  ];

  beforeEach(() => {
    store = new MockStateStore();
    services = createServices({ store, useMocks: true });
  });

  it('renders legal mutual agreement and promissory note text with borrower details and calculated schedule', () => {
    const handleClose = vi.fn();

    render(
      <ServiceProvider services={services}>
        <PromissoryNoteModal
          isOpen={true}
          onClose={handleClose}
          loan={sampleFundedLoan}
          borrower={sampleBorrower}
          installments={sampleInstallments}
        />
      </ServiceProvider>
    );

    // Modal and title
    expect(screen.getByTestId('promissory-note-modal')).toBeInTheDocument();
    expect(screen.getByText(/Firma de Pagaré Digital y Mutuo/i)).toBeInTheDocument();

    // Borrower legal name & CUIT
    const nameEl = screen.getByTestId('contract-borrower-name');
    expect(nameEl).toHaveTextContent('TecnoAgro Rosario SAS');
    const cuitEl = screen.getByTestId('contract-borrower-cuit');
    expect(cuitEl).toHaveTextContent('30715566772');

    // Principal amount ($ 30.000.000)
    const principalEl = screen.getByTestId('contract-principal-amount');
    expect(principalEl).toHaveTextContent('$ 30.000.000');

    // Interest rate
    const rateEl = screen.getByTestId('contract-interest-rate');
    expect(rateEl).toHaveTextContent(/14[,.]5/);

    // Calculated installment payment schedule
    const scheduleEl = screen.getByTestId('contract-schedule');
    expect(scheduleEl).toBeInTheDocument();
    expect(screen.getByTestId('schedule-row-1')).toHaveTextContent('Cuota 1');
    expect(screen.getByTestId('schedule-row-1')).toHaveTextContent('2026-10-30');
    expect(screen.getByTestId('schedule-row-1')).toHaveTextContent('$ 2.500.000');
    expect(screen.getByTestId('schedule-row-2')).toHaveTextContent('Cuota 2');
  });

  it('displays 6-digit OTP verification inputs simulating SMS/email 2FA', () => {
    render(
      <ServiceProvider services={services}>
        <PromissoryNoteModal
          isOpen={true}
          onClose={vi.fn()}
          loan={sampleFundedLoan}
          borrower={sampleBorrower}
        />
      </ServiceProvider>
    );

    expect(screen.getByTestId('otp-section')).toBeInTheDocument();
    expect(screen.getByText(/Verificación de identidad 2FA \(OTP\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('simulated-otp-badge')).toHaveTextContent('123456');

    // Verify all 6 digit inputs are rendered
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`otp-input-${i}`)).toBeInTheDocument();
    }
  });

  it('displays error and prevents submission when OTP is incomplete', async () => {
    render(
      <ServiceProvider services={services}>
        <PromissoryNoteModal
          isOpen={true}
          onClose={vi.fn()}
          loan={sampleFundedLoan}
          borrower={sampleBorrower}
          simulatedOtp="123456"
        />
      </ServiceProvider>
    );

    // Enter only 3 digits
    fireEvent.change(screen.getByTestId('otp-input-0'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('otp-input-1'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('otp-input-2'), { target: { value: '3' } });

    fireEvent.click(screen.getByTestId('btn-confirm-sign'));

    const error = await screen.findByTestId('otp-error-message');
    expect(error).toHaveTextContent(/completá los 6 dígitos/i);
    expect(screen.queryByTestId('signature-success-pane')).not.toBeInTheDocument();
  });

  it('displays error and prevents submission when OTP is invalid', async () => {
    render(
      <ServiceProvider services={services}>
        <PromissoryNoteModal
          isOpen={true}
          onClose={vi.fn()}
          loan={sampleFundedLoan}
          borrower={sampleBorrower}
          simulatedOtp="123456"
        />
      </ServiceProvider>
    );

    // Enter incorrect 6 digits '999999'
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByTestId(`otp-input-${i}`), { target: { value: '9' } });
    }

    fireEvent.click(screen.getByTestId('btn-confirm-sign'));

    const error = await screen.findByTestId('otp-error-message');
    expect(error).toHaveTextContent(/Código OTP inválido/i);
    expect(screen.queryByTestId('signature-success-pane')).not.toBeInTheDocument();
  });

  it('successfully signs contract with SHA-256 hash when valid OTP is entered', async () => {
    const onSuccessMock = vi.fn();

    render(
      <ServiceProvider services={services}>
        <PromissoryNoteModal
          isOpen={true}
          onClose={vi.fn()}
          loan={sampleFundedLoan}
          borrower={sampleBorrower}
          simulatedOtp="123456"
          onSuccess={onSuccessMock}
        />
      </ServiceProvider>
    );

    // Enter valid '123456'
    const code = '123456';
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByTestId(`otp-input-${i}`), { target: { value: code[i] } });
    }

    fireEvent.click(screen.getByTestId('btn-confirm-sign'));

    // Wait for success screen
    await waitFor(() => {
      expect(screen.getByTestId('signature-success-pane')).toBeInTheDocument();
    });

    // Check SHA-256 hash display
    const hashEl = screen.getByTestId('signature-hash');
    expect(hashEl.textContent).toMatch(/^[a-f0-9]{64}$/i);

    // Check timestamp display
    expect(screen.getByTestId('signature-timestamp')).toBeInTheDocument();

    // Check onSuccess callback called with signed contract
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    const contractResult: LegalContract = onSuccessMock.mock.calls[0][0];
    expect(contractResult.signature_hash).toBe(hashEl.textContent);
    expect(contractResult.signed_at).toBeDefined();

    // Verify stored contract in service
    const storedContracts = await services.legal.getContractsByLoan(sampleFundedLoan.id);
    const signedStored = storedContracts.find((c) => c.document_type === 'pagare');
    expect(signedStored?.signature_hash).toBe(hashEl.textContent);
  });

  it('cancels modal when Cancel button or Close button is clicked without modifying contract', () => {
    const handleClose = vi.fn();

    render(
      <ServiceProvider services={services}>
        <PromissoryNoteModal
          isOpen={true}
          onClose={handleClose}
          loan={sampleFundedLoan}
          borrower={sampleBorrower}
        />
      </ServiceProvider>
    );

    // Click close '✕' button
    fireEvent.click(screen.getByTestId('btn-close-modal'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Click Cancel button
    fireEvent.click(screen.getByTestId('btn-cancel-modal'));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('integrates with BorrowerDashboard: opening modal from funded loan and transitioning to active/ready status on sign', async () => {
    render(
      <ServiceProvider services={services}>
        <BorrowerDashboard initialLoans={[sampleFundedLoan]} initialInstallments={sampleInstallments} />
      </ServiceProvider>
    );

    // Initially in 'funded' state
    expect(screen.getByTestId('borrower-status-badge')).toHaveTextContent('funded');
    const signBtn = screen.getByTestId('btn-sign-promissory-note');
    expect(signBtn).toBeInTheDocument();

    // Open modal
    fireEvent.click(signBtn);
    expect(screen.getByTestId('promissory-note-modal')).toBeInTheDocument();

    // Enter valid OTP
    const code = '123456';
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByTestId(`otp-input-${i}`), { target: { value: code[i] } });
    }

    // Submit signature
    fireEvent.click(screen.getByTestId('btn-confirm-sign'));

    // Wait for success in modal
    await waitFor(() => {
      expect(screen.getByTestId('signature-success-pane')).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByTestId('btn-close-signed'));

    // Verify modal is closed
    expect(screen.queryByTestId('promissory-note-modal')).not.toBeInTheDocument();

    // Loan status transitioned to 'active' (disbursement readiness)
    expect(screen.getByTestId('borrower-status-badge')).toHaveTextContent('active');
    expect(screen.getByTestId('amortization-table')).toBeInTheDocument();
  });
});
