/**
 * Twilio Multi-Channel Notification Adapter for SMS & WhatsApp.
 * Supports provider payload generation, authentication, exponential backoff retry,
 * and graceful fallback on 5xx provider gateway failures.
 * Conforms to Issue #50 and _docs/next_tasks.md Task 27.
 */

import type {
  ChannelMessageResult,
  DeliveryStats,
  DeliveryStatus,
  DeliveryStatusRecord,
  DeliveryStatusWebhookPayload,
  MultiChannelAdapterInterface,
} from './types';
import { normalizeArgentinePhone } from './templates';

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  fromSms?: string;
  fromWhatsApp?: string;
  baseUrl?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

// Error codes known to represent optical bounces (carrier unreachable, handset off, invalid route)
export const TWILIO_OPTICAL_BOUNCE_CODES = new Set([
  '30003', // Unreachable destination handset
  '30005', // Unknown destination handset
  '30006', // Landline or unreachable carrier
  '30007', // Carrier violation / spam filter bounce
  '30008', // Unknown error / optical bounce
  '63003', // WhatsApp message rejected by destination
  '63005', // WhatsApp user opted out or not found
]);

export class TwilioChannelAdapter implements MultiChannelAdapterInterface {
  private accountSid: string;
  private authToken: string;
  private fromSms: string;
  private fromWhatsApp: string;
  private baseUrl: string;
  private maxRetries: number;
  private retryDelayMs: number;

  private deliveryRecords: Map<string, DeliveryStatusRecord> = new Map();

  constructor(config?: TwilioConfig) {
    this.accountSid =
      config?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? 'AC_MOCK_ACCOUNT_SID';
    this.authToken =
      config?.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? 'mock_auth_token';
    this.fromSms =
      config?.fromSms ?? process.env.TWILIO_FROM_SMS ?? '+15005550006';
    this.fromWhatsApp =
      config?.fromWhatsApp ?? process.env.TWILIO_FROM_WHATSAPP ?? '+14155238886';
    this.baseUrl =
      config?.baseUrl ?? process.env.TWILIO_BASE_URL ?? 'https://api.twilio.com';
    this.maxRetries = config?.maxRetries ?? 2;
    this.retryDelayMs = config?.retryDelayMs ?? 100;
  }

  /**
   * Generates standard Twilio URL-encoded form payload for SMS.
   */
  public generateSmsPayload(to: string, message: string): URLSearchParams {
    const normalizedTo = normalizeArgentinePhone(to);
    const params = new URLSearchParams();
    params.append('To', normalizedTo);
    params.append('From', this.fromSms);
    params.append('Body', message);
    return params;
  }

  /**
   * Generates standard Twilio URL-encoded form payload for WhatsApp.
   */
  public generateWhatsAppPayload(to: string, message: string): URLSearchParams {
    const normalizedTo = normalizeArgentinePhone(to);
    const toFormatted = normalizedTo.startsWith('whatsapp:')
      ? normalizedTo
      : `whatsapp:${normalizedTo}`;
    const fromFormatted = this.fromWhatsApp.startsWith('whatsapp:')
      ? this.fromWhatsApp
      : `whatsapp:${this.fromWhatsApp}`;

    const params = new URLSearchParams();
    params.append('To', toFormatted);
    params.append('From', fromFormatted);
    params.append('Body', message);
    return params;
  }

  /**
   * Sends an SMS message via provider API with retry and 5xx error fallback.
   */
  public async sendSms(
    to: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<ChannelMessageResult> {
    const payload = this.generateSmsPayload(to, message);
    return this.dispatchWithRetry('sms', to, payload, metadata);
  }

  /**
   * Sends a WhatsApp message via provider API with retry and 5xx error fallback.
   */
  public async sendWhatsApp(
    to: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<ChannelMessageResult> {
    const payload = this.generateWhatsAppPayload(to, message);
    return this.dispatchWithRetry('whatsapp', to, payload, metadata);
  }

  /**
   * Dispatches provider payload with exponential backoff and 5xx status fallback.
   */
  private async dispatchWithRetry(
    channel: 'sms' | 'whatsapp',
    recipient: string,
    payload: URLSearchParams,
    metadata?: Record<string, unknown>
  ): Promise<ChannelMessageResult> {
    const endpoint = `${this.baseUrl}/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const normalizedTo = normalizeArgentinePhone(recipient);

    // If credentials are dummy/mock and no live network requested, simulate safe sandbox dispatch
    if (
      this.accountSid.startsWith('AC_MOCK') &&
      !process.env.TWILIO_ACCOUNT_SID &&
      !this.baseUrl.includes('localhost') &&
      !this.baseUrl.includes('127.0.0.1')
    ) {
      const mockId = `SM_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const record: DeliveryStatusRecord = {
        id: mockId,
        messageId: mockId,
        channel,
        recipient: normalizedTo,
        status: 'queued',
        isOpticalBounce: false,
        updatedAt: new Date().toISOString(),
      };
      this.deliveryRecords.set(mockId, record);

      return {
        success: true,
        messageId: mockId,
        channel,
        status: 'queued',
        to: normalizedTo,
        statusCode: 201,
      };
    }

    const authHeader = `Basic ${Buffer.from(
      `${this.accountSid}:${this.authToken}`
    ).toString('base64')}`;

    let lastError: Error | null = null;
    let lastStatusCode = 500;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: payload.toString(),
        });

        lastStatusCode = response.status;

        if (response.ok) {
          const data = (await response.json().catch(() => ({}))) as any;
          const messageId =
            data.sid ??
            `SM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

          const status: DeliveryStatus = (data.status as DeliveryStatus) || 'queued';
          const record: DeliveryStatusRecord = {
            id: messageId,
            messageId,
            channel,
            recipient: normalizedTo,
            status,
            isOpticalBounce: false,
            updatedAt: new Date().toISOString(),
          };
          this.deliveryRecords.set(messageId, record);

          return {
            success: true,
            messageId,
            channel,
            status,
            to: normalizedTo,
            statusCode: response.status,
          };
        }

        // Check if 5xx server error (e.g. 500, 502, 503, 504)
        if (response.status >= 500) {
          const errorText = await response.text().catch(() => '');
          lastError = new Error(
            `Provider 5xx Server Error (${response.status}): ${errorText || 'Gateway error'}`
          );

          // If retries remain, back off and retry
          if (attempt < this.maxRetries) {
            const delay = this.retryDelayMs * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // 4xx client or parameter error - do not retry
          const errorData = (await response.json().catch(() => ({}))) as any;
          const errorMsg =
            errorData.message ||
            `Provider rejected request with status ${response.status}`;
          return {
            success: false,
            channel,
            status: 'failed',
            to: normalizedTo,
            error: errorMsg,
            statusCode: response.status,
          };
        }
      } catch (err: any) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // Graceful 5xx error fallback: do not throw or crash; return structured failure payload
    console.warn(
      `[TwilioChannelAdapter] Graceful fallback on provider 5xx failure:`,
      lastError?.message
    );

    return {
      success: false,
      channel,
      status: 'failed',
      to: normalizedTo,
      error:
        lastError?.message ||
        `Provider 5xx failure after ${this.maxRetries} retries`,
      statusCode: lastStatusCode,
    };
  }

  /**
   * Handles incoming delivery status webhook from provider.
   */
  public async handleDeliveryStatusWebhook(
    payload: DeliveryStatusWebhookPayload
  ): Promise<DeliveryStatusRecord> {
    const messageId = payload.messageId;
    const rawStatus = (payload.status || 'unknown').toLowerCase();
    const errorCode = payload.errorCode ? String(payload.errorCode) : undefined;

    let normalizedStatus: DeliveryStatus = 'sent';
    let isOpticalBounce = false;

    if (rawStatus === 'delivered') {
      normalizedStatus = 'delivered';
    } else if (rawStatus === 'undelivered' || rawStatus === 'failed') {
      normalizedStatus = 'undelivered';
      // Identify optical bounce based on error codes or carrier rejection
      if (errorCode && TWILIO_OPTICAL_BOUNCE_CODES.has(errorCode)) {
        normalizedStatus = 'bounced';
        isOpticalBounce = true;
      }
    } else if (rawStatus === 'bounced') {
      normalizedStatus = 'bounced';
      isOpticalBounce = true;
    } else if (rawStatus === 'queued') {
      normalizedStatus = 'queued';
    } else {
      normalizedStatus = 'sent';
    }

    const channel: 'sms' | 'whatsapp' =
      payload.channel === 'whatsapp' ||
      (payload.to && payload.to.startsWith('whatsapp:'))
        ? 'whatsapp'
        : 'sms';

    const existing = this.deliveryRecords.get(messageId);
    const updatedRecord: DeliveryStatusRecord = {
      id: messageId,
      messageId,
      channel: existing?.channel ?? channel,
      recipient: existing?.recipient ?? payload.to ?? '',
      status: normalizedStatus,
      errorCode,
      errorMessage: payload.errorMessage,
      isOpticalBounce,
      updatedAt: new Date().toISOString(),
    };

    this.deliveryRecords.set(messageId, updatedRecord);
    return updatedRecord;
  }

  /**
   * Calculates aggregate delivery, failure, and optical bounce rates.
   */
  public getDeliveryStats(): DeliveryStats {
    const records = Array.from(this.deliveryRecords.values());
    const total = records.length;
    if (total === 0) {
      return {
        total: 0,
        delivered: 0,
        failed: 0,
        bounced: 0,
        pending: 0,
        deliveryRate: 100,
        failureRate: 0,
        bounceRate: 0,
      };
    }

    const delivered = records.filter((r) => r.status === 'delivered').length;
    const bounced = records.filter((r) => r.status === 'bounced').length;
    const failed = records.filter(
      (r) => r.status === 'failed' || r.status === 'undelivered'
    ).length;
    const pending = records.filter(
      (r) => r.status === 'queued' || r.status === 'sent'
    ).length;

    const deliveryRate = Number(((delivered / total) * 100).toFixed(2));
    const bounceRate = Number(((bounced / total) * 100).toFixed(2));
    const failureRate = Number(((failed / total) * 100).toFixed(2));

    return {
      total,
      delivered,
      failed,
      bounced,
      pending,
      deliveryRate,
      failureRate,
      bounceRate,
    };
  }

  public getDeliveryRecords(): DeliveryStatusRecord[] {
    return Array.from(this.deliveryRecords.values());
  }

  public clear(): void {
    this.deliveryRecords.clear();
  }
}
