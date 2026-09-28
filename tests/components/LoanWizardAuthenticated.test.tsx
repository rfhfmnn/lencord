import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoanWizard } from '@/components/forms/LoanWizard';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import type { Loan, LoanServiceInterface, SubmitLoanInput } from '@/types';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

describe('SME Loan Application Pre-population and Authenticated Submission (Issue #33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Pre-population and Read-Only Constraints (Step 1)', () => {
    it('pre-populates CUIT, company name, and email from authenticated userProfile prop and renders verified fields in read-only state', async () => {
      const mockUserProfile = {
        id: 'borrower-auth-uuid-123',
        legal_name: 'Soluciones Metalúrgicas Quilmes S.A.',
        tax_id: '30712345671',
        email: 'contacto@quilmes-metal.com.ar',
        phone: '+54 11 5555-9876',
        bank_cbu_cvu: '0720123488000012345678',
        isVerified: true,
      };

      render(
        <LoanWizard
          userProfile={mockUserProfile}
          redirectToConfirmationPage={false}
        />
      );

      // Verify pre-populated values in Step 1
      const legalNameInput = screen.getByTestId('input-legal-name') as HTMLInputElement;
      const taxIdInput = screen.getByTestId('input-tax-id') as HTMLInputElement;
      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;

      expect(legalNameInput.value).toBe('Soluciones Metalúrgicas Quilmes S.A.');
      expect(taxIdInput.value).toBe('30-71234567-1');
      expect(emailInput.value).toBe('contacto@quilmes-metal.com.ar');

      // Verify read-only state to prevent identity spoofing
      expect(legalNameInput).toHaveAttribute('readonly');
      expect(taxIdInput).toHaveAttribute('readonly');
      expect(emailInput).toHaveAttribute('readonly');

      // Notice should be displayed
      expect(screen.getByTestId('verified-company-notice')).toBeInTheDocument();
      expect(screen.getByTestId('verified-company-notice')).toHaveTextContent(
        /datos fiscales verificados/i
      );
    });

    it('asynchronously loads authenticated profile via Supabase client session and applies read-only protection', async () => {
      const mockSupabaseClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: {
              session: {
                user: {
                  id: 'supabase-auth-user-999',
                  email: 'admin@pyme-avellaneda.ar',
                  user_metadata: {
                    legal_name: 'Logística Avellaneda S.R.L.',
                    tax_id: '30500010912',
                  },
                },
              },
            },
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'supabase-auth-user-999',
              legal_name: 'Logística Avellaneda S.R.L.',
              tax_id: '30500010912',
              phone: '+54 11 3333-2222',
              bank_cbu_cvu: '0000003100012345678901',
              role: 'sme',
            },
            error: null,
          }),
        }),
      };

      render(
        <LoanWizard
          supabaseClient={mockSupabaseClient as any}
          redirectToConfirmationPage={false}
        />
      );

      let legalNameInput!: HTMLInputElement;
      await waitFor(() => {
        legalNameInput = screen.getByTestId('input-legal-name') as HTMLInputElement;
        expect(legalNameInput.value).toBe('Logística Avellaneda S.R.L.');
      });

      const taxIdInput = screen.getByTestId('input-tax-id') as HTMLInputElement;
      const emailInput = screen.getByTestId('input-email') as HTMLInputElement;

      expect(taxIdInput.value).toBe('30-50001091-2');
      expect(emailInput.value).toBe('admin@pyme-avellaneda.ar');

      expect(legalNameInput).toHaveAttribute('readonly');
      expect(taxIdInput).toHaveAttribute('readonly');
      expect(emailInput).toHaveAttribute('readonly');
    });
  });

  describe('Authenticated Submission Payload and Loan Association', () => {
    it('associates submitted loan with authenticated borrower_id and persists status as in_review', async () => {
      const services = createServices({ useMocks: true });
      const submitSpy = vi.spyOn(services.loans, 'submitLoanApplication');
      const onSubmittedMock = vi.fn();

      const authenticatedBorrowerId = 'usr-authenticated-borrower-777';

      render(
        <ServiceProvider services={services}>
          <LoanWizard
            initialStep={4}
            borrowerId={authenticatedBorrowerId}
            initialStep1Data={{
              legal_name: 'Fábrica de Envases del Sur S.A.',
              tax_id: '30-50001091-2',
              company_type: 'SA',
              email: 'finanzas@envasesdelsur.ar',
            }}
            initialStep2Data={{
              category: 'working_capital',
              amount_requested: 7500000,
              term_months: 9,
              rate_type: 'TNA_FIXED',
            }}
            initialStep3Data={{
              balance_sheet_url: 'https://storage.lencord.ar/loan-documents/usr-777/balance.pdf',
              f931_url: 'https://storage.lencord.ar/loan-documents/usr-777/f931.pdf',
            }}
            initialStep4Data={{
              cbu_cvu: '0720123488000012345678',
            }}
            onSubmitted={onSubmittedMock}
            redirectToConfirmationPage={false}
          />
        </ServiceProvider>
      );

      // Agree to funds declaration and terms
      fireEvent.click(screen.getByTestId('checkbox-funds-declaration'));
      fireEvent.click(screen.getByTestId('checkbox-terms-accepted'));

      // Submit
      fireEvent.click(screen.getByTestId('step4-submit-button'));

      await waitFor(() => {
        expect(submitSpy).toHaveBeenCalledTimes(1);
      });

      const payload: SubmitLoanInput = submitSpy.mock.calls[0][0];
      expect(payload.borrower_id).toBe(authenticatedBorrowerId);
      expect(payload.amount_requested).toBe(7500000);
      expect(payload.term_months).toBe(9);
      expect(payload.rate_type).toBe('TNA_FIXED');
      expect(payload.category).toBe('working_capital');
      expect(payload.balance_sheet_url).toBe('https://storage.lencord.ar/loan-documents/usr-777/balance.pdf');
      expect(payload.f931_url).toBe('https://storage.lencord.ar/loan-documents/usr-777/f931.pdf');

      expect(onSubmittedMock).toHaveBeenCalledTimes(1);
      const createdLoan: Loan = onSubmittedMock.mock.calls[0][0];
      expect(createdLoan.borrower_id).toBe(authenticatedBorrowerId);
      expect(createdLoan.status).toBe('in_review');

      // Verify receipt rendered
      expect(screen.getByTestId('receipt-status')).toHaveTextContent('En revisión (in_review)');
    });
  });

  describe('Error Handling and Inline Retry Alert without Wiping Steps', () => {
    it('presents an inline retry alert on network/service failure without wiping filled form steps', async () => {
      const mockLoanService: LoanServiceInterface = {
        getLoanById: vi.fn(),
        listLoans: vi.fn(),
        submitLoanApplication: vi
          .fn()
          .mockRejectedValueOnce(new Error('Fallo de conexión con el servidor Supabase. Por favor reintentá.'))
          .mockResolvedValueOnce({
            id: 'loan-retry-success-123',
            borrower_id: 'borrower-retry-id',
            amount_requested: 5000000,
            amount_funded: 0,
            term_months: 6,
            rate_type: 'TNA_FIXED',
            investor_rate: 0,
            platform_spread: 0,
            borrower_rate: 0,
            base_uva_value: null,
            category: 'working_capital',
            status: 'in_review',
            funding_deadline: '2026-11-01T00:00:00.000Z',
            created_at: new Date().toISOString(),
          }),
        approveAndPublishLoan: vi.fn(),
        rejectLoan: vi.fn(),
        finalizeLoanFunding: vi.fn(),
        cancelLoan: vi.fn(),
        getInstallmentsByLoan: vi.fn(),
      };

      const services = createServices({
        useMocks: true,
        overrides: { loans: mockLoanService },
      });

      render(
        <ServiceProvider services={services}>
          <LoanWizard
            initialStep={4}
            initialStep1Data={{
              legal_name: 'Pinturerías Centro S.R.L.',
              tax_id: '30-71234567-1',
            }}
            initialStep2Data={{
              amount_requested: 5000000,
              term_months: 6,
            }}
            initialStep4Data={{
              cbu_cvu: '0720123488000012345678',
              funds_declaration: true,
              terms_accepted: true,
            }}
            redirectToConfirmationPage={false}
          />
        </ServiceProvider>
      );

      // Attempt submit - will fail
      fireEvent.click(screen.getByTestId('step4-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('submit-error-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('submit-error-banner')).toHaveTextContent(
        'Fallo de conexión con el servidor Supabase. Por favor reintentá.'
      );

      // Verify form steps and inputs are not wiped
      const cbuInput = screen.getByTestId('input-cbu') as HTMLInputElement;
      expect(cbuInput.value).toBe('0720123488000012345678');
      expect((screen.getByTestId('checkbox-funds-declaration') as HTMLInputElement).checked).toBe(true);
      expect((screen.getByTestId('checkbox-terms-accepted') as HTMLInputElement).checked).toBe(true);

      // Inline retry button is present
      const retryButton = screen.getByTestId('submit-retry-button');
      expect(retryButton).toBeInTheDocument();

      // Click inline retry button
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByTestId('application-confirmation')).toBeInTheDocument();
      });

      expect(screen.getByText('¡Solicitud enviada con éxito!')).toBeInTheDocument();
      expect(mockLoanService.submitLoanApplication).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Persistence across Refresh and Browser Restarts', () => {
    it('saves submitted loan to localStorage and redirects to /solicitar/confirmacion', async () => {
      const services = createServices({ useMocks: true });

      render(
        <ServiceProvider services={services}>
          <LoanWizard
            initialStep={4}
            borrowerId="prof-persisted-sme"
            initialStep1Data={{
              legal_name: 'Textil Munro S.A.',
              tax_id: '30-50001091-2',
            }}
            initialStep2Data={{
              category: 'working_capital',
              amount_requested: 6000000,
              term_months: 6,
              rate_type: 'TNA_FIXED',
            }}
            initialStep4Data={{
              cbu_cvu: '0720123488000012345678',
              funds_declaration: true,
              terms_accepted: true,
            }}
            redirectToConfirmationPage={true}
          />
        </ServiceProvider>
      );

      fireEvent.click(screen.getByTestId('step4-submit-button'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
      });

      const pushUrl = mockPush.mock.calls[0][0];
      expect(pushUrl).toContain('/solicitar/confirmacion?');
      expect(pushUrl).toContain('amount=6000000');
      expect(pushUrl).toContain('term=6');
      expect(pushUrl).toContain('legalName=Textil+Munro+S.A.');
      expect(pushUrl).toContain('taxId=30-50001091-2');

      // Verify persisted in localStorage
      const savedRaw = localStorage.getItem('lencord_last_submitted_loan');
      expect(savedRaw).not.toBeNull();
      const saved = JSON.parse(savedRaw!);
      expect(saved.loan.amount_requested).toBe(6000000);
      expect(saved.loan.status).toBe('in_review');
      expect(saved.legalName).toBe('Textil Munro S.A.');
    });

    it('restores draft state from localStorage on page refresh', () => {
      localStorage.setItem(
        'lencord_loan_wizard_draft',
        JSON.stringify({
          step: 2,
          step1Data: {
            legal_name: 'Calzados Hurlingham SRL',
            tax_id: '30-71234567-1',
          },
          step2Data: {
            amount_requested: 4500000,
            term_months: 12,
          },
        })
      );

      render(<LoanWizard />);

      // Should have restored Step 2 and its fields
      expect(screen.getByTestId('step-counter-badge')).toHaveTextContent('Paso 2 de 4');
      const amountInput = screen.getByTestId('input-amount-requested') as HTMLInputElement;
      expect(amountInput.value).toBe('4.500.000');
    });
  });
});
