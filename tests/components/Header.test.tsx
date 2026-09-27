import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '@/components/layout/Header';

describe('Header Component', () => {
  it('renders sticky header element with proper attributes', () => {
    render(<Header user={null} />);
    const header = screen.getByTestId('sticky-header');
    expect(header).toBeInTheDocument();
  });

  it('renders brand logo linking to homepage', () => {
    render(<Header user={null} />);
    const brandLink = screen.getByRole('link', { name: /lencord inicio/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('renders required navigation links with correct destinations', () => {
    render(<Header user={null} />);
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(nav).toBeInTheDocument();

    const prestarLink = screen.getByRole('link', { name: /^prestar$/i });
    expect(prestarLink).toHaveAttribute('href', '/marketplace');

    const pedirLink = screen.getByRole('link', { name: /^pedir financiación$/i });
    expect(pedirLink).toHaveAttribute('href', '/solicitar');

    const comoFuncionaLink = screen.getByRole('link', { name: /^cómo funciona$/i });
    expect(comoFuncionaLink).toHaveAttribute('href', '/#como-funciona');

    const faqLink = screen.getByRole('link', { name: /^faq$/i });
    expect(faqLink).toHaveAttribute('href', '/#faq');
  });

  describe('Unauthenticated Session State', () => {
    it("renders 'Iniciar sesión' linking to /login and 'Registrarse' linking to /registro", () => {
      render(<Header user={null} />);

      const loginLinks = screen.getAllByRole('link', { name: /^iniciar sesión$/i });
      expect(loginLinks[0]).toHaveAttribute('href', '/login');

      const registerLinks = screen.getAllByRole('link', { name: /^registrarse$/i });
      expect(registerLinks[0]).toHaveAttribute('href', '/registro');
    });

    it('triggers onLogin and onRegister callbacks when auth links are clicked', async () => {
      const handleLogin = vi.fn();
      const handleRegister = vi.fn();
      const user = userEvent.setup();

      render(<Header user={null} onLogin={handleLogin} onRegister={handleRegister} />);

      const loginLinks = screen.getAllByRole('link', { name: /^iniciar sesión$/i });
      await user.click(loginLinks[0]);
      expect(handleLogin).toHaveBeenCalledTimes(1);

      const registerLinks = screen.getAllByRole('link', { name: /^registrarse$/i });
      await user.click(registerLinks[0]);
      expect(handleRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Loading State', () => {
    it('renders auth skeleton without layout shifts or button flickering before auth resolves', () => {
      render(<Header isLoading={true} user={null} />);

      const skeleton = screen.getByTestId('header-auth-skeleton');
      expect(skeleton).toBeInTheDocument();

      // Ensure no auth buttons are shown yet
      expect(screen.queryByTestId('header-login-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header-register-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header-session-user')).not.toBeInTheDocument();
    });
  });

  describe('Borrower / SME Session State', () => {
    it('renders company name, role badge (PyME), dashboard link, and logout button', () => {
      render(
        <Header
          user={{
            id: 'prof-sme-001',
            name: 'Metalúrgica Quilmes S.R.L.',
            role: 'borrower',
          }}
        />
      );

      expect(screen.getByTestId('header-user-name')).toHaveTextContent('Metalúrgica Quilmes S.R.L.');
      expect(screen.getByTestId('header-role-badge')).toHaveTextContent('PyME');

      const dashboardLink = screen.getByTestId('header-dashboard-link');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard/pyme');

      // Borrower should NOT have custody balance
      expect(screen.queryByTestId('header-custody-balance')).not.toBeInTheDocument();

      // Logout button is present
      expect(screen.getByTestId('header-logout-button')).toBeInTheDocument();
    });
  });

  describe('Investor Session State', () => {
    it('renders investor name, role badge (Inversor), illustrative custody balance, and dashboard link', () => {
      render(
        <Header
          user={{
            id: 'prof-inv-001',
            name: 'Juan Ignacio Pérez',
            role: 'investor',
            custodyBalance: 2500000,
          }}
        />
      );

      expect(screen.getByTestId('header-user-name')).toHaveTextContent('Juan Ignacio Pérez');
      expect(screen.getByTestId('header-role-badge')).toHaveTextContent('Inversor');

      const custodyBadge = screen.getByTestId('header-custody-balance');
      expect(custodyBadge).toBeInTheDocument();
      expect(custodyBadge).toHaveTextContent(/2\.500\.000/);

      const dashboardLink = screen.getByTestId('header-dashboard-link');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard/inversor');
    });
  });

  describe('Admin Session State', () => {
    it("renders admin name, role badge (Admin), and 'Administración' link targeting /admin", () => {
      render(
        <Header
          user={{
            id: 'prof-adm-001',
            name: 'Administración Lencord',
            role: 'admin',
          }}
        />
      );

      expect(screen.getByTestId('header-user-name')).toHaveTextContent('Administración Lencord');
      expect(screen.getByTestId('header-role-badge')).toHaveTextContent('Admin');

      const adminLink = screen.getByTestId('header-admin-link');
      expect(adminLink).toHaveAttribute('href', '/admin');
      expect(adminLink).toHaveTextContent('Administración');
    });
  });

  describe('Logout Flow & State Resolution', () => {
    it('terminates Supabase auth session and updates UI to unauthenticated state immediately', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ error: null });
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
          signOut: mockSignOut,
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
      } as any;

      const handleLogout = vi.fn();
      const user = userEvent.setup();

      render(
        <Header
          supabaseClient={mockClient}
          user={{
            id: 'prof-sme-001',
            name: 'Alimentos del Valle SAS',
            role: 'sme',
          }}
          onLogout={handleLogout}
        />
      );

      expect(screen.getByTestId('header-user-name')).toHaveTextContent('Alimentos del Valle SAS');

      const logoutBtn = screen.getByTestId('header-logout-button');
      await user.click(logoutBtn);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(handleLogout).toHaveBeenCalledTimes(1);

      // Immediately transitions to unauthenticated UI state
      await waitFor(() => {
        expect(screen.queryByTestId('header-session-user')).not.toBeInTheDocument();
        expect(screen.getByTestId('header-login-link')).toBeInTheDocument();
        expect(screen.getByTestId('header-register-link')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Menu and Responsive Collapse', () => {
    it('handles mobile menu toggle open and close cleanly', async () => {
      const user = userEvent.setup();
      render(<Header user={null} />);

      const toggleButton = screen.getByTestId('mobile-menu-toggle');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      expect(toggleButton).toHaveAttribute('aria-label', 'Abrir menú de navegación');
      expect(screen.queryByTestId('mobile-nav-drawer')).not.toBeInTheDocument();

      // Open mobile menu
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      expect(toggleButton).toHaveAttribute('aria-label', 'Cerrar menú de navegación');

      const drawer = screen.getByTestId('mobile-nav-drawer');
      expect(drawer).toBeInTheDocument();

      // Verify links in mobile menu
      const mobilePrestar = screen.getAllByRole('link', { name: /^prestar$/i });
      expect(mobilePrestar.length).toBeGreaterThanOrEqual(2); // desktop + mobile

      // Close mobile menu by clicking toggle again
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('mobile-nav-drawer')).not.toBeInTheDocument();
    });

    it('closes mobile menu when a mobile nav link is clicked', async () => {
      const user = userEvent.setup();
      render(<Header user={null} />);

      const toggleButton = screen.getByTestId('mobile-menu-toggle');
      await user.click(toggleButton);

      const drawer = screen.getByTestId('mobile-nav-drawer');
      expect(drawer).toBeInTheDocument();

      // Click a link inside drawer
      const mobileLinks = screen.getAllByRole('link', { name: /^pedir financiación$/i });
      const drawerLink = mobileLinks[mobileLinks.length - 1];
      await user.click(drawerLink);

      expect(screen.queryByTestId('mobile-nav-drawer')).not.toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders mobile authenticated session with dashboard link and logout', async () => {
      const user = userEvent.setup();
      render(
        <Header
          user={{
            id: 'prof-inv-001',
            name: 'Juan Ignacio Pérez',
            role: 'investor',
          }}
        />
      );

      const toggleButton = screen.getByTestId('mobile-menu-toggle');
      await user.click(toggleButton);

      expect(screen.getByTestId('header-mobile-session-user')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-dashboard-link')).toHaveAttribute('href', '/dashboard/inversor');
      expect(screen.getByTestId('mobile-logout-button')).toBeInTheDocument();
    });
  });
});

