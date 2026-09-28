/**
 * Test Suite for SMS and WhatsApp Multi-Channel Notification Integration.
 * Conforms to Issue #50 and _docs/next_tasks.md Task 27.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import {
  TwilioChannelAdapter,
  MockChannelAdapter,
  MultiChannelNotificationService,
  renderOtpSignatureSms,
  renderOtpSignatureWhatsApp,
  renderLoanFundingCompletedSms,
  renderLoanFundingCompletedWhatsApp,
  renderUrgentPaymentReminderSms,
  renderUrgentPaymentReminderWhatsApp,
  normalizeArgentinePhone,
  type DeliveryStatusWebhookPayload,
} from '@/services/notifications/channels';
import { POST, GET, setWebhookChannelAdapter } from '@/app/api/webhooks/notifications/route';
import { NotificationPreferencesCard } from '@/components/dashboard/NotificationPreferencesCard';
import type { Profile } from '@/types';

describe('SMS and WhatsApp Multi-Channel Notification Integration (Issue #50)', () => {
  let mockAdapter: MockChannelAdapter;
  let service: MultiChannelNotificationService;

  beforeEach(() => {
    mockAdapter = new MockChannelAdapter();
    service = new MultiChannelNotificationService(mockAdapter);
    setWebhookChannelAdapter(mockAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Adapter & Provider Payload Generation
  // ---------------------------------------------------------------------------
  describe('Multi-Channel Notification Adapter & Provider API Payload Generation', () => {
    it('normalizes Argentine phone numbers to E.164 international format', () => {
      expect(normalizeArgentinePhone('1142538899')).toBe('+5491142538899');
      expect(normalizeArgentinePhone('+54 11 4253-8899')).toBe('+5491142538899');
      expect(normalizeArgentinePhone('+5491142538899')).toBe('+5491142538899');
      expect(normalizeArgentinePhone('01142538899')).toBe('+5491142538899');
    });

    it('generates exact provider URL-encoded payload for SMS dispatch', () => {
      const adapter = new TwilioChannelAdapter({
        accountSid: 'AC_TEST_123',
        authToken: 'secret_token',
        fromSms: '+15005550006',
      });

      const payload = adapter.generateSmsPayload('1142538899', 'Código OTP: 654321');

      expect(payload.get('To')).toBe('+5491142538899');
      expect(payload.get('From')).toBe('+15005550006');
      expect(payload.get('Body')).toBe('Código OTP: 654321');
    });

    it('generates exact provider URL-encoded payload for WhatsApp dispatch with prefix', () => {
      const adapter = new TwilioChannelAdapter({
        accountSid: 'AC_TEST_123',
        authToken: 'secret_token',
        fromWhatsApp: '+14155238886',
      });

      const payload = adapter.generateWhatsAppPayload(
        '1142538899',
        '*Lencord* - Su préstamo fue aprobado'
      );

      expect(payload.get('To')).toBe('whatsapp:+5491142538899');
      expect(payload.get('From')).toBe('whatsapp:+14155238886');
      expect(payload.get('Body')).toBe('*Lencord* - Su préstamo fue aprobado');
    });

    it('dispatches SMS and WhatsApp messages successfully via mock adapter', async () => {
      const smsRes = await mockAdapter.sendSms('1142538899', 'Mensaje SMS de prueba');
      expect(smsRes.success).toBe(true);
      expect(smsRes.channel).toBe('sms');
      expect(smsRes.messageId).toMatch(/^SM_/);
      expect(mockAdapter.getSentSms()).toHaveLength(1);

      const waRes = await mockAdapter.sendWhatsApp('1142538899', 'Mensaje WhatsApp de prueba');
      expect(waRes.success).toBe(true);
      expect(waRes.channel).toBe('whatsapp');
      expect(waRes.messageId).toMatch(/^WA_/);
      expect(mockAdapter.getSentWhatsApp()).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Error Fallback when Provider Returns 5xx Status
  // ---------------------------------------------------------------------------
  describe('Provider 5xx Error Fallback & Resilience', () => {
    it('gracefully handles provider HTTP 503 Service Unavailable without throwing unhandled exceptions', async () => {
      const adapter = new TwilioChannelAdapter({
        accountSid: 'AC_LIVE_TEST',
        authToken: 'token_live',
        baseUrl: 'https://api.twilio.test',
        maxRetries: 1,
        retryDelayMs: 10,
      });

      // Mock global fetch to return HTTP 503
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Service Unavailable at upstream carrier gateway', {
          status: 503,
          statusText: 'Service Unavailable',
        })
      );

      const result = await adapter.sendSms('+5491142538899', 'Alerta urgente');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(503);
      expect(result.error).toContain('503');
    });

    it('gracefully handles provider HTTP 500 Internal Server Error via MockChannelAdapter simulation', async () => {
      mockAdapter.setSimulate5xxFailure(true, 500, 'Internal Server Error (500) upstream');

      const result = await service.sendOtpSignatureAlert({
        to: '+5491142538899',
        recipientName: 'Metalúrgica Quilmes',
        otpCode: '998877',
        loanId: 'loan-101',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('500');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. High-Priority Alert Triggers
  // ---------------------------------------------------------------------------
  describe('High-Priority Operational and Security Alert Triggers', () => {
    it('dispatches instant OTP signature request alert with security code and expiry', async () => {
      const alertParams = {
        to: '+5491142538899',
        recipientName: 'Metalúrgica Quilmes S.R.L.',
        otpCode: '849201',
        loanId: 'loan-777',
        amount: 2500000,
        expiresInMinutes: 10,
      };

      const result = await service.sendOtpSignatureAlert(alertParams);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
      const lastMsg = mockAdapter.getLastMessage();
      expect(lastMsg?.message).toContain('849201');
      expect(lastMsg?.message).toContain('loan-777');
      expect(lastMsg?.message).toContain('10 min');
    });

    it('dispatches instant Loan Funding Completion alert when 100% capacity is reached', async () => {
      const alertParams = {
        to: '+5491142538899',
        recipientName: 'Alimentos del Valle SAS',
        loanId: 'loan-888',
        amount: 5000000,
        channel: 'whatsapp' as const,
      };

      const result = await service.sendLoanFundingCompletedAlert(alertParams);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('whatsapp');
      const lastMsg = mockAdapter.getLastMessage();
      expect(lastMsg?.channel).toBe('whatsapp');
      expect(lastMsg?.message).toContain('100%');
      expect(lastMsg?.message).toContain('loan-888');
      expect(lastMsg?.message).toContain('Alimentos del Valle SAS');
    });

    it('dispatches instant Urgent Payment Reminder alert for upcoming installment', async () => {
      const alertParams = {
        to: '+5491142538899',
        recipientName: 'Distribuidora San Telmo',
        loanId: 'loan-999',
        installmentNumber: 2,
        amount: 350000,
        dueDate: '2026-10-15',
        daysRemaining: 1,
      };

      const result = await service.sendUrgentPaymentReminderAlert(alertParams);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
      const lastMsg = mockAdapter.getLastMessage();
      expect(lastMsg?.message).toContain('cuota #2');
      expect(lastMsg?.message).toContain('loan-999');
      expect(lastMsg?.message).toContain('vence en 1 dias');
    });

    it('renders templates properly with Argentine currency formatting and sentence case', () => {
      const sms = renderLoanFundingCompletedSms({
        to: '+549114000000',
        recipientName: 'PyME Test',
        loanId: 'loan-1',
        amount: 1000000,
      });
      expect(sms).toContain('$');
      expect(sms).toContain('100%');

      const wa = renderUrgentPaymentReminderWhatsApp({
        to: '+549114000000',
        recipientName: 'PyME Test',
        loanId: 'loan-1',
        installmentNumber: 1,
        amount: 50000,
        dueDate: '2026-10-20',
        daysRemaining: 0,
      });
      expect(wa).toContain('VENCIMIENTO HOY');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Delivery Status Webhooks & Optical Bounce Tracking
  // ---------------------------------------------------------------------------
  describe('Delivery Status Webhooks and Optical Bounce Rate Tracking', () => {
    it('records delivered messages and updates delivery rate metric', async () => {
      const sendRes = await mockAdapter.sendSms('+5491142538899', 'Test message');
      const messageId = sendRes.messageId!;

      const webhookPayload: DeliveryStatusWebhookPayload = {
        messageId,
        status: 'delivered',
        to: '+5491142538899',
      };

      const record = await mockAdapter.handleDeliveryStatusWebhook(webhookPayload);
      expect(record.status).toBe('delivered');
      expect(record.isOpticalBounce).toBe(false);

      const stats = mockAdapter.getDeliveryStats();
      expect(stats.total).toBe(1);
      expect(stats.delivered).toBe(1);
      expect(stats.deliveryRate).toBe(100);
      expect(stats.bounceRate).toBe(0);
    });

    it('identifies optical bounces and calculates bounce rate correctly', async () => {
      // 1 successful delivery
      const msg1 = await mockAdapter.sendSms('+5491142538899', 'Msg 1');
      await mockAdapter.handleDeliveryStatusWebhook({
        messageId: msg1.messageId!,
        status: 'delivered',
      });

      // 1 optical bounce (unreachable handset, code 30003)
      const msg2 = await mockAdapter.sendSms('+549119999999', 'Msg 2');
      const record2 = await mockAdapter.handleDeliveryStatusWebhook({
        messageId: msg2.messageId!,
        status: 'undelivered',
        errorCode: '30003',
        errorMessage: 'Destination handset unreachable / out of coverage',
      });

      expect(record2.status).toBe('bounced');
      expect(record2.isOpticalBounce).toBe(true);

      const stats = mockAdapter.getDeliveryStats();
      expect(stats.total).toBe(2);
      expect(stats.delivered).toBe(1);
      expect(stats.bounced).toBe(1);
      expect(stats.deliveryRate).toBe(50);
      expect(stats.bounceRate).toBe(50);
    });

    it('processes webhook requests via HTTP POST /api/webhooks/notifications', async () => {
      const sendRes = await mockAdapter.sendSms('+5491142538899', 'Webhook API test');

      const req = new NextRequest('http://localhost:3000/api/webhooks/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: sendRes.messageId,
          status: 'delivered',
          to: '+5491142538899',
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.status).toBe('ok');
      expect(data.record.status).toBe('delivered');
      expect(data.stats.delivered).toBeGreaterThanOrEqual(1);
    });

    it('returns delivery statistics via HTTP GET /api/webhooks/notifications', async () => {
      const response = await GET();
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.status).toBe('ok');
      expect(data.stats).toBeDefined();
      expect(data.opticalBounceRate).toBeDefined();
      expect(data.deliveryRate).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. User Notification Preferences: Independent Toggling
  // ---------------------------------------------------------------------------
  describe('User Notification Preference Settings & Channel Toggling', () => {
    const userProfileWithDisabledSms: Partial<Profile> = {
      id: 'prof-user-1',
      legal_name: 'PyME Ejemplo',
      phone: '+5491142538899',
      notification_preferences: {
        email: true,
        sms: false,
        whatsapp: true,
      },
    };

    it('allows toggling SMS independently from email and respects disabled SMS preference', async () => {
      expect(service.checkUserPreference(userProfileWithDisabledSms, 'sms')).toBe(false);
      expect(service.checkUserPreference(userProfileWithDisabledSms, 'whatsapp')).toBe(true);

      const result = await service.sendOtpSignatureAlert(
        {
          to: '+5491142538899',
          recipientName: 'PyME Ejemplo',
          otpCode: '112233',
          loanId: 'loan-555',
          channel: 'sms',
        },
        userProfileWithDisabledSms
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('User has disabled SMS');
      expect(mockAdapter.getSentSms()).toHaveLength(0);
    });

    it('allows WhatsApp dispatch even when SMS is disabled', async () => {
      const result = await service.sendLoanFundingCompletedAlert(
        {
          to: '+5491142538899',
          recipientName: 'PyME Ejemplo',
          loanId: 'loan-555',
          amount: 1000000,
          channel: 'whatsapp',
        },
        userProfileWithDisabledSms
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('whatsapp');
      expect(mockAdapter.getSentWhatsApp()).toHaveLength(1);
    });

    it('updates user notification preferences in service store', async () => {
      const updated = await service.updateUserPreferences('prof-user-1', {
        sms: true,
        whatsapp: false,
      });

      expect(updated.sms).toBe(true);
      expect(updated.whatsapp).toBe(false);
      expect(updated.email).toBe(true);

      expect(
        service.checkUserPreference({ id: 'prof-user-1' } as Partial<Profile>, 'sms')
      ).toBe(true);
      expect(
        service.checkUserPreference({ id: 'prof-user-1' } as Partial<Profile>, 'whatsapp')
      ).toBe(false);
    });

    it('renders NotificationPreferencesCard and toggles channels independently in UI', () => {
      const onSaveMock = vi.fn();

      render(
        <NotificationPreferencesCard
          userId="prof-user-1"
          initialPreferences={{ email: true, sms: false, whatsapp: true }}
          onSave={onSaveMock}
        />
      );

      const emailCheckbox = screen.getByTestId('pref-email-checkbox') as HTMLInputElement;
      const smsCheckbox = screen.getByTestId('pref-sms-checkbox') as HTMLInputElement;
      const waCheckbox = screen.getByTestId('pref-whatsapp-checkbox') as HTMLInputElement;

      expect(emailCheckbox.checked).toBe(true);
      expect(smsCheckbox.checked).toBe(false);
      expect(waCheckbox.checked).toBe(true);

      // Toggle SMS to enabled
      fireEvent.click(smsCheckbox);
      expect(smsCheckbox.checked).toBe(true);
      // Verify email and whatsapp remained unchanged
      expect(emailCheckbox.checked).toBe(true);
      expect(waCheckbox.checked).toBe(true);

      // Save preferences
      const saveBtn = screen.getByTestId('btn-save-notification-preferences');
      fireEvent.click(saveBtn);

      expect(onSaveMock).toHaveBeenCalledWith({
        email: true,
        sms: true,
        whatsapp: true,
      });
    });
  });
});
