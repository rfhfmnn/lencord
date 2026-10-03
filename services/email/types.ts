/**
 * Transactional Email Service Contracts and Template Parameters for Lencord P2P Platform.
 * Conforms to Issue #47 and _docs/plan.md.
 */

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

export interface NewInvestmentReceivedEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  amount: number;
  amountFunded: number;
  amountRequested: number;
  percentage: number;
}

export interface LoanFundingCompletedBorrowerEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  amount: number;
}

export interface LoanFundingCompletedInvestorEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  borrowerName: string;
  amountInvested: number;
}

export interface PromissoryNoteSignedInvestorEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  borrowerName: string;
  amountInvested: number;
}

export interface InstallmentPayoutCreditedEmailParams {
  to: string;
  recipientName: string;
  loanId: string;
  installmentNumber: number;
  principalShare: number;
  interestShare: number;
  totalShare: number;
}

/**
 * Service contract for transactional email notifications.
 */
export interface EmailServiceInterface {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
  sendRegistrationEmail(params: RegistrationEmailParams): Promise<SendEmailResult>;
  sendLoanSubmissionEmail(params: LoanSubmissionEmailParams): Promise<SendEmailResult>;
  sendCreditApprovalEmail(params: CreditApprovalEmailParams): Promise<SendEmailResult>;
  sendCreditRejectionEmail(params: CreditRejectionEmailParams): Promise<SendEmailResult>;
  sendInvestmentConfirmationEmail(params: InvestmentConfirmationEmailParams): Promise<SendEmailResult>;
  sendInstallmentReminderEmail(params: InstallmentReminderEmailParams): Promise<SendEmailResult>;
  sendNewInvestmentReceivedEmail?(params: NewInvestmentReceivedEmailParams): Promise<SendEmailResult>;
  sendLoanFundingCompletedBorrowerEmail?(params: LoanFundingCompletedBorrowerEmailParams): Promise<SendEmailResult>;
  sendLoanFundingCompletedInvestorEmail?(params: LoanFundingCompletedInvestorEmailParams): Promise<SendEmailResult>;
  sendPromissoryNoteSignedInvestorEmail?(params: PromissoryNoteSignedInvestorEmailParams): Promise<SendEmailResult>;
  sendInstallmentPayoutCreditedEmail?(params: InstallmentPayoutCreditedEmailParams): Promise<SendEmailResult>;
}
