-- ============================================================================
-- Migration: 20260925000001_create_relational_schema_and_rls.sql
-- Description: Complete PostgreSQL database schema, constraints, foreign keys,
--              and Row Level Security (RLS) policies for Lencord P2P Platform.
-- Specification: _docs/plan.md Section 6 and Section 8.4
-- ============================================================================

-- Ensure auth schema and dummy auth.users exist for local compatibility
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY
);

-- ----------------------------------------------------------------------------
-- 1. Custom ENUM Types
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('investor', 'sme', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_tier AS ENUM ('Tier A', 'Tier B', 'Tier C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rate_type AS ENUM ('TNA_FIXED', 'CER_VARIABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE loan_category AS ENUM (
    'working_capital',
    'machinery',
    'refinancing',
    'expansion',
    'new_sme'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM (
    'draft',
    'in_review',
    'funding',
    'funded',
    'active',
    'repaid',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE investment_status AS ENUM ('committed', 'settled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE installment_status AS ENUM ('pending', 'paid', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_document_type AS ENUM ('mutuo', 'pagare');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tables & Constraints
-- ----------------------------------------------------------------------------

-- 2.1. Tabla profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'investor',
  tax_id VARCHAR(11) NOT NULL UNIQUE,
  legal_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  kyc_status kyc_status NOT NULL DEFAULT 'pending',
  bank_cbu_cvu VARCHAR(22) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_tax_id_format CHECK (tax_id ~ '^[0-9]{11}$')
);

-- 2.2. Tabla sme_credit_profiles
CREATE TABLE IF NOT EXISTS sme_credit_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bcra_situation SMALLINT NULL,
  risk_tier risk_tier NOT NULL DEFAULT 'Tier B',
  balance_sheet_url TEXT NULL,
  f931_url TEXT NULL,
  scoring_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_bcra_situation_range CHECK (
    bcra_situation IS NULL OR (bcra_situation >= 1 AND bcra_situation <= 5)
  )
);

-- 2.3. Tabla loans
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount_requested NUMERIC(14, 2) NOT NULL,
  amount_funded NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  term_months INT NOT NULL,
  rate_type rate_type NOT NULL,
  investor_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  platform_spread NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  borrower_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  base_uva_value NUMERIC(10, 4) NULL,
  category loan_category NOT NULL,
  status loan_status NOT NULL DEFAULT 'in_review',
  funding_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_amount_requested_positive CHECK (amount_requested > 0),
  CONSTRAINT check_amount_funded_non_negative CHECK (amount_funded >= 0),
  CONSTRAINT check_term_months_positive CHECK (term_months > 0),
  CONSTRAINT check_amount_funded_limit CHECK (amount_funded <= amount_requested)
);

-- 2.4. Tabla investments
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
  investor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL,
  status investment_status NOT NULL DEFAULT 'committed',
  external_payment_id VARCHAR(100) NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_investment_amount_positive CHECK (amount > 0)
);

-- 2.5. Tabla installments
CREATE TABLE IF NOT EXISTS installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  principal_amount NUMERIC(14, 2) NOT NULL,
  interest_borrower NUMERIC(14, 2) NOT NULL,
  interest_investors NUMERIC(14, 2) NOT NULL,
  interest_lencord NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  uva_value_applied NUMERIC(10, 4) NULL,
  status installment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT check_installment_number_positive CHECK (installment_number > 0),
  CONSTRAINT check_principal_amount_non_negative CHECK (principal_amount >= 0),
  CONSTRAINT check_interest_borrower_non_negative CHECK (interest_borrower >= 0),
  CONSTRAINT check_interest_investors_non_negative CHECK (interest_investors >= 0),
  CONSTRAINT check_interest_lencord_non_negative CHECK (interest_lencord >= 0)
);

-- 2.6. Tabla legal_contracts
CREATE TABLE IF NOT EXISTS legal_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
  document_type contract_document_type NOT NULL,
  document_url TEXT NOT NULL,
  signature_hash TEXT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NULL
);

-- ----------------------------------------------------------------------------
-- 3. Indexes for Performance
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_tax_id ON profiles(tax_id);
CREATE INDEX IF NOT EXISTS idx_sme_credit_profiles_profile_id ON sme_credit_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_investments_loan_id ON investments(loan_id);
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_installments_loan_id ON installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_legal_contracts_loan_id ON legal_contracts(loan_id);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Helper Functions & Activation
-- ----------------------------------------------------------------------------

-- Enable Row Level Security on all 6 tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sme_credit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_contracts ENABLE ROW LEVEL SECURITY;

-- Helper function to identify platform administrators and service_role tokens
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR COALESCE((auth.jwt() ->> 'role'), '') = 'service_role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security Policies
-- ----------------------------------------------------------------------------

-- 5.1. Policies for profiles
DROP POLICY IF EXISTS "Admins have full access to profiles" ON profiles;
CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5.2. Policies for sme_credit_profiles
DROP POLICY IF EXISTS "Admins have full access to sme_credit_profiles" ON sme_credit_profiles;
CREATE POLICY "Admins have full access to sme_credit_profiles"
  ON sme_credit_profiles FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Borrowers can view own credit profile" ON sme_credit_profiles;
CREATE POLICY "Borrowers can view own credit profile"
  ON sme_credit_profiles FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Borrowers can update own credit profile" ON sme_credit_profiles;
CREATE POLICY "Borrowers can update own credit profile"
  ON sme_credit_profiles FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Borrowers can insert own credit profile" ON sme_credit_profiles;
CREATE POLICY "Borrowers can insert own credit profile"
  ON sme_credit_profiles FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- 5.3. Policies for loans
DROP POLICY IF EXISTS "Admins have full access to loans" ON loans;
CREATE POLICY "Admins have full access to loans"
  ON loans FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Borrowers can view own loans" ON loans;
CREATE POLICY "Borrowers can view own loans"
  ON loans FOR SELECT
  USING (borrower_id = auth.uid());

DROP POLICY IF EXISTS "Borrowers can insert own loan applications" ON loans;
CREATE POLICY "Borrowers can insert own loan applications"
  ON loans FOR INSERT
  WITH CHECK (borrower_id = auth.uid());

DROP POLICY IF EXISTS "Borrowers can update own draft or in_review loans" ON loans;
CREATE POLICY "Borrowers can update own draft or in_review loans"
  ON loans FOR UPDATE
  USING (borrower_id = auth.uid() AND status IN ('draft', 'in_review'))
  WITH CHECK (borrower_id = auth.uid());

DROP POLICY IF EXISTS "Public and investors can view active marketplace loans" ON loans;
CREATE POLICY "Public and investors can view active marketplace loans"
  ON loans FOR SELECT
  USING (status IN ('funding', 'funded', 'active', 'repaid'));

-- 5.4. Policies for investments
DROP POLICY IF EXISTS "Admins have full access to investments" ON investments;
CREATE POLICY "Admins have full access to investments"
  ON investments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Investors can view own investments" ON investments;
CREATE POLICY "Investors can view own investments"
  ON investments FOR SELECT
  USING (investor_id = auth.uid());

DROP POLICY IF EXISTS "Investors can insert own investments" ON investments;
CREATE POLICY "Investors can insert own investments"
  ON investments FOR INSERT
  WITH CHECK (investor_id = auth.uid());

DROP POLICY IF EXISTS "Borrowers can view investments for their loans" ON investments;
CREATE POLICY "Borrowers can view investments for their loans"
  ON investments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = investments.loan_id
        AND loans.borrower_id = auth.uid()
    )
  );

-- 5.5. Policies for installments
DROP POLICY IF EXISTS "Admins have full access to installments" ON installments;
CREATE POLICY "Admins have full access to installments"
  ON installments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Borrowers can view installments for their loans" ON installments;
CREATE POLICY "Borrowers can view installments for their loans"
  ON installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = installments.loan_id
        AND loans.borrower_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Investors can view installments for invested loans" ON installments;
CREATE POLICY "Investors can view installments for invested loans"
  ON installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM investments
      WHERE investments.loan_id = installments.loan_id
        AND investments.investor_id = auth.uid()
    )
  );

-- 5.6. Policies for legal_contracts
DROP POLICY IF EXISTS "Admins have full access to legal_contracts" ON legal_contracts;
CREATE POLICY "Admins have full access to legal_contracts"
  ON legal_contracts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Borrowers can view contracts for their loans" ON legal_contracts;
CREATE POLICY "Borrowers can view contracts for their loans"
  ON legal_contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = legal_contracts.loan_id
        AND loans.borrower_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Borrowers can update contracts for their loans" ON legal_contracts;
CREATE POLICY "Borrowers can update contracts for their loans"
  ON legal_contracts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = legal_contracts.loan_id
        AND loans.borrower_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = legal_contracts.loan_id
        AND loans.borrower_id = auth.uid()
    )
  );
