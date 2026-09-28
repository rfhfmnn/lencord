import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Loan, PaymentGatewayInterface, Profile } from '@/types';
import { createServices } from '@/services/factory';
import { MockStateStore } from '@/services/mock/mockState';
import { generateSha256 } from '@/components/legal/PromissoryNoteModal';

describe('Electronic Promissory Note Generation, OTP Signing & Loan Activation (Issue #42)', () => {
  let store: MockStateStore;

  const sampleBorrower: Profile = {
    id: 'prof-sme-042',
    role: 'sme',
    tax_id: '30719998881',
    legal_name: 'Soluciones Tecnologicas Cordoba SA',
    phone: '+54 351 450-9900',
    kyc_status: 'approved',
    bank_cbu_cvu: '0720123488000012345678',
    created_at: '2026-03-01T10:00:00.000Z',
  };

  const sampleFundedLoan: Loan = {
    id: 'loan-funded-042',
    borrower_id: 'prof-sme-042',
    amount_requested: 12_000_000,
    amount_funded: 12_000_000,
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 45.0,
    platform_spread: 3.0,
    borrower_rate: 48.0,
    base_uva_value: null,
    category: 'working_capital',
    status: 'funded',
    funding_deadline: '2026-11-30T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  beforeEach(() => {
    store = new MockStateStore();
    store.profiles.push({ ...sampleBorrower });
    store.loans.push({ ...sampleFundedLoan });
  });

  it('generates promissory note contract with borrower details and promissory note terms', async () => {
    const services = createServices({ store, useMocks: true });

    const contract = await services.legal.generatePromissoryNote(sampleFundedLoan.id);
    expect(contract).toBeDefined();
    expect(contract.loan_id).toBe(sampleFundedLoan.id);
    expect(contract.document_type).toBe('pagare');
    expect(contract.signature_hash).toBeNull();
    expect(contract.signed_at).toBeNull();

    const storedContracts = await services.legal.getContractsByLoan(sampleFundedLoan.id);
    expect(storedContracts).toHaveLength(1);
    expect(storedContracts[0].id).toBe(contract.id);
  });

  it('records cryptographic hash and timestamp upon signature and activates loan with disbursement and installments', async () => {
    const mockPaymentGateway: PaymentGatewayInterface = {
      holdFunds: vi.fn(),
      releaseFunds: vi.fn(),
      disburseLoan: vi.fn().mockResolvedValue({ transferId: 'tr_test_042', success: true }),
      collectInstallment: vi.fn(),
    };

    const services = createServices({
      store,
      useMocks: true,
      paymentGateway: mockPaymentGateway as any,
    });

    // 1. Generate unsigned contract
    const contract = await services.legal.generatePromissoryNote(sampleFundedLoan.id);

    // 2. Compute SHA-256 signature hash
    const signaturePayload = `LENCORD:PAGARE:${sampleFundedLoan.id}:${sampleBorrower.tax_id}:${sampleFundedLoan.amount_requested}:123456:${new Date().toISOString()}`;
    const signatureHash = await generateSha256(signaturePayload);

    // 3. Sign contract via LegalServiceInterface
    const signed = await services.legal.signContract({
      contract_id: contract.id,
      signature_hash: signatureHash,
    });

    expect(signed.signature_hash).toBe(signatureHash);
    expect(signed.signed_at).toBeDefined();

    // 4. Activate loan via LoanServiceInterface
    const activated = await services.loans.activateLoan!(sampleFundedLoan.id);
    expect(activated.status).toBe('active');

    // 5. Verify payment gateway disbursement was triggered
    expect(mockPaymentGateway.disburseLoan).toHaveBeenCalledWith(
      sampleFundedLoan.id,
      sampleBorrower.bank_cbu_cvu,
      sampleFundedLoan.amount_requested
    );

    // 6. Verify monthly rows were generated in installments table
    const installments = await services.loans.getInstallmentsByLoan(sampleFundedLoan.id);
    expect(installments).toHaveLength(6);
    expect(installments[0].installment_number).toBe(1);
    expect(installments[0].status).toBe('pending');
    expect(installments[0].principal_amount).toBeGreaterThan(0);
    expect(installments[0].interest_borrower).toBeGreaterThan(0);
    expect(installments[5].installment_number).toBe(6);

    // Check sum of principal amounts approximately equals total loan amount
    const totalPrincipal = installments.reduce((acc, curr) => acc + curr.principal_amount, 0);
    expect(Math.round(totalPrincipal)).toBe(sampleFundedLoan.amount_requested);
  });
});
