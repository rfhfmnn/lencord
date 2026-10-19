import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as acceptPartialPost } from '@/app/api/loans/accept-partial/route';
import { POST as updateDeadlinePost } from '@/app/api/loans/update-deadline/route';
import { defaultMockStateStore } from '@/services/mock/mockState';
import type { Loan } from '@/types';

describe('Loan Endpoints Security & Authorization (SEC-01 / Issue #86)', () => {
  const targetLoanId = 'loan-sec-test-1';
  const ownerBorrowerId = 'sme-owner-user-1';
  const attackerBorrowerId = 'sme-attacker-user-2';

  beforeEach(() => {
    // Reset mock loans store
    defaultMockStateStore.loans = defaultMockStateStore.loans.filter((l) => l.id !== targetLoanId);

    const testLoan: Loan = {
      id: targetLoanId,
      borrower_id: ownerBorrowerId,
      amount_requested: 5_000_000,
      amount_funded: 4_000_000,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 45,
      platform_spread: 2.5,
      borrower_rate: 47.5,
      base_uva_value: null,
      category: 'working_capital',
      status: 'funding',
      funding_deadline: '2026-11-01T23:59:59.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
    };

    defaultMockStateStore.loans.push(testLoan);
  });

  function createRequest(
    url: string,
    body: Record<string, any>,
    headers: Record<string, string> = {}
  ): NextRequest {
    return new NextRequest(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  describe('POST /api/loans/accept-partial', () => {
    it('rejects unauthenticated anonymous calls with 401 Unauthorized', async () => {
      const req = createRequest('http://localhost:3000/api/loans/accept-partial', {
        loan_id: targetLoanId,
      });

      const res = await acceptPartialPost(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toMatch(/unauthorized/i);
    });

    it('rejects an authenticated user attempting to accept partial on another borrower loan with 403 Forbidden', async () => {
      const req = createRequest(
        'http://localhost:3000/api/loans/accept-partial',
        { loan_id: targetLoanId },
        { 'x-user-id': attackerBorrowerId, 'x-user-role': 'borrower' }
      );

      const res = await acceptPartialPost(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toMatch(/forbidden/i);
    });

    it('allows the legitimate borrower (owner) to accept partial funding with 200 OK', async () => {
      const req = createRequest(
        'http://localhost:3000/api/loans/accept-partial',
        { loan_id: targetLoanId },
        { 'x-user-id': ownerBorrowerId, 'x-user-role': 'borrower' }
      );

      const res = await acceptPartialPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.loan.status).toBe('funded');
      expect(json.loan.partial_acceptance_flag).toBe(true);
    });

    it('allows an administrator to accept partial funding on behalf of borrower with 200 OK', async () => {
      const req = createRequest(
        'http://localhost:3000/api/loans/accept-partial',
        { loan_id: targetLoanId },
        { 'x-user-id': 'admin-super-1', 'x-user-role': 'admin' }
      );

      const res = await acceptPartialPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/loans/update-deadline', () => {
    const newDeadline = '2026-11-15T23:59:59.000Z';

    it('rejects unauthenticated anonymous calls with 401 Unauthorized', async () => {
      const req = createRequest('http://localhost:3000/api/loans/update-deadline', {
        loan_id: targetLoanId,
        funding_deadline: newDeadline,
      });

      const res = await updateDeadlinePost(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toMatch(/unauthorized/i);
    });

    it('rejects another borrower trying to adjust deadline with 403 Forbidden', async () => {
      const req = createRequest(
        'http://localhost:3000/api/loans/update-deadline',
        { loan_id: targetLoanId, funding_deadline: newDeadline },
        { 'x-user-id': attackerBorrowerId, 'x-user-role': 'borrower' }
      );

      const res = await updateDeadlinePost(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toMatch(/forbidden/i);
    });

    it('allows the loan owner (borrower) to update auction deadline with 200 OK', async () => {
      const req = createRequest(
        'http://localhost:3000/api/loans/update-deadline',
        { loan_id: targetLoanId, funding_deadline: newDeadline },
        { 'x-user-id': ownerBorrowerId, 'x-user-role': 'borrower' }
      );

      const res = await updateDeadlinePost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.loan.funding_deadline).toBe(newDeadline);
    });

    it('allows an administrator to update auction deadline with 200 OK', async () => {
      const req = createRequest(
        'http://localhost:3000/api/loans/update-deadline',
        { loan_id: targetLoanId, funding_deadline: newDeadline },
        { 'x-user-id': 'admin-super-1', 'x-user-role': 'admin' }
      );

      const res = await updateDeadlinePost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.loan.funding_deadline).toBe(newDeadline);
    });
  });
});
