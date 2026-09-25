/**
 * Banking-as-a-Service Payment Webhook Route Handler.
 * Receives asynchronous transaction events (fund hold confirmed, transfer settled, debit failed).
 * Conforms to _docs/plan.md Section 7 & 8.2 and Issue #21.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/services/payments/crypto';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { createSupabaseAdminClient } from '@/services/supabase/client';

export interface WebhookEventPayload {
  eventId: string;
  eventType:
    | 'hold.confirmed'
    | 'hold.released'
    | 'transfer.settled'
    | 'investment.settled'
    | 'installment.paid'
    | 'debit.settled'
    | 'debit.failed'
    | 'payment.failed';
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
      req.headers.get('x-webhook-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const secret = process.env.BAAS_WEBHOOK_SECRET || 'test-webhook-secret';

    // 1. Cryptographic signature validation
    const isValid = verifyWebhookSignature(rawBody, signature, secret);
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

    // 2. Idempotency Check
    if (processedWebhookEvents.has(payload.eventId)) {
      return NextResponse.json(
        { status: 'ok', duplicated: true, eventId: payload.eventId },
        { status: 200 }
      );
    }

    // 3. Process event updates
    const { eventType, data } = payload;

    // A. Update Investment records on settlement
    if (
      eventType === 'investment.settled' ||
      eventType === 'transfer.settled' ||
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
    }

    // B. Update Installment records on payment
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

    // C. Update Installment records on debit failure
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

    // 4. Record event as processed for idempotency
    processedWebhookEvents.add(payload.eventId);

    return NextResponse.json(
      { status: 'ok', success: true, eventId: payload.eventId },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: (err as Error)?.message },
      { status: 500 }
    );
  }
}
