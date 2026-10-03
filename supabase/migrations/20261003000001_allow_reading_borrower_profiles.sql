-- ============================================================================
-- Migration: 20261003000001_allow_reading_borrower_profiles.sql
-- Description: Allow authenticated users to view legal_name and public profile
--              data of borrower/SME companies associated with loans.
-- ============================================================================

DROP POLICY IF EXISTS "Public can view borrower company profiles" ON public.profiles;
CREATE POLICY "Public can view borrower company profiles"
  ON public.profiles FOR SELECT
  USING (
    role IN ('borrower', 'sme')
    OR EXISTS (
      SELECT 1 FROM public.loans
      WHERE loans.borrower_id = profiles.id
    )
  );
