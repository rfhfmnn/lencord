-- ============================================================================
-- Migration: 20261004000001_allow_borrowers_view_loan_investments_and_creditors.sql
-- Description: Allow borrowers to view investments and investor creditor profiles
--              for their funded loans to render the promissory note annex (Anexo I).
-- ============================================================================

-- 1. Permitir a los prestatarios ver las inversiones recibidas en sus préstamos
DROP POLICY IF EXISTS "Borrowers can view investments for their loans" ON public.investments;
CREATE POLICY "Borrowers can view investments for their loans"
  ON public.investments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.loans
      WHERE loans.id = investments.loan_id
        AND loans.borrower_id = auth.uid()
    )
  );

-- 2. Permitir a los prestatarios ver los datos identificatorios de sus acreedores (razón social y CUIT)
DROP POLICY IF EXISTS "Borrowers can view creditor profiles for their loans" ON public.profiles;
CREATE POLICY "Borrowers can view creditor profiles for their loans"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.investments
      JOIN public.loans ON loans.id = investments.loan_id
      WHERE investments.investor_id = profiles.id
        AND loans.borrower_id = auth.uid()
    )
  );
