import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Loan, PaymentGatewayInterface } from '@/types';
import { createServices } from '@/services/factory';
import { MockStateStore } from '@/services/mock/mockState';
import { MockInvestmentService } from '@/services/mock/MockInvestmentService';
import { BaaSPaymentGateway } from '@/services/payments/BaaSPaymentGateway';

describe('Atomic Marketplace Investment Ticket and Escrow Fund Hold (Issue #41)', () => {
  let store: MockStateStore;

  const mockLoan: Loan = {
    id: 'loan-atomic-001',
    borrower_id: 'prof-sme-999',
    amount_requested: 1_000_000,
    amount_funded: 600_000, // Remaining capacity: $ 400.000
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 45.0,
    platform_spread: 2.5,
    borrower_rate: 47.5,
    base_uva_value: null,
    category: 'working_capital',
    status: 'funding',
    funding_deadline: '2026-11-30T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  beforeEach(() => {
    store = new MockStateStore();
    store.loans.push({ ...mockLoan });
  });

  it('rejects investment amounts below minimum ticket threshold ($10.000)', async () => {
    const investmentService = new MockInvestmentService(store);

    await expect(
      investmentService.commitInvestment({
        loan_id: 'loan-atomic-001',
        investor_id: 'prof-inv-001',
        amount: 0,
      })
    ).rejects.toThrow('Investment amount must be greater than zero');
  });

  it('prevents borrower from committing investments into their own loan listing (self-funding prevention)', async () => {
    const mockGateway: PaymentGatewayInterface = {
      holdFunds: vi.fn(),
      releaseFunds: vi.fn(),
      disburseLoan: vi.fn(),
      collectInstallment: vi.fn(),
    };
    const investmentService = new MockInvestmentService(store, mockGateway);

    await expect(
      investmentService.commitInvestment({
        loan_id: 'loan-atomic-001',
        investor_id: 'prof-sme-999', // same as borrower_id
        amount: 50_000,
      })
    ).rejects.toThrow(/Self-funding rejected/i);

    // Verifies no escrow hold was placed on self-funding attempt
    expect(mockGateway.holdFunds).not.toHaveBeenCalled();
  });

  it('rejects investment attempts exceeding remaining capacity without holding funds', async () => {
    const mockGateway: PaymentGatewayInterface = {
      holdFunds: vi.fn(),
      releaseFunds: vi.fn(),
      disburseLoan: vi.fn(),
      collectInstallment: vi.fn(),
    };
    const investmentService = new MockInvestmentService(store, mockGateway);

    // Remaining capacity is $ 400.000, attempting $ 400.001
    await expect(
      investmentService.commitInvestment({
        loan_id: 'loan-atomic-001',
        investor_id: 'prof-inv-001',
        amount: 400_001,
      })
    ).rejects.toThrow(/Overfunding rejected/i);

    // Verifies no funds were held when overfunding occurs
    expect(mockGateway.holdFunds).not.toHaveBeenCalled();
  });

  it('invokes BaaSPaymentGateway.holdFunds to place escrow hold and commits investment atomically', async () => {
    const baasGateway = new BaaSPaymentGateway({ sandbox: true });
    const investmentService = new MockInvestmentService(store, baasGateway);

    const result = await investmentService.commitInvestment({
      loan_id: 'loan-atomic-001',
      investor_id: 'prof-inv-001',
      amount: 150_000,
    });

    expect(result.amount_funded).toBe(750_000);
    expect(result.is_fully_funded).toBe(false);
    expect(result.investment.status).toBe('committed');
    expect(result.investment.external_payment_id).toMatch(/^hold_/);

    // Verify hold was registered in BaaSPaymentGateway
    const simulatedHolds = baasGateway.getSimulatedHolds();
    expect(simulatedHolds).toHaveLength(1);
    expect(simulatedHolds[0].amount).toBe(150_000);
    expect(simulatedHolds[0].status).toBe('held');
    expect(simulatedHolds[0].investorId).toBe('prof-inv-001');
  });

  it('automatically transitions loan status to "funded" when investment completes 100% capacity', async () => {
    const baasGateway = new BaaSPaymentGateway({ sandbox: true });
    const investmentService = new MockInvestmentService(store, baasGateway);

    // Exactly fill remaining $ 400.000
    const result = await investmentService.commitInvestment({
      loan_id: 'loan-atomic-001',
      investor_id: 'prof-inv-002',
      amount: 400_000,
    });

    expect(result.amount_funded).toBe(1_000_000);
    expect(result.is_fully_funded).toBe(true);
    expect(result.loan.status).toBe('funded');

    // Ensure state store also reflects funded status
    const storedLoan = store.loans.find((l) => l.id === 'loan-atomic-001');
    expect(storedLoan?.status).toBe('funded');
    expect(storedLoan?.amount_funded).toBe(1_000_000);

    // Attempting any further investment is now rejected
    await expect(
      investmentService.commitInvestment({
        loan_id: 'loan-atomic-001',
        investor_id: 'prof-inv-003',
        amount: 10_000,
      })
    ).rejects.toThrow(/Loan is not open for funding/i);
  });
});
