import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm, sanitizeRedirectUrl } from '@/components/auth/LoginForm';
import LoginPage from '@/app/login/page';

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('Dedicated Login Page with Role-Aware Redirection (Issue #28)', () => {
  let mockSignInWithPassword: any;
  let mockResetPasswordForEmail: any;
  let mockSelect: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    mockSignInWithPassword = vi.fn();
    mockResetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'investor' }, error: null }),
      }),
    });

    mockSupabaseClient = {
      auth: {
        signInWithPassword: mockSignInWithPassword,
        resetPasswordForEmail: mockResetPasswordForEmail,
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };
  });

  // ---------------------------------------------------------------------------
  // 1. Open Redirect Sanitization Unit Tests
  // ---------------------------------------------------------------------------
  describe('Open Redirect Sanitization (sanitizeRedirectUrl)', () => {
    it('accepts safe relative paths within the application', () => {
      expect(sanitizeRedirectUrl('/solicitar')).toBe('/solicitar');
      expect(sanitizeRedirectUrl('/dashboard/pyme')).toBe('/dashboard/pyme');
      expect(sanitizeRedirectUrl('/marketplace/loan-123')).toBe('/marketplace/loan-123');
      expect(sanitizeRedirectUrl('/solicitar?step=2')).toBe('/solicitar?step=2');
    });

    it('rejects external URLs, protocol-relative URLs, and malicious schemes', () => {
      // Protocol relative
      expect(sanitizeRedirectUrl('//evil.com')).toBeNull();
      expect(sanitizeRedirectUrl('//attacker.org/phishing')).toBeNull();

      // Backslash evasion
      expect(sanitizeRedirectUrl('/\\evil.com')).toBeNull();
      expect(sanitizeRedirectUrl('/path\\with\\backslash')).toBeNull();

      // Absolute protocols
      expect(sanitizeRedirectUrl('https://evil.com')).toBeNull();
      expect(sanitizeRedirectUrl('http://insecure.com')).toBeNull();
      expect(sanitizeRedirectUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBeNull();

      // Empty / invalid
      expect(sanitizeRedirectUrl('')).toBeNull();
      expect(sanitizeRedirectUrl(null)).toBeNull();
      expect(sanitizeRedirectUrl(undefined)).toBeNull();
      expect(sanitizeRedirectUrl('solicitar')).toBeNull(); // Missing leading slash
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Page & Form Layout Rendering
  // ---------------------------------------------------------------------------
  describe('Page & Form Layout Rendering', () => {
    it('route /login renders accessible authentication form with Header and Footer', () => {
      render(<LoginPage />);

      expect(screen.getByTestId('sticky-header')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Iniciar sesión/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Correo electrónico/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
      expect(screen.getByTestId('submit-login-btn')).toBeInTheDocument();
      expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Registrate gratis/i })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Form Submission & Authentication
  // ---------------------------------------------------------------------------
  describe('Form Submission & Authentication Execution', () => {
    it('validates empty inputs and prevents submission', async () => {
      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      expect(await screen.findByText(/El correo electrónico es obligatorio/i)).toBeInTheDocument();
      expect(screen.getByText(/La contraseña es obligatoria/i)).toBeInTheDocument();
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it('submits form with clean credentials and calls signInWithPassword', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'usr-1', email: 'user@lencord.com', user_metadata: { role: 'investor' } },
          session: {},
        },
        error: null,
      });

      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: '  User@Lencord.COM  ' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'SecretPassword123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'user@lencord.com',
          password: 'SecretPassword123!',
        });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Role-Aware Redirection and Query Parameter Handling
  // ---------------------------------------------------------------------------
  describe('Redirect Query Parameter & Role-Aware Navigation', () => {
    it('navigates to redirect query parameter (e.g. /solicitar) upon successful sign-in', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'usr-2', email: 'pyme@lencord.com', user_metadata: { role: 'borrower' } },
        },
        error: null,
      });

      const handleSuccess = vi.fn();

      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          redirectUrl="/solicitar"
          onSuccess={handleSuccess}
        />
      );

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'pyme@lencord.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      await waitFor(() => {
        expect(handleSuccess).toHaveBeenCalledWith('/solicitar');
      });
    });

    it('sanitizes open redirect attempts and falls back to default role route', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'usr-3', email: 'inversor@lencord.com', user_metadata: { role: 'investor' } },
        },
        error: null,
      });

      const handleSuccess = vi.fn();

      // Provide malicious open redirect query parameter
      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          redirectUrl="//attacker.com/evil"
          onSuccess={handleSuccess}
        />
      );

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'inversor@lencord.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      await waitFor(() => {
        // Did not navigate to //attacker.com/evil, fell back to role-aware /dashboard/inversor
        expect(handleSuccess).toHaveBeenCalledWith('/dashboard/inversor');
      });
    });

    it('routes borrower users to /dashboard/pyme by default when no redirect param is specified', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'usr-borrower', email: 'empresa@lencord.com', user_metadata: { role: 'borrower' } },
        },
        error: null,
      });

      const handleSuccess = vi.fn();

      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          redirectUrl={null}
          onSuccess={handleSuccess}
        />
      );

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'empresa@lencord.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      await waitFor(() => {
        expect(handleSuccess).toHaveBeenCalledWith('/dashboard/pyme');
      });
    });

    it('routes investor users to /dashboard/inversor by default when no redirect param is specified', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'usr-inv', email: 'inv@lencord.com', user_metadata: { role: 'investor' } },
        },
        error: null,
      });

      const handleSuccess = vi.fn();

      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          redirectUrl={null}
          onSuccess={handleSuccess}
        />
      );

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'inv@lencord.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      await waitFor(() => {
        expect(handleSuccess).toHaveBeenCalledWith('/dashboard/inversor');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Error State Alerts (Invalid Credentials & Unconfirmed Email)
  // ---------------------------------------------------------------------------
  describe('Authentication Error States', () => {
    it('displays user-friendly alert when invalid login credentials are provided', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'wrong@user.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'IncorrectPassword' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      expect(
        await screen.findByText(/Credenciales incorrectas\. Verificá tu correo electrónico y contraseña\./i)
      ).toBeInTheDocument();
      expect(screen.getByTestId('auth-error-alert')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('displays clear alert when user email is not yet confirmed', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed', status: 400 },
      });

      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'unconfirmed@user.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      expect(
        await screen.findByText(/Tu correo electrónico no ha sido verificado/i)
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Password Recovery Request Flow
  // ---------------------------------------------------------------------------
  describe('Password Recovery Request', () => {
    it('displays recovery panel when clicking "¿Olvidaste tu contraseña?" and executes reset request', async () => {
      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      // Initially recovery panel is hidden
      expect(screen.queryByTestId('password-recovery-panel')).not.toBeInTheDocument();

      // Click recovery link
      fireEvent.click(screen.getByTestId('forgot-password-link'));

      expect(screen.getByTestId('password-recovery-panel')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Recuperar contraseña/i })).toBeInTheDocument();

      // Enter recovery email and send
      fireEvent.change(screen.getByLabelText(/Correo de recuperación/i), {
        target: { value: 'recuperar@lencord.com' },
      });

      fireEvent.click(screen.getByTestId('submit-recovery-btn'));

      await waitFor(() => {
        expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
          'recuperar@lencord.com',
          expect.objectContaining({
            redirectTo: expect.stringContaining('/login?recovery=true'),
          })
        );
      });

      expect(
        await screen.findByText(/Te enviamos un enlace de recuperación a recuperar@lencord\.com/i)
      ).toBeInTheDocument();
    });
  });
});
