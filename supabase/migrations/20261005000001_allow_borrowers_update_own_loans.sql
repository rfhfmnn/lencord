-- ============================================================================
-- Migration: 20261005000001_allow_borrowers_update_own_loans.sql
-- Description: Permitir a los prestatarios (PyMEs) modificar sus propios préstamos
--              (por ejemplo, actualizar la fecha límite de subasta funding_deadline,
--              o activar la aceptación parcial partial_acceptance_flag).
-- ============================================================================

-- 1. Agregar columnas para control de aceptación parcial si no existen
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS partial_acceptance_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS partial_acceptance_deadline TIMESTAMP WITH TIME ZONE NULL;

-- 2. Permitir a los prestatarios actualizar sus propios préstamos
DROP POLICY IF EXISTS "Borrowers can update own loans" ON public.loans;
CREATE POLICY "Borrowers can update own loans"
  ON public.loans FOR UPDATE
  TO authenticated
  USING (auth.uid() = borrower_id)
  WITH CHECK (auth.uid() = borrower_id);

