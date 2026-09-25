import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Investment, Loan, LoanStatus } from '@/types';

describe('Atomic Auction Investment RPC Function (Issue #18)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const rpcFile = path.resolve(
    migrationsDir,
    '20260925000002_create_commit_investment_atomic_rpc.sql'
  );

  it('migration file exists in supabase/migrations directory', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(rpcFile)).toBe(true);
  });

  const sqlContent = fs.existsSync(rpcFile) ? fs.readFileSync(rpcFile, 'utf-8') : '';

  it('declares function commit_investment_atomic with exact signatures matching plan.md section 8.3', () => {
    const fnRegex =
      /CREATE OR REPLACE FUNCTION commit_investment_atomic\s*\(\s*p_loan_id UUID,\s*p_investor_id UUID,\s*p_amount NUMERIC\s*\)\s*RETURNS JSONB/i;
    expect(fnRegex.test(sqlContent)).toBe(true);
  });

  it('executes pessimistic row locking using "SELECT ... FOR UPDATE" before checking values', () => {
    expect(sqlContent).toMatch(/SELECT\s+\*\s+INTO\s+v_loan\s+FROM\s+loans\s+WHERE\s+id\s*=\s*p_loan_id\s+FOR\s+UPDATE/i);
  });

  it('throws an exception if loan status is not "funding"', () => {
    expect(sqlContent).toMatch(/IF\s+v_loan\.status\s*!=\s*'funding'\s+THEN/i);
    expect(sqlContent).toMatch(/RAISE EXCEPTION 'El préstamo no se encuentra en estado de fondeo'/i);
  });

  it('throws an exception if investment exceeds available quota (overfunding protection)', () => {
    expect(sqlContent).toMatch(/IF\s*\(v_loan\.amount_funded\s*\+\s*p_amount\)\s*>\s*v_loan\.amount_requested\s*THEN/i);
    expect(sqlContent).toMatch(/RAISE EXCEPTION 'El monto excede el cupo disponible de la subasta'/i);
  });

  it('updates amount_funded and inserts committed investment record within the same transaction', () => {
    expect(sqlContent).toMatch(/v_new_funded\s*:=\s*v_loan\.amount_funded\s*\+\s*p_amount;/i);
    expect(sqlContent).toMatch(/UPDATE\s+loans\s+SET\s+amount_funded\s*=\s*v_new_funded/i);
    expect(sqlContent).toMatch(/INSERT\s+INTO\s+investments\s*\(\s*loan_id,\s*investor_id,\s*amount,\s*status/i);
    expect(sqlContent).toMatch(/'committed'/i);
  });

  it('transitions loan status to "funded" when new_funded equals amount_requested', () => {
    expect(sqlContent).toMatch(
      /WHEN\s+v_new_funded\s*=\s*amount_requested\s+THEN\s*'funded'::loan_status/i
    );
  });

  it('returns JSONB object with success: true and updated amount_funded', () => {
    expect(sqlContent).toMatch(/RETURN jsonb_build_object\(\s*'success',\s*true,\s*'amount_funded',\s*v_new_funded\s*\)/i);
  });

  // ---------------------------------------------------------------------------
  // Concurrency Simulation Testing Atomic Logic
  // ---------------------------------------------------------------------------
  describe('Transactional Concurrency Simulation', () => {
    // In-memory simulation of the exact PL/pgSQL commit_investment_atomic logic
    class SimulatedPostgresEngine {
      public loans: Map<string, Loan> = new Map();
      public investments: Investment[] = [];
      private locks: Map<string, boolean> = new Map();

      public registerLoan(loan: Loan) {
        this.loans.set(loan.id, { ...loan });
      }

      public async commitInvestmentAtomic(
        loanId: string,
        investorId: string,
        amount: number
      ): Promise<{ success: boolean; amount_funded: number }> {
        // Pessimistic lock simulation (mutex per loan_id)
        while (this.locks.get(loanId)) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        this.locks.set(loanId, true);

        try {
          const loan = this.loans.get(loanId);
          if (!loan) {
            throw new Error('Préstamo no encontrado');
          }

          if (loan.status !== 'funding') {
            throw new Error('El préstamo no se encuentra en estado de fondeo');
          }

          if (loan.amount_funded + amount > loan.amount_requested) {
            throw new Error('El monto excede el cupo disponible de la subasta');
          }

          const newFunded = loan.amount_funded + amount;
          loan.amount_funded = newFunded;
          if (newFunded === loan.amount_requested) {
            loan.status = 'funded';
          }

          this.investments.push({
            id: `inv-${Math.random().toString(36).substring(2, 9)}`,
            loan_id: loanId,
            investor_id: investorId,
            amount,
            status: 'committed',
            external_payment_id: `ext_${Date.now()}`,
            created_at: new Date().toISOString(),
          });

          return { success: true, amount_funded: newFunded };
        } finally {
          this.locks.set(loanId, false);
        }
      }
    }

    it('rejects investment when loan is not in "funding" status', async () => {
      const db = new SimulatedPostgresEngine();
      const draftLoan: Loan = {
        id: 'loan-draft-01',
        borrower_id: 'prof-sme-001',
        amount_requested: 5_000_000,
        amount_funded: 0,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 45.0,
        platform_spread: 2.5,
        borrower_rate: 47.5,
        base_uva_value: null,
        category: 'working_capital',
        status: 'draft',
        funding_deadline: '2026-10-30T23:59:59.000Z',
        created_at: new Date().toISOString(),
      };
      db.registerLoan(draftLoan);

      await expect(
        db.commitInvestmentAtomic('loan-draft-01', 'prof-inv-001', 500_000)
      ).rejects.toThrow('El préstamo no se encuentra en estado de fondeo');
    });

    it('prevents overfunding and handles concurrent simultaneous investments race-free', async () => {
      const db = new SimulatedPostgresEngine();
      // Loan with $1,000,000 capacity remaining ($9,000,000 already funded of $10,000,000)
      const targetLoan: Loan = {
        id: 'loan-concurrent-01',
        borrower_id: 'prof-sme-002',
        amount_requested: 10_000_000,
        amount_funded: 9_000_000,
        term_months: 12,
        rate_type: 'TNA_FIXED',
        investor_rate: 45.0,
        platform_spread: 2.5,
        borrower_rate: 47.5,
        base_uva_value: null,
        category: 'machinery',
        status: 'funding',
        funding_deadline: '2026-10-30T23:59:59.000Z',
        created_at: new Date().toISOString(),
      };
      db.registerLoan(targetLoan);

      // 3 concurrent investors simultaneously trying to commit $500,000 each
      // Remaining cupo is only $1,000,000 -> Exactly 2 must succeed, 1 must fail with overfunding error
      const results = await Promise.allSettled([
        db.commitInvestmentAtomic('loan-concurrent-01', 'prof-inv-001', 500_000),
        db.commitInvestmentAtomic('loan-concurrent-01', 'prof-inv-002', 500_000),
        db.commitInvestmentAtomic('loan-concurrent-01', 'prof-inv-003', 500_000),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(1);

      // Verify rejection error is either exceeding quota or already fully funded
      if (rejected[0].status === 'rejected') {
        const msg = rejected[0].reason.message;
        const isValidRejection =
          msg.includes('El monto excede el cupo disponible') ||
          msg.includes('El préstamo no se encuentra en estado de fondeo');
        expect(isValidRejection).toBe(true);
      }

      // Explicitly test quota exceeded error while loan is still in funding status
      const loanWithCapacity: Loan = {
        ...targetLoan,
        id: 'loan-capacity-02',
        amount_funded: 9_500_000,
        amount_requested: 10_000_000,
        status: 'funding',
      };
      db.registerLoan(loanWithCapacity);

      await expect(
        db.commitInvestmentAtomic('loan-capacity-02', 'prof-inv-001', 600_000)
      ).rejects.toThrow('El monto excede el cupo disponible de la subasta');
    });
  });
});
