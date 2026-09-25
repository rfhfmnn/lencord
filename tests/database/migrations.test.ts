import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Relational Database Schema and Row Level Security Setup (Issue #17)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const migrationFile = path.resolve(
    migrationsDir,
    '20260925000001_create_relational_schema_and_rls.sql'
  );

  it('migration file exists in supabase/migrations directory', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.existsSync(migrationFile)).toBe(true);
  });

  const sqlContent = fs.existsSync(migrationFile)
    ? fs.readFileSync(migrationFile, 'utf-8')
    : '';

  it('creates all 6 domain tables matching plan.md section 6 specification', () => {
    const requiredTables = [
      'profiles',
      'sme_credit_profiles',
      'loans',
      'investments',
      'installments',
      'legal_contracts',
    ];

    requiredTables.forEach((table) => {
      const tableRegex = new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}\\s*\\(`, 'i');
      expect(tableRegex.test(sqlContent)).toBe(true);
    });
  });

  it('creates required custom PostgreSQL ENUM types', () => {
    const requiredEnums = [
      'user_role',
      'kyc_status',
      'risk_tier',
      'rate_type',
      'loan_category',
      'loan_status',
      'investment_status',
      'installment_status',
      'contract_document_type',
    ];

    requiredEnums.forEach((enumType) => {
      const enumRegex = new RegExp(`CREATE TYPE ${enumType} AS ENUM`, 'i');
      expect(enumRegex.test(sqlContent)).toBe(true);
    });
  });

  it('verifies exact column definitions and types matching plan.md section 6', () => {
    // profiles columns
    expect(sqlContent).toMatch(/tax_id VARCHAR\(11\)/i);
    expect(sqlContent).toMatch(/legal_name VARCHAR\(255\)/i);
    expect(sqlContent).toMatch(/bank_cbu_cvu VARCHAR\(22\)/i);

    // sme_credit_profiles columns
    expect(sqlContent).toMatch(/bcra_situation SMALLINT/i);
    expect(sqlContent).toMatch(/balance_sheet_url TEXT/i);
    expect(sqlContent).toMatch(/f931_url TEXT/i);

    // loans columns
    expect(sqlContent).toMatch(/amount_requested NUMERIC\(14,\s*2\)/i);
    expect(sqlContent).toMatch(/amount_funded NUMERIC\(14,\s*2\)/i);
    expect(sqlContent).toMatch(/investor_rate NUMERIC\(5,\s*2\)/i);
    expect(sqlContent).toMatch(/platform_spread NUMERIC\(5,\s*2\)/i);
    expect(sqlContent).toMatch(/borrower_rate NUMERIC\(5,\s*2\)/i);
    expect(sqlContent).toMatch(/base_uva_value NUMERIC\(10,\s*4\)/i);
    expect(sqlContent).toMatch(/funding_deadline TIMESTAMP WITH TIME ZONE/i);

    // investments columns
    expect(sqlContent).toMatch(/external_payment_id VARCHAR\(100\)/i);

    // installments columns
    expect(sqlContent).toMatch(/principal_amount NUMERIC\(14,\s*2\)/i);
    expect(sqlContent).toMatch(/interest_borrower NUMERIC\(14,\s*2\)/i);
    expect(sqlContent).toMatch(/interest_investors NUMERIC\(14,\s*2\)/i);
    expect(sqlContent).toMatch(/interest_lencord NUMERIC\(14,\s*2\)/i);
    expect(sqlContent).toMatch(/uva_value_applied NUMERIC\(10,\s*4\)/i);

    // legal_contracts columns
    expect(sqlContent).toMatch(/signature_hash TEXT/i);
    expect(sqlContent).toMatch(/signed_at TIMESTAMP WITH TIME ZONE/i);
  });

  it('enforces check constraint "CHECK (amount_funded <= amount_requested)" to prevent overfunding', () => {
    expect(sqlContent).toMatch(/CHECK\s*\(\s*amount_funded\s*<=\s*amount_requested\s*\)/i);
  });

  it('defines foreign keys with appropriate cascade and restrict delete behaviors', () => {
    // profiles -> auth.users (CASCADE)
    expect(sqlContent).toMatch(/REFERENCES auth\.users\(id\)\s+ON DELETE CASCADE/i);

    // sme_credit_profiles -> profiles (CASCADE)
    expect(sqlContent).toMatch(/REFERENCES profiles\(id\)\s+ON DELETE CASCADE/i);

    // loans -> profiles (RESTRICT)
    expect(sqlContent).toMatch(/borrower_id UUID NOT NULL REFERENCES profiles\(id\)\s+ON DELETE RESTRICT/i);

    // investments -> loans (RESTRICT) and profiles (RESTRICT)
    expect(sqlContent).toMatch(/loan_id UUID NOT NULL REFERENCES loans\(id\)\s+ON DELETE RESTRICT/i);
    expect(sqlContent).toMatch(/investor_id UUID NOT NULL REFERENCES profiles\(id\)\s+ON DELETE RESTRICT/i);

    // installments -> loans (CASCADE)
    expect(sqlContent).toMatch(/loan_id UUID NOT NULL REFERENCES loans\(id\)\s+ON DELETE CASCADE/i);

    // legal_contracts -> loans (RESTRICT)
    expect(sqlContent).toMatch(/loan_id UUID NOT NULL REFERENCES loans\(id\)\s+ON DELETE RESTRICT/i);
  });

  it('enables Row Level Security (RLS) on all tables', () => {
    const requiredTables = [
      'profiles',
      'sme_credit_profiles',
      'loans',
      'investments',
      'installments',
      'legal_contracts',
    ];

    requiredTables.forEach((table) => {
      const rlsRegex = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`, 'i');
      expect(rlsRegex.test(sqlContent)).toBe(true);
    });
  });

  it('implements security isolation policies conforming to plan.md section 8.4', () => {
    // Admin access
    expect(sqlContent).toMatch(/is_admin\(\)/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Admins have full access to profiles"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Admins have full access to loans"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Admins have full access to investments"/i);

    // Borrower isolation
    expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can view own credit profile"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can view own loans"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can update own draft or in_review loans"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Borrowers can view contracts for their loans"/i);

    // Investor isolation
    expect(sqlContent).toMatch(/CREATE POLICY "Investors can view own investments"/i);
    expect(sqlContent).toMatch(/CREATE POLICY "Investors can view installments for invested loans"/i);

    // Marketplace public/investor active read
    expect(sqlContent).toMatch(/CREATE POLICY "Public and investors can view active marketplace loans"/i);
    expect(sqlContent).toMatch(/status IN \('funding', 'funded', 'active', 'repaid'\)/i);
  });

  it('validates SQL syntactic structure and statement termination', () => {
    // Check balanced parentheses in CREATE TABLE statements
    const createTableBlocks = sqlContent.match(/CREATE TABLE IF NOT EXISTS [a-z_.]+ \([\s\S]*?\);/gi);
    expect(createTableBlocks).not.toBeNull();
    expect(createTableBlocks?.length).toBe(7); // auth.users + 6 domain tables

    createTableBlocks?.forEach((block) => {
      const openParen = (block.match(/\(/g) || []).length;
      const closeParen = (block.match(/\)/g) || []).length;
      expect(openParen).toBe(closeParen);
    });

    // Verify all policy statements end with semicolons
    const policyStatements = sqlContent.match(/CREATE POLICY[\s\S]*?;/gi);
    expect(policyStatements).not.toBeNull();
    expect(policyStatements?.length).toBeGreaterThanOrEqual(12);
  });
});
