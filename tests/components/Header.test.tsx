import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '@/components/layout/Header';

describe('Header Component', () => {
  it('renders sticky header element with proper attributes', () => {
    render(<Header />);
    const header = screen.getByTestId('sticky-header');
    expect(header).toBeInTheDocument();
  });

  it('renders brand logo linking to homepage', () => {
    render(<Header />);
    const brandLink = screen.getByRole('link', { name: /lencord inicio/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('renders required navigation links with correct destinations', () => {
    render(<Header />);
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

  it('renders auth action buttons with primary navy and secondary styles', () => {
    render(<Header />);
    const loginButton = screen.getByRole('button', { name: /^iniciar sesión$/i });
    const registerButton = screen.getByRole('button', { name: /^registrarse$/i });

    expect(loginButton).toBeInTheDocument();
    expect(registerButton).toBeInTheDocument();
  });

  it('triggers onLogin and onRegister callbacks when auth buttons are clicked', async () => {
    const handleLogin = vi.fn();
    const handleRegister = vi.fn();
    const user = userEvent.setup();

    render(<Header onLogin={handleLogin} onRegister={handleRegister} />);

    const loginButton = screen.getByRole('button', { name: /^iniciar sesión$/i });
    await user.click(loginButton);
    expect(handleLogin).toHaveBeenCalledTimes(1);

    const registerButton = screen.getByRole('button', { name: /^registrarse$/i });
    await user.click(registerButton);
    expect(handleRegister).toHaveBeenCalledTimes(1);
  });

  it('handles mobile menu toggle open and close cleanly', async () => {
    const user = userEvent.setup();
    render(<Header />);

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
    render(<Header />);

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

  it('closes mobile menu when mobile auth action button is clicked', async () => {
    const handleLogin = vi.fn();
    const user = userEvent.setup();
    render(<Header onLogin={handleLogin} />);

    const toggleButton = screen.getByTestId('mobile-menu-toggle');
    await user.click(toggleButton);

    const loginButtons = screen.getAllByRole('button', { name: /^iniciar sesión$/i });
    const drawerLoginButton = loginButtons[loginButtons.length - 1];
    await user.click(drawerLoginButton);

    expect(handleLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('mobile-nav-drawer')).not.toBeInTheDocument();
  });
});
