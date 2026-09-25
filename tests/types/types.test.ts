import { describe, expect, it } from 'vitest';
import type {
  BcraCreditReport,
  BcraSituation,
  CommitInvestmentInput,
  CommitInvestmentResult,
  CreditScoringInterface,
  DocumentType,
  Installment,
  InstallmentStatus,
  Investment,
  InvestmentServiceInterface,
  InvestmentStatus,
  KycStatus,
  LegalContract,
  LegalServiceInterface,
  Loan,
  LoanCategory,
  LoanServiceInterface,
  LoanStatus,
  PaymentGatewayInterface,
  Profile,
  RateType,
  RiskTier,
  SmeCreditProfile,
  UserRole,
} from '@/types';
import { LOAN_CATEGORY_LABELS, RISK_TIER_CONFIG } from '@/types';

describe('Domain Models and Enums (@/types)', () => {
  it('instantiates a valid Profile matching plan.md Section 6', () => {
    const profile: Profile = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      role: 'sme',
      tax_id: '30712345678',
      legal_name: 'Acme Textiles SAS',
      phone: '+541144445555',
      kyc_status: 'approved',
      bank_cbu_cvu: '0720000000000000000001',
      created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    };

    expect(profile.id).toBeDefined();
    expect(profile.role).toBe('sme');
    expect(profile.tax_id).toHaveLength(11);
    expect(profile.bank_cbu_cvu).toHaveLength(22);
  });

  it('instantiates a valid SmeCreditProfile matching plan.md Section 6', () => {
    const creditProfile: SmeCreditProfile = {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      profile_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      bcra_situation: 1,
      risk_tier: 'Tier A',
      balance_sheet_url: 'https://storage.lencord.com/balances/acme_2025.pdf',
      f931_url: 'https://storage.lencord.com/f931/acme_f931.pdf',
      scoring_notes: 'Situación 1 en BCRA, flujo de caja positivo.',
      updated_at: new Date('2026-01-02T00:00:00Z').toISOString(),
    };

    expect(creditProfile.risk_tier).toBe('Tier A');
    expect(creditProfile.bcra_situation).toBe(1);
  });

  it('allows nullable BCRA situation and document URLs for independent SMEs without debt or payroll', () => {
    const creditProfileNoDebt: SmeCreditProfile = {
      id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      profile_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      bcra_situation: null,
      risk_tier: 'Tier B',
      balance_sheet_url: null,
      f931_url: null,
      scoring_notes: 'PyME nueva sin deuda bancaria reportada ni empleados.',
      updated_at: new Date().toISOString(),
    };

    expect(creditProfileNoDebt.bcra_situation).toBeNull();
    expect(creditProfileNoDebt.balance_sheet_url).toBeNull();
  });

  it('instantiates a valid Loan entity with financial fields matching plan.md Section 6', () => {
    const loan: Loan = {
      id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
      borrower_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      amount_requested: 5000000,
      amount_funded: 1250000,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 48.0,
      platform_spread: 4.0,
      borrower_rate: 52.0,
      base_uva_value: null,
      category: 'working_capital',
      status: 'funding',
      funding_deadline: new Date('2026-10-15T00:00:00Z').toISOString(),
      created_at: new Date('2026-09-25T00:00:00Z').toISOString(),
    };

    expect(loan.amount_funded).toBeLessThanOrEqual(loan.amount_requested);
    expect(loan.borrower_rate).toBe(loan.investor_rate + loan.platform_spread);
    expect(loan.status).toBe('funding');
  });

  it('instantiates a valid CER_VARIABLE loan with base_uva_value', () => {
    const cerLoan: Loan = {
      id: 'e5f6a7b8-c9d0-1234-ef12-345678901234',
      borrower_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      amount_requested: 10000000,
      amount_funded: 10000000,
      term_months: 12,
      rate_type: 'CER_VARIABLE',
      investor_rate: 10.0,
      platform_spread: 2.5,
      borrower_rate: 12.5,
      base_uva_value: 1245.85,
      category: 'machinery',
      status: 'funded',
      funding_deadline: new Date('2026-10-01T00:00:00Z').toISOString(),
      created_at: new Date('2026-09-20T00:00:00Z').toISOString(),
    };

    expect(cerLoan.rate_type).toBe('CER_VARIABLE');
    expect(cerLoan.base_uva_value).toBe(1245.85);
  });

  it('instantiates a valid Investment commitment', () => {
    const investment: Investment = {
      id: 'f6a7b8c9-d0e1-2345-f123-456789012345',
      loan_id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
      investor_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      amount: 250000,
      status: 'committed',
      external_payment_id: 'hold_abc123',
      created_at: new Date().toISOString(),
    };

    expect(investment.amount).toBe(250000);
    expect(investment.status).toBe('committed');
  });

  it('instantiates an Installment record with borrower, investor, and platform interest splits', () => {
    const installment: Installment = {
      id: 'a7b8c9d0-e1f2-3456-1234-567890123456',
      loan_id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
      installment_number: 1,
      due_date: '2026-11-01',
      principal_amount: 833333.33,
      interest_borrower: 216666.67,
      interest_investors: 200000.0,
      interest_lencord: 16666.67,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    };

    expect(installment.installment_number).toBe(1);
    expect(installment.status).toBe('pending');
    expect(installment.interest_borrower).toBeCloseTo(
      installment.interest_investors + installment.interest_lencord,
      1
    );
  });

  it('instantiates a LegalContract for promissory notes and mutual agreements', () => {
    const legalContract: LegalContract = {
      id: 'b8c9d0e1-f2a3-4567-2345-678901234567',
      loan_id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
      document_type: 'pagare',
      document_url: 'https://storage.lencord.com/contracts/pagare_d4e5.pdf',
      signature_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signed_at: new Date().toISOString(),
    };

    expect(legalContract.document_type).toBe('pagare');
    expect(legalContract.signature_hash).toHaveLength(64);
  });

  it('validates all union types for UserRole, RiskTier, LoanStatus, RateType, and others', () => {
    const roles: UserRole[] = ['investor', 'sme', 'admin'];
    const tiers: RiskTier[] = ['Tier A', 'Tier B', 'Tier C'];
    const statuses: LoanStatus[] = [
      'draft',
      'in_review',
      'funding',
      'funded',
      'active',
      'repaid',
      'cancelled',
    ];
    const rateTypes: RateType[] = ['TNA_FIXED', 'CER_VARIABLE'];
    const kycStatuses: KycStatus[] = ['pending', 'approved', 'rejected'];
    const investmentStatuses: InvestmentStatus[] = ['committed', 'settled', 'refunded'];
    const installmentStatuses: InstallmentStatus[] = ['pending', 'paid', 'overdue'];
    const docTypes: DocumentType[] = ['mutuo', 'pagare'];
    const bcraSituations: BcraSituation[] = [1, 2, 3, 4, 5, null];

    expect(roles).toHaveLength(3);
    expect(tiers).toHaveLength(3);
    expect(statuses).toHaveLength(7);
    expect(rateTypes).toHaveLength(2);
    expect(kycStatuses).toHaveLength(3);
    expect(investmentStatuses).toHaveLength(3);
    expect(installmentStatuses).toHaveLength(3);
    expect(docTypes).toHaveLength(2);
    expect(bcraSituations).toHaveLength(6);
  });

  it('provides complete category labels for all LoanCategory variants', () => {
    const categories: LoanCategory[] = [
      'working_capital',
      'machinery',
      'refinancing',
      'expansion',
      'new_sme',
    ];

    categories.forEach((cat) => {
      expect(LOAN_CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof LOAN_CATEGORY_LABELS[cat]).toBe('string');
    });
  });

  it('provides complete risk tier badges configuration', () => {
    const tiers: RiskTier[] = ['Tier A', 'Tier B', 'Tier C'];

    tiers.forEach((tier) => {
      expect(RISK_TIER_CONFIG[tier]).toBeDefined();
      expect(RISK_TIER_CONFIG[tier].badgeBg).toBeDefined();
      expect(RISK_TIER_CONFIG[tier].badgeText).toBeDefined();
    });
  });
});

describe('Service Layer Contracts (@/types)', () => {
  it('verifies PaymentGatewayInterface adheres strictly to plan.md Section 8.2', async () => {
    class MockPaymentGateway implements PaymentGatewayInterface {
      async holdFunds(
        investorId: string,
        amount: number,
        loanId: string
      ): Promise<{ holdId: string; success: boolean }> {
        return { holdId: `hold_${investorId}_${loanId}`, success: amount > 0 };
      }

      async releaseFunds(holdId: string): Promise<{ success: boolean }> {
        return { success: Boolean(holdId) };
      }

      async disburseLoan(
        loanId: string,
        cbuTarget: string,
        amount: number
      ): Promise<{ transferId: string; success: boolean }> {
        return { transferId: `tx_${loanId}`, success: Boolean(cbuTarget && amount > 0) };
      }

      async collectInstallment(
        installmentId: string,
        cbuSource: string,
        amount: number
      ): Promise<{ paymentId: string; status: 'pending' | 'settled' }> {
        return {
          paymentId: `pay_${installmentId}_${cbuSource.slice(0, 4)}`,
          status: amount > 0 ? 'settled' : 'pending',
        };
      }
    }

    const gateway = new MockPaymentGateway();

    const hold = await gateway.holdFunds('inv_1', 50000, 'loan_1');
    expect(hold.success).toBe(true);
    expect(hold.holdId).toContain('inv_1');

    const release = await gateway.releaseFunds(hold.holdId);
    expect(release.success).toBe(true);

    const disburse = await gateway.disburseLoan('loan_1', '0720000000000000000001', 500000);
    expect(disburse.success).toBe(true);
    expect(disburse.transferId).toContain('loan_1');

    const collect = await gateway.collectInstallment('inst_1', '0720000000000000000001', 50000);
    expect(collect.status).toBe('settled');
  });

  it('implements LoanServiceInterface contract with Promise return types', async () => {
    const mockLoanService: LoanServiceInterface = {
      async getLoanById(id: string): Promise<Loan | null> {
        if (id === 'missing') return null;
        return {
          id,
          borrower_id: 'b_1',
          amount_requested: 1000000,
          amount_funded: 0,
          term_months: 3,
          rate_type: 'TNA_FIXED',
          investor_rate: 50,
          platform_spread: 3,
          borrower_rate: 53,
          base_uva_value: null,
          category: 'working_capital',
          status: 'draft',
          funding_deadline: '2026-10-31T00:00:00Z',
          created_at: '2026-09-25T00:00:00Z',
        };
      },
      async listLoans() {
        return [];
      },
      async submitLoanApplication(input) {
        return {
          id: 'new_loan',
          borrower_id: input.borrower_id,
          amount_requested: input.amount_requested,
          amount_funded: 0,
          term_months: input.term_months,
          rate_type: input.rate_type,
          investor_rate: 0,
          platform_spread: 0,
          borrower_rate: 0,
          base_uva_value: null,
          category: input.category,
          status: 'in_review',
          funding_deadline: '',
          created_at: new Date().toISOString(),
        };
      },
      async approveAndPublishLoan(input) {
        return {
          id: input.loan_id,
          borrower_id: 'b_1',
          amount_requested: 1000000,
          amount_funded: 0,
          term_months: 6,
          rate_type: 'TNA_FIXED',
          investor_rate: input.investor_rate,
          platform_spread: input.platform_spread,
          borrower_rate: input.investor_rate + input.platform_spread,
          base_uva_value: null,
          category: 'working_capital',
          status: 'funding',
          funding_deadline: input.funding_deadline,
          created_at: new Date().toISOString(),
        };
      },
      async finalizeLoanFunding(loanId: string) {
        return {
          id: loanId,
          borrower_id: 'b_1',
          amount_requested: 1000000,
          amount_funded: 1000000,
          term_months: 6,
          rate_type: 'TNA_FIXED',
          investor_rate: 45,
          platform_spread: 3,
          borrower_rate: 48,
          base_uva_value: null,
          category: 'working_capital',
          status: 'funded',
          funding_deadline: '2026-10-01T00:00:00Z',
          created_at: new Date().toISOString(),
        };
      },
      async cancelLoan(loanId: string) {
        return {
          id: loanId,
          borrower_id: 'b_1',
          amount_requested: 1000000,
          amount_funded: 200000,
          term_months: 6,
          rate_type: 'TNA_FIXED',
          investor_rate: 45,
          platform_spread: 3,
          borrower_rate: 48,
          base_uva_value: null,
          category: 'working_capital',
          status: 'cancelled',
          funding_deadline: '2026-09-01T00:00:00Z',
          created_at: new Date().toISOString(),
        };
      },
      async getInstallmentsByLoan() {
        return [];
      },
    };

    const loan = await mockLoanService.getLoanById('loan_123');
    expect(loan?.id).toBe('loan_123');

    const missing = await mockLoanService.getLoanById('missing');
    expect(missing).toBeNull();
  });

  it('implements InvestmentServiceInterface contract with atomic commit signature', async () => {
    const mockInvestmentService: InvestmentServiceInterface = {
      async commitInvestment(input: CommitInvestmentInput): Promise<CommitInvestmentResult> {
        const dummyLoan: Loan = {
          id: input.loan_id,
          borrower_id: 'borrower_1',
          amount_requested: 100000,
          amount_funded: input.amount,
          term_months: 3,
          rate_type: 'TNA_FIXED',
          investor_rate: 40,
          platform_spread: 3,
          borrower_rate: 43,
          base_uva_value: null,
          category: 'working_capital',
          status: input.amount >= 100000 ? 'funded' : 'funding',
          funding_deadline: '2026-10-30T00:00:00Z',
          created_at: '2026-09-25T00:00:00Z',
        };

        const dummyInvestment: Investment = {
          id: 'inv_new',
          loan_id: input.loan_id,
          investor_id: input.investor_id,
          amount: input.amount,
          status: 'committed',
          external_payment_id: 'hold_999',
          created_at: new Date().toISOString(),
        };

        return {
          investment: dummyInvestment,
          loan: dummyLoan,
          amount_funded: input.amount,
          is_fully_funded: input.amount >= 100000,
        };
      },
      async getInvestmentsByLoan() {
        return [];
      },
      async getInvestmentsByInvestor() {
        return [];
      },
      async getInvestmentById() {
        return null;
      },
      async refundInvestmentsByLoan() {
        return { refunded_count: 0, total_refunded_amount: 0 };
      },
    };

    const res = await mockInvestmentService.commitInvestment({
      loan_id: 'loan_xyz',
      investor_id: 'inv_123',
      amount: 100000,
    });

    expect(res.is_fully_funded).toBe(true);
    expect(res.loan.status).toBe('funded');
  });

  it('implements CreditScoringInterface contract for BCRA report and SME risk evaluation', async () => {
    const mockCreditService: CreditScoringInterface = {
      async getBcraReport(cuit: string): Promise<BcraCreditReport> {
        return {
          cuit,
          worstSituation: 1,
          totalDebt: 350000,
          entities: [{ entityName: 'BANCO DE GALICIA', situation: 1, amount: 350000 }],
          isClean: true,
          statusDescription: 'Normal (Situación 1)',
        };
      },
      async evaluateCreditRisk(input): Promise<SmeCreditProfile> {
        return {
          id: 'risk_profile_1',
          profile_id: input.profileId,
          bcra_situation: 1,
          risk_tier: 'Tier A',
          balance_sheet_url: null,
          f931_url: null,
          scoring_notes: 'Automated Tier A score',
          updated_at: new Date().toISOString(),
        };
      },
      async getCreditProfileByProfileId() {
        return null;
      },
    };

    const report = await mockCreditService.getBcraReport('30712345678');
    expect(report.worstSituation).toBe(1);
    expect(report.isClean).toBe(true);

    const profile = await mockCreditService.evaluateCreditRisk({
      profileId: 'p_1',
      taxId: '30712345678',
    });
    expect(profile.risk_tier).toBe('Tier A');
  });

  it('implements LegalServiceInterface contract for promissory notes and contract signing', async () => {
    const mockLegalService: LegalServiceInterface = {
      async generatePromissoryNote(loanId: string): Promise<LegalContract> {
        return {
          id: 'contract_pagare_1',
          loan_id: loanId,
          document_type: 'pagare',
          document_url: `https://storage.lencord.com/contracts/pagare_${loanId}.pdf`,
          signature_hash: null,
          signed_at: null,
        };
      },
      async generateMutualAgreement(loanId: string): Promise<LegalContract> {
        return {
          id: 'contract_mutuo_1',
          loan_id: loanId,
          document_type: 'mutuo',
          document_url: `https://storage.lencord.com/contracts/mutuo_${loanId}.pdf`,
          signature_hash: null,
          signed_at: null,
        };
      },
      async signContract(input): Promise<LegalContract> {
        return {
          id: input.contract_id,
          loan_id: 'loan_1',
          document_type: 'pagare',
          document_url: 'https://storage.lencord.com/contracts/pagare_loan_1.pdf',
          signature_hash: input.signature_hash,
          signed_at: new Date().toISOString(),
        };
      },
      async getContractsByLoan() {
        return [];
      },
      async getContractById() {
        return null;
      },
    };

    const unsigned = await mockLegalService.generatePromissoryNote('loan_100');
    expect(unsigned.signature_hash).toBeNull();

    const signed = await mockLegalService.signContract({
      contract_id: unsigned.id,
      signature_hash: 'sha256_mock_hash_value',
    });
    expect(signed.signature_hash).toBe('sha256_mock_hash_value');
    expect(signed.signed_at).toBeDefined();
  });
});
