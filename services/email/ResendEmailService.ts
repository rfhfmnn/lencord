/**
 * Production / Live Transactional Email Service using Resend / SMTP REST API.
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
} from './templates';
import { isValidEmailAddress } from './MockEmailService';

export interface ResendEmailConfig {
  apiKey?: string;
  fromEmail?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export function redactSensitiveData(text: string, secrets: string[] = []): string {
  let sanitized = text;
  sanitized = sanitized.replace(/Bearer\s+[^\s,]+/gi, 'Bearer ***REDACTED***');
  sanitized = sanitized.replace(/apikey=[^\s,]+/gi, 'apikey=***REDACTED***');
  sanitized = sanitized.replace(/re_[a-zA-Z0-9_\-]+/g, 're_***REDACTED***');
  for (const secret of secrets) {
    if (secret && secret.length >= 4) {
      sanitized = sanitized.split(secret).join('***REDACTED***');
    }
  }
  return sanitized;
}

export class ResendEmailService implements EmailServiceInterface {
  private apiKey: string;
  private fromEmail: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(config?: ResendEmailConfig) {
    this.apiKey =
      config?.apiKey ||
      process.env.RESEND_API_KEY ||
      process.env.EMAIL_API_KEY ||
      '';
    this.fromEmail =
      config?.fromEmail ||
      process.env.EMAIL_FROM ||
      'Lencord <notificaciones@lencord.com.ar>';
    this.baseUrl = config?.baseUrl || 'https://api.resend.com/emails';
    this.fetchFn = config?.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (null as any));
  }

  private extractEmail(to: string | EmailRecipient): string {
    if (typeof to === 'string') return to;
    return to?.email || '';
  }

  public async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const toAddress = this.extractEmail(options.to);

    // 1. Validate recipient email
    if (!isValidEmailAddress(toAddress)) {
      console.warn(
        `[ResendEmailService] Warning: Invalid or missing recipient email address: "${toAddress}"`
      );
      return {
        success: false,
        error: 'Invalid or missing recipient email address',
      };
    }

    // 2. Fallback to mock mode if no API key is configured (dev/staging safety)
    if (!this.apiKey) {
      console.warn(
        '[ResendEmailService] Notice: RESEND_API_KEY is not set. Email dispatch skipped in mock/dev mode.'
      );
      return {
        success: true,
        messageId: `simulated-no-key-${Date.now()}`,
      };
    }

    try {
      const response = await this.fetchFn(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: options.from || this.fromEmail,
          to: [toAddress],
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const rawErrMsg = data?.message || data?.error || `HTTP ${response.status} ${response.statusText}`;
        const sanitizedErrMsg = redactSensitiveData(String(rawErrMsg), [this.apiKey]);
        console.error(
          '[ResendEmailService] Provider error dispatching email:',
          sanitizedErrMsg
        );
        return {
          success: false,
          error: sanitizedErrMsg,
        };
      }

      return {
        success: true,
        messageId: data?.id || `resend-${Date.now()}`,
      };
    } catch (err: any) {
      const rawErrMsg = err?.message || String(err);
      const sanitizedErrMsg = redactSensitiveData(rawErrMsg, [this.apiKey]);
      console.error(
        '[ResendEmailService] Network/system error dispatching email:',
        sanitizedErrMsg
      );
      return {
        success: false,
        error: sanitizedErrMsg,
      };
    }
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
}
