-- ============================================================================
-- Migration: 20261019000001_harden_loans_update_rls.sql
-- Description: Blindaje de seguridad en políticas de actualización para la tabla loans (SEC-02 / Issue #87).
--              1. Revoca la política excesivamente permisiva sobre UPDATE en loans.
--              2. Restringe el UPDATE directo por prestatarios autenticados únicamente a
--                 columnas no financieras operativas (funding_deadline, partial_acceptance_flag,
--                 partial_acceptance_deadline) y bajo estados de subasta permitidos ('draft', 'in_review', 'funding').
--              3. Introduce la función RPC segura 'accept_partial_funding_secure' para ejecutar
--                 la transición atómica a estado 'funded' con validación de quórum (>= 75%).
-- ============================================================================

-- 1. Eliminar la política anterior permisiva
DROP POLICY IF EXISTS "Borrowers can update own loans" ON public.loans;

-- 2. Crear política blindada para prestatarios
-- Solo permite actualizar filas propias si el préstamo está en etapa previa o durante subasta.
-- Los parámetros financieros (tasas, montos, y estados finales) están protegidos.
CREATE POLICY "Borrowers can update own editable loans"
  ON public.loans FOR UPDATE
  TO authenticated
  USING (
    borrower_id = auth.uid()
    AND status IN ('draft', 'in_review', 'funding')
  )
  WITH CHECK (
    borrower_id = auth.uid()
    -- Garantiza que el usuario no pueda alterar arbitrariamente el status hacia estados privilegiados
    AND (
      status = (SELECT l.status FROM public.loans l WHERE l.id = loans.id)
      OR (status IN ('draft', 'in_review', 'funding'))
    )
    -- Garantiza que las tasas y montos solicitados/fondeados no sean manipulados
    AND borrower_rate = (SELECT l.borrower_rate FROM public.loans l WHERE l.id = loans.id)
    AND investor_rate = (SELECT l.investor_rate FROM public.loans l WHERE l.id = loans.id)
    AND amount_requested = (SELECT l.amount_requested FROM public.loans l WHERE l.id = loans.id)
    AND amount_funded = (SELECT l.amount_funded FROM public.loans l WHERE l.id = loans.id)
  );

-- 3. Función RPC segura para Aceptación de Financiamiento Parcial (75% threshold)
-- Ejecuta con SECURITY DEFINER para permitir la transición oficial a 'funded'
-- validando que auth.uid() sea el dueño o admin y que se cumpla el quórum mínimo.
CREATE OR REPLACE FUNCTION public.accept_partial_funding_secure(p_loan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_loan RECORD;
  v_funding_ratio NUMERIC;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Se requiere sesión activa' USING ERRCODE = '42501';
  END IF;

  -- Verificar si el llamador es admin
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_caller_id;
  IF v_is_admin IS NULL THEN
    v_is_admin := false;
  END IF;

  -- Bloquear fila del préstamo para prevenir condiciones de carrera
  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found' USING ERRCODE = 'P0002';
  END IF;

  -- Validar autorización
  IF v_loan.borrower_id <> v_caller_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: No tienes permisos para modificar este préstamo' USING ERRCODE = '42501';
  END IF;

  -- Validar estado actual
  IF v_loan.status NOT IN ('funding', 'in_review') THEN
    RAISE EXCEPTION 'Estado no válido para aceptación parcial (debe estar en subasta o revisión)' USING ERRCODE = 'P0001';
  END IF;

  -- Validar regla del 75%
  IF v_loan.amount_requested <= 0 THEN
    RAISE EXCEPTION 'Monto solicitado inválido' USING ERRCODE = 'P0001';
  END IF;

  v_funding_ratio := (v_loan.amount_funded / v_loan.amount_requested);
  IF v_funding_ratio < 0.75 THEN
    RAISE EXCEPTION 'No se alcanzó el umbral del 75%% (recaudado: % %%)', ROUND(v_funding_ratio * 100, 2)
      USING ERRCODE = 'P0001';
  END IF;

  -- Realizar la actualización atómica
  UPDATE public.loans
  SET
    status = 'funded',
    partial_acceptance_flag = true
  WHERE id = p_loan_id;

  RETURN jsonb_build_object(
    'success', true,
    'loan_id', p_loan_id,
    'status', 'funded',
    'partial_acceptance_flag', true,
    'amount_funded', v_loan.amount_funded
  );
END;
$$;

-- Otorgar ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.accept_partial_funding_secure(UUID) TO authenticated;
