'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { NotificationBell } from '@/components/NotificationBell';
import { defaultMockStateStore } from '@/services/mock/mockState';
import styles from './header.module.css';

export interface HeaderUser {
  id?: string;
  email?: string;
  name?: string;
  role: 'investor' | 'sme' | 'borrower' | 'admin';
  custodyBalance?: number;
  availableRoles?: ('investor' | 'sme' | 'borrower')[];
  legalName?: string;
  pymeCompanyName?: string;
  investorLegalName?: string;
}

export interface HeaderProps {
  className?: string;
  supabaseClient?: SupabaseClient;
  user?: HeaderUser | null;
  isLoading?: boolean;
  onLogin?: () => void;
  onRegister?: () => void;
  onLogout?: () => void;
  onRoleSwitch?: (newRole: 'borrower' | 'investor') => void;
}

export const Header: React.FC<HeaderProps> = ({
  className = '',
  supabaseClient,
  user: userProp,
  isLoading: isLoadingProp,
  onLogin,
  onRegister,
  onLogout,
  onRoleSwitch,
}) => {
  let router: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<HeaderUser | null>(userProp ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(
    userProp !== undefined ? (isLoadingProp ?? false) : true
  );

  useEffect(() => {
    if (userProp !== undefined) {
      if (userProp) {
        let activeName = userProp.name || userProp.legalName || 'Usuario';
        if (userProp.role === 'investor' && userProp.investorLegalName) {
          activeName = userProp.investorLegalName;
        } else if ((userProp.role === 'borrower' || userProp.role === 'sme') && userProp.pymeCompanyName) {
          activeName = userProp.pymeCompanyName;
        }
        setCurrentUser({
          ...userProp,
          name: activeName,
        });
      } else {
        setCurrentUser(null);
      }
    }
  }, [userProp]);

  useEffect(() => {
    if (isLoadingProp !== undefined) {
      setIsLoading(isLoadingProp);
    }
  }, [isLoadingProp]);

  useEffect(() => {
    if (userProp !== undefined) {
      return;
    }

    let isMounted = true;
    const client = supabaseClient || createSupabaseBrowserClient();

    async function resolveSession() {
      try {
        const { data: sessionData } = await client.auth.getSession();
        const authUser = sessionData?.session?.user;

        if (!authUser) {
          if (isMounted) {
            setCurrentUser(null);
            setIsLoading(false);
          }
          return;
        }

        let role: 'investor' | 'sme' | 'borrower' | 'admin' =
          (authUser.user_metadata?.role as any) || 'borrower';

        const availableRoles: ('investor' | 'sme' | 'borrower')[] = [];
        if (Array.isArray(authUser.user_metadata?.roles)) {
          availableRoles.push(...authUser.user_metadata.roles);
        }
        if (authUser.user_metadata?.role && !availableRoles.includes(authUser.user_metadata.role)) {
          availableRoles.push(authUser.user_metadata.role);
        }

        let profileData: any = null;
        try {
          const { data: profile } = await client
            .from('profiles')
            .select('id, role, legal_name, email')
            .eq('id', authUser.id)
            .maybeSingle();

          if (profile) {
            profileData = profile;
            if (profile.role) {
              if (profile.role === 'admin' || authUser.user_metadata?.role === 'admin') {
                role = 'admin';
                if (!availableRoles.includes('admin')) {
                  availableRoles.push('admin');
                }
              } else {
                const activeRole = authUser.user_metadata?.active_role || profile.role;
                role = activeRole as any;
                if (!availableRoles.includes(profile.role as any)) {
                  availableRoles.push(profile.role as any);
                }
              }
            }
          }
        } catch {
          // Keep metadata fallbacks
        }

        const mockProf = defaultMockStateStore.profiles.find((p) => p.id === authUser.id);

        const pymeCompanyName: string | undefined =
          authUser.user_metadata?.pyme_company_name ||
          authUser.user_metadata?.company_name ||
          profileData?.pyme_company_name ||
          (mockProf as any)?.pyme_company_name;

        const investorLegalName: string | undefined =
          authUser.user_metadata?.investor_legal_name ||
          authUser.user_metadata?.investor_name ||
          profileData?.investor_legal_name ||
          (mockProf as any)?.investor_legal_name;

        const fallbackLegalName: string =
          profileData?.legal_name ||
          mockProf?.legal_name ||
          authUser.user_metadata?.legal_name ||
          authUser.user_metadata?.name ||
          authUser.user_metadata?.full_name ||
          authUser.email?.split('@')[0] ||
          'Usuario';

        let activeName = fallbackLegalName;
        if (role === 'investor') {
          activeName = investorLegalName || fallbackLegalName;
        } else if (role === 'borrower' || role === 'sme') {
          activeName = pymeCompanyName || fallbackLegalName;
        }

        if (isMounted) {
          setCurrentUser({
            id: authUser.id,
            email: authUser.email,
            name: activeName,
            role,
            availableRoles: availableRoles.length > 0 ? availableRoles : [role as any],
            custodyBalance: role === 'investor' ? 1250000 : undefined,
            legalName: fallbackLegalName,
            pymeCompanyName,
            investorLegalName,
          });
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
          setIsLoading(false);
        }
      }
    }

    resolveSession();

    const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (isMounted) {
          setCurrentUser(null);
          setIsLoading(false);
        }
      } else if (session?.user) {
        resolveSession();
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [userProp, supabaseClient]);

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

  const handleLogout = async () => {
    closeMobileMenu();
    try {
      const client = supabaseClient || createSupabaseBrowserClient();
      await client.auth.signOut();
    } catch {
      // Ignored
    } finally {
      setCurrentUser(null);
      if (onLogout) onLogout();
    }
  };

  const isBorrower = currentUser?.role === 'borrower' || currentUser?.role === 'sme';
  const isInvestor = currentUser?.role === 'investor';
  const isAdmin = currentUser?.role === 'admin';

  const showSolicitudes = isAdmin;
  const showPrestar = !isAdmin && (isLoading || !currentUser || isInvestor);
  const showPedir = !isAdmin && (isLoading || !currentUser || isBorrower);
  const showInformational = !isAdmin;

  const hasDualRoles = !isAdmin && Boolean(
    currentUser?.availableRoles &&
    currentUser.availableRoles.includes('investor') &&
    (currentUser.availableRoles.includes('borrower') || currentUser.availableRoles.includes('sme'))
  );

  const handleRoleSwitch = async (targetRole: 'borrower' | 'investor') => {
    if (!currentUser) return;
    try {
      const client = supabaseClient || createSupabaseBrowserClient();
      await client.auth.updateUser({
        data: {
          active_role: targetRole,
          role: targetRole,
        },
      });
    } catch {
      // Ignored
    }

    let nextName = currentUser.name || currentUser.legalName || 'Usuario';
    if (targetRole === 'investor') {
      nextName = currentUser.investorLegalName || currentUser.legalName || currentUser.name || 'Inversor';
    } else if (targetRole === 'borrower') {
      nextName = currentUser.pymeCompanyName || currentUser.legalName || currentUser.name || 'PyME';
    }

    setCurrentUser({
      ...currentUser,
      role: targetRole,
      name: nextName,
    });
    if (onRoleSwitch) {
      onRoleSwitch(targetRole);
    }
    const targetDashboard = targetRole === 'borrower' ? '/dashboard/pyme' : '/dashboard/inversor';
    if (router?.push) {
      router.push(targetDashboard);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetDashboard;
    }
  };

  const roleBadgeText = isAdmin ? 'Admin' : isBorrower ? 'PyME' : isInvestor ? 'Inversor' : 'Admin';
  const roleBadgeClass = isAdmin
    ? styles.roleBadgeAdmin
    : isBorrower
      ? styles.roleBadgePyme
      : styles.roleBadgeInvestor;

  const dashboardHref = isBorrower
    ? '/dashboard/pyme'
    : isInvestor
      ? '/dashboard/inversor'
      : '/admin';

  return (
    <header className={`${styles.header} ${className}`.trim()} data-testid="sticky-header">
      <div className={styles.container}>
        <Link href="/" className={styles.brand} onClick={closeMobileMenu} aria-label="Lencord inicio">
          <span className={styles.brandName}>Lencord</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className={styles.desktopNav} aria-label="Navegación principal">
          {showSolicitudes && (
            <Link href="/admin" className={styles.navLink} data-testid="header-solicitudes-link">
              Solicitudes
            </Link>
          )}
          {showPrestar && (
            <Link href="/marketplace" className={styles.navLink}>
              Prestar
            </Link>
          )}
          {showPedir && (
            <Link href="/solicitar" className={styles.navLink}>
              Pedir financiación
            </Link>
          )}
          {showInformational && (
            <>
              <Link href="/#como-funciona" className={styles.navLink}>
                Cómo funciona
              </Link>
              <Link href="/faq" className={styles.navLink}>
                FAQ
              </Link>
            </>
          )}
        </nav>

        {/* Desktop Session / Auth Action Area */}
        <div className={styles.desktopActions} data-testid="header-desktop-actions">
          {isLoading ? (
            <div
              className={styles.authSkeleton}
              data-testid="header-auth-skeleton"
              aria-label="Cargando sesión..."
              aria-busy="true"
            />
          ) : currentUser ? (
            <div className={styles.sessionArea} data-testid="header-session-user">
              {/* Custody Balance (Investors only) */}
              {isInvestor && (
                <div
                  className={styles.custodyBalance}
                  data-testid="header-custody-balance"
                  title="Saldo en cuenta de custodia"
                >
                  <span className={styles.custodyLabel}>Custodia:</span>
                  <span className={styles.custodyValue}>
                    {formatCurrency(currentUser.custodyBalance ?? 1250000)}
                  </span>
                </div>
              )}

              {/* In-App Notifications Bell */}
              <NotificationBell
                userId={currentUser.id}
                supabaseClient={supabaseClient}
              />

              {/* User Identity & Role Badge */}
              <div className={styles.userProfile}>
                <span className={styles.userName} data-testid="header-user-name" title={currentUser.name}>
                  {currentUser.name}
                </span>
                <span
                  className={`${styles.roleBadge} ${roleBadgeClass}`}
                  data-testid="header-role-badge"
                >
                  {roleBadgeText}
                </span>
              </div>

              {/* Role-Specific Navigation Link */}
              {isAdmin ? (
                <Link
                  href="/admin"
                  className={styles.adminLink}
                  data-testid="header-admin-link"
                >
                  Administración
                </Link>
              ) : (
                <Link
                  href={dashboardHref}
                  className={styles.dashboardLink}
                  data-testid="header-dashboard-link"
                >
                  Mi panel
                </Link>
              )}

              {/* Role Switcher (Unified Account) */}
              {hasDualRoles && (
                <Button
                  variant="bordered"
                  size="sm"
                  onClick={() => handleRoleSwitch(isBorrower ? 'investor' : 'borrower')}
                  className={styles.roleSwitchButton}
                  data-testid="header-role-switcher"
                >
                  {isBorrower ? 'Cambiar a modo Inversor' : 'Cambiar a modo PyME'}
                </Button>
              )}

              {/* Logout Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className={styles.logoutButton}
                data-testid="header-logout-button"
              >
                Cerrar sesión
              </Button>
            </div>
          ) : (
            <div className={styles.unauthActions}>
              <Link
                href="/login"
                className={styles.loginLink}
                onClick={handleLoginClick}
                data-testid="header-login-link"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className={styles.registerLink}
                onClick={handleRegisterClick}
                data-testid="header-register-link"
              >
                Registrarse
              </Link>
            </div>
          )}
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
            {showSolicitudes && (
              <Link href="/admin" className={styles.mobileNavLink} onClick={closeMobileMenu} data-testid="mobile-solicitudes-link">
                Solicitudes
              </Link>
            )}
            {showPrestar && (
              <Link href="/marketplace" className={styles.mobileNavLink} onClick={closeMobileMenu}>
                Prestar
              </Link>
            )}
            {showPedir && (
              <Link href="/solicitar" className={styles.mobileNavLink} onClick={closeMobileMenu}>
                Pedir financiación
              </Link>
            )}
            {showInformational && (
              <>
                <Link href="/#como-funciona" className={styles.mobileNavLink} onClick={closeMobileMenu}>
                  Cómo funciona
                </Link>
                <Link href="/faq" className={styles.mobileNavLink} onClick={closeMobileMenu}>
                  FAQ
                </Link>
              </>
            )}
          </nav>

          <div className={styles.mobileActions} data-testid="mobile-actions-container">
            {isLoading ? (
              <div
                className={styles.authSkeletonMobile}
                data-testid="header-auth-skeleton-mobile"
                aria-label="Cargando sesión..."
                aria-busy="true"
              />
            ) : currentUser ? (
              <div className={styles.mobileSessionArea} data-testid="header-mobile-session-user">
                <div className={styles.mobileUserHeader}>
                  <div className={styles.userProfile}>
                    <span className={styles.userName} title={currentUser.name}>
                      {currentUser.name}
                    </span>
                    <span className={`${styles.roleBadge} ${roleBadgeClass}`}>
                      {roleBadgeText}
                    </span>
                  </div>

                  {isInvestor && (
                    <div className={styles.custodyBalance} data-testid="header-mobile-custody-balance">
                      <span className={styles.custodyLabel}>Custodia:</span>
                      <span className={styles.custodyValue}>
                        {formatCurrency(currentUser.custodyBalance ?? 1250000)}
                      </span>
                    </div>
                  )}
                </div>

                {isAdmin ? (
                  <Link
                    href="/admin"
                    className={styles.mobileDashboardLink}
                    onClick={closeMobileMenu}
                    data-testid="mobile-admin-link"
                  >
                    Administración
                  </Link>
                ) : (
                  <Link
                    href={dashboardHref}
                    className={styles.mobileDashboardLink}
                    onClick={closeMobileMenu}
                    data-testid="mobile-dashboard-link"
                  >
                    Mi panel
                  </Link>
                )}

                {hasDualRoles && (
                  <Button
                    variant="bordered"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      closeMobileMenu();
                      handleRoleSwitch(isBorrower ? 'investor' : 'borrower');
                    }}
                    className={styles.roleSwitchButton}
                    data-testid="mobile-role-switcher"
                  >
                    {isBorrower ? 'Cambiar a modo Inversor' : 'Cambiar a modo PyME'}
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handleLogout}
                  data-testid="mobile-logout-button"
                >
                  Cerrar sesión
                </Button>
              </div>
            ) : (
              <div className={styles.mobileUnauthActions}>
                <Link
                  href="/login"
                  className={styles.mobileLoginLink}
                  onClick={handleLoginClick}
                  data-testid="mobile-login-link"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  className={styles.mobileRegisterLink}
                  onClick={handleRegisterClick}
                  data-testid="mobile-register-link"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

