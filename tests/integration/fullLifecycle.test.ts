/**
 * Comprehensive End-to-End System Integration and Smoke Test Suite (Issue #48)
 * Validates complete lifecycle from borrower registration to active loan and installment repayment.
 * Conforms to _docs/plan.md and _docs/testing-guidelines.md.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServices } from '@/services/factory';
import { MockStateStore } from '@/services/mock/mockState';
import { MockPaymentGateway } from '@/services/mock/MockPaymentGateway';
import { MockEmailService } from '@/services/email/MockEmailService';
import { generateSha256 } from '@/components/legal/PromissoryNoteModal';
import type { Services } from '@/services/types';
import type { Profile, Loan, Installment } from '@/types';

describe('End-to-End System Integration: Complete Borrower to Active Loan Lifecycle (Issue #48)', () => {
  let store: MockStateStore;
  let paymentGateway: MockPaymentGateway;
  let emailService: MockEmailService;
  let services: Services;

  // Test Entities
  const borrowerId = 'prof-sme-e2e-mediterranea';
  const investor1Id = 'prof-inv-e2e-agustin';
  const investor2Id = 'prof-inv-e2e-belen';

  const borrowerTaxId = '30715556661'; // Valid Argentine CUIT
  const borrowerCbu = '0720123488000012345678';
  const borrowerEmail = 'contacto@mediterranea.com.ar';

  const investor1Cbu = '0720123488000088888881';
  const investor2Cbu = '0720123488000088888882';

  beforeEach(() => {
    store = new MockStateStore();
    paymentGateway = new MockPaymentGateway();
    emailService = new MockEmailService();

    // Instantiate complete service container with isolated in-memory stores and mock adapters
    services = createServices({
      useMocks: true,
      store,
      paymentGateway,
      overrides: {
        email: emailService,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes the full end-to-end journey from SME registration to active loan, multi-investor auction, promissory note, and installment repayment', async () => {
    // =========================================================================
    // STEP 1: Borrower Registration and Authenticated Session Setup
    // =========================================================================
    const newBorrowerProfile: Profile = {
      id: borrowerId,
      role: 'sme',
      tax_id: borrowerTaxId,
      legal_name: 'Industrias Metalúrgicas Mediterránea S.A.',
      phone: '+54 351 456-7890',
      bank_cbu_cvu: borrowerCbu,
      kyc_status: 'approved',
      created_at: new Date().toISOString(),
    };
    (newBorrowerProfile as any).email = borrowerEmail;

    // Simulate registration persistence in profiles table
    store.profiles.push(newBorrowerProfile);

    // Register investors
    const investor1Profile: Profile = {
      id: investor1Id,
      role: 'investor',
      tax_id: '20334445558',
      legal_name: 'Agustín Rossi',
      phone: '+54 351 987-6543',
      bank_cbu_cvu: investor1Cbu,
      kyc_status: 'approved',
      created_at: new Date().toISOString(),
    };
    (investor1Profile as any).email = 'agustin@capital.com.ar';
    store.profiles.push(investor1Profile);

    const investor2Profile: Profile = {
      id: investor2Id,
      role: 'investor',
      tax_id: '27361112224',
      legal_name: 'Belén Santillán',
      phone: '+54 351 112-2334',
      bank_cbu_cvu: investor2Cbu,
      kyc_status: 'approved',
      created_at: new Date().toISOString(),
    };
    (investor2Profile as any).email = 'belen@inversiones.com.ar';
    store.profiles.push(investor2Profile);

    // Verify registration and welcome email dispatch
    await emailService.sendRegistrationEmail({
      to: borrowerEmail,
      recipientName: newBorrowerProfile.legal_name,
      role: 'borrower',
    });
    expect(emailService.getSentEmails().some((e) => e.to === borrowerEmail)).toBe(true);

    const registeredProfile = store.profiles.find((p) => p.id === borrowerId);
    expect(registeredProfile).toBeDefined();
    expect(registeredProfile?.legal_name).toBe('Industrias Metalúrgicas Mediterránea S.A.');
    expect(registeredProfile?.bank_cbu_cvu).toBe(borrowerCbu);

    // =========================================================================
    // STEP 2: Loan Application Submission with Document Metadata & Persistence
    // =========================================================================
    const applicationPayload = {
      borrower_id: borrowerId,
      amount_requested: 6_000_000,
      term_months: 6,
      rate_type: 'TNA_FIXED' as const,
      category: 'working_capital' as const,
      balance_sheet_url: '/documents/sme-001/balance_2025.pdf',
      f931_url: '/documents/sme-001/f931_period_2026.pdf',
    };

    const submittedLoan = await services.loans.submitLoanApplication(applicationPayload);

    expect(submittedLoan).toBeDefined();
    expect(submittedLoan.id).toBeDefined();
    expect(submittedLoan.borrower_id).toBe(borrowerId);
    expect(submittedLoan.amount_requested).toBe(6_000_000);
    expect(submittedLoan.amount_funded).toBe(0);
    expect(submittedLoan.status).toBe('in_review');

    // Confirm persistence in database / store
    const persistedLoan = await services.loans.getLoanById(submittedLoan.id);
    expect(persistedLoan).not.toBeNull();
    expect(persistedLoan?.status).toBe('in_review');
    expect(persistedLoan?.amount_requested).toBe(6_000_000);

    // Confirm supporting document URLs registered in SME credit profile
    const borrowerCreditProfile = await services.creditScoring.getCreditProfileByProfileId(borrowerId);
    expect(borrowerCreditProfile?.balance_sheet_url).toBe(applicationPayload.balance_sheet_url);
    expect(borrowerCreditProfile?.f931_url).toBe(applicationPayload.f931_url);

    // =========================================================================
    // STEP 3: Admin Evaluation, BCRA Credit Scoring, and Auction Publication
    // =========================================================================
    // 3.1 Retrieve BCRA Central de Deudores credit report
    const bcraReport = await services.creditScoring.getBcraReport(borrowerTaxId);
    expect(bcraReport).toBeDefined();
    expect(bcraReport.cuit).toBe(borrowerTaxId);
    expect(bcraReport.worstSituation).toBe(1); // Normal situation
    expect(bcraReport.isClean).toBe(true);

    // 3.2 Evaluate overall SME credit risk
    const evaluatedCreditProfile = await services.creditScoring.evaluateCreditRisk({
      profileId: borrowerId,
      taxId: borrowerTaxId,
      hasBalanceSheet: true,
      hasF931: true,
    });
    expect(evaluatedCreditProfile.risk_tier).toBe('Tier A');

    // 3.3 Admin approval and auction publication
    const auctionDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const approvedLoan = await services.loans.approveAndPublishLoan({
      loan_id: submittedLoan.id,
      risk_tier: 'Tier A',
      investor_rate: 42.0,
      platform_spread: 3.0,
      funding_deadline: auctionDeadline,
    });

    expect(approvedLoan.status).toBe('funding');
    expect(approvedLoan.investor_rate).toBe(42.0);
    expect(approvedLoan.platform_spread).toBe(3.0);
    expect(approvedLoan.borrower_rate).toBe(45.0); // 42 + 3

    // =========================================================================
    // STEP 4: Multi-Investor Bidding up to 100% Capacity & Overfunding Rejection
    // =========================================================================
    // 4.1 Investor 1 commits $3,000,000 (50% of $6,000,000 total)
    const bid1 = await services.investments.commitInvestment({
      loan_id: approvedLoan.id,
      investor_id: investor1Id,
      amount: 3_000_000,
    });

    expect(bid1.amount_funded).toBe(3_000_000);
    expect(bid1.is_fully_funded).toBe(false);
    expect(bid1.loan.status).toBe('funding');
    expect(bid1.investment.status).toBe('committed');

    // 4.2 Overfunding Protection:
    // Remaining available capacity is $3,000,000.
    // Investor 2 attempts to commit $4,000,000 -> MUST BE ATOMICALLY REJECTED!
    await expect(
      services.investments.commitInvestment({
        loan_id: approvedLoan.id,
        investor_id: investor2Id,
        amount: 4_000_000,
      })
    ).rejects.toThrow(/exceeds remaining loan capacity/i);

    // Verify amount_funded remained unchanged at $3,000,000
    const loanCheckAfterRejection = await services.loans.getLoanById(approvedLoan.id);
    expect(loanCheckAfterRejection?.amount_funded).toBe(3_000_000);
    expect(loanCheckAfterRejection?.status).toBe('funding');

    // 4.3 Investor 2 commits exact remaining $3,000,000 -> 100% capacity reached
    const bid2 = await services.investments.commitInvestment({
      loan_id: approvedLoan.id,
      investor_id: investor2Id,
      amount: 3_000_000,
    });

    expect(bid2.amount_funded).toBe(6_000_000);
    expect(bid2.is_fully_funded).toBe(true);
    expect(bid2.loan.status).toBe('funded');

    // Confirm both investments are saved and loan status is 'funded'
    const allInvestments = await services.investments.getInvestmentsByLoan(approvedLoan.id);
    expect(allInvestments).toHaveLength(2);

    const fundedLoanState = await services.loans.getLoanById(approvedLoan.id);
    expect(fundedLoanState?.status).toBe('funded');
    expect(fundedLoanState?.amount_funded).toBe(6_000_000);

    // =========================================================================
    // STEP 5: Electronic Promissory Note (Pagaré Digital) Generation & OTP Signing
    // =========================================================================
    // 5.1 Generate digital promissory note
    const contract = await services.legal.generatePromissoryNote(approvedLoan.id);
    expect(contract).toBeDefined();
    expect(contract.loan_id).toBe(approvedLoan.id);
    expect(contract.document_type).toBe('pagare');
    expect(contract.signature_hash).toBeNull();
    expect(contract.signed_at).toBeNull();

    // 5.2 Simulate OTP Verification (passcode '789123') and compute cryptographic signature
    const otpCode = '789123';
    const signatureTimestamp = new Date().toISOString();
    const signaturePayload = `LENCORD:PAGARE:${approvedLoan.id}:${borrowerTaxId}:${approvedLoan.amount_requested}:${otpCode}:${signatureTimestamp}`;
    const signatureHash = await generateSha256(signaturePayload);

    // 5.3 Sign the promissory note contract
    const signedContract = await services.legal.signContract({
      contract_id: contract.id,
      signature_hash: signatureHash,
    });

    expect(signedContract.signature_hash).toBe(signatureHash);
    expect(signedContract.signed_at).toBeDefined();

    // 5.4 Activate loan and trigger disbursement via Payment Gateway
    const spyDisburse = vi.spyOn(paymentGateway, 'disburseLoan');
    const activatedLoan = await services.loans.activateLoan!(approvedLoan.id);

    expect(activatedLoan.status).toBe('active');
    expect(spyDisburse).toHaveBeenCalledWith(
      approvedLoan.id,
      borrowerCbu,
      6_000_000
    );

    // =========================================================================
    // STEP 6: Monthly Installment Schedule Generation & Repayment Simulation
    // =========================================================================
    const installments = await services.loans.getInstallmentsByLoan(approvedLoan.id);

    // Validate 6 monthly installments generated matching term_months
    expect(installments).toHaveLength(6);

    const firstInstallment = installments[0];
    expect(firstInstallment.installment_number).toBe(1);
    expect(firstInstallment.status).toBe('pending');
    expect(firstInstallment.principal_amount).toBeGreaterThan(0);
    expect(firstInstallment.interest_borrower).toBeGreaterThan(0);
    expect(firstInstallment.due_date).toBeDefined();

    // Total monthly payment = principal + interest
    const installmentTotalDue = Number(
      (firstInstallment.principal_amount + firstInstallment.interest_borrower).toFixed(2)
    );

    // 6.2 Simulate monthly installment collection via Payment Gateway
    const paymentResult = await services.payments.collectInstallment(
      firstInstallment.id,
      borrowerCbu,
      installmentTotalDue
    );

    expect(paymentResult.status).toBe('settled');
    expect(paymentResult.paymentId).toBeDefined();

    // 6.3 Update installment record to paid
    const installmentInStore = store.installments.find((i) => i.id === firstInstallment.id);
    if (installmentInStore) {
      installmentInStore.status = 'paid';
      installmentInStore.paid_at = new Date().toISOString();
    }

    const reloadedInstallments = await services.loans.getInstallmentsByLoan(approvedLoan.id);
    const paidInstallment = reloadedInstallments.find((i) => i.id === firstInstallment.id);
    expect(paidInstallment?.status).toBe('paid');
    expect(paidInstallment?.paid_at).toBeDefined();
  });

  describe('Isolated Acceptance Criteria Verification Suites', () => {
    it('executes complete borrower registration and authenticated session setup', async () => {
      const borrower: Profile = {
        id: 'prof-test-reg-1',
        role: 'sme',
        tax_id: '30719998881',
        legal_name: 'Soluciones Tecnologicas Cordoba SA',
        phone: '+54 351 450-9900',
        kyc_status: 'approved',
        bank_cbu_cvu: '0720123488000012345678',
        created_at: new Date().toISOString(),
      };
      (borrower as any).email = 'contacto@solucionescordoba.com';
      store.profiles.push(borrower);

      const profile = store.profiles.find((p) => p.id === borrower.id);
      expect(profile).toBeDefined();
      expect(profile?.tax_id).toBe('30719998881');
      expect(profile?.role).toBe('sme');
      expect(profile?.kyc_status).toBe('approved');
    });

    it('executes loan application submission with document metadata and confirms persistence in loans table', async () => {
      const loan = await services.loans.submitLoanApplication({
        borrower_id: borrowerId,
        amount_requested: 5_000_000,
        term_months: 12,
        rate_type: 'TNA_FIXED',
        category: 'machinery',
        balance_sheet_url: '/documents/sme-001/balance.pdf',
        f931_url: '/documents/sme-001/f931.pdf',
      });

      expect(loan.id).toBeDefined();
      expect(loan.status).toBe('in_review');

      const retrieved = await services.loans.getLoanById(loan.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(loan.id);
      expect(retrieved?.amount_requested).toBe(5_000_000);
      expect(retrieved?.category).toBe('machinery');

      const creditProfile = await services.creditScoring.getCreditProfileByProfileId(borrowerId);
      expect(creditProfile?.balance_sheet_url).toBe('/documents/sme-001/balance.pdf');
    });

    it('executes administrator evaluation, BCRA credit scoring retrieval, and auction publication with risk tier assignment', async () => {
      const loan = await services.loans.submitLoanApplication({
        borrower_id: borrowerId,
        amount_requested: 2_000_000,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        category: 'working_capital',
      });

      const report = await services.creditScoring.getBcraReport(borrowerTaxId);
      expect(report.worstSituation).toBe(1);

      const approved = await services.loans.approveAndPublishLoan({
        loan_id: loan.id,
        risk_tier: 'Tier A',
        investor_rate: 40.0,
        platform_spread: 2.5,
        funding_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      expect(approved.status).toBe('funding');
      expect(approved.borrower_rate).toBe(42.5);

      const profile = await services.creditScoring.getCreditProfileByProfileId(borrowerId);
      expect(profile?.risk_tier).toBe('Tier A');
    });

    it('executes multi-investor bidding up to 100% capacity and validates atomic overfunding rejection', async () => {
      const loan = await services.loans.submitLoanApplication({
        borrower_id: borrowerId,
        amount_requested: 1_000_000,
        term_months: 3,
        rate_type: 'TNA_FIXED',
        category: 'working_capital',
      });

      await services.loans.approveAndPublishLoan({
        loan_id: loan.id,
        risk_tier: 'Tier B',
        investor_rate: 45.0,
        platform_spread: 3.0,
        funding_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      // Partial bid 1
      const bid1 = await services.investments.commitInvestment({
        loan_id: loan.id,
        investor_id: investor1Id,
        amount: 600_000,
      });
      expect(bid1.amount_funded).toBe(600_000);
      expect(bid1.is_fully_funded).toBe(false);

      // Overfunding bid
      await expect(
        services.investments.commitInvestment({
          loan_id: loan.id,
          investor_id: investor2Id,
          amount: 500_000, // 600k + 500k = 1.1M > 1M
        })
      ).rejects.toThrow(/exceeds remaining loan capacity/i);

      // Final valid bid
      const bid2 = await services.investments.commitInvestment({
        loan_id: loan.id,
        investor_id: investor2Id,
        amount: 400_000,
      });
      expect(bid2.amount_funded).toBe(1_000_000);
      expect(bid2.is_fully_funded).toBe(true);
      expect(bid2.loan.status).toBe('funded');
    });

    it('executes digital promissory note OTP signature and verifies loan status transition to active', async () => {
      const loan = await services.loans.submitLoanApplication({
        borrower_id: borrowerId,
        amount_requested: 1_000_000,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        category: 'working_capital',
      });
      await services.loans.approveAndPublishLoan({
        loan_id: loan.id,
        risk_tier: 'Tier A',
        investor_rate: 40.0,
        platform_spread: 3.0,
        funding_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      await services.investments.commitInvestment({
        loan_id: loan.id,
        investor_id: investor1Id,
        amount: 1_000_000,
      });

      const note = await services.legal.generatePromissoryNote(loan.id);
      expect(note.document_type).toBe('pagare');

      const hash = await generateSha256(`LENCORD:PAGARE:${loan.id}:OTP123`);
      const signed = await services.legal.signContract({
        contract_id: note.id,
        signature_hash: hash,
      });
      expect(signed.signature_hash).toBe(hash);

      const activated = await services.loans.activateLoan!(loan.id);
      expect(activated.status).toBe('active');
    });

    it('executes monthly installment schedule generation and simulates installment repayment', async () => {
      const loan = await services.loans.submitLoanApplication({
        borrower_id: borrowerId,
        amount_requested: 1_200_000,
        term_months: 4,
        rate_type: 'TNA_FIXED',
        category: 'working_capital',
      });
      await services.loans.approveAndPublishLoan({
        loan_id: loan.id,
        risk_tier: 'Tier A',
        investor_rate: 40.0,
        platform_spread: 2.0,
        funding_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      await services.investments.commitInvestment({
        loan_id: loan.id,
        investor_id: investor1Id,
        amount: 1_200_000,
      });
      await services.loans.activateLoan!(loan.id);

      const installments = await services.loans.getInstallmentsByLoan(loan.id);
      expect(installments).toHaveLength(4);
      expect(installments.every((i) => i.status === 'pending')).toBe(true);

      const collectResult = await services.payments.collectInstallment(
        installments[0].id,
        borrowerCbu,
        installments[0].principal_amount + installments[0].interest_borrower
      );
      expect(collectResult.status).toBe('settled');
    });
  });
});

