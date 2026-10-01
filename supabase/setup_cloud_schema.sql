-- ============================================================================
-- LENCORD P2P PLATFORM - ESQUEMA INTEGRAL DEFINITIVO PARA PRODUCCIÓN / CLOUD
-- Ejecutar en Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

-- Habilitar extensión criptográfica
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Tipos ENUM del Sistema
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('investor', 'borrower', 'sme', 'admin');
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
    'cancelled',
    'rejected',
    'expired'
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

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tablas Principales
-- ----------------------------------------------------------------------------

-- 2.1. Tabla profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'investor',
  tax_id VARCHAR(11) NULL,
  legal_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  kyc_status kyc_status NOT NULL DEFAULT 'pending',
  bank_cbu_cvu VARCHAR(22) NOT NULL DEFAULT '0000000000000000000000',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  notification_preferences JSONB NOT NULL DEFAULT '{"email": true, "sms": true, "whatsapp": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_tax_id_format CHECK (
    tax_id IS NULL OR tax_id ~ '^[0-9]{7,8}$' OR tax_id ~ '^[0-9]{11}$'
  )
);

-- Asegurar compatibilidad si la tabla ya existía previamente con NOT NULL
DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN tax_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_tax_id_format;
  ALTER TABLE public.profiles ADD CONSTRAINT check_tax_id_format CHECK (
    tax_id IS NULL OR tax_id ~ '^[0-9]{7,8}$' OR tax_id ~ '^[0-9]{11}$'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2.2. Tabla sme_credit_profiles
CREATE TABLE IF NOT EXISTS public.sme_credit_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
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
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_amount_requested_positive CHECK (amount_requested > 0),
  CONSTRAINT check_amount_funded_non_negative CHECK (amount_funded >= 0),
  CONSTRAINT check_term_months_positive CHECK (term_months > 0),
  CONSTRAINT check_amount_funded_limit CHECK (amount_funded <= amount_requested)
);

-- 2.4. Tabla investments
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
  investor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL,
  status investment_status NOT NULL DEFAULT 'committed',
  gateway_hold_id TEXT NULL,
  external_payment_id VARCHAR(100) NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_investment_amount_positive CHECK (amount > 0)
);

-- 2.5. Tabla installments
CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS public.legal_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
  document_type contract_document_type NOT NULL,
  document_url TEXT NOT NULL,
  signer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  signer_role VARCHAR(20) NULL,
  signature_hash TEXT NULL,
  signer_ip VARCHAR(45) NULL,
  signer_user_agent TEXT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NULL
);

-- 2.7. Tabla notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2.8. Tabla custody_transactions (Libro Contable Inmutable / Ledger)
CREATE TABLE IF NOT EXISTS public.custody_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  balance_after NUMERIC(14, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  reference_id UUID NULL,
  payment_metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_transaction_amount_positive CHECK (amount > 0)
);

-- 2.9. Tabla installment_payouts (Distribución de Cuotas por Inversor)
CREATE TABLE IF NOT EXISTS public.installment_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE RESTRICT,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE RESTRICT,
  investor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  principal_share NUMERIC(14, 2) NOT NULL,
  interest_share NUMERIC(14, 2) NOT NULL,
  total_share NUMERIC(14, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'credited',
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_installment_investment UNIQUE (installment_id, investment_id)
);

-- ----------------------------------------------------------------------------
-- 3. Índices de Rendimiento
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_tax_id ON public.profiles(tax_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_sme_credit_profiles_profile_id ON public.sme_credit_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_investments_loan_id ON public.investments(loan_id);
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON public.investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_installments_loan_id ON public.installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_legal_contracts_loan_id ON public.legal_contracts(loan_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custody_transactions_profile_id ON public.custody_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_custody_transactions_created_at ON public.custody_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custody_transactions_reference_id ON public.custody_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_installment_payouts_investor_id ON public.installment_payouts(investor_id);
CREATE INDEX IF NOT EXISTS idx_installment_payouts_installment_id ON public.installment_payouts(installment_id);
CREATE INDEX IF NOT EXISTS idx_installment_payouts_investment_id ON public.installment_payouts(investment_id);

-- ----------------------------------------------------------------------------
-- 4. Seguridad a Nivel de Fila (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sme_credit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_payouts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR COALESCE((auth.jwt() ->> 'role'), '') = 'service_role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas de Profiles
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Enable insert for authenticated users and trigger" ON public.profiles;
CREATE POLICY "Enable insert for authenticated users and trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- Políticas de Loans
DROP POLICY IF EXISTS "Admins have full access to loans" ON public.loans;
CREATE POLICY "Admins have full access to loans"
  ON public.loans FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view loans in funding" ON public.loans;
CREATE POLICY "Anyone can view loans in funding"
  ON public.loans FOR SELECT
  USING (status IN ('funding', 'funded', 'active', 'repaid'));

DROP POLICY IF EXISTS "Borrowers can view their own loans" ON public.loans;
CREATE POLICY "Borrowers can view their own loans"
  ON public.loans FOR SELECT
  USING (auth.uid() = borrower_id);

DROP POLICY IF EXISTS "Borrowers can create draft or in_review loans" ON public.loans;
CREATE POLICY "Borrowers can create draft or in_review loans"
  ON public.loans FOR INSERT
  WITH CHECK (auth.uid() = borrower_id AND status IN ('draft', 'in_review'));

-- Políticas de Investments
DROP POLICY IF EXISTS "Admins have full access to investments" ON public.investments;
CREATE POLICY "Admins have full access to investments"
  ON public.investments FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Investors can view their own investments" ON public.investments;
CREATE POLICY "Investors can view their own investments"
  ON public.investments FOR SELECT
  USING (auth.uid() = investor_id);

-- Políticas de Notifications
DROP POLICY IF EXISTS "Admins have full access to notifications" ON public.notifications;
CREATE POLICY "Admins have full access to notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas de custody_transactions
DROP POLICY IF EXISTS "Investors can view own custody transactions" ON public.custody_transactions;
CREATE POLICY "Investors can view own custody transactions"
  ON public.custody_transactions FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to custody transactions" ON public.custody_transactions;
CREATE POLICY "Admins have full access to custody transactions"
  ON public.custody_transactions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Políticas de installment_payouts
DROP POLICY IF EXISTS "Investors can view own installment payouts" ON public.installment_payouts;
CREATE POLICY "Investors can view own installment payouts"
  ON public.installment_payouts FOR SELECT
  TO authenticated
  USING (investor_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to installment payouts" ON public.installment_payouts;
CREATE POLICY "Admins have full access to installment payouts"
  ON public.installment_payouts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. TRIGGER AUTOMÁTICO: Creación de Perfil al Registrarse (CUALQUIER USUARIO)
-- ----------------------------------------------------------------------------
-- Este trigger se dispara automáticamente en auth.users en cada registro.
-- Funciona para PyMEs, Inversores y Admins, sin importar si confirman mail o no.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_tax_id text;
  v_legal_name text;
  v_first_name text;
BEGIN
  -- Extraer rol de metadata ('borrower' o 'investor')
  v_role := COALESCE((new.raw_user_meta_data->>'role')::user_role, 'investor'::user_role);
  
  -- Extraer tax_id si existe (puede ser NULL para inversores o el CUIT/DNI ingresado)
  v_tax_id := NULLIF(new.raw_user_meta_data->>'tax_id', '');

  -- Extraer Razón Social o Nombre
  v_legal_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'legal_name', ''),
    split_part(new.email, '@', 1)
  );

  v_first_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'representative_name', ''),
    split_part(v_legal_name, ' ', 1)
  );

  INSERT INTO public.profiles (
    id,
    role,
    tax_id,
    legal_name,
    first_name,
    last_name,
    email,
    phone,
    kyc_status,
    is_verified
  ) VALUES (
    new.id,
    v_role,
    v_tax_id,
    v_legal_name,
    v_first_name,
    '',
    new.email,
    '',
    'pending',
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    legal_name = EXCLUDED.legal_name,
    role = CASE WHEN public.profiles.role = 'admin' THEN 'admin'::user_role ELSE EXCLUDED.role END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. Procedimiento Almacenado Atómico: commit_investment_atomic
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION commit_investment_atomic(
  p_loan_id UUID,
  p_investor_id UUID,
  p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_loan loans%ROWTYPE;
  v_new_funded NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto a invertir debe ser mayor a cero';
  END IF;

  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Préstamo no encontrado';
  END IF;

  IF v_loan.status != 'funding' THEN
    RAISE EXCEPTION 'El préstamo no se encuentra en estado de fondeo';
  END IF;

  IF v_loan.borrower_id = p_investor_id THEN
    RAISE EXCEPTION 'No se permite autofinanciamiento: el solicitante no puede invertir en su propio préstamo';
  END IF;

  IF (v_loan.amount_funded + p_amount) > v_loan.amount_requested THEN
    RAISE EXCEPTION 'El monto excede el cupo disponible de la subasta';
  END IF;

  v_new_funded := v_loan.amount_funded + p_amount;

  UPDATE loans SET
    amount_funded = v_new_funded,
    status = CASE
      WHEN v_new_funded = amount_requested THEN 'funded'::loan_status
      ELSE 'funding'::loan_status
    END,
    updated_at = NOW()
  WHERE id = p_loan_id;

  INSERT INTO investments (
    loan_id,
    investor_id,
    amount,
    status
  ) VALUES (
    p_loan_id,
    p_investor_id,
    p_amount,
    'committed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount_funded', v_new_funded,
    'status', CASE WHEN v_new_funded = v_loan.amount_requested THEN 'funded' ELSE 'funding' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION commit_investment_atomic(UUID, UUID, NUMERIC) TO authenticated, service_role;

-- 6.1. Procedimiento Almacenado Atómico: process_investment_checkout_rpc
CREATE OR REPLACE FUNCTION public.process_investment_checkout_rpc(
  p_loan_id UUID,
  p_investor_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_card_last_four TEXT DEFAULT NULL,
  p_card_brand TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_new_funded NUMERIC(14, 2);
  v_new_status public.loan_status;
  v_investment_id UUID := gen_random_uuid();
  v_transaction_id UUID := gen_random_uuid();
  v_current_balance NUMERIC(14, 2) := 0.00;
  v_balance_after NUMERIC(14, 2) := 0.00;
  v_payment_metadata JSONB;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto a invertir debe ser mayor a cero';
  END IF;

  -- Bloqueo pesimista de fila en préstamo
  SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Préstamo no encontrado';
  END IF;

  IF v_loan.status != 'funding' THEN
    RAISE EXCEPTION 'El préstamo no se encuentra en estado de fondeo';
  END IF;

  IF v_loan.borrower_id = p_investor_id THEN
    RAISE EXCEPTION 'No se permite autofinanciamiento: el solicitante no puede invertir en su propio préstamo';
  END IF;

  IF (v_loan.amount_funded + p_amount) > v_loan.amount_requested THEN
    RAISE EXCEPTION 'El monto excede el cupo disponible de la subasta';
  END IF;

  -- Obtener último saldo en custodia
  SELECT COALESCE(balance_after, 0.00) INTO v_current_balance
  FROM public.custody_transactions
  WHERE profile_id = p_investor_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0.00;
  END IF;

  v_payment_metadata := jsonb_build_object(
    'payment_method', p_payment_method,
    'card_last_four', p_card_last_four,
    'card_brand', p_card_brand,
    'loan_id', p_loan_id
  );

  IF p_payment_method = 'custody_balance' THEN
    IF v_current_balance < p_amount THEN
      RAISE EXCEPTION 'Saldo en custodia insuficiente para realizar la inversión';
    END IF;
    v_balance_after := v_current_balance - p_amount;
  ELSE
    v_balance_after := v_current_balance;
  END IF;

  v_new_funded := v_loan.amount_funded + p_amount;
  v_new_status := CASE
    WHEN v_new_funded = v_loan.amount_requested THEN 'funded'::public.loan_status
    ELSE 'funding'::public.loan_status
  END;

  UPDATE public.loans SET
    amount_funded = v_new_funded,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_loan_id;

  INSERT INTO public.investments (
    id,
    loan_id,
    investor_id,
    amount,
    status,
    created_at
  ) VALUES (
    v_investment_id,
    p_loan_id,
    p_investor_id,
    p_amount,
    'committed',
    now()
  );

  INSERT INTO public.custody_transactions (
    id,
    profile_id,
    type,
    amount,
    balance_after,
    status,
    reference_id,
    payment_metadata,
    created_at
  ) VALUES (
    v_transaction_id,
    p_investor_id,
    'investment_hold',
    p_amount,
    v_balance_after,
    'completed',
    p_loan_id,
    v_payment_metadata,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount_funded', v_new_funded,
    'loan_status', v_new_status::text,
    'investment_id', v_investment_id,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_investment_checkout_rpc(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 6.2. Procedimiento Almacenado Atómico: process_installment_repayment_rpc
CREATE OR REPLACE FUNCTION public.process_installment_repayment_rpc(
  p_installment_id UUID,
  p_payer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_installment public.installments%ROWTYPE;
  v_total_invested NUMERIC(14, 2);
  v_inv RECORD;
  v_accumulated_principal NUMERIC(14, 2) := 0.00;
  v_accumulated_interest NUMERIC(14, 2) := 0.00;
  v_principal_share NUMERIC(14, 2);
  v_interest_share NUMERIC(14, 2);
  v_total_share NUMERIC(14, 2);
  v_inv_current_balance NUMERIC(14, 2);
  v_inv_balance_after NUMERIC(14, 2);
  v_inv_count INT := 0;
  v_current_idx INT := 0;
  v_payout_id UUID;
  v_all_repaid BOOLEAN := false;
BEGIN
  SELECT * INTO v_installment
  FROM public.installments
  WHERE id = p_installment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuota no encontrada';
  END IF;

  IF v_installment.status = 'paid' THEN
    RAISE EXCEPTION 'La cuota ya se encuentra pagada';
  END IF;

  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_total_invested, v_inv_count
  FROM public.investments
  WHERE loan_id = v_installment.loan_id
    AND status IN ('committed', 'settled');

  IF v_total_invested <= 0 THEN
    RAISE EXCEPTION 'No se registran inversiones válidas para distribuir esta cuota';
  END IF;

  UPDATE public.installments SET
    status = 'paid',
    paid_at = now()
  WHERE id = p_installment_id;

  FOR v_inv IN
    SELECT id, investor_id, amount
    FROM public.investments
    WHERE loan_id = v_installment.loan_id
      AND status IN ('committed', 'settled')
    ORDER BY created_at ASC
  LOOP
    v_current_idx := v_current_idx + 1;

    IF v_current_idx = v_inv_count THEN
      v_principal_share := v_installment.principal_amount - v_accumulated_principal;
      v_interest_share := v_installment.interest_investors - v_accumulated_interest;
    ELSE
      v_principal_share := round((v_installment.principal_amount * (v_inv.amount / v_total_invested)), 2);
      v_interest_share := round((v_installment.interest_investors * (v_inv.amount / v_total_invested)), 2);
      v_accumulated_principal := v_accumulated_principal + v_principal_share;
      v_accumulated_interest := v_accumulated_interest + v_interest_share;
    END IF;

    v_total_share := v_principal_share + v_interest_share;
    v_payout_id := gen_random_uuid();

    INSERT INTO public.installment_payouts (
      id,
      installment_id,
      investment_id,
      investor_id,
      principal_share,
      interest_share,
      total_share,
      status,
      paid_at
    ) VALUES (
      v_payout_id,
      p_installment_id,
      v_inv.id,
      v_inv.investor_id,
      v_principal_share,
      v_interest_share,
      v_total_share,
      'credited',
      now()
    );

    SELECT COALESCE(balance_after, 0.00) INTO v_inv_current_balance
    FROM public.custody_transactions
    WHERE profile_id = v_inv.investor_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_inv_current_balance IS NULL THEN
      v_inv_current_balance := 0.00;
    END IF;

    v_inv_balance_after := v_inv_current_balance + v_total_share;

    INSERT INTO public.custody_transactions (
      profile_id,
      type,
      amount,
      balance_after,
      status,
      reference_id,
      payment_metadata,
      created_at
    ) VALUES (
      v_inv.investor_id,
      'installment_payout',
      v_total_share,
      v_inv_balance_after,
      'completed',
      p_installment_id,
      jsonb_build_object(
        'installment_id', p_installment_id,
        'installment_number', v_installment.installment_number,
        'principal_share', v_principal_share,
        'interest_share', v_interest_share
      ),
      now()
    );

    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      action_url,
      created_at
    ) VALUES (
      v_inv.investor_id,
      'Cuota de inversión acreditada',
      'Se acreditaron $' || to_char(v_total_share, 'FM999,999,990.00') || ' en tu cuenta por la cuota #' || v_installment.installment_number || '.',
      'success',
      '/dashboard/inversor',
      now()
    );
  END LOOP;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.installments
    WHERE loan_id = v_installment.loan_id
      AND status != 'paid'
  ) INTO v_all_repaid;

  IF v_all_repaid THEN
    UPDATE public.loans SET
      status = 'repaid',
      updated_at = now()
    WHERE id = v_installment.loan_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'installment_id', p_installment_id,
    'status', 'paid',
    'all_repaid', v_all_repaid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_installment_repayment_rpc(UUID, UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Bucket Privado de Storage para Balances Contables y Políticas RLS
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-documents',
  'loan-documents',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Habilitar Row Level Security en storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 7.1. Los prestatarios solo pueden ver sus propios documentos
DROP POLICY IF EXISTS "Borrowers can read own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can read own loan documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 7.2. Los prestatarios solo pueden subir archivos dentro de su propia carpeta (auth.uid())
DROP POLICY IF EXISTS "Borrowers can upload own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can upload own loan documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 7.3. Los prestatarios pueden actualizar sus propios documentos
DROP POLICY IF EXISTS "Borrowers can update own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can update own loan documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  )
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 7.4. Los prestatarios pueden borrar sus propios documentos
DROP POLICY IF EXISTS "Borrowers can delete own loan documents" ON storage.objects;
CREATE POLICY "Borrowers can delete own loan documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- 7.5. Los Administradores tienen acceso total para auditoría y visualización
DROP POLICY IF EXISTS "Admins have full access to loan documents" ON storage.objects;
CREATE POLICY "Admins have full access to loan documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'loan-documents'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 8. USUARIO ADMINISTRADOR SEMILLA (Listo para usar de inmediato)
-- ----------------------------------------------------------------------------
-- Credenciales:
-- Email: admin@lencord.ar
-- Contraseña: Admin1234!

DO $$
DECLARE
  v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- Insertar o actualizar en auth.users con contraseña encriptada
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  ) VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@lencord.ar',
    crypt('Admin1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"admin","legal_name":"Administrador General Lencord","tax_id":"20300000001"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt('Admin1234!', gen_salt('bf')),
    email_confirmed_at = now();

  -- Insertar o actualizar en public.profiles con rol 'admin'
  INSERT INTO public.profiles (
    id,
    role,
    tax_id,
    legal_name,
    first_name,
    last_name,
    email,
    phone,
    kyc_status,
    is_verified,
    notification_preferences
  ) VALUES (
    v_admin_id,
    'admin',
    '20300000001',
    'Administrador General Lencord',
    'Administrador',
    'General',
    'admin@lencord.ar',
    '+541155555555',
    'approved',
    true,
    '{"email": true, "sms": true, "whatsapp": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    email = 'admin@lencord.ar',
    is_verified = true,
    kyc_status = 'approved';

END $$;
