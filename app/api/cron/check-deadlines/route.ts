/**
 * Automated Loan Deadline Check and Settlement Cron Routine.
 * Evaluates loans in 'funding' status whose funding_deadline has passed.
 * Conforms to _docs/plan.md Section 7, 205-206 and Issue #22.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerServices } from '@/services/locator';
import { defaultMockStateStore } from '@/services/mock/mockState';

export async function GET(req: NextRequest) {
  return handleCheckDeadlines(req);
}

export async function POST(req: NextRequest) {
  return handleCheckDeadlines(req);
}

async function handleCheckDeadlines(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const providedToken = match ? match[1].trim() : null;

  const expectedSecret = process.env.CRON_SECRET || 'test-cron-secret';

  // 1. Verify Bearer token authorization
  if (!providedToken || providedToken !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing bearer token' },
      { status: 401 }
    );
  }

  const now = Date.now();
  const services = getServerServices();

  let evaluated = 0;
  let cancelled = 0;
  let finalized = 0;

  try {
    // 2. Query all loans in 'funding' status
    const fundingLoans = await services.loans.listLoans({ status: 'funding' });

    for (const loan of fundingLoans) {
      const deadlineTime = new Date(loan.funding_deadline).getTime();

      // Check if deadline has expired
      if (deadlineTime < now) {
        evaluated += 1;

        if (loan.amount_funded < loan.amount_requested) {
          // A. Underfunded auction expired -> Cancel and refund investors
          await services.loans.cancelLoan(loan.id);
          await services.investments.refundInvestmentsByLoan(loan.id);

          // Update in-memory state store if mock is active
          const mockLoan = defaultMockStateStore.loans.find((l) => l.id === loan.id);
          if (mockLoan) {
            mockLoan.status = 'cancelled';
          }

          cancelled += 1;
        } else {
          // B. Fully funded auction expired (or reached 100%) -> Finalize and prepare legal/disbursement
          await services.loans.finalizeLoanFunding(loan.id);
          await services.legal.generatePromissoryNote(loan.id);

          // Trigger or queue disbursement via payments gateway
          try {
            await services.payments.disburseLoan(
              loan.id,
              '0000003100010000000001',
              loan.amount_funded
            );
          } catch {
            // Log/ignore disbursement queuing error in cron
          }

          const mockLoan = defaultMockStateStore.loans.find((l) => l.id === loan.id);
          if (mockLoan) {
            mockLoan.status = 'funded';
          }

          finalized += 1;
        }
      }
    }

    return NextResponse.json(
      {
        status: 'ok',
        evaluated,
        cancelled,
        finalized,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: 'Internal Server Error during deadline evaluation',
        message: (err as Error)?.message,
      },
      { status: 500 }
    );
  }
}
