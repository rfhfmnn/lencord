import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionAdmin, assertServerEnvironment } from '@/scripts/seed-admin';

describe('Initial Administrator Provisioning Script (Issue #31)', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  function createMockAdminClient(options?: {
    users?: { id: string; email: string; user_metadata?: Record<string, any> }[];
    updateProfileError?: Error | null;
    listUsersError?: Error | null;
  }) {
    const users = options?.users ?? [
      { id: 'usr-admin-cand', email: 'candidato@lencord.ar', user_metadata: { role: 'investor' } },
    ];

    const mockUpdateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockListUsers = vi.fn().mockResolvedValue({
      data: { users },
      error: options?.listUsersError ?? null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: options?.updateProfileError
              ? null
              : { id: 'usr-admin-cand', role: 'admin', legal_name: 'Admin Candidato' },
            error: options?.updateProfileError ?? null,
          }),
        }),
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({
      update: mockUpdate,
    });

    return {
      auth: {
        admin: {
          listUsers: mockListUsers,
          updateUserById: mockUpdateUserById,
        },
      },
      from: mockFrom,
      _spies: {
        mockListUsers,
        mockUpdateUserById,
        mockUpdate,
      },
    } as any;
  }

  describe('Validation & Credentials Guard', () => {
    it('prevents execution in client-side environments', () => {
      const originalVitest = process.env.VITEST;
      delete process.env.VITEST;

      expect(() => assertServerEnvironment()).toThrow(
        'Security Violation: scripts/seed-admin.ts cannot be executed in client-side environments.'
      );

      process.env.VITEST = originalVitest;
    });

    it('rejects execution when email format is invalid or empty', async () => {
      const result = await provisionAdmin('correo-invalido');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Email inválido o vacío');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('rejects execution when service role key is missing or is placeholder without client provided', async () => {
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const result = await provisionAdmin('admin@lencord.ar', {
        serviceRoleKey: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SUPABASE_SERVICE_ROLE_KEY');

      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
  });

  describe('Verification of User in auth.users', () => {
    it('aborts and logs error when user is not registered in auth.users', async () => {
      const mockClient = createMockAdminClient({ users: [] });

      const result = await provisionAdmin('noexiste@lencord.ar', {
        supabaseAdminClient: mockClient,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('no encontrado en auth.users');
      expect(mockClient._spies.mockListUsers).toHaveBeenCalledTimes(1);
      // Ensures profiles table is NOT touched if user does not exist
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('surfaces communication error when auth.users query fails', async () => {
      const mockClient = createMockAdminClient({
        listUsersError: new Error('Network timeout'),
      });

      const result = await provisionAdmin('candidato@lencord.ar', {
        supabaseAdminClient: mockClient,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });

  describe('Role Update in profiles and auth metadata', () => {
    it("successfully promotes target user to 'admin' in profiles table", async () => {
      const mockClient = createMockAdminClient();

      const result = await provisionAdmin('candidato@lencord.ar', {
        supabaseAdminClient: mockClient,
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('usr-admin-cand');
      expect(result.email).toBe('candidato@lencord.ar');

      // Verify profiles update call
      expect(mockClient.from).toHaveBeenCalledWith('profiles');
      expect(mockClient._spies.mockUpdate).toHaveBeenCalledWith({ role: 'admin' });

      // Verify metadata sync
      expect(mockClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'usr-admin-cand',
        expect.objectContaining({
          user_metadata: expect.objectContaining({ role: 'admin' }),
        })
      );

      // Verify terminal success logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SUCCESS] Usuario promovido exitosamente a Administrador:')
      );
    });

    it('handles database error when profiles update fails', async () => {
      const mockClient = createMockAdminClient({
        updateProfileError: new Error('Database permission denied'),
      });

      const result = await provisionAdmin('candidato@lencord.ar', {
        supabaseAdminClient: mockClient,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database permission denied');
    });
  });
});
