/**
 * Multi-Channel Notification Delivery Status Webhook Handler.
 * Tracks message delivery, failure, and optical bounce rates.
 * Conforms to Issue #50 and _docs/next_tasks.md Task 27.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  defaultMockChannelAdapter,
  TwilioChannelAdapter,
  type DeliveryStatusWebhookPayload,
} from '@/services/notifications/channels';

// In-memory global channel adapter instance for webhooks
let activeWebhookAdapter: TwilioChannelAdapter | typeof defaultMockChannelAdapter =
  process.env.NODE_ENV === 'test' || !process.env.TWILIO_ACCOUNT_SID
    ? defaultMockChannelAdapter
    : new TwilioChannelAdapter();

export function setWebhookChannelAdapter(adapter: any) {
  activeWebhookAdapter = adapter;
}

export function getWebhookChannelAdapter() {
  return activeWebhookAdapter;
}

/**
 * POST /api/webhooks/notifications
 * Processes incoming provider delivery status callbacks (Twilio SMS / WhatsApp).
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let payload: DeliveryStatusWebhookPayload;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const messageSid =
        formData.get('MessageSid')?.toString() ||
        formData.get('SmsSid')?.toString() ||
        '';
      const messageStatus =
        formData.get('MessageStatus')?.toString() ||
        formData.get('SmsStatus')?.toString() ||
        'unknown';
      const to = formData.get('To')?.toString() || '';
      const errorCode = formData.get('ErrorCode')?.toString();
      const errorMessage = formData.get('ErrorMessage')?.toString();
      const channel = to.startsWith('whatsapp:') ? 'whatsapp' : 'sms';

      payload = {
        messageId: messageSid,
        status: messageStatus,
        to,
        channel,
        errorCode,
        errorMessage,
        timestamp: new Date().toISOString(),
      };
    } else {
      const body = await req.json().catch(() => ({}));
      payload = {
        messageId:
          body.messageId ||
          body.MessageSid ||
          body.sid ||
          `SM_WEBHOOK_${Date.now()}`,
        status: body.status || body.MessageStatus || 'delivered',
        to: body.to || body.To || '',
        channel: body.channel || (body.to?.startsWith('whatsapp:') ? 'whatsapp' : 'sms'),
        errorCode: body.errorCode || body.ErrorCode,
        errorMessage: body.errorMessage || body.ErrorMessage,
        timestamp: body.timestamp || new Date().toISOString(),
        rawPayload: body,
      };
    }

    if (!payload.messageId) {
      return NextResponse.json(
        { error: 'Missing required messageId/MessageSid parameter' },
        { status: 400 }
      );
    }

    // Process delivery status record
    const record = await activeWebhookAdapter.handleDeliveryStatusWebhook(payload);
    const stats = activeWebhookAdapter.getDeliveryStats();

    return NextResponse.json({
      status: 'ok',
      record,
      stats,
    });
  } catch (err: any) {
    console.error('[Webhooks:Notifications] Error processing delivery status:', err);
    return NextResponse.json(
      { error: 'Internal server error processing notification webhook', details: err?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/notifications
 * Returns current delivery statistics, failure rates, and optical bounce rates.
 */
export async function GET() {
  const stats = activeWebhookAdapter.getDeliveryStats();
  const records = activeWebhookAdapter.getDeliveryRecords();

  return NextResponse.json({
    status: 'ok',
    stats,
    recordsCount: records.length,
    opticalBounceRate: `${stats.bounceRate}%`,
    deliveryRate: `${stats.deliveryRate}%`,
    failureRate: `${stats.failureRate}%`,
  });
}
