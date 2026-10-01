import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BorrowerDashboard } from '@/components/dashboard/BorrowerDashboard';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import type { Loan, Installment } from '@/types';

describe('Loan Funding Completion & Disbursement Activation (Issue #68)', () => {
  let services: ReturnType<typeof createServices>;

  const fullyFundedLoan: Loan = {
    id: 'loan-funded-68',
    borrower_id: 'prof-sme-001',
    amount_requested: 3000000,
    amount_funded: 3000000,
    term_months: 3,
    rate_type: 'TNA_FIXED',
    investor_rate: 40,
    platform_spread: 5,
    borrower_rate: 45,
    base_uva_value: null,
    category: 'machinery',
    status: 'active',
    funding_deadline: '2026-11-01T00:00:00.000Z',
    created_at: '2026-10-01T12:00:00.000Z',
  };

  const sampleInstallments: Installment[] = [
    {
      id: 'inst-68-1',
      loan_id: 'loan-funded-68',
      installment_number: 1,
      due_date: '2026-10-31',
      principal_amount: 960000,
      interest_borrower: 112500,
      interest_investors: 100000,
      interest_lencord: 12500,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
    {
      id: 'inst-68-2',
      loan_id: 'loan-funded-68',
      installment_number: 2,
      due_date: '2026-11-30',
      principal_amount: 996000,
      interest_borrower: 76500,
      interest_investors: 68000,
      interest_lencord: 8500,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
    {
      id: 'inst-68-3',
      loan_id: 'loan-funded-68',
      installment_number: 3,
      due_date: '2026-12-31',
      principal_amount: 1044000,
      interest_borrower: 39150,
      interest_investors: 34800,
      interest_lencord: 4350,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
  ];

  beforeEach(() => {
    services = createServices({ useMocks: true });
    vi.clearAllMocks();
  });

  it('renders celebration disbursement banner on BorrowerDashboard when loan is active', () => {
    render(
      <ServiceProvider services={services}>
        <BorrowerDashboard
          borrowerId="prof-sme-001"
          initialLoans={[fullyFundedLoan]}
          initialInstallments={sampleInstallments}
        />
      </ServiceProvider>
    );

    // 1. Celebration banner
    const banner = screen.getByTestId('disbursement-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/¡Felicitaciones! Tu solicitud fue 100% financiada/i);
    expect(banner).toHaveTextContent(/Los fondos por \$ 3\.000\.000 han sido transferidos a tu cuenta CBU registrada/i);

    // 2. Next due notice
    const nextDue = screen.getByTestId('next-due-date-notice');
    expect(nextDue).toBeInTheDocument();
    expect(nextDue).toHaveTextContent('Próximo vencimiento: Cuota #1 el 2026-10-31 ($ 1.072.500)');
  });

  it('generates French amortization installment schedule upon loan activation', async () => {
    // Submit and approve loan
    const loan = await services.loans.submitLoanApplication({
      borrower_id: 'prof-sme-001',
      amount_requested: 1200000,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      category: 'expansion',
    });

    const approved = await services.loans.approveAndPublishLoan({
      loan_id: loan.id,
      risk_tier: 'Tier A',
      investor_rate: 42,
      platform_spread: 8,
      funding_deadline: '2026-12-31T00:00:00.000Z',
    });

    // Commit 100%
    await services.investments.commitInvestment({
      loan_id: approved.id,
      investor_id: 'usr-investor-001',
      amount: 1200000,
    });

    // Activate loan
    const activated = await services.loans.activateLoan!(approved.id);
    expect(activated.status).toBe('active');

    // Retrieve generated installments
    const installments = await services.loans.getInstallmentsByLoan(approved.id);
    expect(installments).toHaveLength(6);
    expect(installments[0].installment_number).toBe(1);
    expect(installments[0].status).toBe('pending');
    expect(installments[0].principal_amount).toBeGreaterThan(0);
    expect(installments[0].interest_borrower).toBeGreaterThan(0);

    // Verify constant monthly French payments (approx principal + interest)
    const payment1 = installments[0].principal_amount + installments[0].interest_borrower;
    const payment6 = installments[5].principal_amount + installments[5].interest_borrower;
    expect(Math.abs(payment1 - payment6)).toBeLessThanOrEqual(5); // rounding tolerance
  });

  it('emits notification to participating investors when auction is fully funded', async () => {
    const loan = await services.loans.submitLoanApplication({
      borrower_id: 'prof-sme-001',
      amount_requested: 500000,
      term_months: 3,
      rate_type: 'TNA_FIXED',
      category: 'working_capital',
    });

    await services.loans.approveAndPublishLoan({
      loan_id: loan.id,
      risk_tier: 'Tier A',
      investor_rate: 40,
      platform_spread: 5,
      funding_deadline: '2026-12-31T00:00:00.000Z',
    });

    const commitResult = await services.investments.commitInvestment({
      loan_id: loan.id,
      investor_id: 'usr-investor-002',
      amount: 500000,
    });

    expect(commitResult.is_fully_funded).toBe(true);

    // Verify investor notification
    const notifications = await services.notifications!.getNotifications('usr-investor-002');
    const completionNotif = notifications.find(
      (n) => n.title.includes('Subasta') || n.message.includes('completó exitosamente')
    );
    expect(completionNotif).toBeDefined();
    expect(completionNotif?.read).toBe(false);
  });
});
