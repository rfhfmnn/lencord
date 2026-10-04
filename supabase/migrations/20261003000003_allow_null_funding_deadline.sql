-- ============================================================================
-- Migration: 20261003000003_allow_null_funding_deadline.sql
-- Description: Allow funding_deadline to be NULL for auctions without a fixed deadline.
-- ============================================================================

ALTER TABLE public.loans
  ALTER COLUMN funding_deadline DROP NOT NULL;

COMMENT ON COLUMN public.loans.funding_deadline IS
  'Auction funding deadline timestamp (ISO), or NULL if open auction without fixed deadline';
