import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseLoanService,
  SupabaseInvestmentService,
  SupabaseLegalService,
  mapSupabaseError,
  ApplicationError,
} from '@/services/supabase';
import {
  createLiveServices,
  createServices,
  registerLiveServices,
  clearLiveServices,
  getLiveServices,
} from '@/services/factory';
import type { Loan, PaymentGatewayInterface } from '@/types';

// Mock helper to build chainable Supabase query builder
function createMockSupabaseClient(overrides: Record<string, any> = {}) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };

  const client: any = {
    from: vi.fn().mockReturnValue(builder),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    ...overrides,
  };

  return { client, builder };
}

describe('Live Supabase Backend Service Implementations (Issue #19)', () => {
  beforeEach(() => {
    clearLiveServices();
  });

  describe('Error Mapping & Sanitization (mapSupabaseError)', () => {
    it('maps overfunding RPC error to user-friendly message', () => {
      const err = new Error('RAISE EXCEPTION: El monto excede el cupo disponible de la subasta');
      const mapped = mapSupabaseError(err);
      expect(mapped).toBeInstanceOf(ApplicationError);
      expect(mapped.message).toBe('El monto excede el cupo disponible de la subasta');
      expect(mapped.code).toBe('OVERFUNDING_REJECTED');
      expect(mapped.statusCode).toBe(400);
    });

    it('maps invalid loan status to user-friendly message', () => {
      const err = new Error('RAISE EXCEPTION: El préstamo no se encuentra en estado de fondeo');
      const mapped = mapSupabaseError(err);
      expect(mapped.message).toBe('El préstamo no se encuentra en estado de fondeo');
      expect(mapped.code).toBe('INVALID_LOAN_STATUS');
    });

    it('sanitizes raw PostgreSQL syntax errors without leaking SQL internals', () => {
      const rawSqlError = {
        message: 'syntax error at or near "SELECT" in relation loans_tbl_internal',
        code: '42601',
      };
      const mapped = mapSupabaseError(rawSqlError);
      expect(mapped.message).toBe('Error en la base de datos');
      expect(mapped.message).not.toContain('loans_tbl_internal');
      expect(mapped.code).toBe('42601');
    });
  });

  describe('SupabaseLoanService', () => {
    it('submits loan application and inserts record into "loans" table', async () => {
      const mockCreatedLoan: Loan = {
        id: 'loan-sup-1',
        borrower_id: 'user-borrower-1',
        amount_requested: 5_000_000,
        amount_funded: 0,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 0,
        platform_spread: 0,
        borrower_rate: 0,
        base_uva_value: null,
        category: 'working_capital',
        status: 'in_review',
        funding_deadline: '2026-10-25T00:00:00.000Z',
        created_at: '2026-09-25T00:00:00.000Z',
      };

      const { client, builder } = createMockSupabaseClient();
      builder.single.mockResolvedValueOnce({ data: mockCreatedLoan, error: null });

      const loanService = new SupabaseLoanService(client as unknown as SupabaseClient);

      const result = await loanService.submitLoanApplication({
        borrower_id: 'user-borrower-1',
        amount_requested: 5_000_000,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        category: 'working_capital',
      });

      expect(client.from).toHaveBeenCalledWith('loans');
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          borrower_id: 'user-borrower-1',
          amount_requested: 5_000_000,
          term_months: 6,
          status: 'in_review',
        })
      );
      expect(result.id).toBe('loan-sup-1');
    });

    it('approves and publishes loan, updating rates, status and borrower credit profile', async () => {
      const mockApprovedLoan: Loan = {
        id: 'loan-sup-1',
        borrower_id: 'user-borrower-1',
        amount_requested: 5_000_000,
        amount_funded: 0,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 45.0,
        platform_spread: 3.0,
        borrower_rate: 48.0,
        base_uva_value: null,
        category: 'working_capital',
        status: 'funding',
        funding_deadline: '2026-10-31T23:59:59.000Z',
        created_at: '2026-09-25T00:00:00.000Z',
      };

      const { client, builder } = createMockSupabaseClient();
      builder.single.mockResolvedValueOnce({ data: mockApprovedLoan, error: null });

      const loanService = new SupabaseLoanService(client as unknown as SupabaseClient);

      const result = await loanService.approveAndPublishLoan({
        loan_id: 'loan-sup-1',
        risk_tier: 'Tier A',
        investor_rate: 45.0,
        platform_spread: 3.0,
        funding_deadline: '2026-10-31T23:59:59.000Z',
      });

      expect(client.from).toHaveBeenCalledWith('loans');
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          investor_rate: 45.0,
          platform_spread: 3.0,
          borrower_rate: 48.0,
          status: 'funding',
        })
      );
      expect(client.from).toHaveBeenCalledWith('sme_credit_profiles');
      expect(result.status).toBe('funding');
    });

    it('fetches loan by id and maps maybeSingle response', async () => {
      const mockLoan: Loan = {
        id: 'loan-123',
        borrower_id: 'borrower-1',
        amount_requested: 1_000_000,
        amount_funded: 500_000,
        term_months: 3,
        rate_type: 'TNA_FIXED',
        investor_rate: 40,
        platform_spread: 2,
        borrower_rate: 42,
        base_uva_value: null,
        category: 'machinery',
        status: 'funding',
        funding_deadline: '2026-10-30T00:00:00.000Z',
        created_at: '2026-09-25T00:00:00.000Z',
      };

      const { client, builder } = createMockSupabaseClient();
      builder.maybeSingle.mockResolvedValueOnce({ data: mockLoan, error: null });

      const loanService = new SupabaseLoanService(client as unknown as SupabaseClient);
      const loan = await loanService.getLoanById('loan-123');

      expect(client.from).toHaveBeenCalledWith('loans');
      expect(builder.eq).toHaveBeenCalledWith('id', 'loan-123');
      expect(loan).toEqual(mockLoan);
    });
  });

  describe('SupabaseInvestmentService', () => {
    it('invokes commit_investment_atomic RPC procedure and holds funds via payment gateway', async () => {
      const mockPaymentGateway: PaymentGatewayInterface = {
        holdFunds: vi.fn().mockResolvedValue({ holdId: 'hold-123', success: true }),
        releaseFunds: vi.fn().mockResolvedValue({ success: true }),
        disburseLoan: vi.fn().mockResolvedValue({ transferId: 'tr-1', success: true }),
        collectInstallment: vi.fn().mockResolvedValue({ paymentId: 'pay-1', status: 'settled' }),
      };

      const mockLoan: Loan = {
        id: 'loan-target',
        borrower_id: 'borrower-1',
        amount_requested: 10_000_000,
        amount_funded: 2_000_000,
        term_months: 12,
        rate_type: 'TNA_FIXED',
        investor_rate: 45,
        platform_spread: 2.5,
        borrower_rate: 47.5,
        base_uva_value: null,
        category: 'expansion',
        status: 'funding',
        funding_deadline: '2026-10-30T00:00:00.000Z',
        created_at: '2026-09-25T00:00:00.000Z',
      };

      const { client, builder } = createMockSupabaseClient();
      client.rpc.mockResolvedValueOnce({
        data: { success: true, amount_funded: 2_000_000 },
        error: null,
      });
      builder.single.mockResolvedValueOnce({ data: mockLoan, error: null });

      const investmentService = new SupabaseInvestmentService(
        client as unknown as SupabaseClient,
        mockPaymentGateway
      );

      const result = await investmentService.commitInvestment({
        loan_id: 'loan-target',
        investor_id: 'investor-1',
        amount: 2_000_000,
      });

      expect(mockPaymentGateway.holdFunds).toHaveBeenCalledWith('investor-1', 2_000_000, 'loan-target');
      expect(client.rpc).toHaveBeenCalledWith('commit_investment_atomic', {
        p_loan_id: 'loan-target',
        p_investor_id: 'investor-1',
        p_amount: 2_000_000,
      });
      expect(result.amount_funded).toBe(2_000_000);
      expect(result.is_fully_funded).toBe(false);
    });

    it('releases held funds and maps error when commit_investment_atomic RPC fails', async () => {
      const mockPaymentGateway: PaymentGatewayInterface = {
        holdFunds: vi.fn().mockResolvedValue({ holdId: 'hold-456', success: true }),
        releaseFunds: vi.fn().mockResolvedValue({ success: true }),
        disburseLoan: vi.fn(),
        collectInstallment: vi.fn(),
      };

      const { client } = createMockSupabaseClient();
      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'El monto excede el cupo disponible de la subasta' },
      });

      const investmentService = new SupabaseInvestmentService(
        client as unknown as SupabaseClient,
        mockPaymentGateway
      );

      await expect(
        investmentService.commitInvestment({
          loan_id: 'loan-target',
          investor_id: 'investor-1',
          amount: 50_000_000,
        })
      ).rejects.toThrow('El monto excede el cupo disponible de la subasta');

      expect(mockPaymentGateway.releaseFunds).toHaveBeenCalledWith('hold-456');
    });

    it('refunds investments and releases held funds on loan cancellation', async () => {
      const mockPaymentGateway: PaymentGatewayInterface = {
        holdFunds: vi.fn(),
        releaseFunds: vi.fn().mockResolvedValue({ success: true }),
        disburseLoan: vi.fn(),
        collectInstallment: vi.fn(),
      };

      const { client, builder } = createMockSupabaseClient();
      const mockInvestments = [
        { id: 'inv-1', loan_id: 'loan-cancelled', amount: 500_000, status: 'committed', external_payment_id: 'hold-1' },
        { id: 'inv-2', loan_id: 'loan-cancelled', amount: 300_000, status: 'committed', external_payment_id: 'hold-2' },
      ];
      builder.order.mockResolvedValueOnce({ data: mockInvestments, error: null });
      // When select is called without order:
      (builder as any).eq.mockImplementation((field: string, val: any) => {
        if (field === 'status' && val === 'committed') {
          return Promise.resolve({ data: mockInvestments, error: null });
        }
        return builder;
      });

      const investmentService = new SupabaseInvestmentService(
        client as unknown as SupabaseClient,
        mockPaymentGateway
      );

      const refundResult = await investmentService.refundInvestmentsByLoan('loan-cancelled');

      expect(refundResult.refunded_count).toBe(2);
      expect(refundResult.total_refunded_amount).toBe(800_000);
      expect(mockPaymentGateway.releaseFunds).toHaveBeenCalledWith('hold-1');
      expect(mockPaymentGateway.releaseFunds).toHaveBeenCalledWith('hold-2');
    });
  });

  describe('SupabaseLegalService', () => {
    it('generates electronic promissory note record in legal_contracts table', async () => {
      const mockContract = {
        id: 'contract-pagare-1',
        loan_id: 'loan-100',
        document_type: 'pagare',
        document_url: 'https://storage.lencord.ar/contracts/loan-100/pagare-electronico.pdf',
        signature_hash: null,
        signed_at: null,
      };

      const { client, builder } = createMockSupabaseClient();
      builder.single.mockResolvedValueOnce({ data: mockContract, error: null });

      const legalService = new SupabaseLegalService(client as unknown as SupabaseClient);
      const contract = await legalService.generatePromissoryNote('loan-100');

      expect(client.from).toHaveBeenCalledWith('legal_contracts');
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          loan_id: 'loan-100',
          document_type: 'pagare',
        })
      );
      expect(contract.document_type).toBe('pagare');
    });

    it('signs contract updating signature_hash and timestamp', async () => {
      const mockSignedContract = {
        id: 'contract-1',
        loan_id: 'loan-100',
        document_type: 'pagare',
        document_url: 'https://storage.lencord.ar/contracts/loan-100/pagare-electronico.pdf',
        signature_hash: 'sha256_hash_abc123',
        signed_at: '2026-09-25T14:00:00.000Z',
      };

      const { client, builder } = createMockSupabaseClient();
      builder.single.mockResolvedValueOnce({ data: mockSignedContract, error: null });

      const legalService = new SupabaseLegalService(client as unknown as SupabaseClient);
      const signed = await legalService.signContract({
        contract_id: 'contract-1',
        signature_hash: 'sha256_hash_abc123',
      });

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          signature_hash: 'sha256_hash_abc123',
        })
      );
      expect(signed.signature_hash).toBe('sha256_hash_abc123');
    });
  });

  describe('Service Factory Integration with Supabase Services', () => {
    it('instantiates and registers Supabase services into the factory container', () => {
      const { client } = createMockSupabaseClient();
      const loanService = new SupabaseLoanService(client as unknown as SupabaseClient);
      const investmentService = new SupabaseInvestmentService(client as unknown as SupabaseClient);
      const legalService = new SupabaseLegalService(client as unknown as SupabaseClient);

      registerLiveServices({
        loans: loanService,
        investments: investmentService,
        legal: legalService,
      });

      const live = getLiveServices();
      expect(live.loans).toBe(loanService);
      expect(live.investments).toBe(investmentService);
      expect(live.legal).toBe(legalService);
    });
  });
});
