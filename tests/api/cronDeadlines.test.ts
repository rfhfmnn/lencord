import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/check-deadlines/route';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { resetServerServices } from '@/services/locator';
import type { Loan, Investment } from '@/types';

describe('Automated Loan Deadline Check and Settlement Routine (Issue #22)', () => {
  const secret = 'test-cron-secret';

  beforeEach(() => {
    process.env.CRON_SECRET = secret;
    resetServerServices();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createCronRequest(authHeader?: string) {
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['authorization'] = authHeader;
    }
    return new NextRequest('http://localhost:3000/api/cron/check-deadlines', {
      method: 'GET',
      headers,
    });
  }

  it('rejects unauthorized requests without bearer token or with wrong secret with 401', async () => {
    // Missing header
    const reqNoAuth = createCronRequest();
    const resNoAuth = await GET(reqNoAuth);
    expect(resNoAuth.status).toBe(401);
    const bodyNoAuth = await resNoAuth.json();
    expect(bodyNoAuth.error).toContain('Unauthorized');

    // Invalid token
    const reqInvalid = createCronRequest('Bearer wrong-secret');
    const resInvalid = await GET(reqInvalid);
    expect(resInvalid.status).toBe(401);
  });

  it('cancels expired underfunded loans and triggers investment refunds', async () => {
    // Mock system time to October 15, 2026
    const baseTime = new Date('2026-10-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    // Create an expired underfunded loan (deadline was October 10, 2026)
    const expiredLoanId = 'loan-expired-underfunded-1';
    const expiredLoan: Loan = {
      id: expiredLoanId,
      borrower_id: 'sme-1',
      amount_requested: 5_000_000,
      amount_funded: 2_000_000,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 45,
      platform_spread: 2.5,
      borrower_rate: 47.5,
      base_uva_value: null,
      category: 'working_capital',
      status: 'funding',
      funding_deadline: '2026-10-10T23:59:59.000Z', // Expired 5 days ago
      created_at: '2026-09-01T00:00:00.000Z',
    };

    // Add investor commitments to be refunded
    const inv1: Investment = {
      id: 'inv-to-refund-1',
      loan_id: expiredLoanId,
      investor_id: 'inv-user-1',
      amount: 1_000_000,
      status: 'committed',
      external_payment_id: 'hold_ref_1',
      created_at: '2026-09-05T00:00:00.000Z',
    };
    const inv2: Investment = {
      id: 'inv-to-refund-2',
      loan_id: expiredLoanId,
      investor_id: 'inv-user-2',
      amount: 1_000_000,
      status: 'committed',
      external_payment_id: 'hold_ref_2',
      created_at: '2026-09-06T00:00:00.000Z',
    };

    defaultMockStateStore.loans.push(expiredLoan);
    defaultMockStateStore.investments.push(inv1, inv2);

    const req = createCronRequest(`Bearer ${secret}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report.status).toBe('ok');
    expect(report.cancelled).toBeGreaterThanOrEqual(1);

    // Verify loan was cancelled
    const updatedLoan = defaultMockStateStore.loans.find((l) => l.id === expiredLoanId);
    expect(updatedLoan?.status).toBe('cancelled');

    // Verify investments were marked as refunded
    const updatedInv1 = defaultMockStateStore.investments.find((i) => i.id === 'inv-to-refund-1');
    const updatedInv2 = defaultMockStateStore.investments.find((i) => i.id === 'inv-to-refund-2');
    expect(updatedInv1?.status).toBe('refunded');
    expect(updatedInv2?.status).toBe('refunded');
  });

  it('finalizes fully funded loans, generates promissory note, and queues disbursement', async () => {
    const baseTime = new Date('2026-10-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    // Create a fully funded loan whose deadline passed
    const fullyFundedLoanId = 'loan-fullyfunded-expired-2';
    const fullyFundedLoan: Loan = {
      id: fullyFundedLoanId,
      borrower_id: 'sme-2',
      amount_requested: 3_000_000,
      amount_funded: 3_000_000,
      term_months: 3,
      rate_type: 'TNA_FIXED',
      investor_rate: 40,
      platform_spread: 2,
      borrower_rate: 42,
      base_uva_value: null,
      category: 'machinery',
      status: 'funding',
      funding_deadline: '2026-10-12T23:59:59.000Z', // Expired 3 days ago
      created_at: '2026-09-01T00:00:00.000Z',
    };

    defaultMockStateStore.loans.push(fullyFundedLoan);

    const req = createCronRequest(`Bearer ${secret}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report.status).toBe('ok');
    expect(report.finalized).toBeGreaterThanOrEqual(1);

    // Verify loan transitioned to funded
    const updatedLoan = defaultMockStateStore.loans.find((l) => l.id === fullyFundedLoanId);
    expect(updatedLoan?.status).toBe('funded');

    // Verify promissory note (pagaré) was generated
    const contracts = defaultMockStateStore.contracts.filter((c) => c.loan_id === fullyFundedLoanId);
    expect(contracts.some((c) => c.document_type === 'pagare')).toBe(true);
  });
});
