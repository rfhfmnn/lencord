/**
 * Initial Administrator Provisioning Script
 * Issue #31: Securely promotes a registered user to the 'admin' role.
 *
 * Usage:
 *   npm run seed:admin -- <email>
 *   node scripts/seed-admin.ts <email>
 *   (or interactive prompt if no email is provided)
 */

import readline from 'node:readline';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Enforce backend/CLI execution only - block browser/client invocation
export function assertServerEnvironment(): void {
  if (typeof window !== 'undefined' && !process.env.VITEST) {
    throw new Error(
      'Security Violation: scripts/seed-admin.ts cannot be executed in client-side environments.'
    );
  }
}

assertServerEnvironment();

// Attempt to load environment variables from .env.local or .env if in Node environment
if (typeof process !== 'undefined' && typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile('.env.local');
  } catch {
    try {
      (process as any).loadEnvFile('.env');
    } catch {
      // Ignore if files do not exist
    }
  }
}

export interface ProvisionAdminOptions {
  supabaseAdminClient?: SupabaseClient;
  supabaseUrl?: string;
  serviceRoleKey?: string;
}

export interface ProvisionAdminResult {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

/**
 * Validates and promotes a user with the given email to the 'admin' role in auth and profiles.
 */
export async function provisionAdmin(
  emailInput: string,
  options?: ProvisionAdminOptions
): Promise<ProvisionAdminResult> {
  const cleanEmail = emailInput?.trim().toLowerCase();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const errorMsg = `Email inválido o vacío: "${emailInput}". Proporcione un correo electrónico válido.`;
    console.error(`[ERROR] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // 1. Resolve and validate service role credentials
  const serviceRoleKey =
    options?.serviceRoleKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrl =
    options?.supabaseUrl ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://placeholder-project.supabase.co';

  if (
    !options?.supabaseAdminClient &&
    (!serviceRoleKey ||
      serviceRoleKey.trim() === '' ||
      serviceRoleKey.includes('placeholder-service-key'))
  ) {
    const errorMsg =
      'Credenciales de servicio faltantes o inválidas. SUPABASE_SERVICE_ROLE_KEY debe estar configurada en las variables de entorno o archivo .env.local para aprovisionar administradores.';
    console.error(`[ERROR] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // 2. Initialize Supabase Admin Client with Service Role Key
  const adminClient =
    options?.supabaseAdminClient ||
    createClient(supabaseUrl, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

  console.log(`[INFO] Verificando existencia del usuario "${cleanEmail}" en auth.users...`);

  // 3. Securely verify user existence in auth.users
  let targetUser = null;
  try {
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      const errorMsg = `Error al consultar auth.users: ${listError.message}`;
      console.error(`[ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    targetUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    );
  } catch (err: any) {
    const errorMsg = `Fallo de comunicación con Supabase Auth: ${err?.message || err}`;
    console.error(`[ERROR] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  if (!targetUser) {
    const errorMsg = `Usuario con email "${cleanEmail}" no encontrado en auth.users. El usuario debe registrarse previamente en la plataforma antes de ser promovido a administrador.`;
    console.error(`[ERROR] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  console.log(`[INFO] Usuario encontrado: ${targetUser.id}. Actualizando rol a 'admin' en la tabla 'profiles'...`);

  // 4. Update the user's role to 'admin' in the profiles table
  try {
    const { data: updatedProfile, error: profileError } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', targetUser.id)
      .select('id, role, legal_name, email')
      .maybeSingle();

    if (profileError) {
      const errorMsg = `Error al actualizar la tabla profiles: ${profileError.message}`;
      console.error(`[ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Also synchronize user_metadata.role in auth.users
    try {
      await adminClient.auth.admin.updateUserById(targetUser.id, {
        user_metadata: {
          ...(targetUser.user_metadata || {}),
          role: 'admin',
        },
      });
    } catch {
      // Non-fatal if metadata update fails, database profiles row is source of truth
    }

    console.log('===========================================================');
    console.log('[SUCCESS] Usuario promovido exitosamente a Administrador:');
    console.log(`  - ID: ${targetUser.id}`);
    console.log(`  - Email: ${cleanEmail}`);
    console.log(`  - Rol asignado: admin`);
    if (updatedProfile?.legal_name) {
      console.log(`  - Nombre: ${updatedProfile.legal_name}`);
    }
    console.log('===========================================================');

    return {
      success: true,
      userId: targetUser.id,
      email: cleanEmail,
    };
  } catch (err: any) {
    const errorMsg = `Fallo al modificar el perfil del usuario: ${err?.message || err}`;
    console.error(`[ERROR] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * CLI Execution Entry Point
 */
async function runCli(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  let email = args[0]?.trim();

  if (!email) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    email = await new Promise<string>((resolve) => {
      rl.question('Ingrese el email del usuario a promover a administrador: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!email) {
    console.error('[ERROR] No se proporcionó ningún email. Operación abortada.');
    process.exit(1);
  }

  const result = await provisionAdmin(email);
  if (!result.success) {
    process.exit(1);
  }
}

// Execute CLI automatically if this file is run directly by node
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('seed-admin.ts') || process.argv[1].endsWith('seed-admin.js'));

if (isMain) {
  runCli().catch((err) => {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
  });
}
