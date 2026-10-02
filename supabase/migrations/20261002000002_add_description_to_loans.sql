-- ============================================================================
-- Migration: 20261002000002_add_description_to_loans.sql
-- Description: Add optional description column to loans table to persist project details.
-- Issue: #78
-- ============================================================================

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS description TEXT NULL;

COMMENT ON COLUMN public.loans.description IS
  'Project details and purpose of the loan entered by the borrower in Step 2';
