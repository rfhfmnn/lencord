import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockServices } from '@/services/factory';
import { MockStateStore } from '@/services/mock/mockState';
import { MockPaymentGateway } from '@/services/mock/MockPaymentGateway';
import type { Profile, LegalContract } from '@/types';
import type { Services } from '@/services';

describe('End-to-End User Journey Integration: Loan Lifecycle (Issue #23)', () => {
  let store: MockStateStore;
  let paymentGateway: MockPaymentGateway;
  let services: Services;

  const borrowerId = 'prof-sme-e2e-01';
  const investor1Id = 'prof-inv-e2e-01';
  const investor2Id = 'prof-inv-e2e-02';
  const investor3Id = 'prof-inv-e2e-03';
  let borrowerProfile: Profile;

  beforeEach(() => {
    store = new MockStateStore();
    paymentGateway = new MockPaymentGateway();
    services = createMockServices({ store, paymentGateway });

    // Seed borrower profile
    borrowerProfile = {
      id: borrowerId,
      role: 'sme',
      tax_id: '30712345678',
      legal_name: 'Metalúrgica Aconcagua S.A.S.',
      phone: '+5491145678901',
      kyc_status: 'approved',
      bank_cbu_cvu: '0000003100010000000001',
      created_at: new Date().toISOString(),
    };
    store.profiles.push(borrowerProfile);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes full business lifecycle from application to 100% funding and promissory note signing', async () => {
    // -------------------------------------------------------------------------
    // Phase 1: Borrower Application Flow (submitLoanApplication)
    // -------------------------------------------------------------------------
    const applicationInput = {
      borrower_id: borrowerId,
      amount_requested: 5_000_000,
      term_months: 6,
      rate_type: 'TNA_FIXED' as const,
      category: 'working_capital' as const,
      balance_sheet_url: 'https://storage.lencord.ar/documents/balance_2025.pdf',
      f931_url: 'https://storage.lencord.ar/documents/f931_aug_2026.pdf',
    };

    const submittedLoan = await services.loans.submitLoanApplication(applicationInput);

    expect(submittedLoan.id).toBeDefined();
    expect(submittedLoan.borrower_id).toBe(borrowerId);
    expect(submittedLoan.amount_requested).toBe(5_000_000);
    expect(submittedLoan.amount_funded).toBe(0);
    expect(submittedLoan.status).toBe('in_review');
    expect(submittedLoan.rate_type).toBe('TNA_FIXED');

    // Verify loan is retrieved via service
    const loanInDb = await services.loans.getLoanById(submittedLoan.id);
    expect(loanInDb).not.toBeNull();
    expect(loanInDb?.status).toBe('in_review');

    // -------------------------------------------------------------------------
    // Phase 2: Admin Evaluation & Approval Step (approveAndPublishLoan)
    // -------------------------------------------------------------------------
    const fundingDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const approvedLoan = await services.loans.approveAndPublishLoan({
      loan_id: submittedLoan.id,
      risk_tier: 'Tier A',
      investor_rate: 45.0,
      platform_spread: 2.5,
      funding_deadline: fundingDeadline,
    });

    expect(approvedLoan.status).toBe('funding');
    expect(approvedLoan.investor_rate).toBe(45.0);
    expect(approvedLoan.platform_spread).toBe(2.5);
    expect(approvedLoan.borrower_rate).toBe(47.5);
    expect(approvedLoan.funding_deadline).toBe(fundingDeadline);

    // Verify SME Credit Profile risk tier is updated
    const creditProfile = await services.creditScoring.getCreditProfileByProfileId(borrowerId);
    expect(creditProfile?.risk_tier).toBe('Tier A');

    // -------------------------------------------------------------------------
    // Phase 3: Multiple Investor Commitments & Overfunding Protection
    // -------------------------------------------------------------------------
    // Investor 1 commits $2,000,000 (40% capacity)
    const commit1 = await services.investments.commitInvestment({
      loan_id: approvedLoan.id,
      investor_id: investor1Id,
      amount: 2_000_000,
    });
    expect(commit1.amount_funded).toBe(2_000_000);
    expect(commit1.is_fully_funded).toBe(false);
    expect(commit1.loan.status).toBe('funding');
    expect(commit1.investment.status).toBe('committed');

    // Investor 2 commits $2,000,000 (reaching $4,000,000 / 80% capacity)
    const commit2 = await services.investments.commitInvestment({
      loan_id: approvedLoan.id,
      investor_id: investor2Id,
      amount: 2_000_000,
    });
    expect(commit2.amount_funded).toBe(4_000_000);
    expect(commit2.is_fully_funded).toBe(false);

    // Overfunding validation: Remaining quota is $1,000,000.
    // Investor 3 tries to commit $1,500,000 -> Must be rejected!
    await expect(
      services.investments.commitInvestment({
        loan_id: approvedLoan.id,
        investor_id: investor3Id,
        amount: 1_500_000,
      })
    ).rejects.toThrow(/exceeds remaining loan capacity/i);

    // Verify amount_funded remained unchanged at $4,000,000
    const loanAfterRejection = await services.loans.getLoanById(approvedLoan.id);
    expect(loanAfterRejection?.amount_funded).toBe(4_000_000);

    // Investor 3 commits exact remaining $1,000,000 -> 100% capacity reached
    const commit3 = await services.investments.commitInvestment({
      loan_id: approvedLoan.id,
      investor_id: investor3Id,
      amount: 1_000_000,
    });
    expect(commit3.amount_funded).toBe(5_000_000);
    expect(commit3.is_fully_funded).toBe(true);

    // -------------------------------------------------------------------------
    // Phase 4: Automatic Transition to 'funded'
    // -------------------------------------------------------------------------
    expect(commit3.loan.status).toBe('funded');
    const finalLoanState = await services.loans.getLoanById(approvedLoan.id);
    expect(finalLoanState?.status).toBe('funded');
    expect(finalLoanState?.amount_funded).toBe(5_000_000);

    // Verify all 3 investments are recorded
    const loanInvestments = await services.investments.getInvestmentsByLoan(approvedLoan.id);
    expect(loanInvestments).toHaveLength(3);

    // -------------------------------------------------------------------------
    // Phase 5: Promissory Note Generation and Digital Signature Flow
    // -------------------------------------------------------------------------
    // Generate electronic promissory note (pagaré)
    const promissoryNote = await services.legal.generatePromissoryNote(approvedLoan.id);
    expect(promissoryNote.document_type).toBe('pagare');
    expect(promissoryNote.document_url).toContain('pagare-electronico.pdf');
    expect(promissoryNote.signature_hash).toBeNull();

    // Borrower signs the promissory note
    const signatureHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const signedContract = await services.legal.signContract({
      contract_id: promissoryNote.id,
      signature_hash: signatureHash,
    });

    expect(signedContract.signature_hash).toBe(signatureHash);
    expect(signedContract.signed_at).toBeDefined();

    // Verify contract can be retrieved
    const contractsList = await services.legal.getContractsByLoan(approvedLoan.id);
    expect(contractsList.some((c: LegalContract) => c.id === promissoryNote.id && c.signature_hash === signatureHash)).toBe(true);

    // Instruct disbursement via payment gateway
    const disburseResult = await services.payments.disburseLoan(
      approvedLoan.id,
      borrowerProfile.bank_cbu_cvu,
      finalLoanState!.amount_funded
    );
    expect(disburseResult.success).toBe(true);
    expect(disburseResult.transferId).toBeDefined();
  });

  it('handles underfunded auction expiration lifecycle and refunds committed investors', async () => {
    // 1. Submit loan
    const loan = await services.loans.submitLoanApplication({
      borrower_id: borrowerId,
      amount_requested: 10_000_000,
      term_months: 12,
      rate_type: 'TNA_FIXED',
      category: 'machinery',
    });

    // 2. Admin approves with 7-day deadline
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await services.loans.approveAndPublishLoan({
      loan_id: loan.id,
      risk_tier: 'Tier B',
      investor_rate: 48,
      platform_spread: 3,
      funding_deadline: deadline,
    });

    // 3. Partial funding: Investor commits $3,000,000 (30%)
    await services.investments.commitInvestment({
      loan_id: loan.id,
      investor_id: investor1Id,
      amount: 3_000_000,
    });

    // 4. Fast forward time past deadline
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));

    // 5. Finalize funding routine -> identifies underfunded expiration
    const finalized = await services.loans.finalizeLoanFunding(loan.id);
    expect(finalized.status).toBe('cancelled');

    // 6. Trigger refund for all participating investors
    const refundResult = await services.investments.refundInvestmentsByLoan(loan.id);
    expect(refundResult.refunded_count).toBe(1);
    expect(refundResult.total_refunded_amount).toBe(3_000_000);

    const investments = await services.investments.getInvestmentsByLoan(loan.id);
    expect(investments[0].status).toBe('refunded');
  });
});
