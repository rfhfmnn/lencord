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

describe('Login with Role Selector and Unified Account Architecture (Issue #54)', () => {
  let mockSignInWithPassword: any;
  let mockResetPasswordForEmail: any;
  let mockUpdateUser: any;
  let mockSelect: any;
  let mockUpdate: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    mockSignInWithPassword = vi.fn();
    mockResetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockUpdateUser = vi.fn().mockResolvedValue({ data: { user: {} }, error: null });
    mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });
    mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    mockSupabaseClient = {
      auth: {
        signInWithPassword: mockSignInWithPassword,
        resetPasswordForEmail: mockResetPasswordForEmail,
        updateUser: mockUpdateUser,
      },
      from: vi.fn().mockImplementation((table: string) => ({
        select: mockSelect,
        update: mockUpdate,
      })),
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

    it('renders dual-tab role selector with accessible ARIA semantics and default investor tab', () => {
      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      const tablist = screen.getByRole('tablist', { name: /Seleccionar tipo de cuenta para ingresar/i });
      expect(tablist).toBeInTheDocument();

      const pymeTab = screen.getByTestId('tab-login-pyme');
      const investorTab = screen.getByTestId('tab-login-investor');

      expect(pymeTab).toHaveAttribute('role', 'tab');
      expect(investorTab).toHaveAttribute('role', 'tab');
      expect(investorTab).toHaveAttribute('aria-selected', 'true');
      expect(pymeTab).toHaveAttribute('aria-selected', 'false');
    });

    it('allows switching tabs via mouse click and updates aria-selected attributes', () => {
      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      const pymeTab = screen.getByTestId('tab-login-pyme');
      const investorTab = screen.getByTestId('tab-login-investor');

      fireEvent.click(pymeTab);
      expect(pymeTab).toHaveAttribute('aria-selected', 'true');
      expect(investorTab).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(investorTab);
      expect(investorTab).toHaveAttribute('aria-selected', 'true');
      expect(pymeTab).toHaveAttribute('aria-selected', 'false');
    });

    it('supports keyboard navigation with arrow keys between role tabs', () => {
      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      const pymeTab = screen.getByTestId('tab-login-pyme');
      const investorTab = screen.getByTestId('tab-login-investor');

      // Focus on investor tab (default selected) and press ArrowLeft
      fireEvent.keyDown(investorTab, { key: 'ArrowLeft' });
      expect(pymeTab).toHaveAttribute('aria-selected', 'true');
      expect(investorTab).toHaveAttribute('aria-selected', 'false');

      // Press ArrowRight to toggle back
      fireEvent.keyDown(pymeTab, { key: 'ArrowRight' });
      expect(investorTab).toHaveAttribute('aria-selected', 'true');
      expect(pymeTab).toHaveAttribute('aria-selected', 'false');
    });

    it('respects initial role from URL query param (?role=pyme)', () => {
      mockSearchParams = new URLSearchParams('role=pyme');
      render(<LoginForm supabaseClient={mockSupabaseClient} />);

      const pymeTab = screen.getByTestId('tab-login-pyme');
      expect(pymeTab).toHaveAttribute('aria-selected', 'true');
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
          defaultRole="borrower"
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

    it('routes borrower users to /dashboard/pyme when logging in with PyME tab', async () => {
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
          defaultRole="borrower"
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
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: {
          active_role: 'borrower',
          role: 'borrower',
        },
      });
    });

    it('routes investor users to /dashboard/inversor when logging in with Investor tab', async () => {
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
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: {
          active_role: 'investor',
          role: 'investor',
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Missing Role Handling & Profile Activation Flow (Issue #54)
  // ---------------------------------------------------------------------------
  describe('Missing Role Handling and One-Click Activation (Issue #54)', () => {
    it('shows missing PyME profile alert when investor user attempts to log in via PyME tab', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'usr-only-investor',
            email: 'investor@lencord.com',
            user_metadata: { role: 'investor' },
          },
        },
        error: null,
      });

      const handleSuccess = vi.fn();

      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          defaultRole="borrower"
          onSuccess={handleSuccess}
        />
      );

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'investor@lencord.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      // Missing role alert should appear without navigating
      expect(await screen.findByTestId('missing-role-alert')).toBeInTheDocument();
      expect(screen.getByText(/Tu cuenta no posee un perfil PyME activo\./i)).toBeInTheDocument();
      expect(screen.getByTestId('activate-profile-btn')).toHaveTextContent(/Activar perfil de empresa/i);
      expect(handleSuccess).not.toHaveBeenCalled();
    });

    it('activates company profile on button click and navigates to /dashboard/pyme', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'usr-only-investor-2',
            email: 'investor2@lencord.com',
            user_metadata: { role: 'investor' },
          },
        },
        error: null,
      });

      const handleSuccess = vi.fn();

      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          defaultRole="borrower"
          onSuccess={handleSuccess}
        />
      );

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'investor2@lencord.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      const activateBtn = await screen.findByTestId('activate-profile-btn');
      fireEvent.click(activateBtn);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          data: {
            roles: ['investor', 'borrower'],
            role: 'borrower',
            active_role: 'borrower',
          },
        });
        expect(handleSuccess).toHaveBeenCalledWith('/dashboard/pyme');
      });
    });

    it('shows missing Inversor profile alert when borrower user attempts to log in via Inversor tab', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'usr-only-pyme',
            email: 'pyme@lencord.com',
            user_metadata: { role: 'borrower' },
          },
        },
        error: null,
      });

      const handleSuccess = vi.fn();

      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          defaultRole="investor"
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

      expect(await screen.findByTestId('missing-role-alert')).toBeInTheDocument();
      expect(screen.getByText(/Tu cuenta no posee un perfil Inversor activo\./i)).toBeInTheDocument();
      expect(screen.getByTestId('activate-profile-btn')).toHaveTextContent(/Activar perfil de inversor/i);
      expect(handleSuccess).not.toHaveBeenCalled();

      // Click to activate investor profile
      fireEvent.click(screen.getByTestId('activate-profile-btn'));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          data: {
            roles: ['borrower', 'investor'],
            role: 'investor',
            active_role: 'investor',
          },
        });
        expect(handleSuccess).toHaveBeenCalledWith('/dashboard/inversor');
      });
    });

    it('clears missing role warning when switching to the other role tab', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'usr-only-investor-3',
            email: 'investor3@lencord.com',
            user_metadata: { role: 'investor' },
          },
        },
        error: null,
      });

      render(
        <LoginForm
          supabaseClient={mockSupabaseClient}
          defaultRole="borrower"
        />
      );

      fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
        target: { value: 'investor3@lencord.com' },
      });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByTestId('submit-login-btn'));

      expect(await screen.findByTestId('missing-role-alert')).toBeInTheDocument();

      // Switch tab to Investor
      fireEvent.click(screen.getByTestId('tab-login-investor'));

      expect(screen.queryByTestId('missing-role-alert')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Error State Alerts (Invalid Credentials & Unconfirmed Email)
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
  // 7. Password Recovery Request Flow
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
