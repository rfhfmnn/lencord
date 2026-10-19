import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Profiles Role Escalation Prevention in RLS (Issue #92 / SEC-07)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const migrationFile = path.resolve(
    migrationsDir,
    '20261019000004_prevent_admin_role_escalation_in_profiles_rls.sql'
  );

  it('migration file exists in supabase/migrations directory', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(migrationFile)).toBe(true);
  });

  const sqlContent = fs.existsSync(migrationFile)
    ? fs.readFileSync(migrationFile, 'utf-8')
    : '';

  it('revokes and recreates "Users can insert own profile" policy with role restriction', () => {
    expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Users can insert own profile" ON public\.profiles;/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Users can insert own profile"/i);
    expect(sqlContent).toMatch(/ON public\.profiles FOR INSERT/i);
    expect(sqlContent).toMatch(/auth\.uid\(\) = id/i);
    // Explicitly restricts role to investor or sme unless admin
    expect(sqlContent).toMatch(/role IN \('investor'::user_role, 'sme'::user_role\)/i);
    expect(sqlContent).toMatch(/is_admin\(\)/i);
  });

  it('revokes and recreates "Users can update own profile" policy preventing role modification', () => {
    expect(sqlContent).toMatch(/DROP POLICY IF EXISTS "Users can update own profile" ON public\.profiles;/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Users can update own profile"/i);
    expect(sqlContent).toMatch(/ON public\.profiles FOR UPDATE/i);
    expect(sqlContent).toMatch(/auth\.uid\(\) = id/i);
    // Guard ensures role cannot be changed by regular user
    expect(sqlContent).toMatch(/role = \(SELECT p\.role FROM public\.profiles p WHERE p\.id = profiles\.id\)/i);
  });
});
