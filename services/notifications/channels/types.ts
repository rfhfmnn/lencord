/**
 * Multi-Channel Notification Contracts and Types for Lencord P2P Platform.
 * Supports SMS, WhatsApp, and delivery status tracking.
 * Conforms to Issue #50 and _docs/next_tasks.md Task 27.
 */

import type { Installment, Investment, Loan, NotificationPreferences, Profile } from '@/types';

export type ChannelType = 'sms' | 'whatsapp';

export type HighPriorityAlertType =
  | 'otp_signature'
  | 'loan_funding_completed'
  | 'urgent_payment_reminder';

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'bounced';

export interface ChannelMessagePayload {
  to: string;
  body: string;
  channel: ChannelType;
  priority?: 'high' | 'normal';
  metadata?: Record<string, unknown>;
}

export interface ChannelMessageResult {
  success: boolean;
  messageId?: string;
  channel: ChannelType;
  status: DeliveryStatus;
  to: string;
  error?: string;
  statusCode?: number;
}

export interface OtpSignatureAlertParams {
  to: string;
  recipientName: string;
  otpCode: string;
  loanId: string;
  amount?: number;
  expiresInMinutes?: number;
  channel?: ChannelType;
}

export interface LoanFundingCompletedAlertParams {
  to: string;
  recipientName: string;
  loanId: string;
  amount: number;
  channel?: ChannelType;
}

export interface UrgentPaymentReminderAlertParams {
  to: string;
  recipientName: string;
  loanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  daysRemaining?: number;
  channel?: ChannelType;
}

export interface NotifyNewInvestmentParams {
  loan: Loan;
  investment: Investment;
  borrower: Partial<Profile>;
  investor?: Partial<Profile>;
}

export interface NotifyLoanFundingCompletedParams {
  loan: Loan;
  borrower: Partial<Profile>;
  investors: Array<{ profile: Partial<Profile>; amount?: number }>;
}

export interface NotifyPromissoryNoteSignedParams {
  loan: Loan;
  borrower: Partial<Profile>;
  investors: Array<{ profile: Partial<Profile>; amount?: number }>;
}

export interface NotifyInstallmentPayoutParams {
  loan: Loan;
  installment: Installment;
  borrower: Partial<Profile>;
  payouts: Array<{
    investor: Partial<Profile>;
    principalShare: number;
    interestShare: number;
    totalShare: number;
  }>;
}

export interface NotifyUpcomingInstallmentReminderParams {
  loan: Loan;
  installment: Installment;
  borrower: Partial<Profile>;
  daysRemaining?: number;
}

export interface DeliveryStatusWebhookPayload {
  messageId: string;
  status: DeliveryStatus | string;
  to?: string;
  channel?: ChannelType | string;
  errorCode?: string;
  errorMessage?: string;
  timestamp?: string;
  rawPayload?: Record<string, unknown>;
}

export interface DeliveryStatusRecord {
  id: string;
  messageId: string;
  channel: ChannelType;
  recipient: string;
  status: DeliveryStatus;
  errorCode?: string;
  errorMessage?: string;
  isOpticalBounce: boolean;
  updatedAt: string;
}

export interface DeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  bounced: number;
  pending: number;
  deliveryRate: number; // percentage (0 - 100)
  failureRate: number; // percentage (0 - 100)
  bounceRate: number; // percentage (0 - 100)
}

/**
 * Interface contract for low-level provider adapter (Twilio, mock, etc.).
 */
export interface MultiChannelAdapterInterface {
  sendSms(
    to: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<ChannelMessageResult>;
  sendWhatsApp(
    to: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<ChannelMessageResult>;
  handleDeliveryStatusWebhook(
    payload: DeliveryStatusWebhookPayload
  ): Promise<DeliveryStatusRecord>;
  getDeliveryStats(): DeliveryStats;
  getDeliveryRecords(): DeliveryStatusRecord[];
}

/**
 * Interface contract for high-level multi-channel notification service.
 */
export interface MultiChannelNotificationServiceInterface {
  adapter: MultiChannelAdapterInterface;
  sendOtpSignatureAlert(
    params: OtpSignatureAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult>;
  sendLoanFundingCompletedAlert(
    params: LoanFundingCompletedAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult>;
  sendUrgentPaymentReminderAlert(
    params: UrgentPaymentReminderAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult>;
  dispatchAlert(
    type: HighPriorityAlertType,
    params:
      | OtpSignatureAlertParams
      | LoanFundingCompletedAlertParams
      | UrgentPaymentReminderAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult>;
  checkUserPreference(
    userProfile: Partial<Profile> | undefined,
    channel: ChannelType
  ): boolean;
  updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences>;

  // Lifecycle Bidirectional Notification Events (Issue #82)
  notifyNewInvestmentReceived?(params: NotifyNewInvestmentParams): Promise<void>;
  notifyLoanFundingCompleted?(params: NotifyLoanFundingCompletedParams): Promise<void>;
  notifyPromissoryNoteSignedAndActivated?(params: NotifyPromissoryNoteSignedParams): Promise<void>;
  notifyInstallmentPayoutCredited?(params: NotifyInstallmentPayoutParams): Promise<void>;
  notifyUpcomingInstallmentReminder?(params: NotifyUpcomingInstallmentReminderParams): Promise<void>;
}
