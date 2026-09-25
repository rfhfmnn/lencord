import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultMockCreditScoringService,
  defaultMockInvestmentService,
  defaultMockLegalService,
  defaultMockLoanService,
  defaultMockPaymentGateway,
  defaultMockStateStore,
  MockCreditScoringService,
  MockInvestmentService,
  MockLegalService,
  MockLoanService,
  MockPaymentGateway,
  MockStateStore,
  SEED_LOANS,
  SEED_PROFILES,
} from '@/services/mock';
import type { LoanCategory, RiskTier } from '@/types';

describe('In-Memory Mock Services and Seed Data (Issue #4)', () => {
  let store: MockStateStore;
  let paymentGateway: MockPaymentGateway;
  let loanService: MockLoanService;
  let investmentService: MockInvestmentService;
  let creditScoringService: MockCreditScoringService;
  let legalService: MockLegalService;

  beforeEach(() => {
    store = new MockStateStore();
    paymentGateway = new MockPaymentGateway();
    loanService = new MockLoanService(store);
    investmentService = new MockInvestmentService(store, paymentGateway);
    creditScoringService = new MockCreditScoringService(store);
    legalService = new MockLegalService(store);
  });

  // -------------------------------------------------------------------------
  // 1. Seed Data Pre-population & Argentine PyME Requirements
  // -------------------------------------------------------------------------
  describe('Seed Data Verification', () => {
    it('pre-populates at least 5 realistic Argentine PyME loans spanning Tier A, B, and C', () => {
      expect(store.loans.length).toBeGreaterThanOrEqual(5);

      // Verify all 5 categories are present
      const categories = new Set(store.loans.map((l) => l.category));
      const expectedCategories: LoanCategory[] = [
        'working_capital',
        'machinery',
        'refinancing',
        'expansion',
        'new_sme',
      ];
      expectedCategories.forEach((cat) => {
        expect(categories.has(cat)).toBe(true);
      });

      // Verify all 3 risk tiers (Tier A, Tier B, Tier C) are covered in seed credit profiles
      const tiers = new Set(store.creditProfiles.map((cp) => cp.risk_tier));
      const expectedTiers: RiskTier[] = ['Tier A', 'Tier B', 'Tier C'];
      expectedTiers.forEach((tier) => {
        expect(tiers.has(tier)).toBe(true);
      });
    });

    it('contains realistic Argentine PyME profile data with CUITs, company names, and CBUs', () => {
      const smes = store.profiles.filter((p) => p.role === 'sme');
      expect(smes.length).toBeGreaterThanOrEqual(5);

      smes.forEach((sme) => {
        expect(sme.tax_id).toMatch(/^\d{11}$/); // 11-digit CUIT
        expect(sme.legal_name.length).toBeGreaterThan(3);
        expect(sme.bank_cbu_cvu).toMatch(/^\d{22}$/); // 22-digit standard CBU/CVU
        expect(sme.kyc_status).toBe('approved');
      });
    });

    it('allows resetting mock state store to pristine seed data', () => {
      // Mutate state
      store.loans.pop();
      expect(store.loans.length).toBe(SEED_LOANS.length - 1);
      store.profiles.pop();
      expect(store.profiles.length).toBe(SEED_PROFILES.length - 1);

      // Reset
      store.reset();
      expect(store.loans.length).toBe(SEED_LOANS.length);
      expect(store.profiles.length).toBe(SEED_PROFILES.length);
    });
  });

  // -------------------------------------------------------------------------
  // 2. MockPaymentGateway Simulation (Latency and Failures)
  // -------------------------------------------------------------------------
  describe('MockPaymentGateway', () => {
    it('simulates holdFunds and records hold in memory', async () => {
      const result = await paymentGateway.holdFunds('prof-inv-001', 500000, 'loan-seed-001');
      expect(result.success).toBe(true);
      expect(result.holdId).toMatch(/^hold_/);

      const hold = paymentGateway.getHoldById(result.holdId);
      expect(hold).toBeDefined();
      expect(hold?.amount).toBe(500000);
      expect(hold?.status).toBe('held');
    });

    it('simulates releaseFunds for active hold', async () => {
      const { holdId } = await paymentGateway.holdFunds('prof-inv-001', 250000, 'loan-seed-001');
      const releaseResult = await paymentGateway.releaseFunds(holdId);
      expect(releaseResult.success).toBe(true);

      const hold = paymentGateway.getHoldById(holdId);
      expect(hold?.status).toBe('released');

      // Releasing invalid hold returns success: false
      const invalidRelease = await paymentGateway.releaseFunds('non-existent-hold');
      expect(invalidRelease.success).toBe(false);
    });

    it('simulates disburseLoan and checks destination CBU validation', async () => {
      const validCbu = '0720123488000012345678';
      const result = await paymentGateway.disburseLoan('loan-seed-001', validCbu, 6000000);
      expect(result.success).toBe(true);
      expect(result.transferId).toMatch(/^tr_/);
      expect(paymentGateway.getDisbursements().length).toBe(1);

      // Rejects invalid CBU length
      await expect(
        paymentGateway.disburseLoan('loan-seed-001', '12345', 1000)
      ).rejects.toThrow('Invalid destination CBU/CVU');
    });

    it('simulates collectInstallment in memory', async () => {
      const cbuSource = '0720123488000012345678';
      const result = await paymentGateway.collectInstallment('inst-seed-001', cbuSource, 350000);
      expect(result.status).toBe('settled');
      expect(result.paymentId).toMatch(/^pay_/);
      expect(paymentGateway.getCollections().length).toBe(1);
    });

    it('supports controllable latency', async () => {
      paymentGateway.setLatency(50);
      const start = Date.now();
      await paymentGateway.holdFunds('prof-inv-001', 10000, 'loan-seed-001');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('simulates errors when throwError is enabled', async () => {
      paymentGateway.simulateFailure('holdFunds', true, {
        throwError: true,
        errorMessage: 'Custom BaaS Timeout',
      });

      await expect(
        paymentGateway.holdFunds('prof-inv-001', 10000, 'loan-seed-001')
      ).rejects.toThrow('Custom BaaS Timeout');

      // Clear failures restores functionality
      paymentGateway.clearFailures();
      const retry = await paymentGateway.holdFunds('prof-inv-001', 10000, 'loan-seed-001');
      expect(retry.success).toBe(true);
    });

    it('simulates failure responses when throwError is false', async () => {
      paymentGateway.simulateFailure('disburseLoan', true, {
        throwError: false,
      });

      const res = await paymentGateway.disburseLoan(
        'loan-seed-001',
        '0720123488000012345678',
        100000
      );
      expect(res.success).toBe(false);
      expect(res.transferId).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // 3. MockLoanService CRUD and Lifecycle
  // -------------------------------------------------------------------------
  describe('MockLoanService', () => {
    it('retrieves loans by ID and returns null for non-existent IDs', async () => {
      const loan = await loanService.getLoanById('loan-seed-001');
      expect(loan).not.toBeNull();
      expect(loan?.id).toBe('loan-seed-001');
      expect(loan?.category).toBe('working_capital');

      const nonExistent = await loanService.getLoanById('unknown-id');
      expect(nonExistent).toBeNull();
    });

    it('filters loans by status, category, rate_type, and risk_tier', async () => {
      const fundingLoans = await loanService.listLoans({ status: 'funding' });
      expect(fundingLoans.every((l) => l.status === 'funding')).toBe(true);

      const arrayStatus = await loanService.listLoans({
        status: ['funding', 'funded'],
      });
      expect(arrayStatus.every((l) => ['funding', 'funded'].includes(l.status))).toBe(true);

      const machineryLoans = await loanService.listLoans({ category: 'machinery' });
      expect(machineryLoans.every((l) => l.category === 'machinery')).toBe(true);

      const tierALoans = await loanService.listLoans({ risk_tier: 'Tier A' });
      expect(tierALoans.length).toBeGreaterThan(0);
    });

    it('submits a new loan application in in_review state', async () => {
      const newLoan = await loanService.submitLoanApplication({
        borrower_id: 'prof-sme-001',
        amount_requested: 5000000,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        category: 'expansion',
        balance_sheet_url: 'https://storage.lencord.ar/docs/new-balance.pdf',
      });

      expect(newLoan.id).toBeDefined();
      expect(newLoan.status).toBe('in_review');
      expect(newLoan.amount_requested).toBe(5000000);
      expect(newLoan.amount_funded).toBe(0);

      // Loan should be listed in the store
      const retrieved = await loanService.getLoanById(newLoan.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.status).toBe('in_review');
    });

    it('approves and publishes a loan to funding state with rates and deadline', async () => {
      const deadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const approved = await loanService.approveAndPublishLoan({
        loan_id: 'loan-seed-006', // seed loan in in_review
        risk_tier: 'Tier A',
        investor_rate: 46.0,
        platform_spread: 2.5,
        funding_deadline: deadline,
      });

      expect(approved.status).toBe('funding');
      expect(approved.investor_rate).toBe(46.0);
      expect(approved.platform_spread).toBe(2.5);
      expect(approved.borrower_rate).toBe(48.5);
      expect(approved.funding_deadline).toBe(deadline);
    });

    it('finalizes fully funded loan and cancels underfunded expired loan', async () => {
      // 1. Fully funded loan transitions to funded
      const finalized = await loanService.finalizeLoanFunding('loan-seed-004');
      expect(finalized.status).toBe('funded');

      // 2. Expired loan with underfunding transitions to cancelled
      const expiredLoan = store.loans.find((l) => l.id === 'loan-seed-005')!;
      expiredLoan.funding_deadline = new Date(Date.now() - 1000).toISOString();

      const cancelled = await loanService.finalizeLoanFunding('loan-seed-005');
      expect(cancelled.status).toBe('cancelled');
    });

    it('cancels a loan directly', async () => {
      const cancelled = await loanService.cancelLoan('loan-seed-001');
      expect(cancelled.status).toBe('cancelled');
    });

    it('retrieves installments associated with a loan', async () => {
      const installments = await loanService.getInstallmentsByLoan('loan-seed-004');
      expect(installments.length).toBeGreaterThan(0);
      expect(installments[0].loan_id).toBe('loan-seed-004');
    });
  });

  // -------------------------------------------------------------------------
  // 4. MockInvestmentService & Overfunding Prevention
  // -------------------------------------------------------------------------
  describe('MockInvestmentService', () => {
    it('commits valid investment and updates loan amount_funded', async () => {
      const loan = store.loans.find((l) => l.id === 'loan-seed-001')!;
      const initialFunded = loan.amount_funded; // 6,000,000 / 12,000,000
      const investmentAmount = 1000000;

      const result = await investmentService.commitInvestment({
        loan_id: 'loan-seed-001',
        investor_id: 'prof-inv-001',
        amount: investmentAmount,
      });

      expect(result.amount_funded).toBe(initialFunded + investmentAmount);
      expect(result.loan.amount_funded).toBe(initialFunded + investmentAmount);
      expect(result.investment.status).toBe('committed');
      expect(result.investment.amount).toBe(investmentAmount);
      expect(result.is_fully_funded).toBe(false);
      expect(result.loan.status).toBe('funding');
    });

    it('rejects investment exceeding remaining capacity with overfunding error', async () => {
      const loan = store.loans.find((l) => l.id === 'loan-seed-001')!;
      // loan-seed-001: requested 12M, funded 6M, capacity remaining: 6M
      const excessiveAmount = 6000001;

      await expect(
        investmentService.commitInvestment({
          loan_id: 'loan-seed-001',
          investor_id: 'prof-inv-001',
          amount: excessiveAmount,
        })
      ).rejects.toThrow(/Overfunding rejected/);

      // Verify state was not modified
      expect(loan.amount_funded).toBe(6000000);
    });

    it('automatically transitions loan status to funded when 100% capacity is reached', async () => {
      const loan = store.loans.find((l) => l.id === 'loan-seed-001')!;
      // Remaining capacity is exactly 6,000,000
      const remainingAmount = loan.amount_requested - loan.amount_funded;

      const result = await investmentService.commitInvestment({
        loan_id: 'loan-seed-001',
        investor_id: 'prof-inv-002',
        amount: remainingAmount,
      });

      expect(result.amount_funded).toBe(loan.amount_requested);
      expect(result.is_fully_funded).toBe(true);
      expect(result.loan.status).toBe('funded');

      // Verify in store
      const updatedInStore = await loanService.getLoanById('loan-seed-001');
      expect(updatedInStore?.status).toBe('funded');
      expect(updatedInStore?.amount_funded).toBe(updatedInStore?.amount_requested);
    });

    it('rejects investments on loans that are not in funding status', async () => {
      // loan-seed-004 is already funded
      await expect(
        investmentService.commitInvestment({
          loan_id: 'loan-seed-004',
          investor_id: 'prof-inv-001',
          amount: 500000,
        })
      ).rejects.toThrow(/not open for funding/);
    });

    it('refunds all investments of a loan and releases funds', async () => {
      // Loan 1 has 2 seed investments totaling 6,000,000
      const refundResult = await investmentService.refundInvestmentsByLoan('loan-seed-001');
      expect(refundResult.refunded_count).toBe(2);
      expect(refundResult.total_refunded_amount).toBe(6000000);

      const investments = await investmentService.getInvestmentsByLoan('loan-seed-001');
      expect(investments.every((inv) => inv.status === 'refunded')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. MockCreditScoringService
  // -------------------------------------------------------------------------
  describe('MockCreditScoringService', () => {
    it('returns clean report for Tier A borrowers', async () => {
      const report = await creditScoringService.getBcraReport('30712345679');
      expect(report.worstSituation).toBe(1);
      expect(report.isClean).toBe(true);
      expect(report.totalDebt).toBe(0);
      expect(report.entities).toHaveLength(0);
    });

    it('returns debt report for Situation 2 borrowers', async () => {
      const report = await creditScoringService.getBcraReport('30718901234');
      expect(report.worstSituation).toBe(2);
      expect(report.isClean).toBe(false);
      expect(report.totalDebt).toBeGreaterThan(0);
      expect(report.entities.length).toBeGreaterThan(0);
    });

    it('evaluates credit risk tier based on documentation and BCRA record', async () => {
      // Clean with balance sheet -> Tier A
      const profileA = await creditScoringService.evaluateCreditRisk({
        profileId: 'new-sme-001',
        taxId: '30712345679',
        hasBalanceSheet: true,
        hasF931: true,
      });
      expect(profileA.risk_tier).toBe('Tier A');

      // Situation 2 -> Tier B
      const profileB = await creditScoringService.evaluateCreditRisk({
        profileId: 'new-sme-002',
        taxId: '30718901234',
      });
      expect(profileB.risk_tier).toBe('Tier B');

      // Situation 3 -> Tier C
      const profileC = await creditScoringService.evaluateCreditRisk({
        profileId: 'new-sme-003',
        taxId: '30719988771', // situation 3 in custom / seed
      });
      expect(profileC.risk_tier).toBe('Tier C');
    });
  });

  // -------------------------------------------------------------------------
  // 6. MockLegalService
  // -------------------------------------------------------------------------
  describe('MockLegalService', () => {
    it('generates an electronic promissory note (pagaré)', async () => {
      const pagare = await legalService.generatePromissoryNote('loan-seed-001');
      expect(pagare.id).toBeDefined();
      expect(pagare.loan_id).toBe('loan-seed-001');
      expect(pagare.document_type).toBe('pagare');
      expect(pagare.document_url).toContain('pagare-electronico.pdf');
      expect(pagare.signature_hash).toBeNull();
    });

    it('generates a mutual agreement framework (mutuo)', async () => {
      const mutuo = await legalService.generateMutualAgreement('loan-seed-001');
      expect(mutuo.id).toBeDefined();
      expect(mutuo.loan_id).toBe('loan-seed-001');
      expect(mutuo.document_type).toBe('mutuo');
      expect(mutuo.document_url).toContain('contrato-mutuo.pdf');
      expect(mutuo.signature_hash).toBeNull();
    });

    it('signs contract with cryptographic hash and records timestamp', async () => {
      const contract = await legalService.generatePromissoryNote('loan-seed-002');
      const sampleHash = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';

      const signed = await legalService.signContract({
        contract_id: contract.id,
        signature_hash: sampleHash,
      });

      expect(signed.signature_hash).toBe(sampleHash);
      expect(signed.signed_at).not.toBeNull();

      const inStore = await legalService.getContractById(contract.id);
      expect(inStore?.signature_hash).toBe(sampleHash);
    });

    it('retrieves contracts by loan ID', async () => {
      const contracts = await legalService.getContractsByLoan('loan-seed-004');
      expect(contracts.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Default Singleton Export Sanity
  // -------------------------------------------------------------------------
  describe('Default Instances', () => {
    it('provides operational default singleton service instances', () => {
      expect(defaultMockStateStore).toBeDefined();
      expect(defaultMockPaymentGateway).toBeDefined();
      expect(defaultMockLoanService).toBeDefined();
      expect(defaultMockInvestmentService).toBeDefined();
      expect(defaultMockCreditScoringService).toBeDefined();
      expect(defaultMockLegalService).toBeDefined();
    });
  });
});
