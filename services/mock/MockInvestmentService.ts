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
import type { MultiChannelNotificationServiceInterface } from '../notifications/channels';

export class MockInvestmentService implements InvestmentServiceInterface {
  private store: MockStateStore;
  private paymentGateway?: PaymentGatewayInterface;
  private emailService?: EmailServiceInterface;
  private multiChannelNotifications?: MultiChannelNotificationServiceInterface;

  constructor(
    store: MockStateStore = defaultMockStateStore,
    paymentGateway: PaymentGatewayInterface = defaultMockPaymentGateway,
    emailService?: EmailServiceInterface,
    multiChannelNotifications?: MultiChannelNotificationServiceInterface
  ) {
    this.store = store;
    this.paymentGateway = paymentGateway;
    this.emailService = emailService;
    this.multiChannelNotifications = multiChannelNotifications;
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

    const investor = this.store.profiles.find((p) => p.id === input.investor_id);
    if (investor && !investor.tax_id) {
      throw new Error(
        'MISSING_TAX_ID: Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil.'
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

    // Automatically transition to active and trigger disbursement cycle when 100% capacity is reached (Issue #68)
    const isFullyFunded = loan.amount_funded >= loan.amount_requested;
    if (isFullyFunded) {
      loan.status = 'funded';

      // 1. Generate monthly French amortization installments if not yet generated
      const existingInstallments = this.store.installments.filter((i) => i.loan_id === loan.id);
      if (existingInstallments.length === 0) {
        const term = loan.term_months || 1;
        const annualRate = loan.borrower_rate || 45;
        const monthlyRate = annualRate > 0 ? annualRate / 100 / 12 : 0.04;
        let installmentAmount = 0;
        if (term === 1) {
          installmentAmount = loan.amount_requested * (1 + monthlyRate);
        } else {
          const factor = Math.pow(1 + monthlyRate, term);
          installmentAmount = (loan.amount_requested * (monthlyRate * factor)) / (factor - 1);
        }

        let remainingPrincipal = loan.amount_requested;
        const activationDate = new Date();
        const investorRatio = loan.borrower_rate > 0 ? loan.investor_rate / loan.borrower_rate : 0.9;

        for (let i = 1; i <= term; i++) {
          const interestTotal = remainingPrincipal * monthlyRate;
          const principal = installmentAmount - interestTotal;
          remainingPrincipal = Math.max(0, remainingPrincipal - principal);
          const dueDate = new Date(activationDate.getTime() + i * 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          const interestInvestors = Number((interestTotal * investorRatio).toFixed(2));
          const interestLencord = Number((interestTotal - interestInvestors).toFixed(2));

          this.store.installments.push({
            id: `inst-${Math.random().toString(36).substring(2, 9)}`,
            loan_id: loan.id,
            installment_number: i,
            due_date: dueDate,
            principal_amount: Number(principal.toFixed(2)),
            interest_borrower: Number(interestTotal.toFixed(2)),
            interest_investors: interestInvestors,
            interest_lencord: interestLencord,
            uva_value_applied: loan.base_uva_value,
            status: 'pending',
            paid_at: null,
          });
        }
      }

      // 2. Resolve borrower info for notifications
      const borrowerProfile = this.store.profiles.find((p) => p.id === loan.borrower_id);
      const borrowerName = (borrowerProfile as any)?.pyme_company_name || borrowerProfile?.legal_name || 'la PyME';
      const borrowerCbu = borrowerProfile?.bank_cbu_cvu || '0000003100010000000001';
      const cbuLast4 = borrowerCbu.slice(-4);

      // 3. Emit celebration notification to borrower
      this.store.notifications.unshift({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: loan.borrower_id,
        title: '¡Subasta financiada al 100%!',
        message: `¡Felicitaciones! Tu solicitud fue 100% financiada. Los fondos por $${loan.amount_requested.toLocaleString('es-AR')} han sido transferidos a tu cuenta CBU registrada (terminada en ${cbuLast4}).`,
        type: 'success',
        read: false,
        action_url: '/dashboard/pyme',
        created_at: new Date().toISOString(),
      });

      // 4. Emit notification to all participating investors
      const allLoanInvestments = this.store.investments.filter((inv) => inv.loan_id === loan.id);
      const uniqueInvestorIds = Array.from(new Set([...allLoanInvestments.map((inv) => inv.investor_id), input.investor_id]));

      for (const invId of uniqueInvestorIds) {
        this.store.notifications.unshift({
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: invId,
          title: 'Subasta completada',
          message: `La subasta de ${borrowerName} se completó exitosamente. Tu inversión ya está activa y devengando rendimientos.`,
          type: 'success',
          read: false,
          action_url: '/dashboard/inversor',
          created_at: new Date().toISOString(),
        });
      }
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

      // Dispatch high-priority loan funding alert via WhatsApp / SMS
      if (this.multiChannelNotifications) {
        try {
          const borrower = this.store.profiles.find((p) => p.id === loan.borrower_id);
          const borrowerPhone = borrower?.phone || '+541140000000';
          const borrowerName = borrower?.legal_name || 'PyME Prestataria';
          this.multiChannelNotifications
            .sendLoanFundingCompletedAlert(
              {
                to: borrowerPhone,
                recipientName: borrowerName,
                loanId: loan.id,
                amount: loan.amount_funded,
              },
              borrower
            )
            .catch((err) => {
              console.warn(
                '[MockInvestmentService] Multi-channel loan funding alert error:',
                err?.message || err
              );
            });
        } catch (err: any) {
          console.warn(
            '[MockInvestmentService] Exception triggering multi-channel funding alert:',
            err?.message || err
          );
        }
      }
    }

    return {
      investment: JSON.parse(JSON.stringify(investment)),
      loan: JSON.parse(JSON.stringify(loan)),
      amount_funded: loan.amount_funded,
      is_fully_funded: (loan.status as string) === 'funded' || (loan.status as string) === 'active',
    };
  }

  public async getCustodyBalance(investorId: string): Promise<number> {
    const txs = this.store.custodyTransactions.filter((t) => t.profile_id === investorId);
    if (txs.length > 0) {
      return txs[txs.length - 1].balance_after;
    }
    const prof = this.store.profiles.find((p) => p.id === investorId);
    return prof?.custody_balance ?? 0;
  }

  public async getCustodyTransactions(investorId: string): Promise<import('@/types').CustodyTransaction[]> {
    const txs = this.store.custodyTransactions
      .filter((t) => t.profile_id === investorId)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return JSON.parse(JSON.stringify(txs));
  }

  public async requestWithdrawal(
    input: import('@/types').RequestWithdrawalInput
  ): Promise<import('@/types').CustodyTransaction> {
    if (!input.amount || input.amount <= 0) {
      throw new Error('El importe a retirar debe ser mayor a cero.');
    }

    const currentBalance = await this.getCustodyBalance(input.investor_id);
    if (input.amount > currentBalance) {
      throw new Error('Saldo insuficiente para realizar el retiro solicitado.');
    }

    const profile = this.store.profiles.find((p) => p.id === input.investor_id);
    const destinationCbu = input.bank_cbu_cvu || profile?.bank_cbu_cvu;
    if (!destinationCbu) {
      throw new Error('Cuenta bancaria no configurada. Por favor, agregá tu CBU/CVU en tu perfil.');
    }

    const newBalance = Number((currentBalance - input.amount).toFixed(2));
    if (profile) {
      profile.custody_balance = newBalance;
    }

    const txId = `tx-wth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tx: import('@/types').CustodyTransaction = {
      id: txId,
      profile_id: input.investor_id,
      type: 'withdrawal',
      amount: input.amount,
      balance_after: newBalance,
      status: 'completed',
      reference_id: null,
      payment_metadata: {
        bank_cbu_cvu: destinationCbu,
        bank_alias: input.bank_alias || (profile as any)?.bank_alias || null,
        description: 'Retiro de saldo en custodia a CBU bancario',
      },
      created_at: new Date().toISOString(),
    };

    this.store.custodyTransactions.push(tx);

    this.store.notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: input.investor_id,
      title: 'Solicitud de retiro registrada',
      message: `La transferencia por $${input.amount.toLocaleString('es-AR')} a tu CBU está en proceso.`,
      type: 'info',
      action_url: '/dashboard/inversor',
      read: false,
      created_at: new Date().toISOString(),
    });

    return JSON.parse(JSON.stringify(tx));
  }

  public async checkoutInvestment(
    input: import('@/types').CheckoutInvestmentInput
  ): Promise<import('@/types').CheckoutInvestmentResult> {
    if (
      (input.payment_method === 'credit_card' || input.payment_method === 'debit_card') &&
      input.card_last_four === '0002'
    ) {
      throw new Error('Fondos insuficientes: La entidad bancaria emisora rechazó la operación.');
    }

    const prevBalance = await this.getCustodyBalance(input.investor_id);
    if (input.payment_method === 'custody_balance' && prevBalance < input.amount) {
      throw new Error('Saldo en custodia insuficiente para completar la inversión.');
    }

    const commitResult = await this.commitInvestment({
      loan_id: input.loan_id,
      investor_id: input.investor_id,
      amount: input.amount,
    });

    const txId = `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const balanceAfter =
      input.payment_method === 'custody_balance'
        ? prevBalance - input.amount
        : prevBalance;

    const tx: import('@/types').CustodyTransaction = {
      id: txId,
      profile_id: input.investor_id,
      type: 'investment_hold',
      amount: input.amount,
      balance_after: balanceAfter,
      status: 'completed',
      reference_id: input.loan_id,
      payment_metadata: {
        payment_method: input.payment_method,
        card_last_four: input.card_last_four,
        card_brand: input.card_brand,
        loan_id: input.loan_id,
      },
      created_at: new Date().toISOString(),
    };

    this.store.custodyTransactions.push(tx);

    return {
      success: true,
      investment_id: commitResult.investment.id,
      transaction_id: txId,
      amount_funded: commitResult.amount_funded,
      loan_status: commitResult.loan.status,
      payment_method: input.payment_method,
      card_last_four: input.card_last_four,
      card_brand: input.card_brand,
      timestamp: tx.created_at,
      investment: commitResult.investment,
      loan: commitResult.loan,
      is_fully_funded: commitResult.is_fully_funded,
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
