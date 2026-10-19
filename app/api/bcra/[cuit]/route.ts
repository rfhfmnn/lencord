import { NextRequest, NextResponse } from 'next/server';
import { BcraCreditScoringService } from '@/services/bcra';
import { getAuthenticatedUser } from '@/app/api/loans/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cuit: string }> }
) {
  try {
    // 1. Authentication check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Se requiere iniciar sesión para consultar el reporte crediticio' },
        { status: 401 }
      );
    }

    const { cuit } = await params;
    const cleanCuit = (cuit || '').replace(/\D/g, '');

    // 2. Format validation (Argentine CUIT/CUIL: exactly 11 numeric digits)
    if (!cleanCuit || cleanCuit.length !== 11) {
      return NextResponse.json(
        { error: 'Bad Request: El CUIT debe contener exactamente 11 dígitos numéricos' },
        { status: 400 }
      );
    }

    const service = new BcraCreditScoringService();
    const report = await service.getBcraReport(cleanCuit);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error al consultar API BCRA Central de Deudores' },
      { status: 500 }
    );
  }
}

