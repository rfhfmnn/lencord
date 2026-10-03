/**
 * In-memory Mock Email Service for Lencord Testing & Development.
 * Conforms to EmailServiceInterface and Issue #47.
 */

import type {
  EmailRecipient,
  EmailServiceInterface,
  InstallmentReminderEmailParams,
  InvestmentConfirmationEmailParams,
  LoanSubmissionEmailParams,
  CreditApprovalEmailParams,
  CreditRejectionEmailParams,
  RegistrationEmailParams,
  NewInvestmentReceivedEmailParams,
  LoanFundingCompletedBorrowerEmailParams,
  LoanFundingCompletedInvestorEmailParams,
  PromissoryNoteSignedInvestorEmailParams,
  InstallmentPayoutCreditedEmailParams,
  SendEmailOptions,
  SendEmailResult,
} from './types';
import {
  renderCreditApprovalTemplate,
  renderCreditRejectionTemplate,
  renderInstallmentReminderTemplate,
  renderInvestmentConfirmationTemplate,
  renderLoanSubmissionTemplate,
  renderRegistrationTemplate,
  renderNewInvestmentReceivedTemplate,
  renderLoanFundingCompletedBorrowerTemplate,
  renderLoanFundingCompletedInvestorTemplate,
  renderPromissoryNoteSignedInvestorTemplate,
  renderInstallmentPayoutCreditedTemplate,
} from './templates';

export interface SentEmailRecord extends SendEmailOptions {
  id: string;
  sentAt: string;
}

export function isValidEmailAddress(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export class MockEmailService implements EmailServiceInterface {
  private sentEmails: SentEmailRecord[] = [];
  private shouldFail = false;
  private failureError = 'Simulated SMTP/Resend provider outage';

  public setShouldFail(fail: boolean, errorMessage?: string): void {
    this.shouldFail = fail;
    if (errorMessage) {
      this.failureError = errorMessage;
    }
  }

  public getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  public getLastEmail(): SentEmailRecord | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  public clearSentEmails(): void {
    this.sentEmails = [];
  }

  private extractEmailString(to: string | EmailRecipient): string {
    if (typeof to === 'string') return to;
    return to?.email || '';
  }

  public async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const toAddress = this.extractEmailString(options.to);

    // Validate recipient
    if (!isValidEmailAddress(toAddress)) {
      console.warn(
        `[MockEmailService] Warning: Invalid or missing recipient email address: "${toAddress}"`
      );
      return {
        success: false,
        error: 'Invalid or missing recipient email address',
      };
    }

    if (this.shouldFail) {
      console.error(
        `[MockEmailService] Simulated provider failure: ${this.failureError}`
      );
      return {
        success: false,
        error: this.failureError,
      };
    }

    const messageId = `mock-email-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.sentEmails.push({
      ...options,
      id: messageId,
      sentAt: new Date().toISOString(),
    });

    return {
      success: true,
      messageId,
    };
  }

  public async sendRegistrationEmail(
    params: RegistrationEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderRegistrationTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendLoanSubmissionEmail(
    params: LoanSubmissionEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderLoanSubmissionTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendCreditApprovalEmail(
    params: CreditApprovalEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderCreditApprovalTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendCreditRejectionEmail(
    params: CreditRejectionEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderCreditRejectionTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendInvestmentConfirmationEmail(
    params: InvestmentConfirmationEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderInvestmentConfirmationTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendInstallmentReminderEmail(
    params: InstallmentReminderEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderInstallmentReminderTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendNewInvestmentReceivedEmail(
    params: NewInvestmentReceivedEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderNewInvestmentReceivedTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendLoanFundingCompletedBorrowerEmail(
    params: LoanFundingCompletedBorrowerEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderLoanFundingCompletedBorrowerTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendLoanFundingCompletedInvestorEmail(
    params: LoanFundingCompletedInvestorEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderLoanFundingCompletedInvestorTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendPromissoryNoteSignedInvestorEmail(
    params: PromissoryNoteSignedInvestorEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderPromissoryNoteSignedInvestorTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }

  public async sendInstallmentPayoutCreditedEmail(
    params: InstallmentPayoutCreditedEmailParams
  ): Promise<SendEmailResult> {
    const { subject, html, text } = renderInstallmentPayoutCreditedTemplate(params);
    return this.send({
      to: params.to,
      subject,
      html,
      text,
    });
  }
}

export const defaultMockEmailService = new MockEmailService();
