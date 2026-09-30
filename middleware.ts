import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export interface MiddlewareHandlerOptions {
  supabaseClient?: any;
}

/**
 * Core handler implementing session token refresh and role-based route protection.
 */
export async function createMiddlewareHandler(
  request: NextRequest,
  options?: MiddlewareHandlerOptions
): Promise<NextResponse> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // Initialize @supabase/ssr client
  const supabase =
    options?.supabaseClient ||
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      'placeholder-anon-key',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options: cookieOpts }) =>
              response.cookies.set(name, value, cookieOpts)
            );
          },
        },
      }
    );

  // Refresh session tokens and inspect authenticated user
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  // Determine user role if authenticated
  let userRole: string | undefined = undefined;
  if (user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role) {
        userRole = profile.role;
      }
    } catch {
      // Fall back to metadata
    }

    if (!userRole && user.user_metadata?.role) {
      userRole = user.user_metadata.role;
    }
  }

  // Add auth status header
  response.headers.set('x-auth-status', user ? 'authenticated' : 'unauthenticated');
  if (userRole) {
    response.headers.set('x-user-role', userRole);
  }

  // 1. Route Protection: /solicitar
  if (pathname === '/solicitar' || pathname.startsWith('/solicitar/')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set('x-route-protection', 'auth-required');
      return redirectRes;
    }

    if (userRole === 'investor') {
      const noticeUrl = new URL('/dashboard/inversor', request.url);
      noticeUrl.searchParams.set('notice', 'investor_cannot_borrow');
      const redirectRes = NextResponse.redirect(noticeUrl);
      redirectRes.headers.set('x-route-protection', 'investor-restricted');
      redirectRes.headers.set('x-user-role', 'investor');
      return redirectRes;
    }

    response.headers.set('x-route-protection', 'allowed');
    return response;
  }

  // 2. Route Protection: /admin
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set('x-route-protection', 'auth-required');
      return redirectRes;
    }

    if (userRole !== 'admin') {
      return new NextResponse('Acceso denegado: se requieren credenciales de administrador.', {
        status: 403,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-route-protection': 'admin-forbidden',
          'x-user-role': userRole || 'unknown',
        },
      });
    }

    response.headers.set('x-route-protection', 'admin-allowed');
    return response;
  }

  // 3. Route Protection: /dashboard/*
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set('x-route-protection', 'auth-required');
      return redirectRes;
    }

    response.headers.set('x-route-protection', 'allowed');
    return response;
  }

  // 4. Route Protection: /marketplace/[id] (Individual auction details)
  if (pathname.startsWith('/marketplace/')) {
    const subPath = pathname.slice('/marketplace/'.length).trim();
    if (subPath.length > 0) {
      if (!user) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set('reason', 'auth_required');
        const redirectRes = NextResponse.redirect(loginUrl, 307);
        redirectRes.headers.set('x-route-protection', 'auth-required');
        return redirectRes;
      }

      response.headers.set('x-route-protection', 'allowed');
      return response;
    }
  }

  // 5. Public routes (/, /marketplace, /login, /registro, etc.)
  response.headers.set('x-route-protection', 'public');
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  return createMiddlewareHandler(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public static files (.svg, .png, .jpg, .jpeg, .gif, .webp, .pdf, .ico, .css, .js)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|ico|css|js)$).*)',
  ],
};
