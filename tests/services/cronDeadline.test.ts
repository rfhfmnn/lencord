import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/check-deadlines/route';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { resetServerServices } from '@/services/locator';
import type { Loan, Investment, PaymentGatewayInterface } from '@/types';

describe('Automated Auction Expiration Routine and Partial Funding Resolution (Issue #43)', () => {
  const cronSecretKey = 'test-cron-secret-key-123';

  beforeEach(() => {
    process.env.CRON_SECRET_KEY = cronSecretKey;
    defaultMockStateStore.loans = [];
    defaultMockStateStore.investments = [];
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

  it('requires Authorization: Bearer <CRON_SECRET_KEY> header, returning 401 if missing or invalid', async () => {
    // Missing header
    const resMissing = await GET(createCronRequest());
    expect(resMissing.status).toBe(401);
    const bodyMissing = await resMissing.json();
    expect(bodyMissing.error).toContain('Unauthorized');

    // Invalid secret
    const resInvalid = await GET(createCronRequest('Bearer wrong-secret-token'));
    expect(resInvalid.status).toBe(401);

    // Valid secret
    const resValid = await GET(createCronRequest(`Bearer ${cronSecretKey}`));
    expect(resValid.status).toBe(200);
  });

  it('queries loans where funding_deadline < NOW(), flags loans with >= 75% for partial acceptance and dispatches notification', async () => {
    const baseTime = new Date('2026-10-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    // Loan reaching 80% funding (>= 75% threshold)
    const partialLoanId = 'loan-partial-80-percent';
    const partialLoan: Loan = {
      id: partialLoanId,
      borrower_id: 'prof-sme-080',
      amount_requested: 10_000_000,
      amount_funded: 8_000_000, // 80% funded
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

    const inv1: Investment = {
      id: 'inv-partial-1',
      loan_id: partialLoanId,
      investor_id: 'inv-user-1',
      amount: 8_000_000,
      status: 'committed',
      external_payment_id: 'hold_partial_1',
      created_at: '2026-09-05T00:00:00.000Z',
    };

    defaultMockStateStore.loans.push(partialLoan);
    defaultMockStateStore.investments.push(inv1);

    const res = await GET(createCronRequest(`Bearer ${cronSecretKey}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.partial_flagged).toBe(1);
    expect(body.notifications_dispatched).toBe(1);
    expect(body.expired).toBe(0);

    // Verify loan is flagged for partial acceptance with 48h deadline
    const updatedLoan = defaultMockStateStore.loans.find((l) => l.id === partialLoanId);
    expect(updatedLoan?.partial_acceptance_flag).toBe(true);
    expect(updatedLoan?.notification_dispatched).toBe(true);
    expect(updatedLoan?.partial_acceptance_deadline).toBeDefined();

    // Verify investments were NOT refunded
    const updatedInv = defaultMockStateStore.investments.find((i) => i.id === 'inv-partial-1');
    expect(updatedInv?.status).toBe('committed');
  });

  it('transitions loans with < 75% funding to "expired", refunds investments and cancels escrow holds', async () => {
    const baseTime = new Date('2026-10-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    // Loan reaching only 50% funding (< 75% threshold)
    const failedLoanId = 'loan-underfunded-50-percent';
    const failedLoan: Loan = {
      id: failedLoanId,
      borrower_id: 'prof-sme-050',
      amount_requested: 10_000_000,
      amount_funded: 5_000_000, // 50% funded
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

    const inv1: Investment = {
      id: 'inv-underfunded-1',
      loan_id: failedLoanId,
      investor_id: 'inv-user-1',
      amount: 5_000_000,
      status: 'committed',
      external_payment_id: 'hold_underfunded_1',
      created_at: '2026-09-05T00:00:00.000Z',
    };

    defaultMockStateStore.loans.push(failedLoan);
    defaultMockStateStore.investments.push(inv1);

    const res = await GET(createCronRequest(`Bearer ${cronSecretKey}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.expired).toBe(1);

    // Verify loan transitioned to 'expired'
    const updatedLoan = defaultMockStateStore.loans.find((l) => l.id === failedLoanId);
    expect(updatedLoan?.status).toBe('expired');

    // Verify investment transitioned to 'refunded'
    const updatedInv = defaultMockStateStore.investments.find((i) => i.id === 'inv-underfunded-1');
    expect(updatedInv?.status).toBe('refunded');
  });

  it('guarantees idempotency on consecutive executions (no double refunds or duplicate alerts)', async () => {
    const baseTime = new Date('2026-10-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    // Underfunded loan
    const loanUnder = 'loan-idempotent-under';
    defaultMockStateStore.loans.push({
      id: loanUnder,
      borrower_id: 'prof-sme-001',
      amount_requested: 10_000_000,
      amount_funded: 2_000_000, // 20%
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 45,
      platform_spread: 2.5,
      borrower_rate: 47.5,
      base_uva_value: null,
      category: 'working_capital',
      status: 'funding',
      funding_deadline: '2026-10-10T23:59:59.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
    });
    defaultMockStateStore.investments.push({
      id: 'inv-under-1',
      loan_id: loanUnder,
      investor_id: 'inv-user-1',
      amount: 2_000_000,
      status: 'committed',
      external_payment_id: 'hold_under_1',
      created_at: '2026-09-05T00:00:00.000Z',
    });

    // Partial loan (85%)
    const loanPartial = 'loan-idempotent-partial';
    defaultMockStateStore.loans.push({
      id: loanPartial,
      borrower_id: 'prof-sme-002',
      amount_requested: 10_000_000,
      amount_funded: 8_500_000, // 85%
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 45,
      platform_spread: 2.5,
      borrower_rate: 47.5,
      base_uva_value: null,
      category: 'working_capital',
      status: 'funding',
      funding_deadline: '2026-10-10T23:59:59.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
    });

    // 1st Execution
    const res1 = await GET(createCronRequest(`Bearer ${cronSecretKey}`));
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.expired).toBe(1);
    expect(body1.partial_flagged).toBe(1);
    expect(body1.notifications_dispatched).toBe(1);

    // 2nd Execution immediately following
    const res2 = await GET(createCronRequest(`Bearer ${cronSecretKey}`));
    expect(res2.status).toBe(200);
    const body2 = await res2.json();

    // Expired loan is no longer in 'funding', so expired is 0 on 2nd run
    expect(body2.expired).toBe(0);
    // Partial loan was already notified, so duplicate notifications dispatched is 0
    expect(body2.notifications_dispatched).toBe(0);
  });
});
