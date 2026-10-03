import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MockInvestmentService } from '@/services/mock/MockInvestmentService';
import { MockLoanService } from '@/services/mock/MockLoanService';
import { MockStateStore } from '@/services/mock/mockState';

describe('Data Architecture: Ledger, Installment Payouts, Audit & Atomic RPCs (Issue #65)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const migrationFile = path.resolve(
    migrationsDir,
    '20261001000001_create_ledger_and_checkout_rpcs.sql'
  );
  const cloudSchemaFile = path.resolve(process.cwd(), 'supabase', 'setup_cloud_schema.sql');

  it('migration file exists in supabase/migrations directory', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(migrationFile)).toBe(true);
  });

  const sqlContent = fs.existsSync(migrationFile) ? fs.readFileSync(migrationFile, 'utf-8') : '';
  const cloudSchemaContent = fs.existsSync(cloudSchemaFile) ? fs.readFileSync(cloudSchemaFile, 'utf-8') : '';

  // 1. Table custody_transactions
  it('creates custody_transactions table with correct columns, types, indexes, and positive check', () => {
    expect(sqlContent).toMatch(/CREATE TABLE IF NOT EXISTS public\.custody_transactions/i);
    expect(sqlContent).toMatch(/profile_id UUID NOT NULL REFERENCES public\.profiles\(id\)/i);
    expect(sqlContent).toMatch(/amount NUMERIC\(14,\s*2\)\s+NOT NULL/i);
    expect(sqlContent).toMatch(/balance_after NUMERIC\(14,\s*2\)\s+NOT NULL/i);
    expect(sqlContent).toMatch(/CONSTRAINT check_transaction_amount_positive CHECK \(amount > 0\)/i);
    expect(sqlContent).toMatch(/idx_custody_transactions_profile_id/i);
    expect(sqlContent).toMatch(/idx_custody_transactions_created_at/i);

    expect(cloudSchemaContent).toMatch(/custody_transactions/i);
  });

  // 2. Table installment_payouts
  it('creates installment_payouts table with unique constraint and pro-rata share fields', () => {
    expect(sqlContent).toMatch(/CREATE TABLE IF NOT EXISTS public\.installment_payouts/i);
    expect(sqlContent).toMatch(/installment_id UUID NOT NULL REFERENCES public\.installments\(id\)/i);
    expect(sqlContent).toMatch(/investment_id UUID NOT NULL REFERENCES public\.investments\(id\)/i);
    expect(sqlContent).toMatch(/investor_id UUID NOT NULL REFERENCES public\.profiles\(id\)/i);
    expect(sqlContent).toMatch(/principal_share NUMERIC\(14,\s*2\)\s+NOT NULL/i);
    expect(sqlContent).toMatch(/interest_share NUMERIC\(14,\s*2\)\s+NOT NULL/i);
    expect(sqlContent).toMatch(/total_share NUMERIC\(14,\s*2\)\s+NOT NULL/i);
    expect(sqlContent).toMatch(/CONSTRAINT uq_installment_investment UNIQUE\s*\(installment_id,\s*investment_id\)/i);

    expect(cloudSchemaContent).toMatch(/installment_payouts/i);
  });

  // 3. Audit fields in legal_contracts
  it('alters legal_contracts to add evidentiary audit columns (signer_id, signer_role, signature_hash, signer_ip, signer_user_agent, signed_at)', () => {
    expect(sqlContent).toMatch(/ALTER TABLE public\.legal_contracts/i);
    expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS signer_id UUID/i);
    expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS signer_role VARCHAR\(20\)/i);
    expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS signer_ip VARCHAR\(45\)/i);
    expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS signer_user_agent TEXT/i);

    expect(cloudSchemaContent).toMatch(/signer_id UUID REFERENCES public\.profiles\(id\)/i);
    expect(cloudSchemaContent).toMatch(/signer_role VARCHAR\(20\)/i);
  });

  // 4. Atomic RPC: process_investment_checkout_rpc
  it('declares process_investment_checkout_rpc with row locking, validations, ledger insertion and status transition', () => {
    expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.process_investment_checkout_rpc/i);
    expect(sqlContent).toMatch(/SELECT \* INTO v_loan FROM public\.loans WHERE id = p_loan_id FOR UPDATE/i);
    expect(sqlContent).toMatch(/IF v_loan\.borrower_id = p_investor_id THEN/i);
    expect(sqlContent).toMatch(/IF \(v_loan\.amount_funded \+ p_amount\) > v_loan\.amount_requested THEN/i);
    expect(sqlContent).toMatch(/INSERT INTO public\.investments/i);
    expect(sqlContent).toMatch(/INSERT INTO public\.custody_transactions/i);
    expect(sqlContent).toMatch(/GRANT EXECUTE ON FUNCTION public\.process_investment_checkout_rpc/i);

    expect(cloudSchemaContent).toMatch(/process_investment_checkout_rpc/i);
  });

  // 5. Atomic RPC: process_installment_repayment_rpc
  it('declares process_installment_repayment_rpc with idempotency check, pro-rata investor distribution and loan status update', () => {
    expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.process_installment_repayment_rpc/i);
    expect(sqlContent).toMatch(/SELECT\s+\*\s+INTO\s+v_installment\s+FROM\s+public\.installments\s+WHERE\s+id\s*=\s*p_installment_id\s+FOR\s+UPDATE/i);
    expect(sqlContent).toMatch(/IF\s+v_installment\.status\s*=\s*'paid'\s+THEN/i);
    expect(sqlContent).toMatch(/INSERT INTO public\.installment_payouts/i);
    expect(sqlContent).toMatch(/INSERT INTO public\.custody_transactions/i);
    expect(sqlContent).toMatch(/UPDATE public\.loans SET\s+status = 'repaid'/i);
    expect(sqlContent).toMatch(/GRANT EXECUTE ON FUNCTION public\.process_installment_repayment_rpc/i);

    expect(cloudSchemaContent).toMatch(/process_installment_repayment_rpc/i);
  });

  // 6. RLS Policies
  it('enforces RLS on custody_transactions and installment_payouts with investor and admin policies', () => {
    expect(sqlContent).toMatch(/ALTER TABLE public\.custody_transactions ENABLE ROW LEVEL SECURITY/i);
    expect(sqlContent).toMatch(/ALTER TABLE public\.installment_payouts ENABLE ROW LEVEL SECURITY/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Investors can view own custody transactions"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Investors can view own installment payouts"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Admins have full access to custody transactions"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Admins have full access to installment payouts"/i);
  });

  // 7. Service Layer Simulation & Verification
  describe('Service Layer Checkout & Repayment Execution', () => {
    let store: MockStateStore;
    let investmentService: MockInvestmentService;
    let loanService: MockLoanService;

    beforeEach(() => {
      store = new MockStateStore();
      investmentService = new MockInvestmentService(store);
      loanService = new MockLoanService(store);
    });

    it('processes investment checkout with card and registers ledger hold transaction', async () => {
      const loan = store.loans.find((l) => l.status === 'funding')!;
      const investorId = 'prof-inv-001';

      const checkoutResult = await investmentService.checkoutInvestment({
        loan_id: loan.id,
        investor_id: investorId,
        amount: 50000,
        payment_method: 'credit_card',
        card_last_four: '9010',
        card_brand: 'Visa',
      });

      expect(checkoutResult.success).toBe(true);
      expect(checkoutResult.investment_id).toBeDefined();
      expect(checkoutResult.transaction_id).toBeDefined();
      expect(checkoutResult.payment_method).toBe('credit_card');
      expect(checkoutResult.card_last_four).toBe('9010');

      // Verify transaction exists in store ledger
      const tx = store.custodyTransactions.find((t) => t.id === checkoutResult.transaction_id);
      expect(tx).toBeDefined();
      expect(tx?.type).toBe('investment_hold');
      expect(tx?.amount).toBe(50000);
      expect(tx?.payment_metadata?.card_last_four).toBe('9010');
    });

    it('processes installment repayment, distributes pro-rata shares, and credits investors in ledger', async () => {
      // Setup loan with investments and installments
      const loan = store.loans[0];
      loan.status = 'active';

      // 2 investors
      store.investments = [
        {
          id: 'inv-1',
          loan_id: loan.id,
          investor_id: 'prof-inv-001',
          amount: 600000,
          status: 'committed',
          external_payment_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'inv-2',
          loan_id: loan.id,
          investor_id: 'prof-inv-002',
          amount: 400000,
          status: 'committed',
          external_payment_id: null,
          created_at: new Date().toISOString(),
        },
      ];

      const installment = {
        id: 'inst-repay-1',
        loan_id: loan.id,
        installment_number: 1,
        due_date: '2026-11-01',
        principal_amount: 100000,
        interest_borrower: 25000,
        interest_investors: 20000,
        interest_lencord: 5000,
        uva_value_applied: null,
        status: 'pending' as const,
        paid_at: null,
      };
      store.installments.push(installment);

      const repayResult = await loanService.repayInstallment({
        installment_id: installment.id,
        payer_id: loan.borrower_id,
      });

      expect(repayResult.success).toBe(true);
      expect(repayResult.status).toBe('paid');
      expect(repayResult.payouts_count).toBe(2);

      // Check payouts in store
      const payouts = store.installmentPayouts.filter((p) => p.installment_id === installment.id);
      expect(payouts.length).toBe(2);

      // 60% and 40% proportions
      const p1 = payouts.find((p) => p.investor_id === 'prof-inv-001')!;
      const p2 = payouts.find((p) => p.investor_id === 'prof-inv-002')!;

      expect(p1.principal_share).toBe(60000);
      expect(p1.interest_share).toBe(12000);
      expect(p1.total_share).toBe(72000);

      expect(p2.principal_share).toBe(40000);
      expect(p2.interest_share).toBe(8000);
      expect(p2.total_share).toBe(48000);

      // Total sum equals installment total
      expect(p1.total_share + p2.total_share).toBe(installment.principal_amount + installment.interest_investors);

      // Check custody transaction ledger entries
      const txs = store.custodyTransactions.filter((t) => t.reference_id === installment.id);
      expect(txs.length).toBe(2);
      expect(txs[0].type).toBe('installment_payout');

      // Check notification sent to investors
      const notifs = store.notifications.filter((n) => n.title.toLowerCase().includes('cuota'));
      expect(notifs.length).toBe(2);
    });

    it('rejects duplicate installment repayment idempotently', async () => {
      const installment = {
        id: 'inst-already-paid',
        loan_id: 'loan-1',
        installment_number: 1,
        due_date: '2026-10-01',
        principal_amount: 50000,
        interest_borrower: 10000,
        interest_investors: 8000,
        interest_lencord: 2000,
        uva_value_applied: null,
        status: 'paid' as const,
        paid_at: new Date().toISOString(),
      };
      store.installments.push(installment);

      await expect(
        loanService.repayInstallment({
          installment_id: installment.id,
          payer_id: 'prof-sme-001',
        })
      ).rejects.toThrow(/La cuota ya se encuentra pagada/i);
    });
  });
});
