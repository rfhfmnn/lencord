-- ============================================================================
-- Migration: 20261019000002_protect_borrower_privacy_and_create_public_view.sql
-- Description: Protección de datos personales y bancarios de prestatarios (SEC-04 / Issue #89)
--              conforme a la Ley Nacional 25.326 y estándares de seguridad financiera.
--              1. Revoca la política excesivamente permisiva "Public can view borrower company profiles"
--                 que exponía tax_id (CUIT), phone y bank_cbu_cvu a consultas masivas anónimas.
--              2. Restringe el acceso SELECT en public.profiles a:
--                 - El propio usuario autenticado (auth.uid() = id).
--                 - Administradores (is_admin()).
--                 - Prestatarios sobre sus acreedores específicos para Anexo I de pagarés.
--              3. Crea la vista segura public.borrower_public_profiles exponiendo únicamente
--                 columnas no sensibles (id, legal_name, company_type, created_at) con SECURITY INVOKER
--                 o función controlada.
-- ============================================================================

-- 1. Revocar la política que exponía la tabla completa de profiles
DROP POLICY IF EXISTS "Public can view borrower company profiles" ON public.profiles;

-- 2. Asegurar que las políticas legítimas de profiles continúen activas:
-- A. Admins full access
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- B. Usuarios acceden a su propio perfil completo
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- C. Prestatarios ven datos de sus acreedores (razón social / nombre) en el pagaré
DROP POLICY IF EXISTS "Borrowers can view creditor profiles for their loans" ON public.profiles;
CREATE POLICY "Borrowers can view creditor profiles for their loans"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.investments
      JOIN public.loans ON loans.id = investments.loan_id
      WHERE investments.investor_id = profiles.id
        AND loans.borrower_id = auth.uid()
    )
  );

-- 3. Crear vista pública despersonalizada para Marketplace y presentación corporativa
-- Expone exclusivamente metadatos institucionales públicos.
CREATE OR REPLACE VIEW public.borrower_public_profiles AS
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

-- Otorgar permiso de lectura pública en la vista despersonalizada
GRANT SELECT ON public.borrower_public_profiles TO anon, authenticated;

-- Comentario explicativo de cumplimiento normativo
COMMENT ON VIEW public.borrower_public_profiles IS
  'Vista pública segura despersonalizada de PyMEs prestatarias (Ley 25.326). Oculta CUIT, CBU/CVU y teléfono.';
