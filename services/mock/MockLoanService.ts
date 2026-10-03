/**
 * In-memory Mock Loan Service.
 * Conforms to LoanServiceInterface in _docs/plan.md Section 7 and @/types.
 */

import type {
  ApproveLoanInput,
  EmailServiceInterface,
  Installment,
  Loan,
  LoanFilters,
  LoanServiceInterface,
  PaymentGatewayInterface,
  SubmitLoanInput,
} from '@/types';
import type { MultiChannelNotificationServiceInterface } from '../notifications/channels';
import { defaultMockPaymentGateway } from './MockPaymentGateway';
import { defaultMockStateStore, MockStateStore } from './mockState';

export class MockLoanService implements LoanServiceInterface {
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

  public async getLoanById(id: string): Promise<Loan | null> {
    const loan = this.store.loans.find((l) => l.id === id);
    if (!loan) return null;
    return JSON.parse(JSON.stringify(loan));
  }

  public async listLoans(filters?: LoanFilters): Promise<Loan[]> {
    let result = [...this.store.loans];

    if (filters) {
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          result = result.filter((l) =>
            (filters.status as string[]).includes(l.status)
          );
        } else {
          result = result.filter((l) => l.status === filters.status);
        }
      }

      if (filters.borrower_id) {
        result = result.filter((l) => l.borrower_id === filters.borrower_id);
      }

      if (filters.category) {
        result = result.filter((l) => l.category === filters.category);
      }

      if (filters.rate_type) {
        result = result.filter((l) => l.rate_type === filters.rate_type);
      }

      if (typeof filters.min_amount === 'number') {
        result = result.filter((l) => l.amount_requested >= filters.min_amount!);
      }

      if (typeof filters.max_amount === 'number') {
        result = result.filter((l) => l.amount_requested <= filters.max_amount!);
      }

      if (filters.risk_tier) {
        result = result.filter((loan) => {
          const creditProfile = this.store.creditProfiles.find(
            (cp) => cp.profile_id === loan.borrower_id
          );
          return creditProfile?.risk_tier === filters.risk_tier;
        });
      }
    }

    return JSON.parse(JSON.stringify(result));
  }

  public async submitLoanApplication(input: SubmitLoanInput): Promise<Loan> {
    if (!input.borrower_id) {
      throw new Error('borrower_id is required');
    }
    if (input.amount_requested <= 0) {
      throw new Error('amount_requested must be greater than zero');
    }
    if (input.term_months <= 0) {
      throw new Error('term_months must be greater than zero');
    }

    const id = `loan-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const newLoan: Loan = {
      id,
      borrower_id: input.borrower_id,
      amount_requested: input.amount_requested,
      amount_funded: 0,
      term_months: input.term_months,
      rate_type: input.rate_type,
      investor_rate: 0,
      platform_spread: 0,
      borrower_rate: 0,
      base_uva_value: null,
      category: input.category,
      status: 'in_review',
      description: input.description ?? null,
      funding_deadline: deadline.toISOString(),
      created_at: now.toISOString(),
    };

    // Update document URLs in SME credit profile if present
    if (input.balance_sheet_url || input.f931_url || input.afip_url || input.bank_statements_url) {
      let creditProfile = this.store.creditProfiles.find(
        (cp) => cp.profile_id === input.borrower_id
      );
      if (creditProfile) {
        if (input.balance_sheet_url !== undefined) {
          creditProfile.balance_sheet_url = input.balance_sheet_url;
        }
        if (input.f931_url !== undefined) {
          creditProfile.f931_url = input.f931_url;
        }
        if (input.afip_url !== undefined) {
          creditProfile.afip_url = input.afip_url;
        }
        if (input.bank_statements_url !== undefined) {
          creditProfile.bank_statements_url = input.bank_statements_url;
        }
        creditProfile.updated_at = now.toISOString();
      } else {
        creditProfile = {
          id: `cred-${Math.random().toString(36).substring(2, 9)}`,
          profile_id: input.borrower_id,
          bcra_situation: 1,
          risk_tier: 'Tier B',
          balance_sheet_url: input.balance_sheet_url ?? null,
          f931_url: input.f931_url ?? null,
          afip_url: input.afip_url ?? null,
          bank_statements_url: input.bank_statements_url ?? null,
          scoring_notes: 'Documentación cargada en solicitud de préstamo',
          updated_at: now.toISOString(),
        };
        this.store.creditProfiles.push(creditProfile);
      }
    }

    this.store.loans.push(newLoan);

    // Emit in-app notification for borrower
    this.store.notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: input.borrower_id,
      title: 'Solicitud enviada',
      message: `Tu solicitud de crédito por $${input.amount_requested.toLocaleString('es-AR')} fue recibida y se encuentra en revisión.`,
      type: 'info',
      read: false,
      action_url: '/dashboard/pyme',
      created_at: now.toISOString(),
    });

    // Trigger transactional email receipt (graceful error handling)
    if (this.emailService) {
      try {
        const borrower = this.store.profiles.find((p) => p.id === input.borrower_id);
        const borrowerEmail = (borrower as any)?.email || 'contacto@empresa.com.ar';
        const recipientName = borrower?.legal_name || 'Solicitante';
        this.emailService
          .sendLoanSubmissionEmail({
            to: borrowerEmail,
            recipientName,
            loanId: newLoan.id,
            amount: newLoan.amount_requested,
            category: newLoan.category,
          })
          .catch((err) => {
            console.warn('[MockLoanService] Failed to send submission email:', err?.message || err);
          });
      } catch (err: any) {
        console.warn('[MockLoanService] Exception in email trigger:', err?.message || err);
      }
    }

    return JSON.parse(JSON.stringify(newLoan));
  }

  public async approveAndPublishLoan(input: ApproveLoanInput): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === input.loan_id);
    if (!loan) {
      throw new Error(`Loan not found: ${input.loan_id}`);
    }

    loan.investor_rate = input.investor_rate;
    loan.platform_spread = input.platform_spread;
    loan.borrower_rate = Number(
      (input.investor_rate + input.platform_spread).toFixed(2)
    );
    loan.funding_deadline = input.funding_deadline;
    loan.status = 'funding';

    // Emit in-app notification for borrower
    this.store.notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: loan.borrower_id,
      title: 'Préstamo aprobado',
      message: 'Tu solicitud de crédito ha sido aprobada y publicada en la subasta del marketplace.',
      type: 'success',
      read: false,
      action_url: '/dashboard/pyme',
      created_at: new Date().toISOString(),
    });

    // Update or establish risk tier on borrower credit profile
    let creditProfile = this.store.creditProfiles.find(
      (cp) => cp.profile_id === loan.borrower_id
    );
    if (creditProfile) {
      creditProfile.risk_tier = input.risk_tier;
      creditProfile.updated_at = new Date().toISOString();
    } else {
      creditProfile = {
        id: `cred-${Math.random().toString(36).substring(2, 9)}`,
        profile_id: loan.borrower_id,
        bcra_situation: 1,
        risk_tier: input.risk_tier,
        balance_sheet_url: null,
        f931_url: null,
        scoring_notes: `Aprobado por administración con ${input.risk_tier}`,
        updated_at: new Date().toISOString(),
      };
      this.store.creditProfiles.push(creditProfile);
    }

    // Trigger transactional email for loan approval & publication (graceful error handling)
    if (this.emailService) {
      try {
        const borrower = this.store.profiles.find((p) => p.id === loan.borrower_id);
        const borrowerEmail = (borrower as any)?.email || 'contacto@empresa.com.ar';
        const recipientName = borrower?.legal_name || 'Solicitante';
        this.emailService
          .sendCreditApprovalEmail({
            to: borrowerEmail,
            recipientName,
            loanId: loan.id,
            amount: loan.amount_requested,
            riskTier: input.risk_tier,
            investorRate: input.investor_rate,
            fundingDeadline: input.funding_deadline,
          })
          .catch((err) => {
            console.warn('[MockLoanService] Failed to send approval email:', err?.message || err);
          });
      } catch (err: any) {
        console.warn('[MockLoanService] Exception in approval email trigger:', err?.message || err);
      }
    }

    return JSON.parse(JSON.stringify(loan));
  }

  public async finalizeLoanFunding(loanId: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    if (loan.amount_funded >= loan.amount_requested) {
      loan.status = 'funded';
      // Emit in-app notification for borrower
      this.store.notifications.unshift({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: loan.borrower_id,
        title: 'Subasta completada al 100%',
        message: '¡Tu proyecto alcanzó el 100% de fondeo! Firma el Pagaré Digital para proceder con el desembolso.',
        type: 'warning',
        read: false,
        action_url: '/dashboard/pyme',
        created_at: new Date().toISOString(),
      });
    } else {
      const isPastDeadline = loan.funding_deadline
        ? new Date(loan.funding_deadline).getTime() <= Date.now()
        : false;
      if (isPastDeadline) {
        loan.status = 'cancelled';
      }
    }

    return JSON.parse(JSON.stringify(loan));
  }

  public async cancelLoan(loanId: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    loan.status = 'cancelled';
    return JSON.parse(JSON.stringify(loan));
  }

  public async expireLoan(loanId: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    loan.status = 'expired';
    return JSON.parse(JSON.stringify(loan));
  }

  public async flagPartialAcceptance(loanId: string, deadline: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    loan.partial_acceptance_flag = true;
    loan.partial_acceptance_deadline = deadline;
    loan.notification_dispatched = true;
    return JSON.parse(JSON.stringify(loan));
  }

  public async rejectLoan(loanId: string, reason: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    loan.status = 'rejected';
    loan.rejection_reason = reason;

    // Trigger transactional email for credit rejection (graceful error handling)
    if (this.emailService) {
      try {
        const borrower = this.store.profiles.find((p) => p.id === loan.borrower_id);
        const borrowerEmail = (borrower as any)?.email || 'contacto@empresa.com.ar';
        const recipientName = borrower?.legal_name || 'Solicitante';
        this.emailService
          .sendCreditRejectionEmail({
            to: borrowerEmail,
            recipientName,
            loanId: loan.id,
            reason,
          })
          .catch((err) => {
            console.warn('[MockLoanService] Failed to send rejection email:', err?.message || err);
          });
      } catch (err: any) {
        console.warn('[MockLoanService] Exception in rejection email trigger:', err?.message || err);
      }
    }

    return JSON.parse(JSON.stringify(loan));
  }

  public async getInstallmentsByLoan(loanId: string): Promise<Installment[]> {
    const installments = this.store.installments.filter(
      (inst) => inst.loan_id === loanId
    );
    return JSON.parse(JSON.stringify(installments));
  }

  public async activateLoan(loanId: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    loan.status = 'active';

    // 1. Trigger loan disbursement via payment gateway
    if (this.paymentGateway) {
      const borrower = this.store.profiles.find((p) => p.id === loan.borrower_id);
      const cbu = borrower?.bank_cbu_cvu || '0000003100010000000001';
      await this.paymentGateway.disburseLoan(loan.id, cbu, loan.amount_requested);
    }

    // 2. Generate monthly rows in installments table if not already created
    const existing = this.store.installments.filter((i) => i.loan_id === loanId);
    if (existing.length === 0) {
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

      let remaining = loan.amount_requested;
      const now = new Date();
      const investorRateRatio = loan.borrower_rate > 0 ? loan.investor_rate / loan.borrower_rate : 0.9;

      for (let i = 1; i <= term; i++) {
        const interestTotal = remaining * monthlyRate;
        const principal = installmentAmount - interestTotal;
        remaining = Math.max(0, remaining - principal);
        const dueDate = new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        const interestInvestors = Number((interestTotal * investorRateRatio).toFixed(2));
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

    // Event 3: Pagaré firmado y crédito activado (Notifica a los inversores participantes con in-app + email)
    if (this.multiChannelNotifications?.notifyPromissoryNoteSignedAndActivated) {
      const allLoanInvestments = this.store.investments.filter((inv) => inv.loan_id === loan.id);
      const uniqueInvestorIds = Array.from(new Set(allLoanInvestments.map((inv) => inv.investor_id)));
      const borrower = this.store.profiles.find((p) => p.id === loan.borrower_id) || {
        id: loan.borrower_id,
        legal_name: 'la PyME',
      };
      const participatingInvestors = uniqueInvestorIds.map((id) => {
        const p = this.store.profiles.find((pr) => pr.id === id) || {
          id,
          legal_name: 'Inversor Registrado',
          email: `${id}@lencord.com.ar`,
        };
        const invRecord = this.store.investments.find((inv) => inv.loan_id === loan.id && inv.investor_id === id);
        return { profile: p, amount: invRecord?.amount ?? 0 };
      });

      await this.multiChannelNotifications.notifyPromissoryNoteSignedAndActivated({
        loan,
        borrower,
        investors: participatingInvestors,
      });
    }

    return JSON.parse(JSON.stringify(loan));
  }

  public async repayInstallment(
    input: import('@/types').RepayInstallmentInput
  ): Promise<import('@/types').RepayInstallmentResult> {
    const installment = this.store.installments.find((i) => i.id === input.installment_id);
    if (!installment) {
      throw new Error(`Cuota no encontrada: ${input.installment_id}`);
    }

    if (installment.status === 'paid') {
      throw new Error('La cuota ya se encuentra pagada');
    }

    const investments = this.store.investments.filter(
      (inv) => inv.loan_id === installment.loan_id && (inv.status === 'committed' || inv.status === 'settled')
    );

    if (investments.length === 0) {
      throw new Error('No se registran inversiones válidas para distribuir esta cuota');
    }

    const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);

    installment.status = 'paid';
    installment.paid_at = new Date().toISOString();

    let accumPrincipal = 0;
    let accumInterest = 0;

    for (let idx = 0; idx < investments.length; idx++) {
      const inv = investments[idx];
      const isLast = idx === investments.length - 1;

      let principalShare: number;
      let interestShare: number;

      if (isLast) {
        principalShare = Number((installment.principal_amount - accumPrincipal).toFixed(2));
        interestShare = Number((installment.interest_investors - accumInterest).toFixed(2));
      } else {
        principalShare = Number(((installment.principal_amount * inv.amount) / totalInvested).toFixed(2));
        interestShare = Number(((installment.interest_investors * inv.amount) / totalInvested).toFixed(2));
        accumPrincipal += principalShare;
        accumInterest += interestShare;
      }

      const totalShare = Number((principalShare + interestShare).toFixed(2));

      const payout: import('@/types').InstallmentPayout = {
        id: `payout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        installment_id: installment.id,
        investment_id: inv.id,
        investor_id: inv.investor_id,
        principal_share: principalShare,
        interest_share: interestShare,
        total_share: totalShare,
        status: 'credited',
        paid_at: new Date().toISOString(),
      };
      this.store.installmentPayouts.push(payout);

      const prevTx = this.store.custodyTransactions
        .filter((t) => t.profile_id === inv.investor_id)
        .slice(-1)[0];
      const prevBal = prevTx ? prevTx.balance_after : 0;

      const tx: import('@/types').CustodyTransaction = {
        id: `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        profile_id: inv.investor_id,
        type: 'installment_payout',
        amount: totalShare,
        balance_after: Number((prevBal + totalShare).toFixed(2)),
        status: 'completed',
        reference_id: installment.id,
        payment_metadata: {
          installment_id: installment.id,
          installment_number: installment.installment_number,
          principal_share: principalShare,
          interest_share: interestShare,
        },
        created_at: new Date().toISOString(),
      };
      this.store.custodyTransactions.push(tx);

      const targetLoan = this.store.loans.find((l) => l.id === installment.loan_id);
      const borrower = targetLoan ? this.store.profiles.find((p) => p.id === targetLoan.borrower_id) : null;
      const borrowerName = (borrower as any)?.pyme_company_name || borrower?.legal_name || 'la PyME';

      // Event 4: Notify beneficiary investor of credited payout
      if (this.multiChannelNotifications?.notifyInstallmentPayoutCredited && targetLoan) {
        const invProfile = this.store.profiles.find((p) => p.id === inv.investor_id) || {
          id: inv.investor_id,
          legal_name: 'Inversor Registrado',
          email: `${inv.investor_id}@lencord.com.ar`,
        };
        await this.multiChannelNotifications.notifyInstallmentPayoutCredited({
          loan: targetLoan,
          installment,
          borrower: borrower || { id: targetLoan.borrower_id, legal_name: borrowerName },
          payouts: [
            {
              investor: invProfile,
              principalShare,
              interestShare,
              totalShare,
            },
          ],
        });
      } else {
        this.store.notifications.unshift({
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: inv.investor_id,
          title: 'Acreditación de cuota recibida',
          message: `Se acreditó $${totalShare.toLocaleString('es-AR')} en tu saldo en custodia por la cuota #${installment.installment_number} de ${borrowerName}.`,
          type: 'success',
          read: false,
          action_url: '/dashboard/inversor',
          created_at: new Date().toISOString(),
        });
      }
    }

    const allRepaid = !this.store.installments.some(
      (i) => i.loan_id === installment.loan_id && i.status !== 'paid'
    );

    if (allRepaid) {
      const loan = this.store.loans.find((l) => l.id === installment.loan_id);
      if (loan) {
        loan.status = 'repaid';
      }
    }

    return {
      success: true,
      installment_id: installment.id,
      status: 'paid',
      all_repaid: allRepaid,
      payouts_count: investments.length,
    };
  }
}

export const defaultMockLoanService = new MockLoanService();
