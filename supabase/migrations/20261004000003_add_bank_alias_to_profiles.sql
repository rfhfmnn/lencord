-- ============================================================================
-- Migration: 20261004000003_add_bank_alias_to_profiles.sql
-- Description: Add bank_alias column to profiles table for bank account aliases
-- ============================================================================

-- 1. Agregar columna bank_alias a la tabla profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_alias VARCHAR(100) NULL;

COMMENT ON COLUMN public.profiles.bank_alias IS
  'Optional bank account alias (Alias CBU/CVU) for payments and withdrawals';
