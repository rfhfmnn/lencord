/**
 * Multi-Channel Notification Service for Lencord.
 * Coordinates high-priority SMS & WhatsApp alert triggers and enforces user notification preferences.
 * Conforms to Issue #50 and _docs/next_tasks.md Task 27.
 */

import type {
  EmailServiceInterface,
  NotificationPreferences,
  NotificationServiceInterface,
  NotificationType,
  Profile,
} from '@/types';
import type {
  ChannelMessageResult,
  ChannelType,
  HighPriorityAlertType,
  LoanFundingCompletedAlertParams,
  MultiChannelAdapterInterface,
  MultiChannelNotificationServiceInterface,
  OtpSignatureAlertParams,
  UrgentPaymentReminderAlertParams,
  NotifyNewInvestmentParams,
  NotifyLoanFundingCompletedParams,
  NotifyPromissoryNoteSignedParams,
  NotifyInstallmentPayoutParams,
  NotifyUpcomingInstallmentReminderParams,
} from './types';
import {
  renderLoanFundingCompletedSms,
  renderLoanFundingCompletedWhatsApp,
  renderOtpSignatureSms,
  renderOtpSignatureWhatsApp,
  renderUrgentPaymentReminderSms,
  renderUrgentPaymentReminderWhatsApp,
} from './templates';
import { defaultMockStateStore } from '@/services/mock/mockState';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: true,
  whatsapp: true,
};

export class MultiChannelNotificationService
  implements MultiChannelNotificationServiceInterface
{
  public adapter: MultiChannelAdapterInterface;
  public notificationsService?: NotificationServiceInterface;
  public emailService?: EmailServiceInterface;
  private userPreferencesStore: Map<string, NotificationPreferences> = new Map();

  constructor(
    adapter: MultiChannelAdapterInterface,
    notificationsService?: NotificationServiceInterface,
    emailService?: EmailServiceInterface
  ) {
    this.adapter = adapter;
    this.notificationsService = notificationsService;
    this.emailService = emailService;
  }

  public setNotificationsService(service: NotificationServiceInterface): void {
    this.notificationsService = service;
  }

  public setEmailService(service: EmailServiceInterface): void {
    this.emailService = service;
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

  /**
   * Helper to insert in-app notification reliably.
   * Tolerates missing service by falling back to mock store or logging error safely.
   */
  private async createInAppNotification(input: {
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    action_url: string;
  }): Promise<void> {
    try {
      if (this.notificationsService?.createNotification) {
        await this.notificationsService.createNotification(input);
        return;
      }
      if (typeof defaultMockStateStore !== 'undefined' && defaultMockStateStore.notifications) {
        defaultMockStateStore.notifications.unshift({
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: input.user_id,
          title: input.title,
          message: input.message,
          type: input.type,
          read: false,
          action_url: input.action_url,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn('[MultiChannelNotificationService] Error creating in-app notification:', err?.message || err);
    }
  }

  /**
   * Event 1: Nueva Inversión en Subasta (Notifica a la PyME)
   */
  public async notifyNewInvestmentReceived(params: NotifyNewInvestmentParams): Promise<void> {
    const funded = params.loan.amount_funded;
    const requested = params.loan.amount_requested;
    const percentage = requested > 0 ? (funded / requested) * 100 : 0;
    const formattedAmount = Number(params.investment.amount || 0).toLocaleString('es-AR');

    // 1. In-app notification for PyME borrower
    await this.createInAppNotification({
      user_id: params.loan.borrower_id,
      type: 'info',
      title: 'Nuevo aporte de inversión recibido',
      action_url: '/dashboard/pyme',
      message: `Se ha registrado una inversión por $${formattedAmount} (${percentage.toFixed(1)}% financiado).`,
    });

    // 2. Transactional email for PyME borrower (non-blocking)
    if (params.borrower?.email && this.emailService?.sendNewInvestmentReceivedEmail) {
      try {
        await this.emailService.sendNewInvestmentReceivedEmail({
          to: params.borrower.email,
          recipientName: params.borrower.legal_name || 'Titular PyME',
          loanId: params.loan.id,
          amount: params.investment.amount,
          amountFunded: funded,
          amountRequested: requested,
          percentage,
        });
      } catch (emailErr: any) {
        console.warn('[MultiChannelNotificationService] Failed to dispatch investment received email:', emailErr?.message || emailErr);
      }
    }
  }

  /**
   * Event 2: Subasta 100% financiada (Notifica a la PyME y a todos los inversores participantes)
   */
  public async notifyLoanFundingCompleted(params: NotifyLoanFundingCompletedParams): Promise<void> {
    const formattedAmount = Number(params.loan.amount_requested || 0).toLocaleString('es-AR');

    // 1. In-app notification for PyME borrower
    await this.createInAppNotification({
      user_id: params.loan.borrower_id,
      type: 'success',
      title: '¡Subasta 100% financiada! Pagaré listo para firma',
      action_url: '/dashboard/pyme',
      message: `¡Felicitaciones! Tu solicitud fue 100% financiada. Ya podés ingresar a firmar el pagaré digital para la liberación y desembolso de los fondos.`,
    });

    // 2. Email for PyME borrower (non-blocking)
    if (params.borrower?.email && this.emailService?.sendLoanFundingCompletedBorrowerEmail) {
      try {
        await this.emailService.sendLoanFundingCompletedBorrowerEmail({
          to: params.borrower.email,
          recipientName: params.borrower.legal_name || 'Titular PyME',
          loanId: params.loan.id,
          amount: params.loan.amount_requested,
        });
      } catch (err: any) {
        console.warn('[MultiChannelNotificationService] Failed to dispatch loan funding completed borrower email:', err?.message || err);
      }
    }

    // 3. Deduplicate investors
    const seenInvestorIds = new Set<string>();
    const uniqueInvestors = params.investors.filter((inv) => {
      const id = inv.profile?.id;
      if (!id || seenInvestorIds.has(id)) return false;
      seenInvestorIds.add(id);
      return true;
    });

    // 4. Notifications for each participating investor (Promise.allSettled)
    await Promise.allSettled(
      uniqueInvestors.map(async (inv) => {
        const invId = inv.profile.id!;
        const invName = inv.profile.legal_name || 'Inversor';

        await this.createInAppNotification({
          user_id: invId,
          type: 'success',
          title: 'Subasta finalizada con éxito',
          action_url: '/dashboard/inversor',
          message: `La subasta del préstamo ${params.loan.id} alcanzó el 100% de su objetivo. Te notificaremos cuando la PyME firme el pagaré.`,
        });

        if (inv.profile.email && this.emailService?.sendLoanFundingCompletedInvestorEmail) {
          try {
            await this.emailService.sendLoanFundingCompletedInvestorEmail({
              to: inv.profile.email,
              recipientName: invName,
              loanId: params.loan.id,
              borrowerName: params.borrower.legal_name || 'la PyME',
              amountInvested: inv.amount ?? 0,
            });
          } catch (err: any) {
            console.warn(`[MultiChannelNotificationService] Failed to dispatch investor completion email to ${invId}:`, err?.message || err);
          }
        }
      })
    );
  }

  /**
   * Event 3: Pagaré firmado y crédito activado (Notifica a los inversores participantes)
   */
  public async notifyPromissoryNoteSignedAndActivated(params: NotifyPromissoryNoteSignedParams): Promise<void> {
    const borrowerName = params.borrower?.legal_name || 'la PyME';
    const formattedAmount = Number(params.loan.amount_requested || 0).toLocaleString('es-AR');

    // 1. In-app notification for PyME borrower
    await this.createInAppNotification({
      user_id: params.loan.borrower_id,
      type: 'success',
      title: 'Pagaré firmado: fondos desembolsados',
      action_url: '/dashboard/pyme',
      message: `Has firmado exitosamente el pagaré digital por $${formattedAmount}. Los fondos fueron transferidos a tu cuenta bancaria y el crédito comenzó a devengar cuotas.`,
    });

    // Deduplicate investors
    const seenInvestorIds = new Set<string>();
    const uniqueInvestors = params.investors.filter((inv) => {
      const id = inv.profile?.id;
      if (!id || seenInvestorIds.has(id)) return false;
      seenInvestorIds.add(id);
      return true;
    });

    await Promise.allSettled(
      uniqueInvestors.map(async (inv) => {
        const invId = inv.profile.id!;
        const invName = inv.profile.legal_name || 'Inversor';

        await this.createInAppNotification({
          user_id: invId,
          type: 'success',
          title: 'Pagaré firmado: fondos desembolsados',
          action_url: '/dashboard/inversor',
          message: `La PyME ${borrowerName} ha firmado el pagaré digital. Los fondos fueron transferidos y el préstamo ${params.loan.id} ya se encuentra activo devengando intereses.`,
        });

        if (inv.profile.email && this.emailService?.sendPromissoryNoteSignedInvestorEmail) {
          try {
            await this.emailService.sendPromissoryNoteSignedInvestorEmail({
              to: inv.profile.email,
              recipientName: invName,
              loanId: params.loan.id,
              borrowerName,
              amountInvested: inv.amount ?? 0,
            });
          } catch (err: any) {
            console.warn(`[MultiChannelNotificationService] Failed to dispatch note signed email to ${invId}:`, err?.message || err);
          }
        }
      })
    );
  }

  /**
   * Event 4: Cobro y acreditación de cuota mensual (Notifica a los inversores beneficiarios)
   */
  public async notifyInstallmentPayoutCredited(params: NotifyInstallmentPayoutParams): Promise<void> {
    const borrowerName = params.borrower?.legal_name || 'la PyME';

    await Promise.allSettled(
      params.payouts.map(async (p) => {
        const invId = p.investor.id!;
        const invName = p.investor.legal_name || 'Inversor';
        const formattedTotal = Number(p.totalShare || 0).toLocaleString('es-AR');

        await this.createInAppNotification({
          user_id: invId,
          type: 'success',
          title: 'Acreditación de cuota recibida',
          action_url: '/dashboard/inversor',
          message: `Se acreditó $${formattedTotal} en tu saldo en custodia por la cuota #${params.installment.installment_number} de ${borrowerName}.`,
        });

        if (p.investor.email && this.emailService?.sendInstallmentPayoutCreditedEmail) {
          try {
            await this.emailService.sendInstallmentPayoutCreditedEmail({
              to: p.investor.email,
              recipientName: invName,
              loanId: params.loan.id,
              installmentNumber: params.installment.installment_number,
              principalShare: p.principalShare,
              interestShare: p.interestShare,
              totalShare: p.totalShare,
            });
          } catch (err: any) {
            console.warn(`[MultiChannelNotificationService] Failed to dispatch payout email to ${invId}:`, err?.message || err);
          }
        }
      })
    );
  }

  /**
   * Event 5: Alerta de vencimiento próximo de cuota (3 días antes) (Notifica a la PyME)
   */
  public async notifyUpcomingInstallmentReminder(params: NotifyUpcomingInstallmentReminderParams): Promise<void> {
    const totalAmount =
      params.installment.principal_amount + (params.installment.interest_borrower ?? 0);
    const formattedAmount = Number(totalAmount || 0).toLocaleString('es-AR');

    await this.createInAppNotification({
      user_id: params.loan.borrower_id,
      type: 'warning',
      title: 'Próximo vencimiento de cuota',
      action_url: '/dashboard/pyme',
      message: `Tu cuota #${params.installment.installment_number} por $${formattedAmount} vence el ${params.installment.due_date}. Asegurate de contar con fondos en tu cuenta vinculada.`,
    });

    if (params.borrower?.email && this.emailService?.sendInstallmentReminderEmail) {
      try {
        await this.emailService.sendInstallmentReminderEmail({
          to: params.borrower.email,
          recipientName: params.borrower.legal_name || 'Titular PyME',
          loanId: params.loan.id,
          installmentNumber: params.installment.installment_number,
          amount: totalAmount,
          dueDate: params.installment.due_date,
        });
      } catch (err: any) {
        console.warn('[MultiChannelNotificationService] Failed to dispatch upcoming installment reminder email:', err?.message || err);
      }
    }
  }
}
