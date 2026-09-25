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
  SubmitLoanInput,
} from '@/types';
import { defaultMockStateStore, MockStateStore } from './mockState';

export class MockLoanService implements LoanServiceInterface {
  private store: MockStateStore;

  constructor(store: MockStateStore = defaultMockStateStore) {
    this.store = store;
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
    const creditProfile = this.store.creditProfiles.find(
      (cp) => cp.profile_id === loan.borrower_id
    );
    if (creditProfile) {
      creditProfile.risk_tier = input.risk_tier;
      creditProfile.updated_at = new Date().toISOString();
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

  public async getInstallmentsByLoan(loanId: string): Promise<Installment[]> {
    const installments = this.store.installments.filter(
      (inst) => inst.loan_id === loanId
    );
    return JSON.parse(JSON.stringify(installments));
  }
}

export const defaultMockLoanService = new MockLoanService();
