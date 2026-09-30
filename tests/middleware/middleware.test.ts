import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createMiddlewareHandler } from '@/middleware';

describe('Next.js Session Middleware and Route Protection (Issue #30)', () => {
  function createMockRequest(urlStr: string, cookieObj: Record<string, string> = {}): NextRequest {
    const url = new URL(urlStr, 'https://lencord.com.ar');
    const headers = new Headers();
    const cookieHeader = Object.entries(cookieObj)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }

    return new NextRequest(url, { headers });
  }

  function createMockSupabase(user: any = null, profileRole?: string) {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: user ? null : new Error('No session'),
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: profileRole ? { role: profileRole } : null,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  describe('Public Routes Accessibility', () => {
    it.each(['/', '/marketplace', '/login', '/registro'])(
      'allows unauthenticated access to public route %s',
      async (path) => {
        const req = createMockRequest(path);
        const mockSupabase = createMockSupabase(null);

        const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

        expect(res.status).toBe(200);
        expect(res.headers.get('x-auth-status')).toBe('unauthenticated');
        expect(res.headers.get('x-route-protection')).toBe('public');
      }
    );
  });

  describe('Route Protection: /marketplace/[id] (Issue #58)', () => {
    it('allows unauthenticated access to general catalog /marketplace', async () => {
      const req = createMockRequest('/marketplace');
      const mockSupabase = createMockSupabase(null);

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-auth-status')).toBe('unauthenticated');
      expect(res.headers.get('x-route-protection')).toBe('public');
    });

    it('redirects unauthenticated requests from /marketplace/[id] to /login with redirect and reason=auth_required with HTTP 307', async () => {
      const req = createMockRequest('/marketplace/loan-pyme-001');
      const mockSupabase = createMockSupabase(null);

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('reason=auth_required');
      expect(location).toMatch(/redirect=(%2F|\/)marketplace(%2F|\/)loan-pyme-001/);
      expect(res.headers.get('x-route-protection')).toBe('auth-required');
    });

    it('allows authenticated users to access individual auction /marketplace/[id]', async () => {
      const req = createMockRequest('/marketplace/loan-pyme-001');
      const mockUser = {
        id: 'user-inv-001',
        email: 'inversor@lencord.ar',
        user_metadata: { role: 'investor' },
      };
      const mockSupabase = createMockSupabase(mockUser, 'investor');

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-auth-status')).toBe('authenticated');
      expect(res.headers.get('x-route-protection')).toBe('allowed');
    });
  });

  describe('Route Protection: /solicitar', () => {
    it('redirects unauthenticated requests to /login?redirect=/solicitar', async () => {
      const req = createMockRequest('/solicitar');
      const mockSupabase = createMockSupabase(null);

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login?redirect=%2Fsolicitar');
      expect(res.headers.get('x-route-protection')).toBe('auth-required');
    });

    it('redirects nested /solicitar paths with redirect param', async () => {
      const req = createMockRequest('/solicitar/step-2');
      const mockSupabase = createMockSupabase(null);

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login?redirect=%2Fsolicitar%2Fstep-2');
    });

    it('redirects authenticated investors attempting to access /solicitar with access notice', async () => {
      const req = createMockRequest('/solicitar');
      const mockUser = {
        id: 'user-inv-001',
        email: 'inversor@lencord.ar',
        user_metadata: { role: 'investor' },
      };
      const mockSupabase = createMockSupabase(mockUser, 'investor');

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/dashboard/inversor');
      expect(location).toContain('notice=investor_cannot_borrow');
      expect(res.headers.get('x-route-protection')).toBe('investor-restricted');
      expect(res.headers.get('x-user-role')).toBe('investor');
    });

    it('allows access to /solicitar for authenticated borrowers (sme)', async () => {
      const req = createMockRequest('/solicitar');
      const mockUser = {
        id: 'user-sme-001',
        email: 'pyme@empresa.com.ar',
        user_metadata: { role: 'borrower' },
      };
      const mockSupabase = createMockSupabase(mockUser, 'borrower');

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-route-protection')).toBe('allowed');
      expect(res.headers.get('x-user-role')).toBe('borrower');
    });
  });

  describe('Route Protection: /admin', () => {
    it('redirects unauthenticated requests to /login?redirect=/admin', async () => {
      const req = createMockRequest('/admin');
      const mockSupabase = createMockSupabase(null);

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login?redirect=%2Fadmin');
      expect(res.headers.get('x-route-protection')).toBe('auth-required');
    });

    it('strictly forbids access with 403 status for authenticated non-admin users', async () => {
      const req = createMockRequest('/admin');
      const mockUser = {
        id: 'user-sme-001',
        email: 'pyme@empresa.com.ar',
        user_metadata: { role: 'sme' },
      };
      const mockSupabase = createMockSupabase(mockUser, 'sme');

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(403);
      expect(res.headers.get('x-route-protection')).toBe('admin-forbidden');
      expect(res.headers.get('x-user-role')).toBe('sme');
    });

    it('strictly forbids access with 403 status for authenticated investors', async () => {
      const req = createMockRequest('/admin/loans');
      const mockUser = {
        id: 'user-inv-001',
        email: 'inversor@lencord.ar',
        user_metadata: { role: 'investor' },
      };
      const mockSupabase = createMockSupabase(mockUser, 'investor');

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(403);
      expect(res.headers.get('x-route-protection')).toBe('admin-forbidden');
      expect(res.headers.get('x-user-role')).toBe('investor');
    });

    it('allows access to /admin when authenticated user has role admin', async () => {
      const req = createMockRequest('/admin');
      const mockUser = {
        id: 'user-admin-001',
        email: 'admin@lencord.ar',
        user_metadata: { role: 'admin' },
      };
      const mockSupabase = createMockSupabase(mockUser, 'admin');

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-route-protection')).toBe('admin-allowed');
      expect(res.headers.get('x-user-role')).toBe('admin');
    });
  });

  describe('Route Protection: /dashboard/*', () => {
    it.each(['/dashboard', '/dashboard/pyme', '/dashboard/inversor'])(
      'redirects unauthenticated requests to %s directly to /login',
      async (path) => {
        const req = createMockRequest(path);
        const mockSupabase = createMockSupabase(null);

        const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

        expect(res.status).toBe(307);
        const location = res.headers.get('location');
        expect(location).toContain('/login');
        expect(res.headers.get('x-route-protection')).toBe('auth-required');
      }
    );

    it('allows authenticated requests to /dashboard/pyme and /dashboard/inversor', async () => {
      const req = createMockRequest('/dashboard/pyme');
      const mockUser = {
        id: 'user-001',
        email: 'user@lencord.ar',
        user_metadata: { role: 'borrower' },
      };
      const mockSupabase = createMockSupabase(mockUser, 'borrower');

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(res.status).toBe(200);
      expect(res.headers.get('x-route-protection')).toBe('allowed');
    });
  });

  describe('Token Refresh and Session Handling', () => {
    it('sets authentication headers and invokes getUser() on incoming requests', async () => {
      const req = createMockRequest('/');
      const mockUser = { id: 'user-001', email: 'test@example.com' };
      const mockSupabase = createMockSupabase(mockUser);

      const res = await createMiddlewareHandler(req, { supabaseClient: mockSupabase });

      expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1);
      expect(res.headers.get('x-auth-status')).toBe('authenticated');
    });
  });
});
