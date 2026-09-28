/**
 * In-memory Mock Channel Adapter for SMS & WhatsApp Testing.
 * Conforms to MultiChannelAdapterInterface and Issue #50.
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
import { TWILIO_OPTICAL_BOUNCE_CODES } from './TwilioChannelAdapter';

export interface SentChannelMessage {
  id: string;
  channel: 'sms' | 'whatsapp';
  to: string;
  message: string;
  status: DeliveryStatus;
  sentAt: string;
  metadata?: Record<string, unknown>;
}

export class MockChannelAdapter implements MultiChannelAdapterInterface {
  private sentMessages: SentChannelMessage[] = [];
  private deliveryRecords: Map<string, DeliveryStatusRecord> = new Map();

  private simulate5xx = false;
  private simulate5xxCode = 503;
  private simulate5xxMessage = 'Mock Service Unavailable (503)';

  public setSimulate5xxFailure(
    enable: boolean,
    code = 503,
    message = 'Mock Service Unavailable (503)'
  ): void {
    this.simulate5xx = enable;
    this.simulate5xxCode = code;
    this.simulate5xxMessage = message;
  }

  public getSentMessages(): SentChannelMessage[] {
    return [...this.sentMessages];
  }

  public getSentSms(): SentChannelMessage[] {
    return this.sentMessages.filter((m) => m.channel === 'sms');
  }

  public getSentWhatsApp(): SentChannelMessage[] {
    return this.sentMessages.filter((m) => m.channel === 'whatsapp');
  }

  public getLastMessage(): SentChannelMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  public clear(): void {
    this.sentMessages = [];
    this.deliveryRecords.clear();
    this.simulate5xx = false;
  }

  public async sendSms(
    to: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<ChannelMessageResult> {
    const normalizedTo = normalizeArgentinePhone(to);

    if (this.simulate5xx) {
      console.warn(
        `[MockChannelAdapter] Simulated 5xx provider error: ${this.simulate5xxMessage}`
      );
      return {
        success: false,
        channel: 'sms',
        status: 'failed',
        to: normalizedTo,
        error: this.simulate5xxMessage,
        statusCode: this.simulate5xxCode,
      };
    }

    const messageId = `SM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: SentChannelMessage = {
      id: messageId,
      channel: 'sms',
      to: normalizedTo,
      message,
      status: 'queued',
      sentAt: new Date().toISOString(),
      metadata,
    };
    this.sentMessages.push(record);

    const deliveryRecord: DeliveryStatusRecord = {
      id: messageId,
      messageId,
      channel: 'sms',
      recipient: normalizedTo,
      status: 'queued',
      isOpticalBounce: false,
      updatedAt: new Date().toISOString(),
    };
    this.deliveryRecords.set(messageId, deliveryRecord);

    return {
      success: true,
      messageId,
      channel: 'sms',
      status: 'queued',
      to: normalizedTo,
      statusCode: 201,
    };
  }

  public async sendWhatsApp(
    to: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<ChannelMessageResult> {
    const normalizedTo = normalizeArgentinePhone(to);

    if (this.simulate5xx) {
      console.warn(
        `[MockChannelAdapter] Simulated 5xx provider error: ${this.simulate5xxMessage}`
      );
      return {
        success: false,
        channel: 'whatsapp',
        status: 'failed',
        to: normalizedTo,
        error: this.simulate5xxMessage,
        statusCode: this.simulate5xxCode,
      };
    }

    const messageId = `WA_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: SentChannelMessage = {
      id: messageId,
      channel: 'whatsapp',
      to: normalizedTo,
      message,
      status: 'queued',
      sentAt: new Date().toISOString(),
      metadata,
    };
    this.sentMessages.push(record);

    const deliveryRecord: DeliveryStatusRecord = {
      id: messageId,
      messageId,
      channel: 'whatsapp',
      recipient: normalizedTo,
      status: 'queued',
      isOpticalBounce: false,
      updatedAt: new Date().toISOString(),
    };
    this.deliveryRecords.set(messageId, deliveryRecord);

    return {
      success: true,
      messageId,
      channel: 'whatsapp',
      status: 'queued',
      to: normalizedTo,
      statusCode: 201,
    };
  }

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

    // Update in sentMessages list too
    const sent = this.sentMessages.find((m) => m.id === messageId);
    if (sent) {
      sent.status = normalizedStatus;
    }

    return updatedRecord;
  }

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
}

export const defaultMockChannelAdapter = new MockChannelAdapter();
