-- ============================================================================
-- Migration: 20260925000002_create_commit_investment_atomic_rpc.sql
-- Description: Atomic PostgreSQL stored procedure with pessimistic row locking
--              for race-condition-free investment commitments in P2P auctions.
-- Specification: _docs/plan.md Section 8.3
-- ============================================================================

CREATE OR REPLACE FUNCTION commit_investment_atomic(
  p_loan_id UUID,
  p_investor_id UUID,
  p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_loan loans%ROWTYPE;
  v_new_funded NUMERIC;
BEGIN
  -- Validate investment amount is strictly positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto a invertir debe ser mayor a cero';
  END IF;

  -- Pessimistic row locking: locks the target loan row for the duration of the transaction
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Préstamo no encontrado';
  END IF;

  -- Ensure loan is open for funding
  IF v_loan.status != 'funding' THEN
    RAISE EXCEPTION 'El préstamo no se encuentra en estado de fondeo';
  END IF;

  -- Verify remaining capacity and prevent overfunding
  IF (v_loan.amount_funded + p_amount) > v_loan.amount_requested THEN
    RAISE EXCEPTION 'El monto excede el cupo disponible de la subasta';
  END IF;

  v_new_funded := v_loan.amount_funded + p_amount;

  -- Atomic update of loan funded amount and status
  UPDATE loans SET
    amount_funded = v_new_funded,
    status = CASE
      WHEN v_new_funded = amount_requested THEN 'funded'::loan_status
      ELSE 'funding'::loan_status
    END
  WHERE id = p_loan_id;

  -- Insert investment record within the same atomic transaction
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
    'amount_funded', v_new_funded
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION commit_investment_atomic(UUID, UUID, NUMERIC) TO authenticated, service_role;
