/**
 * Multi-Channel Notification Service for Lencord.
 * Coordinates high-priority SMS & WhatsApp alert triggers and enforces user notification preferences.
 * Conforms to Issue #50 and _docs/next_tasks.md Task 27.
 */

import type { NotificationPreferences, Profile } from '@/types';
import type {
  ChannelMessageResult,
  ChannelType,
  HighPriorityAlertType,
  LoanFundingCompletedAlertParams,
  MultiChannelAdapterInterface,
  MultiChannelNotificationServiceInterface,
  OtpSignatureAlertParams,
  UrgentPaymentReminderAlertParams,
} from './types';
import {
  renderLoanFundingCompletedSms,
  renderLoanFundingCompletedWhatsApp,
  renderOtpSignatureSms,
  renderOtpSignatureWhatsApp,
  renderUrgentPaymentReminderSms,
  renderUrgentPaymentReminderWhatsApp,
} from './templates';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: true,
  whatsapp: true,
};

export class MultiChannelNotificationService
  implements MultiChannelNotificationServiceInterface
{
  public adapter: MultiChannelAdapterInterface;
  private userPreferencesStore: Map<string, NotificationPreferences> = new Map();

  constructor(adapter: MultiChannelAdapterInterface) {
    this.adapter = adapter;
  }

  /**
   * Checks whether the user has enabled the requested notification channel.
   * Allows toggling SMS and WhatsApp channels independently from email.
   */
  public checkUserPreference(
    userProfile: Partial<Profile> | undefined,
    channel: ChannelType
  ): boolean {
    if (!userProfile) return true;

    // Check in-memory preference store first if user ID is known
    if (userProfile.id && this.userPreferencesStore.has(userProfile.id)) {
      const prefs = this.userPreferencesStore.get(userProfile.id)!;
      return prefs[channel] ?? true;
    }

    // Check userProfile.notification_preferences
    if (userProfile.notification_preferences) {
      return userProfile.notification_preferences[channel] ?? true;
    }

    return DEFAULT_NOTIFICATION_PREFERENCES[channel];
  }

  /**
   * Updates notification preferences for a given user profile.
   */
  public async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const existing =
      this.userPreferencesStore.get(userId) ?? { ...DEFAULT_NOTIFICATION_PREFERENCES };

    const updated: NotificationPreferences = {
      ...existing,
      ...preferences,
    };

    this.userPreferencesStore.set(userId, updated);
    return updated;
  }

  /**
   * Dispatches high-priority OTP signature request alert via SMS and/or WhatsApp.
   */
  public async sendOtpSignatureAlert(
    params: OtpSignatureAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult> {
    const channel: ChannelType = params.channel ?? 'sms';

    // Verify user preferences
    if (!this.checkUserPreference(userProfile, channel)) {
      return {
        success: false,
        channel,
        status: 'failed',
        to: params.to,
        error: `User has disabled ${channel.toUpperCase()} notifications in their preferences`,
      };
    }

    const message =
      channel === 'whatsapp'
        ? renderOtpSignatureWhatsApp(params)
        : renderOtpSignatureSms(params);

    try {
      if (channel === 'whatsapp') {
        return await this.adapter.sendWhatsApp(params.to, message, {
          type: 'otp_signature',
          loanId: params.loanId,
        });
      }
      return await this.adapter.sendSms(params.to, message, {
        type: 'otp_signature',
        loanId: params.loanId,
      });
    } catch (err: any) {
      console.warn(
        `[MultiChannelNotificationService] Error dispatching OTP signature alert:`,
        err?.message || err
      );
      return {
        success: false,
        channel,
        status: 'failed',
        to: params.to,
        error: err?.message || 'Error dispatching OTP signature alert',
      };
    }
  }

  /**
   * Dispatches high-priority Loan Funding Completion alert via SMS or WhatsApp.
   */
  public async sendLoanFundingCompletedAlert(
    params: LoanFundingCompletedAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult> {
    const channel: ChannelType = params.channel ?? 'whatsapp';

    if (!this.checkUserPreference(userProfile, channel)) {
      // If preferred channel is disabled, attempt fallback to SMS if SMS is enabled
      if (channel === 'whatsapp' && this.checkUserPreference(userProfile, 'sms')) {
        return this.sendLoanFundingCompletedAlert({ ...params, channel: 'sms' }, userProfile);
      }
      return {
        success: false,
        channel,
        status: 'failed',
        to: params.to,
        error: `User has disabled ${channel.toUpperCase()} notifications in their preferences`,
      };
    }

    const message =
      channel === 'whatsapp'
        ? renderLoanFundingCompletedWhatsApp(params)
        : renderLoanFundingCompletedSms(params);

    try {
      if (channel === 'whatsapp') {
        return await this.adapter.sendWhatsApp(params.to, message, {
          type: 'loan_funding_completed',
          loanId: params.loanId,
          amount: params.amount,
        });
      }
      return await this.adapter.sendSms(params.to, message, {
        type: 'loan_funding_completed',
        loanId: params.loanId,
        amount: params.amount,
      });
    } catch (err: any) {
      console.warn(
        `[MultiChannelNotificationService] Error dispatching loan funding alert:`,
        err?.message || err
      );
      return {
        success: false,
        channel,
        status: 'failed',
        to: params.to,
        error: err?.message || 'Error dispatching loan funding alert',
      };
    }
  }

  /**
   * Dispatches high-priority Urgent Payment Reminder alert via SMS or WhatsApp.
   */
  public async sendUrgentPaymentReminderAlert(
    params: UrgentPaymentReminderAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult> {
    const channel: ChannelType = params.channel ?? 'sms';

    if (!this.checkUserPreference(userProfile, channel)) {
      if (channel === 'sms' && this.checkUserPreference(userProfile, 'whatsapp')) {
        return this.sendUrgentPaymentReminderAlert(
          { ...params, channel: 'whatsapp' },
          userProfile
        );
      }
      return {
        success: false,
        channel,
        status: 'failed',
        to: params.to,
        error: `User has disabled ${channel.toUpperCase()} notifications in their preferences`,
      };
    }

    const message =
      channel === 'whatsapp'
        ? renderUrgentPaymentReminderWhatsApp(params)
        : renderUrgentPaymentReminderSms(params);

    try {
      if (channel === 'whatsapp') {
        return await this.adapter.sendWhatsApp(params.to, message, {
          type: 'urgent_payment_reminder',
          loanId: params.loanId,
          installmentNumber: params.installmentNumber,
        });
      }
      return await this.adapter.sendSms(params.to, message, {
        type: 'urgent_payment_reminder',
        loanId: params.loanId,
        installmentNumber: params.installmentNumber,
      });
    } catch (err: any) {
      console.warn(
        `[MultiChannelNotificationService] Error dispatching payment reminder alert:`,
        err?.message || err
      );
      return {
        success: false,
        channel,
        status: 'failed',
        to: params.to,
        error: err?.message || 'Error dispatching payment reminder alert',
      };
    }
  }

  /**
   * Generic high-priority alert dispatcher.
   */
  public async dispatchAlert(
    type: HighPriorityAlertType,
    params:
      | OtpSignatureAlertParams
      | LoanFundingCompletedAlertParams
      | UrgentPaymentReminderAlertParams,
    userProfile?: Partial<Profile>
  ): Promise<ChannelMessageResult> {
    switch (type) {
      case 'otp_signature':
        return this.sendOtpSignatureAlert(
          params as OtpSignatureAlertParams,
          userProfile
        );
      case 'loan_funding_completed':
        return this.sendLoanFundingCompletedAlert(
          params as LoanFundingCompletedAlertParams,
          userProfile
        );
      case 'urgent_payment_reminder':
        return this.sendUrgentPaymentReminderAlert(
          params as UrgentPaymentReminderAlertParams,
          userProfile
        );
      default:
        throw new Error(`Unknown high-priority alert type: ${type}`);
    }
  }
}
