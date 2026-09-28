import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/bcra/[cuit]/route';

describe('Server-Side BCRA Central de Deudores Route Handler (Issue #37)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('queries official BCRA API from server-side context with sanitized CUIT and returns parsed report', async () => {
    const mockBcraResponse = {
      status: 200,
      results: {
        identificacion: 30712345678,
        denominacion: 'TECNOLOGIA Y SERVICIOS S.A.',
        periodos: [
          {
            periodo: '202608',
            entidades: [
              {
                entidad: 'BANCO SANTANDER ARGENTINA S.A.',
                situacion: 1,
                monto: 2500, // $2,500,000 ARS
                diasAtraso: 0,
              },
            ],
          },
        ],
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockBcraResponse),
    }) as any;

    const request = new NextRequest('http://localhost:3000/api/bcra/30712345678');
    const response = await GET(request, {
      params: Promise.resolve({ cuit: '30712345678' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cuit).toBe('30712345678');
    expect(data.worstSituation).toBe(1);
    expect(data.totalDebt).toBe(2_500_000);
    expect(data.entities).toHaveLength(1);
    expect(data.entities[0].entityName).toBe('BANCO SANTANDER ARGENTINA S.A.');
  });

  it('handles 404 response gracefully as "Sin deuda bancaria registrada / Sin calificación previa"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ status: 404 }),
    }) as any;

    const request = new NextRequest('http://localhost:3000/api/bcra/20334455667');
    const response = await GET(request, {
      params: Promise.resolve({ cuit: '20334455667' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.worstSituation).toBeNull();
    expect(data.totalDebt).toBe(0);
    expect(data.entities).toEqual([]);
    expect(data.isClean).toBe(true);
    expect(data.statusDescription).toContain('Sin deuda bancaria registrada');
  });

  it('handles timeout or network failure gracefully returning fallback payload without crashing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;

    const request = new NextRequest('http://localhost:3000/api/bcra/20112233445');
    const response = await GET(request, {
      params: Promise.resolve({ cuit: '20112233445' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.worstSituation).toBeNull();
    expect(data.totalDebt).toBe(0);
    expect(data.statusDescription).toContain('Servicio BCRA no disponible');
  });
});
