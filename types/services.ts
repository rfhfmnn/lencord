/**
 * Service Layer Contracts and Data Transfer Interfaces for Lencord P2P Platform
 * Conforms to _docs/plan.md Sections 7 and 8.2.
 */

import type {
  BcraSituation,
  DocumentType,
  Installment,
  Investment,
  LegalContract,
  Loan,
  LoanCategory,
  LoanStatus,
  RateType,
  RiskTier,
  SmeCreditProfile,
} from './models';

// ---------------------------------------------------------------------------
// Payment Gateway Contract (Agnostic Adapter Pattern)
// Strictly matches plan.md Section 8.2
// ---------------------------------------------------------------------------

export interface HoldFundsResult {
  holdId: string;
  success: boolean;
}

export interface ReleaseFundsResult {
  success: boolean;
}

export interface DisburseLoanResult {
  transferId: string;
  success: boolean;
}

export interface CollectInstallmentResult {
  paymentId: string;
  status: 'pending' | 'settled';
}

/**
 * Agnostic payment provider contract for BaaS and mock providers (Bind, Pomelo, Coelsa).
 * plan.md Section 8.2
 */
export interface PaymentGatewayInterface {
  holdFunds(
    investorId: string,
    amount: number,
    loanId: string
  ): Promise<{ holdId: string; success: boolean }>;

  releaseFunds(holdId: string): Promise<{ success: boolean }>;

  disburseLoan(
    loanId: string,
    cbuTarget: string,
    amount: number
  ): Promise<{ transferId: string; success: boolean }>;

  collectInstallment(
    installmentId: string,
    cbuSource: string,
    amount: number
  ): Promise<{ paymentId: string; status: 'pending' | 'settled' }>;
}

// ---------------------------------------------------------------------------
// Loan Service Interfaces
// ---------------------------------------------------------------------------

export interface SubmitLoanInput {
  borrower_id: string;
  amount_requested: number;
  term_months: number;
  rate_type: RateType;
  category: LoanCategory;
  balance_sheet_url?: string | null;
  f931_url?: string | null;
}

export interface ApproveLoanInput {
  loan_id: string;
  risk_tier: RiskTier;
  investor_rate: number;
  platform_spread: number;
  funding_deadline: string; // ISO 8601 Timestamp
}

export interface LoanFilters {
  status?: LoanStatus | LoanStatus[];
  borrower_id?: string;
  category?: LoanCategory;
  risk_tier?: RiskTier;
  rate_type?: RateType;
  min_amount?: number;
  max_amount?: number;
}

/**
 * Service contract for loan management, origination, approval, and funding finalization.
 */
export interface LoanServiceInterface {
  getLoanById(id: string): Promise<Loan | null>;
  listLoans(filters?: LoanFilters): Promise<Loan[]>;
  submitLoanApplication(input: SubmitLoanInput): Promise<Loan>;
  approveAndPublishLoan(input: ApproveLoanInput): Promise<Loan>;
  finalizeLoanFunding(loanId: string): Promise<Loan>;
  cancelLoan(loanId: string): Promise<Loan>;
  getInstallmentsByLoan(loanId: string): Promise<Installment[]>;
}

// ---------------------------------------------------------------------------
// Investment Service Interfaces
// ---------------------------------------------------------------------------

export interface CommitInvestmentInput {
  loan_id: string;
  investor_id: string;
  amount: number;
}

export interface CommitInvestmentResult {
  investment: Investment;
  loan: Loan;
  amount_funded: number;
  is_fully_funded: boolean;
}

export interface RefundInvestmentsResult {
  refunded_count: number;
  total_refunded_amount: number;
}

/**
 * Service contract for investor commitments, atomic auctions, and fund reconciliation.
 */
export interface InvestmentServiceInterface {
  commitInvestment(input: CommitInvestmentInput): Promise<CommitInvestmentResult>;
  getInvestmentsByLoan(loanId: string): Promise<Investment[]>;
  getInvestmentsByInvestor(investorId: string): Promise<Investment[]>;
  getInvestmentById(id: string): Promise<Investment | null>;
  refundInvestmentsByLoan(loanId: string): Promise<RefundInvestmentsResult>;
}

// ---------------------------------------------------------------------------
// Credit Scoring Interfaces
// ---------------------------------------------------------------------------

export interface BcraEntityDebt {
  entityName: string;
  situation: BcraSituation;
  amount: number;
  daysPastDue?: number;
}

export interface BcraCreditReport {
  cuit: string;
  worstSituation: BcraSituation;
  totalDebt: number;
  entities: BcraEntityDebt[];
  isClean: boolean;
  statusDescription: string;
}

export interface EvaluateCreditRiskInput {
  profileId: string;
  taxId: string;
  hasBalanceSheet?: boolean;
  hasF931?: boolean;
}

/**
 * Service contract for BCRA Central de Deudores inquiries and SME risk categorization.
 */
export interface CreditScoringInterface {
  getBcraReport(cuit: string): Promise<BcraCreditReport>;
  evaluateCreditRisk(input: EvaluateCreditRiskInput): Promise<SmeCreditProfile>;
  getCreditProfileByProfileId(profileId: string): Promise<SmeCreditProfile | null>;
}

// ---------------------------------------------------------------------------
// Legal Service Interfaces
// ---------------------------------------------------------------------------

export interface CreateContractInput {
  loan_id: string;
  document_type: DocumentType;
  document_url: string;
}

export interface SignContractInput {
  contract_id: string;
  signature_hash: string;
}

/**
 * Service contract for mutual agreement framework and electronic promissory note generation and signing.
 */
export interface LegalServiceInterface {
  generatePromissoryNote(loanId: string): Promise<LegalContract>;
  generateMutualAgreement(loanId: string): Promise<LegalContract>;
  signContract(input: SignContractInput): Promise<LegalContract>;
  getContractsByLoan(loanId: string): Promise<LegalContract[]>;
  getContractById(id: string): Promise<LegalContract | null>;
}
