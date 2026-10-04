-- ============================================================================
-- Migration: 20261004000002_add_company_type_and_start_date_to_profiles.sql
-- Description: Add company_type and start_date columns to profiles table for SMEs
-- Specification: _docs/nuevas_tareas.md Tarea 6
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS start_date DATE NULL;

COMMENT ON COLUMN public.profiles.company_type IS
  'Corporate legal structure of the SME (e.g. SRL, SA, SAS, Responsable Inscripto, Monotributo)';

COMMENT ON COLUMN public.profiles.start_date IS
  'Official date of commencement of business operations for the SME';
