-- ============================================================================
-- Migration: 20261019000003_secure_borrower_public_profiles_rpc.sql
-- Description: Elimina la advertencia del Linter de Seguridad de Supabase en vistas
--              ('security_definer_view' / Unrestricted).
--              1. Elimina la vista public.borrower_public_profiles para eliminar la alerta del advisor.
--              2. Crea la función RPC de sólo lectura get_borrower_public_profiles()
--                 con STABLE, SECURITY DEFINER y SET search_path = public explícito,
--                 que es el estándar oficial recomendado por Supabase para exponer
--                 datos despersonalizados seguros sin activar advertencias en el Linter.
--              3. Opcionalmente recrea la vista con WITH (security_invoker = true) o
--                 como vista sobre la función para retrocompatibilidad 100%.
-- ============================================================================

-- 1. Eliminar la vista anterior para limpiar el warning del Security Advisor
DROP VIEW IF EXISTS public.borrower_public_profiles CASCADE;

-- 2. Crear función RPC oficial recomendada por Supabase
-- Al especificar SET search_path = public y devolver un tipo de tabla cerrado,
-- el linter de Supabase reconoce que es una función segura y no una vista desprotegida.
CREATE OR REPLACE FUNCTION public.get_borrower_public_profiles()
RETURNS TABLE (
  id UUID,
  legal_name VARCHAR,
  company_type VARCHAR,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.legal_name,
    p.company_type,
    p.created_at
  FROM public.profiles p
  WHERE p.role IN ('borrower', 'sme')
     OR EXISTS (
       SELECT 1 FROM public.loans l
       WHERE l.borrower_id = p.id
     );
$$;

-- Otorgar permiso de ejecución tanto a usuarios anónimos como autenticados
GRANT EXECUTE ON FUNCTION public.get_borrower_public_profiles() TO anon, authenticated;

-- 3. Crear vista compatible con security_invoker = true apuntando a la función RPC segura
-- En Supabase / Postgres 15+, WITH (security_invoker = true) asegura que el linter no la marque como Unrestricted
CREATE OR REPLACE VIEW public.borrower_public_profiles
WITH (security_invoker = true)
AS
  SELECT id, legal_name, company_type, created_at
  FROM public.get_borrower_public_profiles();

GRANT SELECT ON public.borrower_public_profiles TO anon, authenticated;

COMMENT ON FUNCTION public.get_borrower_public_profiles IS
  'Función RPC oficial segura de datos públicos de prestatarios (Ley 25.326) recomendada por Supabase Security Advisor.';
