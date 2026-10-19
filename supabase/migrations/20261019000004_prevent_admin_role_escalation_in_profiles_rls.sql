-- ============================================================================
-- Migration: 20261019000004_prevent_admin_role_escalation_in_profiles_rls.sql
-- Description: Bloqueo de elevación de privilegios a rol 'admin' en RLS de profiles (SEC-07 / Issue #92).
--              1. Reemplaza la política de inserción "Users can insert own profile"
--                 agregando un guard WITH CHECK que prohíbe autoasignar role = 'admin'.
--                 Únicamente se permite role IN ('investor', 'sme') a usuarios regulares.
--              2. Reemplaza la política de actualización "Users can update own profile"
--                 impidiendo que usuarios no administradores modifiquen su propia columna role.
--              3. Preserva el acceso total a administradores mediante "Admins have full access to profiles".
-- ============================================================================

-- 1. Asegurar restricción en INSERT para usuarios comunes
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Usuarios comunes no pueden auto-declararse 'admin'
      role IN ('investor'::user_role, 'sme'::user_role)
      OR is_admin()
    )
  );

-- 2. Asegurar restricción en UPDATE para usuarios comunes
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- El rol modificado debe ser igual al rol que ya tenía o el llamador debe ser admin
      role = (SELECT p.role FROM public.profiles p WHERE p.id = profiles.id)
      OR is_admin()
    )
  );

-- 3. Comentario de auditoría de seguridad
COMMENT ON POLICY "Users can insert own profile" ON public.profiles IS
  'Previene escalada de privilegios a rol admin en autorregistro (Issue #92).';
COMMENT ON POLICY "Users can update own profile" ON public.profiles IS
  'Previene modificación no autorizada de la columna role por usuarios regulares (Issue #92).';
