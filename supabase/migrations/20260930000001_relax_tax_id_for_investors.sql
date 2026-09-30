-- ============================================================================
-- Migration: 20260930000001_relax_tax_id_for_investors.sql
-- Description: Relaxes NOT NULL constraint on profiles.tax_id for new investors
--              and updates check_tax_id_format to accept NULL, 7-8 digits (DNI),
--              and 11 digits (CUIT).
-- Issue: #53
-- ============================================================================

-- 1. Relax NOT NULL constraint on tax_id
ALTER TABLE profiles ALTER COLUMN tax_id DROP NOT NULL;

-- 2. Drop existing 11-digit only check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_tax_id_format;

-- 3. Add relaxed format check constraint: NULL, 7-8 digit DNI, or 11 digit CUIT
ALTER TABLE profiles ADD CONSTRAINT check_tax_id_format CHECK (
  tax_id IS NULL OR tax_id ~ '^[0-9]{7,8}$' OR tax_id ~ '^[0-9]{11}$'
);
