import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, clearProcessedWebhookEvents } from '@/app/api/webhooks/payments/route';
import { computeHmacSignature } from '@/services/payments/crypto';
import { BaaSPaymentGateway } from '@/services/payments/BaaSPaymentGateway';
import { defaultMockStateStore } from '@/services/mock/mockState';

describe('BaaS Payment Gateway and Webhook Handler (Issue #21)', () => {
  const secret = 'test-webhook-secret';

  beforeEach(() => {
    clearProcessedWebhookEvents();
    process.env.BAAS_WEBHOOK_SECRET = secret;
  });

  describe('BaaSPaymentGateway Adapter', () => {
    it('implements PaymentGatewayInterface methods', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/holds') && !url.includes('/release')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ holdId: 'hold-baas-1' }),
          });
        }
        if (url.includes('/release')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/transfers')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ transferId: 'tr-baas-1' }),
          });
        }
        if (url.includes('/debits')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ paymentId: 'pay-baas-1', status: 'settled' }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const gateway = new BaaSPaymentGateway({ customFetch: mockFetch as any });

      const holdResult = await gateway.holdFunds('inv-1', 100_000, 'loan-1');
      expect(holdResult.success).toBe(true);
      expect(holdResult.holdId).toBe('hold-baas-1');

      const releaseResult = await gateway.releaseFunds('hold-baas-1');
      expect(releaseResult.success).toBe(true);

      const disburseResult = await gateway.disburseLoan(
        'loan-1',
        '0000003100010000000001',
        5_000_000
      );
      expect(disburseResult.success).toBe(true);
      expect(disburseResult.transferId).toBe('tr-baas-1');

      const debitResult = await gateway.collectInstallment(
        'inst-1',
        '0000003100010000000001',
        250_000
      );
      expect(debitResult.status).toBe('settled');
      expect(debitResult.paymentId).toBe('pay-baas-1');
    });
  });

  describe('POST /api/webhooks/payments Route Handler', () => {
    function createSignedRequest(body: any, customSignature?: string) {
      const bodyString = JSON.stringify(body);
      const signature = customSignature ?? computeHmacSignature(bodyString, secret);

      return new NextRequest('http://localhost:3000/api/webhooks/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
        },
        body: bodyString,
      });
    }

    it('rejects requests with missing or invalid signature with 401 Unauthorized', async () => {
      const payload = {
        eventId: 'evt-1',
        eventType: 'investment.settled',
        data: { investmentId: 'inv-1' },
      };

      // Invalid signature
      const invalidReq = createSignedRequest(payload, 'invalid_hmac_hex');
      const res = await POST(invalidReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');

      // Missing signature
      const unsignedReq = new NextRequest(
        'http://localhost:3000/api/webhooks/payments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const resUnsigned = await POST(unsignedReq);
      expect(resUnsigned.status).toBe(401);
    });

    it('processes investment.settled event and updates investment status to settled', async () => {
      // Ensure test investment exists in mock store
      const testInvId = 'inv-wh-test-1';
      defaultMockStateStore.investments.push({
        id: testInvId,
        loan_id: 'loan-test',
        investor_id: 'inv-test',
        amount: 250_000,
        status: 'committed',
        external_payment_id: 'ext_1',
        created_at: new Date().toISOString(),
      });

      const payload = {
        eventId: 'evt-settled-1',
        eventType: 'investment.settled',
        data: { investmentId: testInvId },
      };

      const req = createSignedRequest(payload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.success).toBe(true);

      const updated = defaultMockStateStore.investments.find(
        (i) => i.id === testInvId
      );
      expect(updated?.status).toBe('settled');
    });

    it('processes installment.paid and debit.failed events updating installment status', async () => {
      const testInst1 = 'inst-wh-paid-1';
      const testInst2 = 'inst-wh-fail-2';

      defaultMockStateStore.installments.push(
        {
          id: testInst1,
          loan_id: 'loan-1',
          installment_number: 1,
          due_date: '2026-10-10',
          principal_amount: 100_000,
          interest_borrower: 20_000,
          interest_investors: 18_000,
          interest_lencord: 2_000,
          uva_value_applied: null,
          status: 'pending',
          paid_at: null,
        },
        {
          id: testInst2,
          loan_id: 'loan-1',
          installment_number: 2,
          due_date: '2026-11-10',
          principal_amount: 100_000,
          interest_borrower: 20_000,
          interest_investors: 18_000,
          interest_lencord: 2_000,
          uva_value_applied: null,
          status: 'pending',
          paid_at: null,
        }
      );

      // Paid event
      const paidReq = createSignedRequest({
        eventId: 'evt-paid-1',
        eventType: 'installment.paid',
        data: { installmentId: testInst1 },
      });
      const resPaid = await POST(paidReq);
      expect(resPaid.status).toBe(200);
      expect(
        defaultMockStateStore.installments.find((i) => i.id === testInst1)?.status
      ).toBe('paid');

      // Failed debit event
      const failedReq = createSignedRequest({
        eventId: 'evt-fail-2',
        eventType: 'debit.failed',
        data: { installmentId: testInst2 },
      });
      const resFailed = await POST(failedReq);
      expect(resFailed.status).toBe(200);
      expect(
        defaultMockStateStore.installments.find((i) => i.id === testInst2)?.status
      ).toBe('overdue');
    });

    it('handles duplicate webhook events idempotently returning HTTP 200 without reprocessing', async () => {
      const payload = {
        eventId: 'evt-duplicate-idempotency',
        eventType: 'investment.settled',
        data: { investmentId: 'inv-123' },
      };

      const req1 = createSignedRequest(payload);
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1.success).toBe(true);

      // Second identical request
      const req2 = createSignedRequest(payload);
      const res2 = await POST(req2);
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.duplicated).toBe(true);
      expect(body2.status).toBe('ok');
    });
  });
});
