'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import styles from './header.module.css';

export interface HeaderProps {
  className?: string;
  onLogin?: () => void;
  onRegister?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  className = '',
  onLogin,
  onRegister,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLoginClick = () => {
    closeMobileMenu();
    if (onLogin) onLogin();
  };

  const handleRegisterClick = () => {
    closeMobileMenu();
    if (onRegister) onRegister();
  };

  return (
    <header className={`${styles.header} ${className}`.trim()} data-testid="sticky-header">
      <div className={styles.container}>
        <Link href="/" className={styles.brand} onClick={closeMobileMenu} aria-label="Lencord inicio">
          <span className={styles.brandName}>Lencord</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.desktopNav} aria-label="Navegación principal">
          <Link href="/marketplace" className={styles.navLink}>
            Prestar
          </Link>
          <Link href="/solicitar" className={styles.navLink}>
            Pedir financiación
          </Link>
          <Link href="/#como-funciona" className={styles.navLink}>
            Cómo funciona
          </Link>
          <Link href="/#faq" className={styles.navLink}>
            FAQ
          </Link>
        </nav>

        {/* Desktop Auth Action Buttons */}
        <div className={styles.desktopActions}>
          <Button variant="secondary" size="sm" onClick={handleLoginClick}>
            Iniciar sesión
          </Button>
          <Button variant="primary" size="sm" onClick={handleRegisterClick}>
            Registrarse
          </Button>
        </div>

        {/* Mobile Navigation Toggle */}
        <button
          type="button"
          className={styles.mobileToggle}
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav-drawer"
          data-testid="mobile-menu-toggle"
        >
          {isMobileMenuOpen ? (
            <svg
              className={styles.iconSvg}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className={styles.iconSvg}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          className={styles.mobileMenu}
          data-testid="mobile-nav-drawer"
          role="region"
          aria-label="Menú de navegación móvil"
        >
          <nav className={styles.mobileNavLinks} aria-label="Enlaces móviles">
            <Link href="/marketplace" className={styles.mobileNavLink} onClick={closeMobileMenu}>
              Prestar
            </Link>
            <Link href="/solicitar" className={styles.mobileNavLink} onClick={closeMobileMenu}>
              Pedir financiación
            </Link>
            <Link href="/#como-funciona" className={styles.mobileNavLink} onClick={closeMobileMenu}>
              Cómo funciona
            </Link>
            <Link href="/#faq" className={styles.mobileNavLink} onClick={closeMobileMenu}>
              FAQ
            </Link>
          </nav>
          <div className={styles.mobileActions}>
            <Button variant="secondary" size="md" fullWidth onClick={handleLoginClick}>
              Iniciar sesión
            </Button>
            <Button variant="primary" size="md" fullWidth onClick={handleRegisterClick}>
              Registrarse
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
