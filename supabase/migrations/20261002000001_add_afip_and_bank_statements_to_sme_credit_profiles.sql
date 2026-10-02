-- ============================================================================
-- Migration: 20261002000001_add_afip_and_bank_statements_to_sme_credit_profiles.sql
-- Description: Add afip_url and bank_statements_url columns to sme_credit_profiles
--              to persist all 4 supporting documents uploaded during loan application.
-- Issue: #79
-- ============================================================================

ALTER TABLE public.sme_credit_profiles
  ADD COLUMN IF NOT EXISTS afip_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS bank_statements_url TEXT NULL;

COMMENT ON COLUMN public.sme_credit_profiles.afip_url IS
  'URL/path of the AFIP registration certificate (constancia de inscripción) uploaded by the SME';

COMMENT ON COLUMN public.sme_credit_profiles.bank_statements_url IS
  'URL/path of the bank statements (extractos bancarios) uploaded by the SME';
