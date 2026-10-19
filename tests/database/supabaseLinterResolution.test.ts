import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Supabase Security Advisor / Linter Warning Resolution (Migration 20261019000003)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const migrationFile = path.resolve(
    migrationsDir,
    '20261019000003_secure_borrower_public_profiles_rpc.sql'
  );

  it('migration file exists in supabase/migrations directory', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(migrationFile)).toBe(true);
  });

  const sqlContent = fs.existsSync(migrationFile)
    ? fs.readFileSync(migrationFile, 'utf-8')
    : '';

  it('defines secure RPC function get_borrower_public_profiles with explicit search_path', () => {
    expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.get_borrower_public_profiles\(\)/i);
    expect(sqlContent).toMatch(/RETURNS TABLE/i);
    expect(sqlContent).toMatch(/SECURITY DEFINER/i);
    expect(sqlContent).toMatch(/SET search_path = public/i);
    expect(sqlContent).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_borrower_public_profiles\(\) TO anon, authenticated;/i);
  });

  it('defines the view with security_invoker = true to satisfy Supabase security linter', () => {
    expect(sqlContent).toMatch(/WITH \(security_invoker = true\)/i);
    expect(sqlContent).toMatch(/CREATE OR REPLACE VIEW public\.borrower_public_profiles/i);
    expect(sqlContent).toMatch(/FROM public\.get_borrower_public_profiles\(\)/i);
  });
});
