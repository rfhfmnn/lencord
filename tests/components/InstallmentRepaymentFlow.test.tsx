import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BorrowerDashboard } from '@/components/dashboard/BorrowerDashboard';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import type { Loan, Installment } from '@/types';
import { MockStateStore } from '@/services/mock';

describe('Installment Repayment Flow and Pro-Rata Distribution (Issue #69)', () => {
  let services: ReturnType<typeof createServices>;

  const activeLoan: Loan = {
    id: 'loan-repay-69',
    borrower_id: 'prof-sme-001',
    amount_requested: 2000000,
    amount_funded: 2000000,
    term_months: 2,
    rate_type: 'TNA_FIXED',
    investor_rate: 40,
    platform_spread: 5,
    borrower_rate: 45,
    base_uva_value: null,
    category: 'working_capital',
    status: 'active',
    funding_deadline: '2026-11-01T00:00:00.000Z',
    created_at: '2026-10-01T12:00:00.000Z',
  };

  const installments: Installment[] = [
    {
      id: 'inst-69-1',
      loan_id: 'loan-repay-69',
      installment_number: 1,
      due_date: '2026-10-31',
      principal_amount: 980000,
      interest_borrower: 75000,
      interest_investors: 66667,
      interest_lencord: 8333,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
    {
      id: 'inst-69-2',
      loan_id: 'loan-repay-69',
      installment_number: 2,
      due_date: '2026-11-30',
      principal_amount: 1020000,
      interest_borrower: 38250,
      interest_investors: 34000,
      interest_lencord: 4250,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
  ];

  let currentLoan: Loan;
  let currentInstallments: Installment[];

  beforeEach(() => {
    const customStore = new MockStateStore();
    services = createServices({ useMocks: true, store: customStore } as any);
    currentLoan = JSON.parse(JSON.stringify(activeLoan));
    currentInstallments = JSON.parse(JSON.stringify(installments));

    // Seed loan, installments and an investment in mock store
    customStore.loans.push(currentLoan);
    customStore.installments.push(...currentInstallments);
    customStore.investments.push({
      id: 'inv-seed-69',
      loan_id: 'loan-repay-69',
      investor_id: 'usr-investor-001',
      amount: 2000000,
      status: 'committed',
      external_payment_id: 'ext-seed-69',
      created_at: new Date().toISOString(),
    });
    vi.clearAllMocks();
  });

  it('enforces sequential order: next pending installment is payable while subsequent ones are disabled', () => {
    render(
      <ServiceProvider services={services}>
        <BorrowerDashboard
          borrowerId="prof-sme-001"
          initialLoans={[currentLoan]}
          initialInstallments={currentInstallments}
        />
      </ServiceProvider>
    );

    // Installment 1 is active for payment
    const openModalBtn1 = screen.getByTestId('btn-open-repayment-modal-1');
    expect(openModalBtn1).toBeInTheDocument();
    expect(openModalBtn1).not.toBeDisabled();

    // Installment 2 is locked waiting for installment 1
    const disabledBtn2 = screen.getByTestId('btn-pay-installment-disabled-2');
    expect(disabledBtn2).toBeInTheDocument();
    expect(disabledBtn2).toBeDisabled();
    expect(disabledBtn2).toHaveTextContent(/Esperando cuota anterior/i);
  });

  it('opens repayment modal with financial breakdown and allows confirming payment with card', async () => {
    render(
      <ServiceProvider services={services}>
        <BorrowerDashboard
          borrowerId="prof-sme-001"
          initialLoans={[currentLoan]}
          initialInstallments={currentInstallments}
        />
      </ServiceProvider>
    );

    // Open repayment modal for installment 1
    fireEvent.click(screen.getByTestId('btn-open-repayment-modal-1'));

    // Check modal breakdown
    const modal = screen.getByTestId('repayment-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('repayment-breakdown')).toHaveTextContent('$ 980.000');
    expect(screen.getByTestId('repayment-breakdown')).toHaveTextContent('$ 75.000');
    expect(screen.getByTestId('repayment-breakdown')).toHaveTextContent('$ 1.055.000');

    // Quick sandbox fill
    fireEvent.click(screen.getByTestId('btn-quick-fill-card'));
    expect(screen.getByTestId('input-repayment-card')).toHaveValue('4532 1122 3344 9010');

    // Confirm repayment
    fireEvent.click(screen.getByTestId('btn-confirm-repayment'));

    // Modal closes and installment updates to paid with comprobante badge
    await waitFor(() => {
      expect(screen.queryByTestId('repayment-modal')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('comprobante-badge-1')).toBeInTheDocument();
    expect(screen.getByTestId('comprobante-badge-1')).toHaveTextContent(/Comprobante PAG-/i);

    // Now installment 2 unlocks!
    expect(screen.getByTestId('btn-open-repayment-modal-2')).not.toBeDisabled();
  });

  it('executes atomic repayment, pro-rates to multiple investors and transitions loan to repaid on final installment', async () => {
    // Setup 2 investors for the loan in store (75% and 25%)
    const store = (services.loans as any).store;
    store.investments = store.investments.filter((inv: any) => inv.loan_id !== 'loan-repay-69');
    store.investments.push(
      {
        id: 'inv-test-69-1',
        loan_id: 'loan-repay-69',
        investor_id: 'usr-investor-001',
        amount: 1500000, // 75%
        status: 'committed',
        created_at: new Date().toISOString(),
      },
      {
        id: 'inv-test-69-2',
        loan_id: 'loan-repay-69',
        investor_id: 'usr-investor-002',
        amount: 500000, // 25%
        status: 'committed',
        external_payment_id: 'ext-seed-70',
        created_at: new Date().toISOString(),
      }
    );

    // 1. Repay installment 1
    const repay1 = await services.loans.repayInstallment!({
      installment_id: 'inst-69-1',
      payer_id: 'prof-sme-001',
    });
    expect(repay1.success).toBe(true);
    expect(repay1.status).toBe('paid');
    expect(repay1.all_repaid).toBe(false);

    // Verify payouts generated in store
    const payouts1 = store.installmentPayouts.filter((p: any) => p.installment_id === 'inst-69-1');
    expect(payouts1).toHaveLength(2);

    // 75% investor payout
    const inv1Payout = payouts1.find((p: any) => p.investor_id === 'usr-investor-001');
    expect(inv1Payout.principal_share).toBeCloseTo(735000, 0); // 75% of 980000

    // 25% investor payout
    const inv2Payout = payouts1.find((p: any) => p.investor_id === 'usr-investor-002');
    expect(inv2Payout.principal_share).toBeCloseTo(245000, 0); // 25% of 980000

    // Verify investor custody credit
    const custodyTxs = store.custodyTransactions.filter((t: any) => t.reference_id === 'inst-69-1');
    expect(custodyTxs).toHaveLength(2);
    expect(custodyTxs[0].type).toBe('installment_payout');

    // Verify investor notifications
    const notifs = await services.notifications!.getNotifications('usr-investor-001');
    const payoutNotif = notifs.find((n) => n.title.includes('Cobro acreditado'));
    expect(payoutNotif).toBeDefined();

    // 2. Repay final installment 2 -> should set all_repaid = true and loan status = 'repaid'
    const repay2 = await services.loans.repayInstallment!({
      installment_id: 'inst-69-2',
      payer_id: 'prof-sme-001',
    });
    expect(repay2.success).toBe(true);
    expect(repay2.all_repaid).toBe(true);

    const updatedLoan = await services.loans.getLoanById('loan-repay-69');
    expect(updatedLoan?.status).toBe('repaid');
  });
});
