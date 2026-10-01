-- ============================================================================
-- Migration: 20261001000001_create_ledger_and_checkout_rpcs.sql
-- Description: Implement custody_transactions ledger, installment_payouts,
--              legal_contracts audit fields, and atomic RPC functions for
--              investment checkout and installment repayment.
-- Issue: #65
-- ============================================================================

-- 1. Tabla custody_transactions (Libro Contable Inmutable / Ledger)
CREATE TABLE IF NOT EXISTS public.custody_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'card_deposit', 'investment_hold', 'installment_payout', 'withdrawal', 'refund'
  amount NUMERIC(14, 2) NOT NULL,
  balance_after NUMERIC(14, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  reference_id UUID NULL,
  payment_metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_transaction_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_custody_transactions_profile_id ON public.custody_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_custody_transactions_created_at ON public.custody_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custody_transactions_reference_id ON public.custody_transactions(reference_id);

-- 2. Tabla installment_payouts (Distribución de Cuotas por Inversor)
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

CREATE INDEX IF NOT EXISTS idx_installment_payouts_investor_id ON public.installment_payouts(investor_id);
CREATE INDEX IF NOT EXISTS idx_installment_payouts_installment_id ON public.installment_payouts(installment_id);
CREATE INDEX IF NOT EXISTS idx_installment_payouts_investment_id ON public.installment_payouts(investment_id);

-- 3. Campos de Auditoría en legal_contracts
ALTER TABLE public.legal_contracts
  ADD COLUMN IF NOT EXISTS signer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signer_role VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS signer_user_agent TEXT NULL;

-- 4. Habilitar RLS en nuevas tablas
ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_payouts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para custody_transactions
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

-- Políticas RLS para installment_payouts
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

-- 5. Procedimiento Almacenado Atómico: process_investment_checkout_rpc
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

  -- Preparar metadata y calcular saldo según medio de pago
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
    -- Simulación pasarela BaaS (tarjeta): no reduce el saldo de custodia previo
    v_balance_after := v_current_balance;
  END IF;

  v_new_funded := v_loan.amount_funded + p_amount;
  v_new_status := CASE
    WHEN v_new_funded = v_loan.amount_requested THEN 'funded'::public.loan_status
    ELSE 'funding'::public.loan_status
  END;

  -- 1. Actualizar préstamo
  UPDATE public.loans SET
    amount_funded = v_new_funded,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_loan_id;

  -- 2. Insertar inversión
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

  -- 3. Registrar en libro contable custody_transactions
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

-- 6. Procedimiento Almacenado Atómico: process_installment_repayment_rpc
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
  -- Bloqueo pesimista de fila en cuota
  SELECT * INTO v_installment
  FROM public.installments
  WHERE id = p_installment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuota no encontrada';
  END IF;

  -- Idempotencia: rechazar si ya está pagada
  IF v_installment.status = 'paid' THEN
    RAISE EXCEPTION 'La cuota ya se encuentra pagada';
  END IF;

  -- Calcular total de inversiones activas
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_total_invested, v_inv_count
  FROM public.investments
  WHERE loan_id = v_installment.loan_id
    AND status IN ('committed', 'settled');

  IF v_total_invested <= 0 THEN
    RAISE EXCEPTION 'No se registran inversiones válidas para distribuir esta cuota';
  END IF;

  -- Marcar cuota como pagada
  UPDATE public.installments SET
    status = 'paid',
    paid_at = now()
  WHERE id = p_installment_id;

  -- Distribuir proporcionalmente entre inversores
  FOR v_inv IN
    SELECT id, investor_id, amount
    FROM public.investments
    WHERE loan_id = v_installment.loan_id
      AND status IN ('committed', 'settled')
    ORDER BY created_at ASC
  LOOP
    v_current_idx := v_current_idx + 1;

    -- Manejo exacto de redondeo en centavos para la última inversión
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

    -- Registrar pago de cuota a inversor
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

    -- Obtener último saldo del inversor
    SELECT COALESCE(balance_after, 0.00) INTO v_inv_current_balance
    FROM public.custody_transactions
    WHERE profile_id = v_inv.investor_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_inv_current_balance IS NULL THEN
      v_inv_current_balance := 0.00;
    END IF;

    v_inv_balance_after := v_inv_current_balance + v_total_share;

    -- Acreditar en saldo en custodia
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

    -- Notificar al inversor
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

  -- Verificar si todas las cuotas del crédito fueron pagadas
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
