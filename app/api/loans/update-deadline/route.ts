import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/services/supabase/client';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { authorizeLoanModification } from '../auth';

/**
 * Route handler for updating loan auction funding deadline.
 * Allows borrowers and admins to adjust funding_deadline for active funding loans.
 * Requires authenticated session of loan owner (borrower_id) or admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loan_id, funding_deadline } = body;

    if (!loan_id) {
      return NextResponse.json({ error: 'loan_id es requerido' }, { status: 400 });
    }

    // 1. Authorization check: Require authenticated borrower (owner) or admin
    const authResult = await authorizeLoanModification(req, loan_id);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // 2. Update in mock store
    const mockLoan = defaultMockStateStore.loans.find((l) => l.id === loan_id);
    if (mockLoan) {
      mockLoan.funding_deadline = funding_deadline ?? null;
    }

    // 3. Update in Supabase
    try {
      // 3a. Try admin client (bypasses RLS if SUPABASE_SERVICE_ROLE_KEY is set)
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from('loans')
        .update({ funding_deadline: funding_deadline ?? null })
        .eq('id', loan_id)
        .select()
        .maybeSingle();

      if (data) {
        return NextResponse.json({ success: true, dbUpdated: true, loan: data });
      }

      if (error) {
        console.warn('[update-deadline] adminClient update error:', error.message);
      }

      // 3b. Try server client with user session cookies
      try {
        const cookieStore = await cookies();
        const serverClient = createSupabaseServerClient({ cookies: cookieStore });
        const fallbackRes = await serverClient
          .from('loans')
          .update({ funding_deadline: funding_deadline ?? null })
          .eq('id', loan_id)
          .select()
          .maybeSingle();

        if (fallbackRes.data) {
          return NextResponse.json({ success: true, dbUpdated: true, loan: fallbackRes.data });
        }
      } catch (cookieErr: any) {
        console.warn('[update-deadline] serverClient cookie note:', cookieErr?.message);
      }
    } catch (dbErr: any) {
      console.warn('[update-deadline] DB update note:', dbErr?.message);
    }

    // If live Supabase is used and 0 rows were updated, signal RLS block
    if (process.env.NEXT_PUBLIC_USE_MOCKS !== 'true' && process.env.NODE_ENV !== 'test') {
      return NextResponse.json(
        {
          success: false,
          dbUpdated: false,
          rlsBlocked: true,
          error:
            'No se pudo actualizar el registro en Supabase (0 filas modificadas). Falta la política RLS en Supabase o configurar SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      dbUpdated: true,
      useMocks: true,
      loan: mockLoan ?? { id: loan_id, funding_deadline: funding_deadline ?? null },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error al actualizar el vencimiento del préstamo' },
      { status: 500 }
    );
  }
}

