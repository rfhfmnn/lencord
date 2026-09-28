/**
 * In-memory Mock Loan Service.
 * Conforms to LoanServiceInterface in _docs/plan.md Section 7 and @/types.
 */

import type {
  ApproveLoanInput,
  Installment,
  Loan,
  LoanFilters,
  LoanServiceInterface,
  PaymentGatewayInterface,
  SubmitLoanInput,
} from '@/types';
import { defaultMockPaymentGateway } from './MockPaymentGateway';
import { defaultMockStateStore, MockStateStore } from './mockState';

export class MockLoanService implements LoanServiceInterface {
  private store: MockStateStore;
  private paymentGateway?: PaymentGatewayInterface;

  constructor(
    store: MockStateStore = defaultMockStateStore,
    paymentGateway: PaymentGatewayInterface = defaultMockPaymentGateway
  ) {
    this.store = store;
    this.paymentGateway = paymentGateway;
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
      funding_deadline: deadline.toISOString(),
      created_at: now.toISOString(),
    };

    // Update document URLs in SME credit profile if present
    if (input.balance_sheet_url || input.f931_url) {
      const creditProfile = this.store.creditProfiles.find(
        (cp) => cp.profile_id === input.borrower_id
      );
      if (creditProfile) {
        if (input.balance_sheet_url) {
          creditProfile.balance_sheet_url = input.balance_sheet_url;
        }
        if (input.f931_url) {
          creditProfile.f931_url = input.f931_url;
        }
        creditProfile.updated_at = now.toISOString();
      }
    }

    this.store.loans.push(newLoan);
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

    return JSON.parse(JSON.stringify(loan));
  }

  public async finalizeLoanFunding(loanId: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    if (loan.amount_funded >= loan.amount_requested) {
      loan.status = 'funded';
    } else {
      const isPastDeadline =
        new Date(loan.funding_deadline).getTime() <= Date.now();
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

  public async rejectLoan(loanId: string, reason: string): Promise<Loan> {
    const loan = this.store.loans.find((l) => l.id === loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    loan.status = 'rejected';
    loan.rejection_reason = reason;
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

    return JSON.parse(JSON.stringify(loan));
  }
}

export const defaultMockLoanService = new MockLoanService();
