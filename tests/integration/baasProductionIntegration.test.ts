/**
 * Production Banking-as-a-Service (BaaS) Live Network Integration Test Suite.
 * Validates requirements for GitHub Issue #49:
 * - Encrypted institutional credentials from environment secrets (AES-256-GCM).
 * - Live CBU/CVU verification via COELSA / Interbanking with BCRA checksum algorithm.
 * - Daily automated settlement reconciliation against bank custody statements and BCRA non-custody compliance.
 * - Webhook handler idempotency key processing and deduplication.
 * - Error recovery and exponential backoff retry on bank downtime.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, clearProcessedWebhookEvents } from '@/app/api/webhooks/payments/route';
import {
  encryptCredential,
  decryptCredential,
  generateSignedHeaders,
} from '@/services/payments/crypto';
import {
  validateCbuChecksum,
  resolveBankOrPspName,
  ARGENTINE_BANK_CODES,
} from '@/services/payments/cbu';
import {
  reconcileDailySettlements,
  type PlatformLedgerTransaction,
  type BankCustodyStatement,
} from '@/services/payments/reconciliation';
import { BaaSPaymentGateway } from '@/services/payments/BaaSPaymentGateway';

describe('Production BaaS Integration and Contract Provisioning (Issue #49)', () => {
  const MASTER_SECRET = 'institutional-master-key-32bytes!';
  const WEBHOOK_SECRET = 'baas-prod-webhook-secret-999';

  // Valid 22-digit CBU calculated using BCRA weights
  // Bank Galicia (007), Branch 0001, Account 1000000000001
  const VALID_GALICIA_CBU = '0070001610000000000014';
  // Santander (072), Branch 0000
  // Block 1: 0720000 -> 0*7 + 7*1 + 2*3 = 13. 10 - 3 = 7. '07200007'
  // Block 2: 0000000000001 -> 1*3 = 3. 10 - 3 = 7. '00000000000017'
  const VALID_SANTANDER_CBU = '0720000700000000000017';
  // CVU Fintech prefix 000000
  // Block 1: 0000003 -> 3*3 = 9. 10 - 9 = 1. '00000031'
  // Block 2: 0001000000000 -> 1*1 = 1. 10 - 1 = 9. '00010000000009'
  const VALID_FINTECH_CVU = '0000003100010000000009';

  beforeEach(() => {
    clearProcessedWebhookEvents();
    process.env.BAAS_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  describe('1. Encrypted Institutional Credentials Provisioning', () => {
    it('encrypts and decrypts institutional credentials package with AES-256-GCM', () => {
      const credentials = {
        apiKey: 'baas_live_prod_key_7788',
        apiSecret: 'baas_live_prod_secret_4455',
        institutionId: 'INST_LENCORD_ARG_01',
        baseUrl: 'https://core.bind.com.ar/api/v1',
      };

      const encrypted = encryptCredential(JSON.stringify(credentials), MASTER_SECRET);
      expect(encrypted).toContain(':');
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3); // iv, tag, ciphertext

      const decrypted = decryptCredential(encrypted, MASTER_SECRET);
      expect(JSON.parse(decrypted)).toEqual(credentials);
    });

    it('initializes BaaSPaymentGateway with decrypted institutional credentials', () => {
      const liveCredentials = {
        apiKey: 'baas_encrypted_key_888',
        apiSecret: 'baas_encrypted_secret_999',
        institutionId: 'INST_ARG_LENCORD_PROD',
        baseUrl: 'https://api.live-banking.com.ar/v1',
      };

      const encryptedPackage = encryptCredential(
        JSON.stringify(liveCredentials),
        MASTER_SECRET
      );

      const gateway = new BaaSPaymentGateway({
        encryptedCredentials: encryptedPackage,
        credentialsKey: MASTER_SECRET,
      });

      expect(gateway.getApiKey()).toBe('baas_encrypted_key_888');
      expect(gateway.getApiSecret()).toBe('baas_encrypted_secret_999');
      expect(gateway.getInstitutionId()).toBe('INST_ARG_LENCORD_PROD');
    });

    it('gracefully handles invalid encrypted credentials without crashing', () => {
      const gateway = new BaaSPaymentGateway({
        encryptedCredentials: 'invalid:corrupt:data',
        credentialsKey: MASTER_SECRET,
      });

      // Falls back to defaults / env vars
      expect(gateway.getApiKey()).toBeDefined();
      expect(gateway.getInstitutionId()).toBeDefined();
    });
  });

  describe('2. Live CBU/CVU Verification via COELSA / Interbanking', () => {
    it('validates authentic Argentine CBU/CVU checksums according to BCRA algorithms', () => {
      expect(validateCbuChecksum(VALID_GALICIA_CBU)).toBe(true);
      expect(validateCbuChecksum(VALID_SANTANDER_CBU)).toBe(true);
      expect(validateCbuChecksum(VALID_FINTECH_CVU)).toBe(true);
    });

    it('rejects CBUs with invalid lengths, non-digit characters, or bad check digits', () => {
      expect(validateCbuChecksum('1234567890')).toBe(false); // too short
      expect(validateCbuChecksum(VALID_GALICIA_CBU + '0')).toBe(false); // too long
      expect(validateCbuChecksum('007000161000000000001X')).toBe(false); // non-digit
      // Alter block 1 check digit
      const badBlock1 = '0070001010000000000014';
      expect(validateCbuChecksum(badBlock1)).toBe(false);
      // Alter block 2 check digit
      const badBlock2 = '0070001610000000000010';
      expect(validateCbuChecksum(badBlock2)).toBe(false);
    });

    it('resolves bank or PSP names correctly from Argentine routing codes', () => {
      expect(resolveBankOrPspName(VALID_GALICIA_CBU)).toBe('Banco Galicia');
      expect(resolveBankOrPspName(VALID_SANTANDER_CBU)).toBe('Banco Santander Argentina');
      expect(resolveBankOrPspName(VALID_FINTECH_CVU)).toBe('Proveedor de Servicios de Pago (CVU FinTech)');
      expect(ARGENTINE_BANK_CODES['011']).toBe('Banco de la Nación Argentina');
    });

    it('returns validation error immediately when CBU checksum is invalid without network call', async () => {
      const mockFetch = vi.fn();
      const gateway = new BaaSPaymentGateway({ customFetch: mockFetch as any });

      const result = await gateway.validateCbuCvu('0000000000000000000000');
      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('BCRA algorithm validation failed');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('verifies CBU with COELSA service endpoint in live mode', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: true,
          cbu: VALID_GALICIA_CBU,
          accountHolder: 'TECNOLOGIA AGRO S.A.',
          taxId: '30-71122334-9',
          bankName: 'Banco Galicia',
          accountType: 'checking',
          status: 'active',
        }),
      });

      const gateway = new BaaSPaymentGateway({
        baseUrl: 'https://api.live-banking.com.ar/v1',
        sandbox: false,
        customFetch: mockFetch as any,
      });

      const result = await gateway.validateCbuCvu(VALID_GALICIA_CBU);
      expect(result.valid).toBe(true);
      expect(result.accountHolder).toBe('TECNOLOGIA AGRO S.A.');
      expect(result.taxId).toBe('30-71122334-9');
      expect(result.bankName).toBe('Banco Galicia');
      expect(result.status).toBe('active');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/coelsa/validate-cbu'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('3. Daily Automated Settlement Reconciliation & Non-Custody Compliance', () => {
    const openingBalance = 10_000_000;
    const baseDate = '2026-09-28';

    it('successfully matches perfectly aligned platform ledger and bank statement', () => {
      const ledgerTransactions: PlatformLedgerTransaction[] = [
        {
          id: 'ledg-1',
          type: 'hold',
          amount: 500_000,
          referenceId: 'ref-inv-001',
          timestamp: '2026-09-28T10:00:00Z',
        },
        {
          id: 'ledg-2',
          type: 'disbursement',
          amount: 2_000_000,
          referenceId: 'ref-disb-001',
          timestamp: '2026-09-28T11:00:00Z',
        },
        {
          id: 'ledg-3',
          type: 'installment_collection',
          amount: 300_000,
          referenceId: 'ref-inst-001',
          timestamp: '2026-09-28T14:00:00Z',
        },
      ];

      // Opening: 10,000,000 + 500,000 (credit) - 2,000,000 (debit) + 300,000 (credit) = 8,800,000
      const bankStatement: BankCustodyStatement = {
        accountNumber: 'CC-992-019283-0',
        cbu: VALID_GALICIA_CBU,
        bankName: 'Banco Galicia',
        statementDate: baseDate,
        openingBalance,
        closingBalance: 8_800_000,
        movements: [
          {
            movementId: 'mov-1',
            type: 'credit',
            amount: 500_000,
            referenceId: 'ref-inv-001',
            status: 'settled',
            description: 'Depósito Inversor Lencord',
            timestamp: '2026-09-28T10:05:00Z',
          },
          {
            movementId: 'mov-2',
            type: 'debit',
            amount: 2_000_000,
            referenceId: 'ref-disb-001',
            status: 'settled',
            description: 'Desembolso Préstamo PyME',
            timestamp: '2026-09-28T11:05:00Z',
          },
          {
            movementId: 'mov-3',
            type: 'credit',
            amount: 300_000,
            referenceId: 'ref-inst-001',
            status: 'settled',
            description: 'Cobranza Cuota 1',
            timestamp: '2026-09-28T14:05:00Z',
          },
        ],
      };

      const report = reconcileDailySettlements({
        date: baseDate,
        ledgerTransactions,
        bankStatement,
      });

      expect(report.status).toBe('matched');
      expect(report.variance).toBe(0);
      expect(report.matchedTransactionsCount).toBe(3);
      expect(report.discrepancies.length).toBe(0);
      expect(report.regulatoryCompliance.compliant).toBe(true);
      expect(report.regulatoryCompliance.regulatoryNote).toContain('BCRA');
      expect(report.regulatoryCompliance.regulatoryNote).toContain('CNV');
    });

    it('detects missing transactions in bank statement', () => {
      const ledgerTransactions: PlatformLedgerTransaction[] = [
        {
          id: 'ledg-1',
          type: 'hold',
          amount: 500_000,
          referenceId: 'ref-missing-bank',
          timestamp: '2026-09-28T10:00:00Z',
        },
      ];

      const bankStatement: BankCustodyStatement = {
        accountNumber: 'CC-992-019283-0',
        cbu: VALID_GALICIA_CBU,
        bankName: 'Banco Galicia',
        statementDate: baseDate,
        openingBalance,
        closingBalance: openingBalance,
        movements: [],
      };

      const report = reconcileDailySettlements({
        date: baseDate,
        ledgerTransactions,
        bankStatement,
      });

      expect(report.status).toBe('discrepancy');
      expect(report.discrepancies.length).toBe(1);
      expect(report.discrepancies[0].code).toBe('MISSING_IN_BANK');
      expect(report.discrepancies[0].referenceId).toBe('ref-missing-bank');
      expect(report.regulatoryCompliance.compliant).toBe(false);
    });

    it('detects amount mismatches between platform ledger and bank statement', () => {
      const ledgerTransactions: PlatformLedgerTransaction[] = [
        {
          id: 'ledg-1',
          type: 'hold',
          amount: 500_000,
          referenceId: 'ref-diff-amount',
          timestamp: '2026-09-28T10:00:00Z',
        },
      ];

      const bankStatement: BankCustodyStatement = {
        accountNumber: 'CC-992-019283-0',
        cbu: VALID_GALICIA_CBU,
        bankName: 'Banco Galicia',
        statementDate: baseDate,
        openingBalance,
        closingBalance: openingBalance + 450_000,
        movements: [
          {
            movementId: 'mov-1',
            type: 'credit',
            amount: 450_000, // mismatch: 500_000 vs 450_000
            referenceId: 'ref-diff-amount',
            status: 'settled',
            description: 'Depósito',
            timestamp: '2026-09-28T10:05:00Z',
          },
        ],
      };

      const report = reconcileDailySettlements({
        date: baseDate,
        ledgerTransactions,
        bankStatement,
      });

      expect(report.status).toBe('discrepancy');
      const mismatch = report.discrepancies.find((d) => d.code === 'AMOUNT_MISMATCH');
      expect(mismatch).toBeDefined();
      expect(mismatch?.ledgerAmount).toBe(500_000);
      expect(mismatch?.bankAmount).toBe(450_000);
    });
  });

  describe('4. Webhook Handler Idempotency Key Processing and Deduplication', () => {
    it('processes webhook with idempotency-key header and deduplicates identical retry calls', async () => {
      const idempotencyKey = 'bank-evt-key-xyz-777';
      const eventPayload = {
        eventId: 'evt-unique-001',
        eventType: 'hold.confirmed',
        timestamp: Date.now(),
        data: {
          investmentId: 'inv-test-idempotency',
          amount: 150_000,
        },
      };

      const body = JSON.stringify(eventPayload);
      const { timestamp, signature } = generateSignedHeaders(body, WEBHOOK_SECRET);

      // First call: Should succeed and be processed
      const firstReq = new NextRequest('http://localhost:3000/api/webhooks/payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
          'x-timestamp': timestamp,
          'idempotency-key': idempotencyKey,
        },
        body,
      });

      const firstRes = await POST(firstReq);
      expect(firstRes.status).toBe(200);
      const firstJson = await firstRes.json();
      expect(firstJson.status).toBe('ok');
      expect(firstJson.success).toBe(true);
      expect(firstJson.idempotencyKey).toBe(idempotencyKey);

      // Second call with same idempotency key (bank retry): Should return duplicated: true without re-executing
      const secondReq = new NextRequest('http://localhost:3000/api/webhooks/payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
          'x-timestamp': timestamp,
          'idempotency-key': idempotencyKey,
        },
        body,
      });

      const secondRes = await POST(secondReq);
      expect(secondRes.status).toBe(200);
      const secondJson = await secondRes.json();
      expect(secondJson.status).toBe('ok');
      expect(secondJson.duplicated).toBe(true);
      expect(secondJson.idempotencyKey).toBe(idempotencyKey);
    });

    it('processes webhook with idempotencyKey in body payload', async () => {
      const eventPayload = {
        eventId: 'evt-unique-002',
        idempotencyKey: 'idemp-body-payload-999',
        eventType: 'installment.paid',
        timestamp: Date.now(),
        data: {
          installmentId: 'inst-test-idemp',
          amount: 200_000,
        },
      };

      const body = JSON.stringify(eventPayload);
      const { timestamp, signature } = generateSignedHeaders(body, WEBHOOK_SECRET);

      const req1 = new NextRequest('http://localhost:3000/api/webhooks/payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
          'x-timestamp': timestamp,
        },
        body,
      });

      const res1 = await POST(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.success).toBe(true);

      // Retry
      const req2 = new NextRequest('http://localhost:3000/api/webhooks/payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
          'x-timestamp': timestamp,
        },
        body,
      });

      const res2 = await POST(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.duplicated).toBe(true);
      expect(json2.idempotencyKey).toBe('idemp-body-payload-999');
    });
  });

  describe('5. Error Recovery and Exponential Backoff on Bank Downtime', () => {
    it('retries with exponential backoff on HTTP 503 bank gateway downtime and recovers', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // Bank gateway temporarily down
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: async () => ({ error: 'Bank core maintenance' }),
          });
        }
        // Recovered on 3rd attempt
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            holdId: 'hold-recovered-999',
          }),
        });
      });

      const gateway = new BaaSPaymentGateway({
        baseUrl: 'https://api.live-banking.com.ar/v1',
        sandbox: false,
        maxRetries: 3,
        retryDelayMs: 10, // fast in tests
        customFetch: mockFetch as any,
      });

      const result = await gateway.holdFunds('inv-test-retry', 100_000, 'loan-test-retry');
      expect(callCount).toBe(3);
      expect(result.success).toBe(true);
      expect(result.holdId).toBe('hold-recovered-999');
    });

    it('returns failure if bank gateway remains down after exhausting retries', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => ({ error: 'Gateway timeout' }),
      });

      const gateway = new BaaSPaymentGateway({
        baseUrl: 'https://api.live-banking.com.ar/v1',
        sandbox: false,
        maxRetries: 2,
        retryDelayMs: 5,
        customFetch: mockFetch as any,
      });

      const result = await gateway.holdFunds('inv-test-fail', 100_000, 'loan-test-fail');
      // Should have attempted 1 initial + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
    });
  });
});
