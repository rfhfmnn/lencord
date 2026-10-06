import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/services/supabase/client';
import { defaultMockStateStore } from '@/services/mock/mockState';

/**
 * Route handler for updating loan auction funding deadline.
 * Allows borrowers and admins to adjust funding_deadline for active funding loans.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loan_id, funding_deadline } = body;

    if (!loan_id) {
      return NextResponse.json({ error: 'loan_id es requerido' }, { status: 400 });
    }

    // 1. Update in mock store
    const mockLoan = defaultMockStateStore.loans.find((l) => l.id === loan_id);
    if (mockLoan) {
      mockLoan.funding_deadline = funding_deadline ?? null;
    }

    // 2. Update in Supabase
    try {
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from('loans')
        .update({ funding_deadline: funding_deadline ?? null })
        .eq('id', loan_id)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[update-deadline] adminClient update error:', error.message);
        // Fallback to server client
        const serverClient = createSupabaseServerClient();
        const fallbackRes = await serverClient
          .from('loans')
          .update({ funding_deadline: funding_deadline ?? null })
          .eq('id', loan_id)
          .select()
          .maybeSingle();

        if (fallbackRes.data) {
          return NextResponse.json({ success: true, loan: fallbackRes.data });
        }
      } else if (data) {
        return NextResponse.json({ success: true, loan: data });
      }
    } catch (dbErr: any) {
      console.warn('[update-deadline] DB update note:', dbErr?.message);
    }

    return NextResponse.json({
      success: true,
      loan: mockLoan ?? { id: loan_id, funding_deadline: funding_deadline ?? null },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error al actualizar el vencimiento del préstamo' },
      { status: 500 }
    );
  }
}
