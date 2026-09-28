import { NextRequest, NextResponse } from 'next/server';
import { BcraCreditScoringService } from '@/services/bcra';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cuit: string }> }
) {
  try {
    const { cuit } = await params;
    const service = new BcraCreditScoringService();
    const report = await service.getBcraReport(cuit);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Error al consultar API BCRA Central de Deudores' },
      { status: 500 }
    );
  }
}
