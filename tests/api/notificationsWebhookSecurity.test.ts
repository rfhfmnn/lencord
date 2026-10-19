import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET, setWebhookChannelAdapter } from '@/app/api/webhooks/notifications/route';
import { MockChannelAdapter } from '@/services/notifications/channels';
import { computeHmacSignature } from '@/services/payments/crypto';

describe('Notifications Webhook Security & Verification (Issue #91 / SEC-06)', () => {
  let mockAdapter: MockChannelAdapter;
  const webhookSecret = 'test-notifications-webhook-secret';

  beforeEach(() => {
    mockAdapter = new MockChannelAdapter();
    setWebhookChannelAdapter(mockAdapter);
    process.env.NOTIFICATIONS_WEBHOOK_SECRET = webhookSecret;
    delete process.env.NEXT_PUBLIC_USE_MOCKS;
  });

  afterEach(() => {
    delete process.env.NOTIFICATIONS_WEBHOOK_SECRET;
    vi.restoreAllMocks();
  });

  it('rejects POST notifications webhook without signature with 401 Unauthorized', async () => {
    const payload = JSON.stringify({
      messageId: 'SM123456789',
      status: 'delivered',
      to: '+5491142538899',
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('rejects POST notifications webhook with invalid signature with 401 Unauthorized', async () => {
    const payload = JSON.stringify({
      messageId: 'SM123456789',
      status: 'delivered',
      to: '+5491142538899',
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': 'invalid-signature-hash',
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid webhook signature/i);
  });

  it('accepts POST notifications webhook with valid HMAC signature with 200 OK', async () => {
    const sendRes = await mockAdapter.sendSms('+5491142538899', 'Security webhook test');
    const payload = JSON.stringify({
      messageId: sendRes.messageId,
      status: 'delivered',
      to: '+5491142538899',
    });

    const signature = computeHmacSignature(payload, webhookSecret);

    const req = new NextRequest('http://localhost:3000/api/webhooks/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.record.status).toBe('delivered');
  });

  it('rejects unauthenticated GET requests to delivery stats with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/webhooks/notifications');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('allows authenticated administrator to access delivery stats via GET with 200 OK', async () => {
    const req = new NextRequest('http://localhost:3000/api/webhooks/notifications', {
      headers: {
        'x-user-id': 'admin-user-id',
        'x-user-role': 'admin',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.stats).toBeDefined();
    expect(body.deliveryRate).toBeDefined();
  });
});
