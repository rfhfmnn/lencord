import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Borrower Privacy Protection and Public View (SEC-04 / Issue #89)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const migrationFile = path.resolve(
    migrationsDir,
    '20261019000002_protect_borrower_privacy_and_create_public_view.sql'
  );

  it('migration file exists in supabase/migrations directory', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(migrationFile)).toBe(true);
  });

  const sqlContent = fs.existsSync(migrationFile)
    ? fs.readFileSync(migrationFile, 'utf-8')
    : '';

  it('revokes the open public read policy on public.profiles', () => {
    expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Public can view borrower company profiles" ON public\.profiles;/i);
  });

  it('retains authenticated owner, admin, and creditor access policies on public.profiles', () => {
    expect(sqlContent).toMatch(/CREATE POLICY "Admins have full access to profiles"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Users can view own profile"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can view creditor profiles for their loans"/i);
  });

  it('creates desensitized public view borrower_public_profiles exposing only non-sensitive columns', () => {
    expect(sqlContent).toMatch(/CREATE OR REPLACE VIEW public\.borrower_public_profiles AS/i);
    expect(sqlContent).toMatch(/p\.id/i);
    expect(sqlContent).toMatch(/p\.legal_name/i);
    expect(sqlContent).toMatch(/p\.company_type/i);
    expect(sqlContent).toMatch(/p\.created_at/i);

    // Verifies sensitive columns (tax_id, phone, bank_cbu_cvu, bank_alias) are NOT present in the view definition
    expect(sqlContent).not.toMatch(/p\.tax_id/i);
    expect(sqlContent).not.toMatch(/p\.phone/i);
    expect(sqlContent).not.toMatch(/p\.bank_cbu_cvu/i);
    expect(sqlContent).not.toMatch(/p\.bank_alias/i);

    // Verifies grant to anon and authenticated
    expect(sqlContent).toMatch(/GRANT SELECT ON public\.borrower_public_profiles TO anon, authenticated;/i);
  });
});
