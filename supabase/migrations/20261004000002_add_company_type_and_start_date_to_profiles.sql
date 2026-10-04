-- ============================================================================
-- Migration: 20261004000002_add_company_type_and_start_date_to_profiles.sql
-- Description: Add company_type and start_date columns to profiles table for SMEs
--              and update handle_new_user() trigger to persist them from auth metadata
-- Specification: _docs/nuevas_tareas.md Tarea 6
-- ============================================================================

-- 1. Agregar columnas a la tabla profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS start_date DATE NULL;

COMMENT ON COLUMN public.profiles.company_type IS
  'Corporate legal structure of the SME (e.g. SRL, SA, SAS, Responsable Inscripto, Monotributo)';

COMMENT ON COLUMN public.profiles.start_date IS
  'Official date of commencement of business operations for the SME';

-- 2. Actualizar función trigger handle_new_user() para persistir metadatos societarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
  v_tax_id text;
  v_legal_name text;
  v_first_name text;
  v_last_name text;
  v_company_type text;
  v_start_date date;
BEGIN
  -- Extraer rol de metadata ('borrower' o 'investor')
  v_role := COALESCE((new.raw_user_meta_data->>'role')::user_role, 'investor'::user_role);
  
  -- Extraer tax_id si existe
  v_tax_id := NULLIF(new.raw_user_meta_data->>'tax_id', '');

  -- Extraer Razón Social o Nombre
  v_legal_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'legal_name', ''),
    split_part(new.email, '@', 1)
  );

  v_first_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'first_name', ''),
    NULLIF(new.raw_user_meta_data->>'representative_name', ''),
    split_part(v_legal_name, ' ', 1)
  );

  v_last_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'last_name', ''),
    ''
  );

  v_company_type := NULLIF(new.raw_user_meta_data->>'company_type', '');

  BEGIN
    v_start_date := NULLIF(new.raw_user_meta_data->>'start_date', '')::date;
  EXCEPTION WHEN OTHERS THEN
    v_start_date := NULL;
  END;

  INSERT INTO public.profiles (
    id,
    role,
    tax_id,
    legal_name,
    first_name,
    last_name,
    company_type,
    start_date,
    email,
    phone,
    kyc_status,
    is_verified
  ) VALUES (
    new.id,
    v_role,
    v_tax_id,
    v_legal_name,
    v_first_name,
    v_last_name,
    v_company_type,
    v_start_date,
    new.email,
    '',
    'pending',
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    legal_name = EXCLUDED.legal_name,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    company_type = COALESCE(EXCLUDED.company_type, public.profiles.company_type),
    start_date = COALESCE(EXCLUDED.start_date, public.profiles.start_date),
    role = CASE WHEN public.profiles.role = 'admin' THEN 'admin'::user_role ELSE EXCLUDED.role END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
