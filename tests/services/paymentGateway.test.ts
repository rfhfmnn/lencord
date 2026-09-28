import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, clearProcessedWebhookEvents } from '@/app/api/webhooks/payments/route';
import {
  computeHmacSignature,
  generateSignedHeaders,
  isTimestampValid,
  verifyWebhookSignature,
} from '@/services/payments/crypto';
import { BaaSPaymentGateway } from '@/services/payments/BaaSPaymentGateway';
import { defaultMockStateStore } from '@/services/mock/mockState';

describe('Banking-as-a-Service Sandbox Gateway and HMAC Webhook Handler (Issue #40)', () => {
  const secret = 'test_baas_api_secret';

  beforeEach(() => {
    clearProcessedWebhookEvents();
    defaultMockStateStore.reset();
    process.env.BAAS_WEBHOOK_SECRET = secret;
  });

  // ---------------------------------------------------------------------------
  // 1. BaaSPaymentGateway Adapter Contract and Simulation
  // ---------------------------------------------------------------------------
  describe('BaaSPaymentGateway Sandbox Adapter', () => {
    it('implements PaymentGatewayInterface simulating holdFunds, releaseFunds, and disburseLoan', async () => {
      const gateway = new BaaSPaymentGateway({
        apiSecret: secret,
        sandbox: true,
      });

      // 1. holdFunds simulation
      const holdResult = await gateway.holdFunds('inv-001', 500_000, 'loan-001');
      expect(holdResult.success).toBe(true);
      expect(holdResult.holdId).toMatch(/^hold_/);

      const simulatedHolds = gateway.getSimulatedHolds();
      expect(simulatedHolds).toHaveLength(1);
      expect(simulatedHolds[0].amount).toBe(500_000);
      expect(simulatedHolds[0].status).toBe('held');

      // 2. releaseFunds simulation
      const releaseResult = await gateway.releaseFunds(holdResult.holdId);
      expect(releaseResult.success).toBe(true);
      expect(gateway.getSimulatedHolds()[0].status).toBe('released');

      // 3. disburseLoan simulation
      const disburseResult = await gateway.disburseLoan(
        'loan-001',
        '0000003100010000000001',
        10_000_000
      );
      expect(disburseResult.success).toBe(true);
      expect(disburseResult.transferId).toMatch(/^tr_/);

      const simulatedTransfers = gateway.getSimulatedTransfers();
      expect(simulatedTransfers).toHaveLength(1);
      expect(simulatedTransfers[0].amount).toBe(10_000_000);
      expect(simulatedTransfers[0].cbuTarget).toBe('0000003100010000000001');

      // 4. collectInstallment simulation
      const collectResult = await gateway.collectInstallment(
        'inst-001',
        '0000003100010000000001',
        250_000
      );
      expect(collectResult.status).toBe('settled');
      expect(collectResult.paymentId).toBeDefined();
    });

    it('validates input parameters rejecting non-positive amounts and invalid CBUs', async () => {
      const gateway = new BaaSPaymentGateway({ sandbox: true });

      // Non-positive hold amount
      await expect(gateway.holdFunds('inv-001', 0, 'loan-001')).rejects.toThrow(
        /Hold amount must be greater than zero/
      );
      await expect(gateway.holdFunds('inv-001', -100, 'loan-001')).rejects.toThrow(
        /Hold amount must be greater than zero/
      );

      // Non-positive disbursement amount
      await expect(
        gateway.disburseLoan('loan-001', '0000003100010000000001', -500)
      ).rejects.toThrow(/Disbursement amount must be greater than zero/);

      // Invalid CBU length (< 22 digits)
      await expect(
        gateway.disburseLoan('loan-001', '12345', 1_000_000)
      ).rejects.toThrow(/Invalid CBU\/CVU destination/);
    });

    it('attaches cryptographic HMAC-SHA256 signature and timestamp headers to outgoing requests', () => {
      const gateway = new BaaSPaymentGateway({
        apiKey: 'custom_key',
        apiSecret: secret,
      });

      const body = JSON.stringify({ action: 'test', amount: 100 });
      const now = Date.now();
      const headers = gateway.buildHeaders(body, now);

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-API-Key']).toBe('custom_key');
      expect(headers['X-Timestamp']).toBe(now.toString());

      // Verify that X-Signature matches HMAC-SHA256(timestamp.body, secret)
      const expectedSignature = computeHmacSignature(`${now}.${body}`, secret);
      expect(headers['X-Signature']).toBe(expectedSignature);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Cryptographic HMAC-SHA256 Signature Verification
  // ---------------------------------------------------------------------------
  describe('Cryptographic Signature Generation and Verification', () => {
    it('generates consistent HMAC-SHA256 signatures for identical payloads and secrets', () => {
      const payload = JSON.stringify({ amount: 1000, reference: 'ref-123' });
      const sig1 = computeHmacSignature(payload, secret);
      const sig2 = computeHmacSignature(payload, secret);

      expect(sig1).toHaveLength(64); // 256 bits = 64 hex characters
      expect(sig1).toBe(sig2);
    });

    it('verifies signatures correctly and detects tampered payloads', () => {
      const payload = JSON.stringify({ amount: 1000 });
      const signature = computeHmacSignature(payload, secret);

      // Valid payload
      expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);

      // Tampered payload
      const tampered = JSON.stringify({ amount: 9999 });
      expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);

      // Wrong secret
      expect(verifyWebhookSignature(payload, signature, 'wrong-secret')).toBe(false);

      // Malformed signature
      expect(verifyWebhookSignature(payload, 'not-a-valid-hex-sig', secret)).toBe(false);
      expect(verifyWebhookSignature(payload, null, secret)).toBe(false);
    });

    it('supports timestamp-prefixed HMAC verification', () => {
      const payload = JSON.stringify({ event: 'test' });
      const timestamp = '1770000000000';
      const { signature } = generateSignedHeaders(payload, secret, timestamp);

      // Verified with matching timestamp
      expect(verifyWebhookSignature(payload, signature, secret, timestamp)).toBe(true);

      // Rejected when timestamp differs
      expect(verifyWebhookSignature(payload, signature, secret, '1770000000001')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Replay Window Expiration (Timestamp Validation)
  // ---------------------------------------------------------------------------
  describe('Replay Window Expiration', () => {
    it('accepts timestamps within 5 minutes (300 seconds)', () => {
      const now = Date.now();
      // Current timestamp
      expect(isTimestampValid(now)).toBe(true);
      // 2 minutes ago (120 seconds)
      expect(isTimestampValid(now - 120 * 1000)).toBe(true);
      // Exactly 300 seconds ago
      expect(isTimestampValid(now - 300 * 1000)).toBe(true);
      // In seconds format
      expect(isTimestampValid(Math.floor(now / 1000))).toBe(true);
    });

    it('rejects timestamps older than 5 minutes (300 seconds) to prevent replay attacks', () => {
      const now = Date.now();
      // 301 seconds ago (5 min 1 sec)
      expect(isTimestampValid(now - 301 * 1000)).toBe(false);
      // 10 minutes ago
      expect(isTimestampValid(now - 600 * 1000)).toBe(false);
      // 1 day ago
      expect(isTimestampValid(now - 86400 * 1000)).toBe(false);
      // Null / undefined / invalid
      expect(isTimestampValid(null)).toBe(false);
      expect(isTimestampValid('invalid-timestamp')).toBe(false);
    });

    it('rejects timestamps that are unreasonably far in the future (> 60 seconds)', () => {
      const now = Date.now();
      // 2 minutes in the future
      expect(isTimestampValid(now + 120 * 1000)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. HTTP POST /api/webhooks/payments Route Handler
  // ---------------------------------------------------------------------------
  describe('HTTP POST /api/webhooks/payments Route Handler', () => {
    function createSignedWebhookRequest(
      payload: object,
      options?: {
        signature?: string;
        timestamp?: number | string;
        useAltSignatureHeader?: boolean;
      }
    ) {
      const bodyString = JSON.stringify(payload);
      const timestamp = (
        options?.timestamp !== undefined ? options.timestamp : Date.now()
      ).toString();
      const signature =
        options?.signature !== undefined
          ? options.signature
          : computeHmacSignature(`${timestamp}.${bodyString}`, secret);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
      };

      if (options?.useAltSignatureHeader) {
        headers['x-webhook-signature'] = signature;
      } else {
        headers['X-Signature'] = signature;
      }

      return new NextRequest('http://localhost:3000/api/webhooks/payments', {
        method: 'POST',
        headers,
        body: bodyString,
      });
    }

    it('receives incoming payment notification and validates X-Signature header', async () => {
      const payload = {
        eventId: 'evt-test-sig-valid',
        eventType: 'investment.settled',
        data: { investmentId: 'inv-test-1' },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.success).toBe(true);
      expect(body.eventId).toBe('evt-test-sig-valid');
    });

    it('rejects invalid or missing X-Signature with HTTP 401 Unauthorized', async () => {
      const payload = {
        eventId: 'evt-invalid-sig',
        eventType: 'investment.settled',
        data: { investmentId: 'inv-test-1' },
      };

      // 1. Invalid signature
      const invalidReq = createSignedWebhookRequest(payload, {
        signature: 'deadbeef1234567890abcdef',
      });
      const resInvalid = await POST(invalidReq);
      expect(resInvalid.status).toBe(401);
      const invalidBody = await resInvalid.json();
      expect(invalidBody.error).toContain('Unauthorized');

      // 2. Missing signature
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

    it('rejects requests with timestamps older than 5 minutes (300 seconds) with HTTP 401', async () => {
      const payload = {
        eventId: 'evt-expired-timestamp',
        eventType: 'investment.settled',
        data: { investmentId: 'inv-test-1' },
      };

      // Timestamp from 10 minutes ago
      const expiredTimestamp = Date.now() - 600 * 1000;
      const expiredReq = createSignedWebhookRequest(payload, {
        timestamp: expiredTimestamp,
      });

      const res = await POST(expiredReq);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain('timestamp expired');
    });

    it('triggers corresponding updates in investments table upon investment.settled event', async () => {
      const testInvId = 'inv-integration-test-01';
      defaultMockStateStore.investments.push({
        id: testInvId,
        loan_id: 'loan-test',
        investor_id: 'prof-inv-01',
        amount: 300_000,
        status: 'committed',
        external_payment_id: 'pay-001',
        created_at: new Date().toISOString(),
      });

      const payload = {
        eventId: 'evt-inv-settled-01',
        eventType: 'investment.settled',
        data: {
          investmentId: testInvId,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const updatedInv = defaultMockStateStore.investments.find(
        (i) => i.id === testInvId
      );
      expect(updatedInv?.status).toBe('settled');
    });

    it('triggers corresponding updates in loans table upon transfer.settled / disbursement', async () => {
      const testLoanId = 'loan-disburse-01';
      defaultMockStateStore.loans.push({
        id: testLoanId,
        borrower_id: 'prof-sme-01',
        amount_requested: 5_000_000,
        amount_funded: 5_000_000,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 45,
        platform_spread: 3,
        borrower_rate: 48,
        base_uva_value: null,
        category: 'working_capital',
        status: 'funded',
        funding_deadline: '2026-10-01T00:00:00Z',
        created_at: new Date().toISOString(),
      });

      const payload = {
        eventId: 'evt-disburse-01',
        eventType: 'transfer.settled',
        data: {
          loanId: testLoanId,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const updatedLoan = defaultMockStateStore.loans.find(
        (l) => l.id === testLoanId
      );
      // Transferred funds activate the loan
      expect(updatedLoan?.status).toBe('active');
    });

    it('updates loan amount_funded and status to funded when investment completes the loan', async () => {
      const testLoanId = 'loan-funding-01';
      defaultMockStateStore.loans.push({
        id: testLoanId,
        borrower_id: 'prof-sme-02',
        amount_requested: 1_000_000,
        amount_funded: 800_000,
        term_months: 3,
        rate_type: 'TNA_FIXED',
        investor_rate: 45,
        platform_spread: 2,
        borrower_rate: 47,
        base_uva_value: null,
        category: 'working_capital',
        status: 'funding',
        funding_deadline: '2026-11-01T00:00:00Z',
        created_at: new Date().toISOString(),
      });

      const payload = {
        eventId: 'evt-loan-fund-complete',
        eventType: 'investment.settled',
        data: {
          loanId: testLoanId,
          amount: 200_000,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const updatedLoan = defaultMockStateStore.loans.find(
        (l) => l.id === testLoanId
      );
      expect(updatedLoan?.amount_funded).toBe(1_000_000);
      expect(updatedLoan?.status).toBe('funded');
    });

    it('handles hold.released event updating investment status to refunded', async () => {
      const testInvId = 'inv-refund-01';
      defaultMockStateStore.investments.push({
        id: testInvId,
        loan_id: 'loan-test',
        investor_id: 'prof-inv-01',
        amount: 100_000,
        status: 'committed',
        external_payment_id: 'pay-002',
        created_at: new Date().toISOString(),
      });

      const payload = {
        eventId: 'evt-hold-released-01',
        eventType: 'hold.released',
        data: {
          investmentId: testInvId,
        },
      };

      const req = createSignedWebhookRequest(payload);
      const res = await POST(req);

      expect(res.status).toBe(200);
      const updatedInv = defaultMockStateStore.investments.find(
        (i) => i.id === testInvId
      );
      expect(updatedInv?.status).toBe('refunded');
    });
  });
});
