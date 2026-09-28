/**
 * In-memory Mock Investment Service.
 * Conforms to InvestmentServiceInterface in _docs/plan.md Section 7 and @/types.
 * Handles atomic auction commitments, overfunding validation, and automatic transition to funded.
 */

import type {
  CommitInvestmentInput,
  CommitInvestmentResult,
  EmailServiceInterface,
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
  private emailService?: EmailServiceInterface;

  constructor(
    store: MockStateStore = defaultMockStateStore,
    paymentGateway: PaymentGatewayInterface = defaultMockPaymentGateway,
    emailService?: EmailServiceInterface
  ) {
    this.store = store;
    this.paymentGateway = paymentGateway;
    this.emailService = emailService;
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

    if (loan.borrower_id === input.investor_id) {
      throw new Error(
        'Self-funding rejected: The borrower cannot invest in their own loan listing'
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

    // Emit in-app notification for investor
    this.store.notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: input.investor_id,
      title: 'Inversión confirmada',
      message: `Has comprometido $${input.amount.toLocaleString('es-AR')} en la subasta del préstamo ${loan.id}.`,
      type: 'success',
      read: false,
      action_url: '/dashboard/inversor',
      created_at: new Date().toISOString(),
    });

    // Trigger transactional email for investment confirmation (graceful error handling)
    if (this.emailService) {
      try {
        const investor = this.store.profiles.find((p) => p.id === input.investor_id);
        const investorEmail = (investor as any)?.email || 'inversor@lencord.com.ar';
        const recipientName = investor?.legal_name || 'Inversor';
        this.emailService
          .sendInvestmentConfirmationEmail({
            to: investorEmail,
            recipientName,
            loanId: loan.id,
            amount: input.amount,
            rate: loan.investor_rate || 45.0,
          })
          .catch((err) => {
            console.warn('[MockInvestmentService] Failed to send investment email:', err?.message || err);
          });
      } catch (err: any) {
        console.warn('[MockInvestmentService] Exception in investment email trigger:', err?.message || err);
      }
    }

    // If fully funded, emit notification for borrower
    if (loan.status === 'funded') {
      this.store.notifications.unshift({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: loan.borrower_id,
        title: 'Subasta completada al 100%',
        message: '¡Tu proyecto alcanzó el fondeo total! Firma el Pagaré Digital para proceder con el desembolso.',
        type: 'warning',
        read: false,
        action_url: '/dashboard/pyme',
        created_at: new Date().toISOString(),
      });
    }

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
