import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Installment, Loan } from '@/types';
import { BorrowerDashboard } from '@/components/dashboard/BorrowerDashboard';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { defaultMockStateStore } from '@/services/mock/mockState';

describe('BorrowerDashboard Component (Task 14)', () => {
  const baseLoan: Loan = {
    id: 'loan-test-01',
    borrower_id: 'prof-sme-001',
    amount_requested: 10_000_000,
    amount_funded: 0,
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 45.0,
    platform_spread: 2.5,
    borrower_rate: 47.5,
    base_uva_value: null,
    category: 'working_capital',
    status: 'in_review',
    funding_deadline: '2026-10-30T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  const sampleInstallments: Installment[] = [
    {
      id: 'inst-1',
      loan_id: 'loan-test-01',
      installment_number: 1,
      due_date: '2026-10-30',
      principal_amount: 1_666_666.67,
      interest_borrower: 395_833.33,
      interest_investors: 375_000.00,
      interest_lencord: 20_833.33,
      uva_value_applied: null,
      status: 'paid',
      paid_at: '2026-10-29T12:00:00.000Z',
    },
    {
      id: 'inst-2',
      loan_id: 'loan-test-01',
      installment_number: 2,
      due_date: '2026-11-30',
      principal_amount: 1_666_666.67,
      interest_borrower: 329_861.11,
      interest_investors: 312_500.00,
      interest_lencord: 17_361.11,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
    {
      id: 'inst-3',
      loan_id: 'loan-test-01',
      installment_number: 3,
      due_date: '2026-12-30',
      principal_amount: 1_666_666.67,
      interest_borrower: 263_888.89,
      interest_investors: 250_000.00,
      interest_lencord: 13_888.89,
      uva_value_applied: null,
      status: 'overdue',
      paid_at: null,
    },
  ];

  it('renders correctly when loan is in "in_review" status (Credit Verification 24-48h)', () => {
    const loanInReview: Loan = { ...baseLoan, status: 'in_review' };

    render(<BorrowerDashboard initialLoans={[loanInReview]} />);

    // Active status badge
    const badge = screen.getByTestId('borrower-status-badge');
    expect(badge).toHaveTextContent('in_review');

    // In-review informational card
    const reviewCard = screen.getByTestId('in-review-card');
    expect(reviewCard).toBeInTheDocument();
    expect(reviewCard).toHaveTextContent('Solicitud en evaluación crediticia');
    expect(reviewCard).toHaveTextContent('24 y 48 horas hábiles');

    // Should not show auction monitor or signing notification or amortization table
    expect(screen.queryByTestId('auction-monitor-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('signing-notification')).not.toBeInTheDocument();
    expect(screen.queryByTestId('amortization-table')).not.toBeInTheDocument();
  });

  it('renders correctly when loan is in "funding" status (Auction monitor with pledged amount, percentage, and countdown)', () => {
    const loanFunding: Loan = {
      ...baseLoan,
      status: 'funding',
      amount_requested: 10_000_000,
      amount_funded: 6_000_000,
      funding_deadline: '2026-10-15T23:59:59.000Z',
    };
    const referenceDate = new Date('2026-10-05T00:00:00.000Z');

    render(
      <BorrowerDashboard initialLoans={[loanFunding]} referenceDate={referenceDate} />
    );

    // Active status badge
    const badge = screen.getByTestId('borrower-status-badge');
    expect(badge).toHaveTextContent('funding');

    // Auction monitor card
    const monitorCard = screen.getByTestId('auction-monitor-card');
    expect(monitorCard).toBeInTheDocument();

    // Pledged amount: $ 6.000.000
    expect(screen.getByTestId('amount-pledged')).toHaveTextContent('$ 6.000.000');

    // Percentage: 60% completado
    expect(screen.getByTestId('funding-percentage')).toHaveTextContent('60% completado');

    // Countdown: 11 days remaining (from 2026-10-05 to 2026-10-15T23:59:59)
    const countdown = screen.getByTestId('countdown-timer');
    expect(countdown).toHaveTextContent('días restantes');
  });

  it('renders correctly when loan is in "funded" status (Pagaré Digital prompt and signing button)', () => {
    const loanFunded: Loan = {
      ...baseLoan,
      status: 'funded',
      amount_requested: 10_000_000,
      amount_funded: 10_000_000,
    };
    const onSignMock = vi.fn();

    render(
      <BorrowerDashboard
        initialLoans={[loanFunded]}
        onSignPromissoryNote={onSignMock}
      />
    );

    // Active status badge
    const badge = screen.getByTestId('borrower-status-badge');
    expect(badge).toHaveTextContent('funded');

    // Signing notification banner
    const signingSection = screen.getByTestId('signing-notification');
    expect(signingSection).toBeInTheDocument();
    expect(signingSection).toHaveTextContent('¡Subasta financiada al 100%!');
    expect(signingSection).toHaveTextContent('Pagaré Digital');

    // Action button
    const signBtn = screen.getByTestId('btn-sign-promissory-note');
    expect(signBtn).toBeInTheDocument();
    fireEvent.click(signBtn);
    expect(onSignMock).toHaveBeenCalledWith('loan-test-01');
  });

  it('renders correctly when loan is in "active" status (French amortization table detailing installments, due dates, principal, interest, and status)', () => {
    const loanActive: Loan = {
      ...baseLoan,
      status: 'active',
      amount_requested: 10_000_000,
      amount_funded: 10_000_000,
    };

    render(
      <BorrowerDashboard
        initialLoans={[loanActive]}
        initialInstallments={sampleInstallments}
      />
    );

    // Active status badge
    const badge = screen.getByTestId('borrower-status-badge');
    expect(badge).toHaveTextContent('active');

    // Amortization table
    const table = screen.getByTestId('amortization-table');
    expect(table).toBeInTheDocument();

    // Check rows
    const row1 = screen.getByTestId('amortization-row-1');
    expect(row1).toHaveTextContent('Cuota #1');
    expect(row1).toHaveTextContent('2026-10-30');
    expect(row1).toHaveTextContent('$ 1.666.667');
    expect(screen.getByTestId('installment-badge-1')).toHaveTextContent('paid');

    const row2 = screen.getByTestId('amortization-row-2');
    expect(row2).toHaveTextContent('Cuota #2');
    expect(screen.getByTestId('installment-badge-2')).toHaveTextContent('pending');

    const row3 = screen.getByTestId('amortization-row-3');
    expect(row3).toHaveTextContent('Cuota #3');
    expect(screen.getByTestId('installment-badge-3')).toHaveTextContent('overdue');
  });

  it('displays empty state when borrower has no loan applications', () => {
    render(<BorrowerDashboard initialLoans={[]} />);

    const emptyState = screen.getByTestId('borrower-empty-state');
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent('No poseés solicitudes activas');

    const cta = screen.getByRole('button', { name: /solicitar financiación/i });
    expect(cta).toBeInTheDocument();
  });

  it('loads real seed data via mock service for prof-sme-001', async () => {
    const services = createServices({ store: defaultMockStateStore, useMocks: true });

    render(
      <ServiceProvider services={services}>
        <BorrowerDashboard borrowerId="prof-sme-001" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('borrower-dashboard-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('borrower-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('borrower-status-badge')).toBeInTheDocument();
  });
});
