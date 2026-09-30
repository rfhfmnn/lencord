import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Loan } from '@/types';
import {
  InvestmentModal,
  MIN_INVESTMENT_TICKET,
  calculateFinancialRates,
  calculateInvestmentReturn,
} from '@/components/marketplace/InvestmentModal';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';

describe('InvestmentModal Component (Task 10)', () => {
  const mockLoan: Loan = {
    id: 'loan-test-010',
    borrower_id: 'prof-sme-001',
    amount_requested: 10_000_000,
    amount_funded: 6_000_000, // Remaining capacity: 4_000_000
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 45.0,
    platform_spread: 2.5,
    borrower_rate: 47.5,
    base_uva_value: null,
    category: 'working_capital',
    status: 'funding',
    funding_deadline: '2026-10-31T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  it('does not render when isOpen is false', () => {
    render(
      <InvestmentModal
        isOpen={false}
        onClose={vi.fn()}
        loan={mockLoan}
      />
    );
    expect(screen.queryByTestId('investment-modal')).not.toBeInTheDocument();
  });

  it('renders modal with title, remaining capacity, and minimum ticket when isOpen is true', () => {
    render(
      <InvestmentModal
        isOpen={true}
        onClose={vi.fn()}
        loan={mockLoan}
      />
    );
    expect(screen.getByTestId('investment-modal')).toBeInTheDocument();
    expect(screen.getByText('Invertir en esta PyME')).toBeInTheDocument();
    expect(screen.getByTestId('modal-remaining-capacity')).toHaveTextContent('$ 4.000.000');
    expect(screen.getByTestId('modal-confirm-button')).toBeDisabled();
  });

  it('validates and rejects values below minimum ticket ($10.000)', async () => {
    render(
      <InvestmentModal
        isOpen={true}
        onClose={vi.fn()}
        loan={mockLoan}
      />
    );

    const input = screen.getByTestId('investment-amount-input');
    fireEvent.change(input, { target: { value: '5000' } });

    expect(
      screen.getByText('El ticket mínimo de inversión es de $ 10.000.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('modal-confirm-button')).toBeDisabled();
  });

  it('validates and rejects values exceeding remaining capacity (overfunding prevention)', async () => {
    render(
      <InvestmentModal
        isOpen={true}
        onClose={vi.fn()}
        loan={mockLoan}
      />
    );

    const input = screen.getByTestId('investment-amount-input');
    // Remaining capacity is $ 4.000.000, attempt $ 5.000.000
    fireEvent.change(input, { target: { value: '5000000' } });

    expect(
      screen.getByText(/supera el cupo remanente disponible/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('modal-confirm-button')).toBeDisabled();
  });

  it('enables submission button when amount is valid', async () => {
    render(
      <InvestmentModal
        isOpen={true}
        onClose={vi.fn()}
        loan={mockLoan}
      />
    );

    const input = screen.getByTestId('investment-amount-input');
    fireEvent.change(input, { target: { value: '500000' } });

    expect(screen.queryByTestId('input-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal-confirm-button')).not.toBeDisabled();
  });

  it('submits investment successfully and displays confirmation view', async () => {
    const services = createServices({ useMocks: true });
    // Ensure the loan exists in the mock state
    const existingLoan = await services.loans.getLoanById('loan-seed-001');
    const loanToUse = existingLoan ?? mockLoan;

    const onSuccessMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <ServiceProvider services={services}>
        <InvestmentModal
          isOpen={true}
          onClose={onCloseMock}
          loan={loanToUse}
          onSuccess={onSuccessMock}
        />
      </ServiceProvider>
    );

    const input = screen.getByTestId('investment-amount-input');
    fireEvent.change(input, { target: { value: '100000' } });

    const submitBtn = screen.getByTestId('modal-confirm-button');
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('investment-success-view')).toBeInTheDocument();
    });

    expect(screen.getByText('¡Inversión confirmada con éxito!')).toBeInTheDocument();
    expect(screen.getByTestId('success-amount')).toHaveTextContent('$ 100.000');
    expect(onSuccessMock).toHaveBeenCalledTimes(1);

    // Closing the success view
    fireEvent.click(screen.getByTestId('close-success-button'));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('displays fully funded banner when commitment completes 100% of the loan', async () => {
    const services = createServices({ useMocks: true });
    // Prepare a loan with remaining capacity of exactly $ 50.000
    const partialLoan: Loan = {
      ...mockLoan,
      id: 'loan-almost-full',
      amount_requested: 1_000_000,
      amount_funded: 950_000, // 50_000 remaining
    };

    // Commit via mock service to add loan to store
    // Let's create an in-store loan
    const submitted = await services.loans.submitLoanApplication({
      borrower_id: 'prof-sme-001',
      amount_requested: 100_000,
      term_months: 3,
      rate_type: 'TNA_FIXED',
      category: 'working_capital',
    });
    const approved = await services.loans.approveAndPublishLoan({
      loan_id: submitted.id,
      risk_tier: 'Tier A',
      investor_rate: 45,
      platform_spread: 2,
      funding_deadline: '2026-12-31T00:00:00.000Z',
    });

    render(
      <ServiceProvider services={services}>
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={approved}
        />
      </ServiceProvider>
    );

    // Commit full $100.000
    const input = screen.getByTestId('investment-amount-input');
    fireEvent.change(input, { target: { value: '100000' } });

    fireEvent.click(screen.getByTestId('modal-confirm-button'));

    await waitFor(() => {
      expect(screen.getByTestId('success-fully-funded-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/¡Subasta completada al 100%!/i)).toBeInTheDocument();
  });

  it('prevents borrower from committing investments into their own loan listing', async () => {
    const services = createServices({ useMocks: true });

    render(
      <ServiceProvider services={services}>
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          investorId={mockLoan.borrower_id} // Attempting to invest in their own loan
        />
      </ServiceProvider>
    );

    // Warning is displayed
    expect(screen.getByTestId('self-funding-warning')).toBeInTheDocument();
    expect(screen.getByText(/No podés invertir en tu propia solicitud/i)).toBeInTheDocument();

    // Input and confirm button are disabled
    expect(screen.getByTestId('investment-amount-input')).toBeDisabled();
    expect(screen.getByTestId('modal-confirm-button')).toBeDisabled();
  });

  describe('DNI / Tax ID Requirement (Issue #53)', () => {
    it('disables confirm button and displays alert when investor has missing DNI', async () => {
      render(
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
          investorTaxId={null}
        />
      );

      // Alert is displayed
      const alert = screen.getByTestId('missing-tax-id-alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(
        'Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil.'
      );

      // Redirection button is present
      const completeDniBtn = screen.getByTestId('complete-dni-button');
      expect(completeDniBtn).toBeInTheDocument();
      expect(completeDniBtn).toHaveTextContent('Completar DNI en mi perfil');

      // Even if user types a valid amount, confirm button remains disabled
      const input = screen.getByTestId('investment-amount-input');
      fireEvent.change(input, { target: { value: '50000' } });

      const submitBtn = screen.getByTestId('modal-confirm-button');
      expect(submitBtn).toBeDisabled();
    });

    it('rejects investment in service layer with MISSING_TAX_ID when investor lacks tax_id', async () => {
      const services = createServices({ useMocks: true });
      // Add a mock profile without tax_id
      const mockState = (services.investments as any).store;
      if (mockState) {
        mockState.profiles.push({
          id: 'prof-inv-without-dni',
          role: 'investor',
          tax_id: null,
          legal_name: 'Inversor Sin DNI',
          phone: '',
          kyc_status: 'pending',
          bank_cbu_cvu: '0000000000000000000000',
          created_at: new Date().toISOString(),
        });
      }

      await expect(
        services.investments.commitInvestment({
          loan_id: 'loan-seed-001',
          investor_id: 'prof-inv-without-dni',
          amount: 25000,
        })
      ).rejects.toThrow(/MISSING_TAX_ID/);
    });
  });

  describe('Financial Rates & Returns Calculation (Issue #59)', () => {
    it('displays normalized financial rates: TNA, TEM, TEA', () => {
      render(
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
        />
      );

      // Verify container presence
      expect(screen.getByTestId('financial-rates')).toBeInTheDocument();

      // Rates for mockLoan (investor_rate: 45.0, TNA_FIXED)
      // TNA: 45,0% TNA
      const tnaEl = screen.getByTestId('modal-rate-tna');
      expect(tnaEl).toHaveTextContent('45,0% TNA');

      // TEM: 45 / 12 = 3.75% TEM
      const temEl = screen.getByTestId('modal-rate-tem');
      expect(temEl).toHaveTextContent('3,75% TEM');

      // TEA: ((1 + 0.0375)^12 - 1) * 100 = 55.5% TEA
      const teaEl = screen.getByTestId('modal-rate-tea');
      expect(teaEl).toHaveTextContent('55,5% TEA');
    });

    it('formats CER variable rate properly in TNA rate block', () => {
      const cerLoan: Loan = {
        ...mockLoan,
        rate_type: 'CER_VARIABLE',
        investor_rate: 12.0,
      };

      render(
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={cerLoan}
        />
      );

      expect(screen.getByTestId('modal-rate-tna')).toHaveTextContent('CER + 12,0%');
      expect(screen.getByTestId('modal-rate-tem')).toHaveTextContent('1,0% TEM');
      expect(screen.getByTestId('modal-rate-tea')).toHaveTextContent('12,7% TEA');
    });

    it('displays $ 0 for estimated profit and total return when input is empty or below minimum ticket', () => {
      render(
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan}
        />
      );

      const returnsSummary = screen.getByTestId('investment-returns-summary');
      expect(returnsSummary).toBeInTheDocument();

      // Empty input initially
      expect(screen.getByTestId('modal-estimated-profit')).toHaveTextContent('$ 0');
      expect(screen.getByTestId('modal-total-return')).toHaveTextContent('$ 0');

      // Value below minimum ticket (5.000 < 10.000)
      const input = screen.getByTestId('investment-amount-input');
      fireEvent.change(input, { target: { value: '5000' } });

      expect(screen.getByTestId('modal-estimated-profit')).toHaveTextContent('$ 0');
      expect(screen.getByTestId('modal-total-return')).toHaveTextContent('$ 0');
    });

    it('reactively calculates profit and total return on valid input changes', () => {
      render(
        <InvestmentModal
          isOpen={true}
          onClose={vi.fn()}
          loan={mockLoan} // 6 months, 45% TNA -> TEM = 3.75%
        />
      );

      const input = screen.getByTestId('investment-amount-input');

      // Input $ 100.000:
      // profit = 100.000 * 0.0375 * 6 = 22.500
      // total = 100.000 + 22.500 = 122.500
      fireEvent.change(input, { target: { value: '100000' } });
      expect(screen.getByTestId('modal-estimated-profit')).toHaveTextContent('$ 22.500');
      expect(screen.getByTestId('modal-total-return')).toHaveTextContent('$ 122.500');

      // Update to $ 500.000:
      // profit = 500.000 * 0.0375 * 6 = 112.500
      // total = 500.000 + 112.500 = 612.500
      fireEvent.change(input, { target: { value: '500000' } });
      expect(screen.getByTestId('modal-estimated-profit')).toHaveTextContent('$ 112.500');
      expect(screen.getByTestId('modal-total-return')).toHaveTextContent('$ 612.500');
    });

    it('calculateFinancialRates helper accurately computes TNA, TEM, and TEA values', () => {
      const rates45 = calculateFinancialRates(mockLoan);
      expect(rates45.tna).toBe(45);
      expect(rates45.tem).toBe(3.75);
      expect(rates45.tea).toBeCloseTo(55.545, 2);
      expect(rates45.tnaDisplay).toBe('45,0% TNA');
      expect(rates45.temDisplay).toBe('3,75% TEM');
      expect(rates45.teaDisplay).toBe('55,5% TEA');

      const loan48: Loan = { ...mockLoan, investor_rate: 48.0 };
      const rates48 = calculateFinancialRates(loan48);
      expect(rates48.tna).toBe(48);
      expect(rates48.tem).toBe(4);
      expect(rates48.tea).toBeCloseTo(60.103, 2);
      expect(rates48.tnaDisplay).toBe('48,0% TNA');
      expect(rates48.temDisplay).toBe('4,0% TEM');
      expect(rates48.teaDisplay).toBe('60,1% TEA');
    });

    it('calculateInvestmentReturn helper accurately computes returns and handles edge cases', () => {
      expect(calculateInvestmentReturn(0, 6, 45)).toEqual({ profit: 0, totalReturn: 0 });
      expect(calculateInvestmentReturn(9999, 6, 45)).toEqual({ profit: 0, totalReturn: 0 });
      expect(calculateInvestmentReturn(-50000, 6, 45)).toEqual({ profit: 0, totalReturn: 0 });
      expect(calculateInvestmentReturn(100000, 0, 45)).toEqual({ profit: 0, totalReturn: 0 });
      expect(calculateInvestmentReturn(100000, 6, 0)).toEqual({ profit: 0, totalReturn: 0 });

      // 100.000 at 45% for 1 month: 100.000 * 0.0375 * 1 = 3750
      expect(calculateInvestmentReturn(100000, 1, 45)).toEqual({
        profit: 3750,
        totalReturn: 103750,
      });

      // 100.000 at 45% for 12 months: 100.000 * 0.0375 * 12 = 45000
      expect(calculateInvestmentReturn(100000, 12, 45)).toEqual({
        profit: 45000,
        totalReturn: 145000,
      });
    });
  });
});
