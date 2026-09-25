/**
 * In-memory Mock Investment Service.
 * Conforms to InvestmentServiceInterface in _docs/plan.md Section 7 and @/types.
 * Handles atomic auction commitments, overfunding validation, and automatic transition to funded.
 */

import type {
  CommitInvestmentInput,
  CommitInvestmentResult,
  Investment,
  InvestmentServiceInterface,
  PaymentGatewayInterface,
  RefundInvestmentsResult,
} from '@/types';
import { defaultMockPaymentGateway } from './MockPaymentGateway';
import { defaultMockStateStore, MockStateStore } from './mockState';

export class MockInvestmentService implements InvestmentServiceInterface {
  private store: MockStateStore;
  private paymentGateway?: PaymentGatewayInterface;

  constructor(
    store: MockStateStore = defaultMockStateStore,
    paymentGateway: PaymentGatewayInterface = defaultMockPaymentGateway
  ) {
    this.store = store;
    this.paymentGateway = paymentGateway;
  }

  public async commitInvestment(
    input: CommitInvestmentInput
  ): Promise<CommitInvestmentResult> {
    if (input.amount <= 0) {
      throw new Error('Investment amount must be greater than zero');
    }

    const loan = this.store.loans.find((l) => l.id === input.loan_id);
    if (!loan) {
      throw new Error(`Loan not found: ${input.loan_id}`);
    }

    if (loan.status !== 'funding') {
      throw new Error(
        `Loan is not open for funding. Current status: ${loan.status}`
      );
    }

    const currentFunded = loan.amount_funded;
    const remainingAvailable = loan.amount_requested - currentFunded;

    // Overfunding validation: amount_funded + amount <= amount_requested
    if (currentFunded + input.amount > loan.amount_requested) {
      throw new Error(
        `Overfunding rejected: Investment amount ($${input.amount}) exceeds remaining loan capacity ($${remainingAvailable}). Maximum acceptable investment is $${remainingAvailable}.`
      );
    }

    // BaaS / Payment Gateway hold funds
    let holdId: string | null = null;
    if (this.paymentGateway) {
      const holdResult = await this.paymentGateway.holdFunds(
        input.investor_id,
        input.amount,
        loan.id
      );
      if (!holdResult.success) {
        throw new Error('Payment gateway failed to hold funds for investment');
      }
      holdId = holdResult.holdId;
    }

    // Atomic update in-memory
    const newFundedAmount = Number(
      (currentFunded + input.amount).toFixed(2)
    );
    loan.amount_funded = newFundedAmount;

    // Automatically transition to funded when 100% capacity is reached
    if (loan.amount_funded === loan.amount_requested) {
      loan.status = 'funded';
    }

    const investment: Investment = {
      id: `inv-${Math.random().toString(36).substring(2, 9)}`,
      loan_id: input.loan_id,
      investor_id: input.investor_id,
      amount: input.amount,
      status: 'committed',
      external_payment_id:
        holdId ?? `hold_${Math.random().toString(36).substring(2, 9)}`,
      created_at: new Date().toISOString(),
    };

    this.store.investments.push(investment);

    return {
      investment: JSON.parse(JSON.stringify(investment)),
      loan: JSON.parse(JSON.stringify(loan)),
      amount_funded: loan.amount_funded,
      is_fully_funded: loan.status === 'funded',
    };
  }

  public async getInvestmentsByLoan(loanId: string): Promise<Investment[]> {
    const investments = this.store.investments.filter(
      (inv) => inv.loan_id === loanId
    );
    return JSON.parse(JSON.stringify(investments));
  }

  public async getInvestmentsByInvestor(
    investorId: string
  ): Promise<Investment[]> {
    const investments = this.store.investments.filter(
      (inv) => inv.investor_id === investorId
    );
    return JSON.parse(JSON.stringify(investments));
  }

  public async getInvestmentById(id: string): Promise<Investment | null> {
    const investment = this.store.investments.find((inv) => inv.id === id);
    if (!investment) return null;
    return JSON.parse(JSON.stringify(investment));
  }

  public async refundInvestmentsByLoan(
    loanId: string
  ): Promise<RefundInvestmentsResult> {
    const targetInvestments = this.store.investments.filter(
      (inv) => inv.loan_id === loanId && inv.status === 'committed'
    );

    let refundedCount = 0;
    let totalRefundedAmount = 0;

    for (const inv of targetInvestments) {
      inv.status = 'refunded';
      refundedCount += 1;
      totalRefundedAmount += inv.amount;

      if (this.paymentGateway && inv.external_payment_id) {
        await this.paymentGateway.releaseFunds(inv.external_payment_id);
      }
    }

    return {
      refunded_count: refundedCount,
      total_refunded_amount: totalRefundedAmount,
    };
  }
}

export const defaultMockInvestmentService = new MockInvestmentService();
