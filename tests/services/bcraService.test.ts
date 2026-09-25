import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BcraCreditScoringService } from '@/services/bcra';

describe('BCRA Central de Deudores External API Integration (Issue #20)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('queries official BCRA API endpoint with sanitized CUIT and extracts Situation 1', async () => {
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
                monto: 1500, // $1,500,000 ARS
                diasAtraso: 0,
              },
              {
                entidad: 'BANCO BBVA ARGENTINA S.A.',
                situacion: 1,
                monto: 500, // $500,000 ARS
                diasAtraso: 0,
              },
            ],
          },
        ],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockBcraResponse),
    });

    const service = new BcraCreditScoringService({ customFetch: mockFetch as any });
    const report = await service.getBcraReport('30-71234567-8');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/30712345678',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );

    expect(report.cuit).toBe('30712345678');
    expect(report.worstSituation).toBe(1);
    expect(report.totalDebt).toBe(2_000_000);
    expect(report.entities).toHaveLength(2);
    expect(report.entities[0].entityName).toBe('BANCO SANTANDER ARGENTINA S.A.');
    expect(report.isClean).toBe(true);
    expect(report.statusDescription).toContain('Situación 1');
  });

  it('correctly parses Situation 3 (con atrasos) and sets isClean to false', async () => {
    const mockBcraResponse = {
      status: 200,
      results: {
        identificacion: 30987654321,
        denominacion: 'CONSTRUCCIONES DEL SUR S.R.L.',
        periodos: [
          {
            periodo: '202608',
            entidades: [
              {
                entidad: 'BANCO DE LA NACION ARGENTINA',
                situacion: 1,
                monto: 1000,
                diasAtraso: 0,
              },
              {
                entidad: 'BANCO DE GALICIA Y BUENOS AIRES S.A.',
                situacion: 3,
                monto: 4500, // $4,500,000 ARS
                diasAtraso: 115,
              },
            ],
          },
        ],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockBcraResponse),
    });

    const service = new BcraCreditScoringService({ customFetch: mockFetch as any });
    const report = await service.getBcraReport('30987654321');

    expect(report.worstSituation).toBe(3);
    expect(report.totalDebt).toBe(5_500_000);
    expect(report.isClean).toBe(false);
    expect(report.statusDescription).toContain('Situación 3 - Con problemas');
  });

  it('handles 404 Not Found gracefully by returning normalized null situation status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ status: 404, errorMessages: ['No data'] }),
    });

    const service = new BcraCreditScoringService({ customFetch: mockFetch as any });
    const report = await service.getBcraReport('20334455667');

    expect(report.worstSituation).toBeNull();
    expect(report.totalDebt).toBe(0);
    expect(report.entities).toEqual([]);
    expect(report.isClean).toBe(true);
    expect(report.statusDescription).toBe('Sin deuda bancaria registrada / Sin calificación previa');
  });

  it('handles timeout error gracefully without blocking application submission', async () => {
    const mockFetch = vi.fn().mockImplementation((url, options) => {
      return new Promise((_, reject) => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

    const service = new BcraCreditScoringService({
      customFetch: mockFetch as any,
      timeoutMs: 50,
    });

    const report = await service.getBcraReport('20112233445');

    expect(report.worstSituation).toBeNull();
    expect(report.totalDebt).toBe(0);
    expect(report.isClean).toBe(true);
    expect(report.statusDescription).toContain('Sin deuda bancaria registrada / Sin calificación previa');
  });

  it('handles network error fallback so submission is not blocked if BCRA API is down', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const service = new BcraCreditScoringService({ customFetch: mockFetch as any });
    const report = await service.getBcraReport('20112233445');

    expect(report.worstSituation).toBeNull();
    expect(report.totalDebt).toBe(0);
    expect(report.isClean).toBe(true);
    expect(report.statusDescription).toContain('Servicio BCRA no disponible');
  });

  it('evaluates credit risk tier based on BCRA situation and documentation flags', async () => {
    const mockBcraResponse = {
      status: 200,
      results: {
        periodos: [
          {
            entidades: [
              { entidad: 'BANCO MACRO S.A.', situacion: 1, monto: 100 },
            ],
          },
        ],
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockBcraResponse),
    });

    const service = new BcraCreditScoringService({ customFetch: mockFetch as any });

    // Situation 1 with full documentation -> Tier A
    const profileA = await service.evaluateCreditRisk({
      profileId: 'sme-prof-1',
      taxId: '30712345678',
      hasBalanceSheet: true,
      hasF931: true,
    });
    expect(profileA.risk_tier).toBe('Tier A');
    expect(profileA.bcra_situation).toBe(1);

    // Situation 3 -> Tier C
    const mockFetchSit3 = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        results: {
          periodos: [{ entidades: [{ entidad: 'BANCO X', situacion: 3, monto: 500 }] }],
        },
      }),
    });
    const serviceSit3 = new BcraCreditScoringService({ customFetch: mockFetchSit3 as any });
    const profileC = await serviceSit3.evaluateCreditRisk({
      profileId: 'sme-prof-2',
      taxId: '30712345678',
      hasBalanceSheet: true,
    });
    expect(profileC.risk_tier).toBe('Tier C');
    expect(profileC.bcra_situation).toBe(3);
  });
});
