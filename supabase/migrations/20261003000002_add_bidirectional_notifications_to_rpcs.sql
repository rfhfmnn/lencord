-- Migration: 20261003000002_add_bidirectional_notifications_to_rpcs.sql
-- Description: Inserts automated in-app notifications for PyME borrower and investors inside SECURITY DEFINER RPCs (bypassing RLS).
-- Issue: #82 / Tarea 1 (_docs/nuevas_tareas.md)

-- 1. Actualizar process_investment_checkout_rpc con notificaciones para PyME e Inversores
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

  -- 3. Registrar transacción en libro contable
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

  -- 4. Inserción atómica de Notificaciones (SECURITY DEFINER evita bloqueo por RLS)
  -- 4.1. Notificación para la PyME (prestataria) informando el nuevo aporte
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    action_url,
    created_at
  ) VALUES (
    v_loan.borrower_id,
    'Nuevo aporte de inversión recibido',
    'Se ha registrado una inversión por $' || to_char(p_amount, 'FM999,999,990.00') || ' (' || to_char(round((v_new_funded / v_loan.amount_requested) * 100, 1), 'FM990.0') || '% financiado).',
    'info',
    '/dashboard/pyme',
    now()
  );

  -- 4.2. Notificación para el Inversor que realizó el aporte
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    action_url,
    created_at
  ) VALUES (
    p_investor_id,
    'Inversión confirmada',
    'Has comprometido $' || to_char(p_amount, 'FM999,999,990.00') || ' en la subasta del préstamo.',
    'success',
    '/dashboard/inversor',
    now()
  );

  -- 4.3. Si la subasta alcanzó el 100%, notificar a PyME e inversores participantes
  IF v_new_status = 'funded' THEN
    -- PyME: Pagaré listo para firma
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      action_url,
      created_at
    ) VALUES (
      v_loan.borrower_id,
      '¡Subasta 100% financiada! Pagaré listo para firma',
      '¡Felicitaciones! Tu solicitud fue 100% financiada. Ya podés ingresar a firmar el pagaré digital para la liberación y desembolso de los fondos.',
      'success',
      '/dashboard/pyme',
      now()
    );

    -- Inversores participantes (deduplicados)
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      action_url,
      created_at
    )
    SELECT DISTINCT
      investor_id,
      'Subasta finalizada con éxito',
      'La subasta en la que participaste se completó al 100%. La PyME ha sido notificada para firmar el pagaré digital.',
      'success',
      '/dashboard/inversor',
      now()
    FROM public.investments
    WHERE loan_id = p_loan_id AND status IN ('committed', 'settled');
  END IF;

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


-- 2. Actualizar process_installment_repayment_rpc con notificaciones para PyME e Inversores
CREATE OR REPLACE FUNCTION public.process_installment_repayment_rpc(
  p_installment_id UUID,
  p_payer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_installment public.installments%ROWTYPE;
  v_loan public.loans%ROWTYPE;
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
  v_borrower_id UUID;
  v_total_paid_installment NUMERIC(14, 2);
BEGIN
  -- Bloqueo pesimista de fila en cuota
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

  -- Obtener préstamo para conocer el borrower_id
  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = v_installment.loan_id;

  v_borrower_id := COALESCE(v_loan.borrower_id, p_payer_id);
  v_total_paid_installment := v_installment.principal_amount + v_installment.interest_borrower;

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

  -- Notificación para la PyME (prestataria) confirmando el pago de la cuota
  IF v_borrower_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      action_url,
      created_at
    ) VALUES (
      v_borrower_id,
      'Pago procesado con éxito',
      'Se procesó correctamente el pago de la cuota #' || v_installment.installment_number || ' por $' || to_char(v_total_paid_installment, 'FM999,999,990.00') || '.',
      'success',
      '/dashboard/pyme',
      now()
    );
  END IF;

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

    -- Notificación para la PyME por cancelación total del crédito
    IF v_borrower_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        created_at
      ) VALUES (
        v_borrower_id,
        '¡Préstamo cancelado en su totalidad!',
        'Has completado el pago de todas las cuotas de tu financiamiento. ¡Felicitaciones por mantener un historial crediticio ejemplar!',
        'success',
        '/dashboard/pyme',
        now()
      );
    END IF;
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


-- 3. Asegurar políticas RLS para lectura y actualización de notificaciones
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Habilitar publicación Realtime en la tabla notifications si aún no fue agregada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. Trigger automático al aprobar préstamo (status -> 'funding')
CREATE OR REPLACE FUNCTION public.handle_loan_approval_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'funding' AND (OLD.status IS DISTINCT FROM 'funding') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.borrower_id
        AND title = 'Préstamo aprobado'
        AND created_at >= (now() - interval '5 minutes')
    ) THEN
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        created_at
      ) VALUES (
        NEW.borrower_id,
        'Préstamo aprobado',
        'Tu solicitud de crédito ha sido aprobada y publicada en la subasta del marketplace.',
        'success',
        '/dashboard/pyme',
        now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_loan_approval ON public.loans;
CREATE TRIGGER trg_notify_loan_approval
  AFTER UPDATE OF status ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_loan_approval_notification();

