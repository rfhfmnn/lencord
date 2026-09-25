import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Loan, SmeCreditProfile } from '@/types';
import { LoanDetail } from '@/components/marketplace/LoanDetail';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';

describe('LoanDetail Component (Task 10)', () => {
  const mockLoan: Loan = {
    id: 'loan-test-100',
    borrower_id: 'prof-sme-001',
    amount_requested: 10_000_000,
    amount_funded: 4_000_000,
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

  const mockCreditProfile: SmeCreditProfile = {
    id: 'cred-test-100',
    profile_id: 'prof-sme-001',
    bcra_situation: 1,
    risk_tier: 'Tier A',
    balance_sheet_url: null,
    f931_url: null,
    scoring_notes: 'PyME industrial con 15 años en el mercado. Excelente historial crediticio en BCRA.',
    updated_at: '2026-09-01T10:00:00.000Z',
  };

  it('renders all detailed loan information: category, destination, term, rate, deadline, BCRA score, and tier', () => {
    render(
      <LoanDetail
        loanId={mockLoan.id}
        initialLoan={mockLoan}
        initialCreditProfile={mockCreditProfile}
        referenceDate={new Date('2026-10-01T00:00:00.000Z')}
      />
    );

    // Category
    expect(screen.getByTestId('detail-category-badge')).toHaveTextContent('Capital de trabajo');
    expect(screen.getByTestId('detail-title')).toHaveTextContent('Financiamiento PyME: Capital de trabajo');

    // Destination description
    expect(screen.getByTestId('detail-destination-desc')).toHaveTextContent(
      'PyME industrial con 15 años en el mercado. Excelente historial crediticio en BCRA.'
    );

    // Rate & Term
    expect(screen.getByTestId('detail-rate')).toHaveTextContent('45,0% TNA');
    expect(screen.getByTestId('detail-term')).toHaveTextContent('6 meses');

    // Deadline
    expect(screen.getByTestId('detail-deadline')).toHaveTextContent(/días restantes/i);

    // BCRA Score & Risk Tier
    expect(screen.getByTestId('detail-bcra-score')).toHaveTextContent('Situación 1 - Normal');
    expect(screen.getByTestId('detail-solvency-tier')).toHaveTextContent('Tier A');
    expect(screen.getByTestId('detail-risk-badge')).toHaveTextContent('Tier A');
  });

  it('renders live funding progress bar with amount funded, amount requested, and remaining capacity', () => {
    render(
      <LoanDetail
        loanId={mockLoan.id}
        initialLoan={mockLoan}
        initialCreditProfile={mockCreditProfile}
      />
    );

    expect(screen.getByTestId('detail-amount-funded')).toHaveTextContent('$ 4.000.000');
    expect(screen.getByTestId('detail-amount-requested')).toHaveTextContent('$ 10.000.000');
    expect(screen.getByTestId('detail-percentage')).toHaveTextContent('40% financiado');
    expect(screen.getByTestId('detail-remaining-capacity')).toHaveTextContent('$ 6.000.000');
  });

  it('opens investment modal when clicking "Invertir en esta PyME"', () => {
    render(
      <LoanDetail
        loanId={mockLoan.id}
        initialLoan={mockLoan}
        initialCreditProfile={mockCreditProfile}
      />
    );

    const investBtn = screen.getByTestId('detail-invest-button');
    expect(investBtn).toHaveTextContent('Invertir en esta PyME');

    fireEvent.click(investBtn);

    expect(screen.getByTestId('investment-modal')).toBeInTheDocument();
  });

  it('updates loan progress on the page after a successful investment', async () => {
    const services = createServices({ useMocks: true });
    // Let's create a loan in the service
    const submitted = await services.loans.submitLoanApplication({
      borrower_id: 'prof-sme-001',
      amount_requested: 2_000_000,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      category: 'working_capital',
    });
    const approved = await services.loans.approveAndPublishLoan({
      loan_id: submitted.id,
      risk_tier: 'Tier A',
      investor_rate: 45,
      platform_spread: 2,
      funding_deadline: '2026-11-30T00:00:00.000Z',
    });

    render(
      <ServiceProvider services={services}>
        <LoanDetail
          loanId={approved.id}
          initialLoan={approved}
          initialCreditProfile={mockCreditProfile}
        />
      </ServiceProvider>
    );

    expect(screen.getByTestId('detail-amount-funded')).toHaveTextContent('$ 0');
    expect(screen.getByTestId('detail-remaining-capacity')).toHaveTextContent('$ 2.000.000');

    // Open modal
    fireEvent.click(screen.getByTestId('detail-invest-button'));
    expect(screen.getByTestId('investment-modal')).toBeInTheDocument();

    // Type 500.000
    const input = screen.getByTestId('investment-amount-input');
    fireEvent.change(input, { target: { value: '500000' } });

    fireEvent.click(screen.getByTestId('modal-confirm-button'));

    await waitFor(() => {
      expect(screen.getByTestId('investment-success-view')).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByTestId('close-success-button'));

    // Check page updated
    expect(screen.getByTestId('detail-amount-funded')).toHaveTextContent('$ 500.000');
    expect(screen.getByTestId('detail-remaining-capacity')).toHaveTextContent('$ 1.500.000');
    expect(screen.getByTestId('detail-percentage')).toHaveTextContent('25% financiado');
  });

  it('visually updates status to "Subasta completada" and blocks further bids if 100% funded', () => {
    const fullyFundedLoan: Loan = {
      ...mockLoan,
      amount_funded: 10_000_000,
      status: 'funded',
    };

    render(
      <LoanDetail
        loanId={fullyFundedLoan.id}
        initialLoan={fullyFundedLoan}
        initialCreditProfile={mockCreditProfile}
      />
    );

    expect(screen.getByTestId('detail-status-badge')).toHaveTextContent('Subasta completada');
    const investBtn = screen.getByTestId('detail-invest-button');
    expect(investBtn).toHaveTextContent('Subasta completada');
    expect(investBtn).toBeDisabled();
    expect(screen.getByTestId('detail-percentage')).toHaveTextContent('100% financiado');
    expect(screen.getByTestId('detail-remaining-capacity')).toHaveTextContent('$ 0');
  });

  it('renders error state when loan is not found', async () => {
    const services = createServices({ useMocks: true });
    render(
      <ServiceProvider services={services}>
        <LoanDetail loanId="non-existent-loan-id" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loan-detail-error')).toBeInTheDocument();
    });
    expect(screen.getByText('No se encontró la oportunidad')).toBeInTheDocument();
  });
});
