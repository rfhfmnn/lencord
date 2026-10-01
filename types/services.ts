/**
 * Service Layer Contracts and Data Transfer Interfaces for Lencord P2P Platform
 * Conforms to _docs/plan.md Sections 7 and 8.2.
 */

import type {
  BcraSituation,
  DocumentType,
  Installment,
  InstallmentStatus,
  Investment,
  LegalContract,
  Loan,
  LoanCategory,
  LoanStatus,
  Notification,
  NotificationType,
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
  rejectLoan(loanId: string, reason: string): Promise<Loan>;
  finalizeLoanFunding(loanId: string): Promise<Loan>;
  cancelLoan(loanId: string): Promise<Loan>;
  getInstallmentsByLoan(loanId: string): Promise<Installment[]>;
  activateLoan?(loanId: string): Promise<Loan>;
  expireLoan?(loanId: string): Promise<Loan>;
  flagPartialAcceptance?(loanId: string, deadline: string): Promise<Loan>;
  repayInstallment?(input: RepayInstallmentInput): Promise<RepayInstallmentResult>;
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

export type InvestmentPaymentMethod = 'custody_balance' | 'credit_card' | 'debit_card';

export interface CheckoutInvestmentInput {
  loan_id: string;
  investor_id: string;
  amount: number;
  payment_method: InvestmentPaymentMethod;
  card_last_four?: string;
  card_brand?: string;
}

export interface CheckoutInvestmentResult {
  success: boolean;
  investment_id: string;
  transaction_id: string;
  amount_funded: number;
  loan_status: LoanStatus;
  payment_method: string;
  card_last_four?: string;
  card_brand?: string;
  timestamp: string;
  investment?: Investment;
  loan?: Loan;
  is_fully_funded?: boolean;
}

export interface RepayInstallmentInput {
  installment_id: string;
  payer_id: string;
}

export interface RepayInstallmentResult {
  success: boolean;
  installment_id: string;
  status: InstallmentStatus;
  all_repaid: boolean;
  payouts_count?: number;
}

/**
 * Service contract for investor commitments, atomic auctions, and fund reconciliation.
 */
export interface InvestmentServiceInterface {
  commitInvestment(input: CommitInvestmentInput): Promise<CommitInvestmentResult>;
  checkoutInvestment?(input: CheckoutInvestmentInput): Promise<CheckoutInvestmentResult>;
  getCustodyBalance?(investorId: string): Promise<number>;
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

// ---------------------------------------------------------------------------
// Notification Service Interfaces
// ---------------------------------------------------------------------------

export interface CreateNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  action_url?: string | null;
}

/**
 * Service contract for in-app user notifications and real-time subscription.
 */
export interface NotificationServiceInterface {
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  createNotification(input: CreateNotificationInput): Promise<Notification>;
  markAsRead(notificationId: string): Promise<Notification>;
  markAllAsRead(userId: string): Promise<void>;
  subscribeToNotifications?(
    userId: string,
    callback: (notification: Notification) => void
  ): () => void;
}

// ---------------------------------------------------------------------------
// Transactional Email Service Interfaces
// ---------------------------------------------------------------------------

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string | EmailRecipient;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface RegistrationEmailParams {
  to: string;
  recipientName: string;
  role: 'borrower' | 'investor' | 'sme' | string;
}

export interface LoanSubmissionEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  amount: number;
  category: string;
}

export interface CreditApprovalEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  amount: number;
  riskTier: string;
  investorRate: number;
  fundingDeadline?: string;
}

export interface CreditRejectionEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  reason: string;
}

export interface InvestmentConfirmationEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  amount: number;
  rate: number;
}

export interface InstallmentReminderEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
}

export interface EmailServiceInterface {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
  sendRegistrationEmail(params: RegistrationEmailParams): Promise<SendEmailResult>;
  sendLoanSubmissionEmail(params: LoanSubmissionEmailParams): Promise<SendEmailResult>;
  sendCreditApprovalEmail(params: CreditApprovalEmailParams): Promise<SendEmailResult>;
  sendCreditRejectionEmail(params: CreditRejectionEmailParams): Promise<SendEmailResult>;
  sendInvestmentConfirmationEmail(params: InvestmentConfirmationEmailParams): Promise<SendEmailResult>;
  sendInstallmentReminderEmail(params: InstallmentReminderEmailParams): Promise<SendEmailResult>;
}

