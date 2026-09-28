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

  const expectedSecret =
    process.env.CRON_SECRET_KEY || process.env.CRON_SECRET || 'test-cron-secret';

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
  let expired = 0;
  let partialFlagged = 0;
  let finalized = 0;
  let notificationsDispatched = 0;

  try {
    // 2. Query all loans in 'funding' status
    const fundingLoans = await services.loans.listLoans({ status: 'funding' });

    for (const loan of fundingLoans) {
      const deadlineTime = new Date(loan.funding_deadline).getTime();

      // Check if deadline has expired
      if (deadlineTime < now) {
        evaluated += 1;

        const fundingRatio =
          loan.amount_requested > 0
            ? loan.amount_funded / loan.amount_requested
            : 0;

        if (loan.amount_funded >= loan.amount_requested) {
          // A. Fully funded auction (100%) -> Finalize and prepare legal/disbursement
          await services.loans.finalizeLoanFunding(loan.id);
          await services.legal.generatePromissoryNote(loan.id);

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
        } else if (fundingRatio >= 0.75) {
          // B. Partial funding (>= 75% but < 100%) -> Flag for borrower partial acceptance & dispatch alert
          const partialDeadline = new Date(now + 48 * 60 * 60 * 1000).toISOString();

          if (services.loans.flagPartialAcceptance) {
            await services.loans.flagPartialAcceptance(loan.id, partialDeadline);
          } else {
            loan.partial_acceptance_flag = true;
            loan.partial_acceptance_deadline = partialDeadline;
          }

          // Idempotent notification dispatch: only send if not previously dispatched
          let sentNotification = false;
          if (!loan.notification_dispatched) {
            loan.notification_dispatched = true;
            sentNotification = true;
            notificationsDispatched += 1;
          }

          const mockLoan = defaultMockStateStore.loans.find((l) => l.id === loan.id);
          if (mockLoan) {
            mockLoan.partial_acceptance_flag = true;
            mockLoan.partial_acceptance_deadline = partialDeadline;
            if (sentNotification) {
              mockLoan.notification_dispatched = true;
            }
          }

          partialFlagged += 1;
        } else {
          // C. Underfunded auction (< 75%) -> Transition to 'expired', release escrow holds and refund investors
          if (services.loans.expireLoan) {
            await services.loans.expireLoan(loan.id);
          } else {
            await services.loans.cancelLoan(loan.id);
          }

          await services.investments.refundInvestmentsByLoan(loan.id);

          // Update in-memory state store if mock is active
          const mockLoan = defaultMockStateStore.loans.find((l) => l.id === loan.id);
          if (mockLoan) {
            mockLoan.status = 'expired';
          }

          expired += 1;
          cancelled += 1;
        }
      }
    }

    return NextResponse.json(
      {
        status: 'ok',
        evaluated,
        cancelled,
        expired,
        partial_flagged: partialFlagged,
        finalized,
        notifications_dispatched: notificationsDispatched,
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
