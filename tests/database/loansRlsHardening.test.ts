import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Loans Update RLS Hardening & Atomic Acceptance RPC (SEC-02 / Issue #87)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const migrationFile = path.resolve(
    migrationsDir,
    '20261019000001_harden_loans_update_rls.sql'
  );

  it('migration file exists in supabase/migrations directory', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(migrationFile)).toBe(true);
  });

  const sqlContent = fs.existsSync(migrationFile)
    ? fs.readFileSync(migrationFile, 'utf-8')
    : '';

  it('revokes the open and permissive borrower update policy', () => {
    expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Borrowers can update own loans" ON public\.loans;/i);
  });

  it('creates hardened update policy with state checks and financial column integrity guards', () => {
    expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can update own editable loans"/i);
    expect(sqlContent).toMatch(/ON public\.loans FOR UPDATE/i);
    expect(sqlContent).toMatch(/TO authenticated/i);

    // Checks allowed stages in USING
    expect(sqlContent).toMatch(/borrower_id = auth\.uid\(\)/i);
    expect(sqlContent).toMatch(/status IN \('draft', 'in_review', 'funding'\)/i);

    // Checks WITH CHECK guards preventing tampering of financial terms
    expect(sqlContent).toMatch(/borrower_rate = \(SELECT l\.borrower_rate FROM public\.loans l WHERE l\.id = loans\.id\)/i);
    expect(sqlContent).toMatch(/investor_rate = \(SELECT l\.investor_rate FROM public\.loans l WHERE l\.id = loans\.id\)/i);
    expect(sqlContent).toMatch(/amount_requested = \(SELECT l\.amount_requested FROM public\.loans l WHERE l\.id = loans\.id\)/i);
    expect(sqlContent).toMatch(/amount_funded = \(SELECT l\.amount_funded FROM public\.loans l WHERE l\.id = loans\.id\)/i);
  });

  it('defines secure atomic RPC function accept_partial_funding_secure with 75% quorum verification', () => {
    expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.accept_partial_funding_secure\(p_loan_id UUID\)/i);
    expect(sqlContent).toMatch(/RETURNS JSONB/i);
    expect(sqlContent).toMatch(/SECURITY DEFINER/i);

    // Validates auth.uid()
    expect(sqlContent).toMatch(/auth\.uid\(\)/i);
    expect(sqlContent).toMatch(/RAISE EXCEPTION 'Unauthorized/i);

    // Locks row to prevent race conditions
    expect(sqlContent).toMatch(/FOR UPDATE/i);

    // Enforces 75% quorum threshold
    expect(sqlContent).toMatch(/0\.75/);
    expect(sqlContent).toMatch(/partial_acceptance_flag = true/i);
    expect(sqlContent).toMatch(/GRANT EXECUTE ON FUNCTION public\.accept_partial_funding_secure\(UUID\) TO authenticated;/i);
  });
});
