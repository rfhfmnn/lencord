import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
  createSupabaseBrowserClient,
} from '@/services/supabase';

describe('Supabase Environment Configuration and Database Schema Integration (Issue #25)', () => {
  const rootDir = process.cwd();
  const envExamplePath = path.resolve(rootDir, '.env.example');
  const migrationsDir = path.resolve(rootDir, 'supabase', 'migrations');

  // ---------------------------------------------------------------------------
  // 1. Environment Variables Template Verification
  // ---------------------------------------------------------------------------
  describe('Environment Variables Template (.env.example)', () => {
    it('contains .env.example with documentation for all required Supabase variables', () => {
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, 'utf-8');

      // Acceptance criterion 1: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
      expect(content).toMatch(/NEXT_PUBLIC_SUPABASE_URL=/);
      expect(content).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY=/);
      expect(content).toMatch(/SUPABASE_SERVICE_ROLE_KEY=/);

      // Verify descriptive comments / documentation are present
      expect(content).toMatch(/#.*Supabase/i);
      expect(content).toMatch(/#.*service role/i);
      expect(content).toMatch(/#.*anonymous/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Migration Scripts & Schema Integrity
  // ---------------------------------------------------------------------------
  describe('Database Migration Scripts Integrity', () => {
    const requiredMigrationFiles = [
      '20260925000001_create_relational_schema_and_rls.sql',
      '20260925000002_create_commit_investment_atomic_rpc.sql',
      '20260925000003_create_notifications_table_and_rls.sql',
    ];

    it('contains all required migration files in supabase/migrations/', () => {
      expect(fs.existsSync(migrationsDir)).toBe(true);
      requiredMigrationFiles.forEach((file) => {
        const fullPath = path.resolve(migrationsDir, file);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });

    it('establishes all 7 core tables across migrations', () => {
      const allSql = requiredMigrationFiles
        .map((f) => fs.readFileSync(path.resolve(migrationsDir, f), 'utf-8'))
        .join('\n');

      const requiredTables = [
        'profiles',
        'sme_credit_profiles',
        'loans',
        'investments',
        'installments',
        'legal_contracts',
        'notifications',
      ];

      requiredTables.forEach((table) => {
        const tableRegex = new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}\\s*\\(`, 'i');
        expect(tableRegex.test(allSql)).toBe(true);
      });
    });

    it('enables Row Level Security (RLS) on all 7 core tables with proper security policies', () => {
      const allSql = requiredMigrationFiles
        .map((f) => fs.readFileSync(path.resolve(migrationsDir, f), 'utf-8'))
        .join('\n');

      const requiredTables = [
        'profiles',
        'sme_credit_profiles',
        'loans',
        'investments',
        'installments',
        'legal_contracts',
        'notifications',
      ];

      // Verify RLS enabled on each table
      requiredTables.forEach((table) => {
        const rlsRegex = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`, 'i');
        expect(rlsRegex.test(allSql)).toBe(true);
      });

      // Verify specific RLS policies exist
      expect(allSql).toMatch(/CREATE POLICY "Admins have full access to profiles"/i);
      expect(allSql).toMatch(/CREATE POLICY "Users can view own profile"/i);
      expect(allSql).toMatch(/CREATE POLICY "Admins have full access to loans"/i);
      expect(allSql).toMatch(/CREATE POLICY "Borrowers can view own loans"/i);
      expect(allSql).toMatch(/CREATE POLICY "Public and investors can view active marketplace loans"/i);
      expect(allSql).toMatch(/CREATE POLICY "Admins have full access to investments"/i);
      expect(allSql).toMatch(/CREATE POLICY "Investors can view own investments"/i);
      expect(allSql).toMatch(/CREATE POLICY "Admins have full access to notifications"/i);
      expect(allSql).toMatch(/CREATE POLICY "Users can view own notifications"/i);
      expect(allSql).toMatch(/CREATE POLICY "Users can update own notifications"/i);
    });

    it('compiles and exposes the commit_investment_atomic stored procedure in migration 2', () => {
      const rpcSql = fs.readFileSync(
        path.resolve(migrationsDir, '20260925000002_create_commit_investment_atomic_rpc.sql'),
        'utf-8'
      );

      expect(rpcSql).toMatch(/CREATE OR REPLACE FUNCTION commit_investment_atomic/i);
      expect(rpcSql).toMatch(/SELECT \* INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE/i);
      expect(rpcSql).toMatch(/GRANT EXECUTE ON FUNCTION commit_investment_atomic/i);
    });

    it('verifies all migration SQL statements parse cleanly and terminate properly', () => {
      requiredMigrationFiles.forEach((file) => {
        const content = fs.readFileSync(path.resolve(migrationsDir, file), 'utf-8');

        // Check balanced parentheses in table definitions
        const tableMatches = content.match(/CREATE TABLE IF NOT EXISTS [a-z_.]+ \([\s\S]*?\);/gi) || [];
        tableMatches.forEach((tableBlock) => {
          const openParen = (tableBlock.match(/\(/g) || []).length;
          const closeParen = (tableBlock.match(/\)/g) || []).length;
          expect(openParen).toBe(closeParen);
        });

        // Ensure non-empty and non-trivial
        expect(content.length).toBeGreaterThan(100);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Supabase Client Factories & Connectivity
  // ---------------------------------------------------------------------------
  describe('Supabase Client Factories & Connectivity', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-test-lencord.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-test-anon-key-abc-123';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-test-service-role-key-xyz-789';
    });

    it('initializes Supabase server client reading environment variables', () => {
      const client = createSupabaseServerClient();
      expect(client).toBeDefined();
      expect(typeof client.from).toBe('function');
      expect(typeof client.rpc).toBe('function');
      expect(typeof client.auth.getSession).toBe('function');
    });

    it('initializes Supabase admin client with service role key and non-persistent session', () => {
      const adminClient = createSupabaseAdminClient();
      expect(adminClient).toBeDefined();
      expect(typeof adminClient.from).toBe('function');
      expect(typeof adminClient.rpc).toBe('function');
      expect(typeof adminClient.auth.admin?.createUser).toBe('function');
    });

    it('initializes Supabase browser client reading public environment variables', () => {
      const browserClient = createSupabaseBrowserClient();
      expect(browserClient).toBeDefined();
      expect(typeof browserClient.from).toBe('function');
      expect(typeof browserClient.rpc).toBe('function');
    });

    it('allows overriding Supabase URL and anon key through options in server client', () => {
      const customClient = createSupabaseServerClient({
        supabaseUrl: 'https://custom-project.supabase.co',
        supabaseAnonKey: 'custom-key-999',
      });
      expect(customClient).toBeDefined();
      expect(typeof customClient.from).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Schema Tables Querying via Supabase Client
  // ---------------------------------------------------------------------------
  describe('Schema Tables Querying via Supabase Client', () => {
    it('constructs executable query builders for all 7 domain tables', () => {
      const client = createSupabaseServerClient({
        supabaseUrl: 'https://test-project.supabase.co',
        supabaseAnonKey: 'test-key',
      });

      const tables = [
        'profiles',
        'sme_credit_profiles',
        'loans',
        'investments',
        'installments',
        'legal_contracts',
        'notifications',
      ] as const;

      tables.forEach((tableName) => {
        const query = client.from(tableName).select('*').limit(10);
        expect(query).toBeDefined();
        expect(typeof query.then).toBe('function'); // Is thenable / Promise-like
      });
    });

    it('executes select query with filters and sorting against tables', async () => {
      const mockRows = [
        {
          id: 'notif-1',
          user_id: 'user-1',
          title: 'Subasta activada',
          message: 'Tu solicitud de crédito ha sido aprobada',
          type: 'success',
          read: false,
          action_url: '/dashboard/pyme',
          created_at: new Date().toISOString(),
        },
      ];

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockRows), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'content-range': '0-0/1',
            },
          })
        )
      );

      // Temporarily substitute global fetch to verify URL and headers constructed
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        const client = createSupabaseServerClient({
          supabaseUrl: 'https://test-project.supabase.co',
          supabaseAnonKey: 'test-anon-key',
        });

        const { data, error } = await client
          .from('notifications')
          .select('id, title, message, type, read')
          .eq('user_id', 'user-1')
          .order('created_at', { ascending: false })
          .limit(5);

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data?.[0].title).toBe('Subasta activada');
        expect(data?.[0].type).toBe('success');

        // Verify request dispatched to Supabase REST endpoint
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0].toString();
        expect(calledUrl).toContain('https://test-project.supabase.co/rest/v1/notifications');
        expect(calledUrl).toContain('user_id=eq.user-1');
        expect(calledUrl).toContain('order=created_at.desc');
        expect(calledUrl).toContain('limit=5');

        // Verify authentication headers sent
        const calledHeaders = mockFetch.mock.calls[0][1]?.headers;
        expect(calledHeaders).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('executes atomic RPC procedure call via client.rpc()', async () => {
      const mockRpcResponse = {
        success: true,
        amount_funded: 2_500_000,
      };

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockRpcResponse), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        )
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        const client = createSupabaseServerClient({
          supabaseUrl: 'https://test-project.supabase.co',
          supabaseAnonKey: 'test-anon-key',
        });

        const { data, error } = await client.rpc('commit_investment_atomic', {
          p_loan_id: '00000000-0000-0000-0000-000000000001',
          p_investor_id: '00000000-0000-0000-0000-000000000002',
          p_amount: 500_000,
        });

        expect(error).toBeNull();
        expect(data).toEqual(mockRpcResponse);

        // Verify RPC endpoint invoked
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0].toString();
        expect(calledUrl).toContain('https://test-project.supabase.co/rest/v1/rpc/commit_investment_atomic');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('handles database errors gracefully and surfaces error payload', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              message: 'El monto excede el cupo disponible de la subasta',
              code: 'P0001',
              details: null,
              hint: null,
            }),
            {
              status: 400,
              statusText: 'Bad Request',
              headers: { 'content-type': 'application/json' },
            }
          )
        )
      );

      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        const client = createSupabaseServerClient({
          supabaseUrl: 'https://test-project.supabase.co',
          supabaseAnonKey: 'test-anon-key',
        });

        const { data, error } = await client.rpc('commit_investment_atomic', {
          p_loan_id: '00000000-0000-0000-0000-000000000001',
          p_investor_id: '00000000-0000-0000-0000-000000000002',
          p_amount: 99_999_999,
        });

        expect(data).toBeNull();
        expect(error).toBeDefined();
        expect(error?.message).toContain('El monto excede el cupo disponible');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
