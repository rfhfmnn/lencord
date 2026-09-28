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
  tax_id VARCHAR(11) NOT NULL,
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
  CONSTRAINT check_tax_id_format CHECK (tax_id ~ '^[0-9]{7,11}$')
);

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
  signature_hash TEXT NULL,
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
  
  -- Extraer tax_id o generar uno válido de 11 dígitos
  v_tax_id := COALESCE(
    NULLIF(new.raw_user_meta_data->>'tax_id', ''),
    LPAD(CAST(FLOOR(RANDOM() * 89999999999 + 10000000000) AS TEXT), 11, '0')
  );

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

-- ----------------------------------------------------------------------------
-- 7. Bucket Privado de Storage para Balances Contables
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
