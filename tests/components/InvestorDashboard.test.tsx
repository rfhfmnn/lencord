import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Installment, Investment, Loan, SmeCreditProfile } from '@/types';
import { InvestorDashboard } from '@/components/dashboard/InvestorDashboard';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { defaultMockStateStore } from '@/services/mock/mockState';

describe('InvestorDashboard Component (Task 13)', () => {
  const mockLoans: Loan[] = [
    {
      id: 'loan-1',
      borrower_id: 'sme-1',
      amount_requested: 10_000_000,
      amount_funded: 10_000_000,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 50.0,
      platform_spread: 2.0,
      borrower_rate: 52.0,
      base_uva_value: null,
      category: 'working_capital',
      status: 'funded',
      funding_deadline: '2026-10-30T23:59:59.000Z',
      created_at: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'loan-2',
      borrower_id: 'sme-2',
      amount_requested: 20_000_000,
      amount_funded: 15_000_000,
      term_months: 12,
      rate_type: 'CER_VARIABLE',
      investor_rate: 15.0,
      platform_spread: 2.5,
      borrower_rate: 17.5,
      base_uva_value: 1200,
      category: 'machinery',
      status: 'funding',
      funding_deadline: '2026-10-25T23:59:59.000Z',
      created_at: '2026-09-02T10:00:00.000Z',
    },
  ];

  const mockCreditProfiles: Record<string, SmeCreditProfile> = {
    'sme-1': {
      id: 'cp-1',
      profile_id: 'sme-1',
      bcra_situation: 1,
      risk_tier: 'Tier A',
      balance_sheet_url: null,
      f931_url: null,
      scoring_notes: null,
      updated_at: '2026-09-01T10:00:00.000Z',
    },
    'sme-2': {
      id: 'cp-2',
      profile_id: 'sme-2',
      bcra_situation: 2,
      risk_tier: 'Tier B',
      balance_sheet_url: null,
      f931_url: null,
      scoring_notes: null,
      updated_at: '2026-09-02T10:00:00.000Z',
    },
  };

  const mockInvestments: Investment[] = [
    {
      id: 'inv-1',
      loan_id: 'loan-1',
      investor_id: 'prof-inv-001',
      amount: 4_000_000,
      status: 'committed',
      external_payment_id: 'ext-1',
      created_at: '2026-09-05T10:00:00.000Z',
    },
    {
      id: 'inv-2',
      loan_id: 'loan-2',
      investor_id: 'prof-inv-001',
      amount: 6_000_000,
      status: 'settled',
      external_payment_id: 'ext-2',
      created_at: '2026-09-06T11:00:00.000Z',
    },
  ];

  const mockInstallments: Installment[] = [
    {
      id: 'inst-1',
      loan_id: 'loan-1',
      installment_number: 1,
      due_date: '2026-10-15',
      principal_amount: 1_666_666.67,
      interest_borrower: 433_333.33,
      interest_investors: 416_666.67,
      interest_lencord: 16_666.66,
      uva_value_applied: null,
      status: 'paid',
      paid_at: '2026-10-14T10:00:00.000Z',
    },
    {
      id: 'inst-2',
      loan_id: 'loan-1',
      installment_number: 2,
      due_date: '2026-11-15',
      principal_amount: 1_666_666.67,
      interest_borrower: 433_333.33,
      interest_investors: 416_666.67,
      interest_lencord: 16_666.66,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    },
    {
      id: 'inst-3',
      loan_id: 'loan-1',
      installment_number: 3,
      due_date: '2026-09-15',
      principal_amount: 1_666_666.67,
      interest_borrower: 433_333.33,
      interest_investors: 416_666.67,
      interest_lencord: 16_666.66,
      uva_value_applied: null,
      status: 'overdue',
      paid_at: null,
    },
  ];

  it('renders summary metric cards with correct calculations', () => {
    render(
      <InvestorDashboard
        initialInvestments={mockInvestments}
        initialLoans={mockLoans}
        initialCreditProfiles={mockCreditProfiles}
        initialInstallments={mockInstallments}
      />
    );

    // Total Capital Invertido: 4.000.000 + 6.000.000 = 10.000.000
    const totalCapital = screen.getByTestId('metric-total-capital');
    expect(totalCapital).toHaveTextContent('$ 10.000.000');

    // Active Investments: 2
    const activeCount = screen.getByTestId('metric-active-investments');
    expect(activeCount).toHaveTextContent('2');

    // Estimated Returns:
    // inv-1: 4.000.000 * 50% * (6/12) = 1.000.000
    // inv-2: 6.000.000 * 15% * (12/12) = 900.000
    // Total = 1.900.000
    const estimatedReturns = screen.getByTestId('metric-estimated-returns');
    expect(estimatedReturns).toHaveTextContent('$ 1.900.000');
  });

  it('renders portfolio breakdown indicators across risk tiers', () => {
    render(
      <InvestorDashboard
        initialInvestments={mockInvestments}
        initialLoans={mockLoans}
        initialCreditProfiles={mockCreditProfiles}
        initialInstallments={mockInstallments}
      />
    );

    // Tier A: 4.000.000 of 10.000.000 = 40.0%
    const tierA = screen.getByTestId('tier-a-stat');
    expect(tierA).toHaveTextContent('$ 4.000.000');
    expect(tierA).toHaveTextContent('40.0%');

    // Tier B: 6.000.000 of 10.000.000 = 60.0%
    const tierB = screen.getByTestId('tier-b-stat');
    expect(tierB).toHaveTextContent('$ 6.000.000');
    expect(tierB).toHaveTextContent('60.0%');

    // Tier C: 0.0%
    const tierC = screen.getByTestId('tier-c-stat');
    expect(tierC).toHaveTextContent('0.0%');
  });

  it('renders active investments table with category, ticket, rate, and status badges', () => {
    render(
      <InvestorDashboard
        initialInvestments={mockInvestments}
        initialLoans={mockLoans}
        initialCreditProfiles={mockCreditProfiles}
        initialInstallments={mockInstallments}
      />
    );

    const table = screen.getByTestId('active-investments-table');
    expect(table).toBeInTheDocument();

    // Row 1: working capital, 4.000.000, 50,0% TNA, committed
    const row1 = screen.getByTestId('investment-row-inv-1');
    expect(row1).toHaveTextContent('Capital de trabajo');
    expect(row1).toHaveTextContent('$ 4.000.000');
    expect(row1).toHaveTextContent('50,0% TNA');
    expect(screen.getByTestId('investment-status-inv-1')).toHaveTextContent('committed');

    // Row 2: machinery, 6.000.000, CER + 15,0%, settled
    const row2 = screen.getByTestId('investment-row-inv-2');
    expect(row2).toHaveTextContent('Maquinaria y equipamiento');
    expect(row2).toHaveTextContent('$ 6.000.000');
    expect(row2).toHaveTextContent('CER + 15,0%');
    expect(screen.getByTestId('investment-status-inv-2')).toHaveTextContent('settled');
  });

  it('renders payment schedule table with installment statuses (paid, pending, overdue)', () => {
    render(
      <InvestorDashboard
        initialInvestments={mockInvestments}
        initialLoans={mockLoans}
        initialCreditProfiles={mockCreditProfiles}
        initialInstallments={mockInstallments}
      />
    );

    const scheduleTable = screen.getByTestId('payment-schedule-table');
    expect(scheduleTable).toBeInTheDocument();

    expect(screen.getByTestId('installment-status-inst-1')).toHaveTextContent('paid');
    expect(screen.getByTestId('installment-status-inst-2')).toHaveTextContent('pending');
    expect(screen.getByTestId('installment-status-inst-3')).toHaveTextContent('overdue');
  });

  it('displays empty state with link to marketplace when investor has no active investments', () => {
    render(
      <InvestorDashboard
        initialInvestments={[]}
        initialLoans={[]}
        initialCreditProfiles={{}}
        initialInstallments={[]}
      />
    );

    const emptyState = screen.getByTestId('investor-empty-state');
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent('No poseés inversiones activas');

    const ctaButton = screen.getByRole('button', { name: /explorar marketplace/i });
    expect(ctaButton).toBeInTheDocument();
  });

  it('loads real seed data through mock services when no initial props provided', async () => {
    const services = createServices({ store: defaultMockStateStore, useMocks: true });

    render(
      <ServiceProvider services={services}>
        <InvestorDashboard investorId="prof-inv-001" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('investor-dashboard-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('investor-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('metric-total-capital')).toBeInTheDocument();
    expect(screen.getByTestId('active-investments-table')).toBeInTheDocument();
  });
});
