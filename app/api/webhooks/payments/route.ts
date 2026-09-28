/**
 * Banking-as-a-Service Payment Webhook Route Handler.
 * Receives asynchronous transaction events (fund hold confirmed, transfer settled, debit failed).
 * Conforms to _docs/plan.md Section 7 & 8.2 and Issue #21 & #40.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isTimestampValid, verifyWebhookSignature } from '@/services/payments/crypto';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { createSupabaseAdminClient } from '@/services/supabase/client';

export interface WebhookEventPayload {
  eventId: string;
  eventType:
    | 'hold.confirmed'
    | 'hold.released'
    | 'transfer.settled'
    | 'investment.settled'
    | 'disbursement.settled'
    | 'loan.disbursed'
    | 'installment.paid'
    | 'debit.settled'
    | 'debit.failed'
    | 'payment.failed';
  timestamp?: number | string;
  idempotencyKey?: string;
  data: {
    investmentId?: string;
    installmentId?: string;
    loanId?: string;
    amount?: number;
    status?: string;
    referenceId?: string;
  };
}

// In-memory idempotency cache for deduplicating webhook events
export const processedWebhookEvents = new Set<string>();

export function clearProcessedWebhookEvents(): void {
  processedWebhookEvents.clear();
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('x-signature') ||
      req.headers.get('x-webhook-signature') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const timestampHeader =
      req.headers.get('x-timestamp') ||
      req.headers.get('x-webhook-timestamp') ||
      req.headers.get('timestamp');

    const secret = process.env.BAAS_WEBHOOK_SECRET || 'test-webhook-secret';

    // 1. Timestamp validation (Replay window: max 300 seconds / 5 minutes)
    if (timestampHeader) {
      if (!isTimestampValid(timestampHeader, 300)) {
        return NextResponse.json(
          { error: 'Unauthorized: Webhook timestamp expired (replay attack prevention)' },
          { status: 401 }
        );
      }
    }

    // 2. Cryptographic HMAC-SHA256 signature validation
    const isValid = verifyWebhookSignature(rawBody, signature, secret, timestampHeader);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing webhook signature' },
        { status: 401 }
      );
    }

    let payload: WebhookEventPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Bad Request: Malformed JSON payload' },
        { status: 400 }
      );
    }

    if (!payload.eventId || !payload.eventType) {
      return NextResponse.json(
        { error: 'Bad Request: Missing eventId or eventType' },
        { status: 400 }
      );
    }

    // Also check payload timestamp if header was omitted but payload has timestamp
    if (!timestampHeader && payload.timestamp !== undefined) {
      if (!isTimestampValid(payload.timestamp, 300)) {
        return NextResponse.json(
          { error: 'Unauthorized: Webhook timestamp expired (replay attack prevention)' },
          { status: 401 }
        );
      }
    }

    // 3. Idempotency Check
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      payload.idempotencyKey ||
      payload.eventId;

    if (processedWebhookEvents.has(idempotencyKey) || processedWebhookEvents.has(payload.eventId)) {
      return NextResponse.json(
        { status: 'ok', duplicated: true, eventId: payload.eventId, idempotencyKey },
        { status: 200 }
      );
    }

    // 4. Process event updates on investments and loans tables
    const { eventType, data } = payload;

    // A. Update Investment and Loan records on settlement
    if (
      eventType === 'investment.settled' ||
      eventType === 'hold.confirmed'
    ) {
      if (data.investmentId) {
        // Update in-memory mock store
        const mockInv = defaultMockStateStore.investments.find(
          (i) => i.id === data.investmentId
        );
        if (mockInv) {
          mockInv.status = 'settled';
        }

        // Update database if configured
        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co'
        ) {
          try {
            const supabase = createSupabaseAdminClient();
            await supabase
              .from('investments')
              .update({ status: 'settled' })
              .eq('id', data.investmentId);
          } catch {
            // Ignore DB connection errors if running in standalone/test mode
          }
        }
      }

      // Update corresponding loan if loanId is provided
      if (data.loanId) {
        const mockLoan = defaultMockStateStore.loans.find((l) => l.id === data.loanId);
        if (mockLoan) {
          if (data.amount && data.amount > 0) {
            mockLoan.amount_funded = Math.min(
              mockLoan.amount_requested,
              mockLoan.amount_funded + data.amount
            );
            if (mockLoan.amount_funded >= mockLoan.amount_requested) {
              mockLoan.status = 'funded';
            }
          }
          if (data.status) {
            mockLoan.status = data.status as any;
          }
        }

        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co'
        ) {
          try {
            const supabase = createSupabaseAdminClient();
            const { data: currentLoan } = await supabase
              .from('loans')
              .select('*')
              .eq('id', data.loanId)
              .single();

            if (currentLoan) {
              const newAmountFunded = data.amount
                ? Math.min(currentLoan.amount_requested, Number(currentLoan.amount_funded) + data.amount)
                : currentLoan.amount_funded;
              const newStatus =
                data.status ||
                (newAmountFunded >= currentLoan.amount_requested ? 'funded' : currentLoan.status);

              await supabase
                .from('loans')
                .update({ amount_funded: newAmountFunded, status: newStatus })
                .eq('id', data.loanId);
            }
          } catch {
            // Ignore DB errors in test environments
          }
        }
      }
    }

    // B. Update Loan records on disbursement (transition to 'active')
    if (
      eventType === 'transfer.settled' ||
      eventType === 'disbursement.settled' ||
      eventType === 'loan.disbursed'
    ) {
      if (data.loanId) {
        const mockLoan = defaultMockStateStore.loans.find((l) => l.id === data.loanId);
        if (mockLoan) {
          mockLoan.status = 'active';
        }

        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co'
        ) {
          try {
            const supabase = createSupabaseAdminClient();
            await supabase
              .from('loans')
              .update({ status: 'active' })
              .eq('id', data.loanId);
          } catch {
            // Ignore DB errors in test environments
          }
        }
      }
    }

    // C. Update Investment on hold release
    if (eventType === 'hold.released') {
      if (data.investmentId) {
        const mockInv = defaultMockStateStore.investments.find(
          (i) => i.id === data.investmentId
        );
        if (mockInv) {
          mockInv.status = 'refunded';
        }

        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co'
        ) {
          try {
            const supabase = createSupabaseAdminClient();
            await supabase
              .from('investments')
              .update({ status: 'refunded' })
              .eq('id', data.investmentId);
          } catch {}
        }
      }
    }

    // D. Update Installment records on payment
    if (eventType === 'installment.paid' || eventType === 'debit.settled') {
      if (data.installmentId) {
        const now = new Date().toISOString();
        const mockInst = defaultMockStateStore.installments.find(
          (i) => i.id === data.installmentId
        );
        if (mockInst) {
          mockInst.status = 'paid';
          mockInst.paid_at = now;
        }

        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co'
        ) {
          try {
            const supabase = createSupabaseAdminClient();
            await supabase
              .from('installments')
              .update({ status: 'paid', paid_at: now })
              .eq('id', data.installmentId);
          } catch {}
        }
      }
    }

    // E. Update Installment records on debit failure
    if (eventType === 'debit.failed' || eventType === 'payment.failed') {
      if (data.installmentId) {
        const mockInst = defaultMockStateStore.installments.find(
          (i) => i.id === data.installmentId
        );
        if (mockInst) {
          mockInst.status = 'overdue';
        }

        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co'
        ) {
          try {
            const supabase = createSupabaseAdminClient();
            await supabase
              .from('installments')
              .update({ status: 'overdue' })
              .eq('id', data.installmentId);
          } catch {}
        }
      }
    }

    // 5. Record event as processed for idempotency
    processedWebhookEvents.add(payload.eventId);
    if (idempotencyKey) {
      processedWebhookEvents.add(idempotencyKey);
    }

    return NextResponse.json(
      { status: 'ok', success: true, eventId: payload.eventId, idempotencyKey },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: (err as Error)?.message },
      { status: 500 }
    );
  }
}
