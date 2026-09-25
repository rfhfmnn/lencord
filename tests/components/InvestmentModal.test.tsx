import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Loan } from '@/types';
import { InvestmentModal, MIN_INVESTMENT_TICKET } from '@/components/marketplace/InvestmentModal';
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
});
