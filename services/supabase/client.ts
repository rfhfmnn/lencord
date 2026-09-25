/**
 * Supabase Server Client and Connection Factory.
 * Uses @supabase/ssr respecting HTTP cookies and server-side authentication.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface CookieMethodsServer {
  getAll(): { name: string; value: string }[] | Promise<{ name: string; value: string }[]>;
  setAll?(cookies: { name: string; value: string; options?: CookieOptions }[]): void | Promise<void>;
}

export interface SupabaseClientOptions {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  cookies?: CookieMethodsServer;
}

/**
 * Creates an authenticated Supabase server client using @supabase/ssr.
 * Reads cookies from the incoming request or provided cookie store.
 */
export function createSupabaseServerClient(options?: SupabaseClientOptions): SupabaseClient {
  const supabaseUrl =
    options?.supabaseUrl ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://placeholder-project.supabase.co';

  const supabaseAnonKey =
    options?.supabaseAnonKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-anon-key';

  const cookieStore = options?.cookies ?? {
    getAll: () => [],
    setAll: () => {},
  };

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (cookieStore.setAll) {
          cookieStore.setAll(cookiesToSet);
        }
      },
    },
  });
}

/**
 * Creates an admin/service-role Supabase client for backend cron routines or webhooks.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://placeholder-project.supabase.co';

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-service-key';

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
