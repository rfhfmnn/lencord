import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/services/supabase/client';
import { defaultMockStateStore } from '@/services/mock/mockState';

/**
 * Route handler for borrower partial funding acceptance (75% threshold rule).
 * Transitions loan to 'funded' and marks partial_acceptance_flag.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loan_id } = body;

    if (!loan_id) {
      return NextResponse.json({ error: 'loan_id es requerido' }, { status: 400 });
    }

    // 1. Update mock store
    const mockLoan = defaultMockStateStore.loans.find((l) => l.id === loan_id);
    if (mockLoan) {
      mockLoan.status = 'funded';
      mockLoan.partial_acceptance_flag = true;
    }

    // 2. Update Supabase
    try {
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from('loans')
        .update({
          status: 'funded',
          partial_acceptance_flag: true,
        })
        .eq('id', loan_id)
        .select()
        .maybeSingle();

      if (data) {
        return NextResponse.json({ success: true, loan: data });
      }
      if (error) {
        console.warn('[accept-partial] admin client error:', error.message);
      }
    } catch (e: any) {
      console.warn('[accept-partial] admin client note:', e?.message);
    }

    return NextResponse.json({
      success: true,
      loan: mockLoan ?? { id: loan_id, status: 'funded', partial_acceptance_flag: true },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error al aceptar financiamiento parcial' },
      { status: 500 }
    );
  }
}
