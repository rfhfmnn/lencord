'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { LoginRole } from '@/types';
import styles from './login.module.css';

export type { LoginRole };

/**
 * Sanitizes return URLs to protect against Open Redirect vulnerabilities.
 * Destination must be an absolute path starting with a single '/' and cannot
 * begin with '//', '/\\', or contain external schemes/protocols.
 */
export function sanitizeRedirectUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Must begin with a single slash and not double slashes or backslashes
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }

  // Reject schemes like javascript:, data:, https:, or carriage returns
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || /[\r\n\t]/.test(trimmed)) {
    return null;
  }

  // Reject paths containing backslashes which browsers could treat as domain delimiters
  if (trimmed.includes('\\')) {
    return null;
  }

  return trimmed;
}

export interface LoginFormProps {
  supabaseClient?: SupabaseClient;
  redirectUrl?: string | null;
  defaultRole?: LoginRole;
  onSuccess?: (destination: string) => void;
}

interface MissingRoleInfo {
  missingRole: LoginRole;
  userId: string;
  roles: string[];
}

export const LoginForm: React.FC<LoginFormProps> = ({
  supabaseClient,
  redirectUrl,
  defaultRole,
  onSuccess,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine role from query param or defaultRole prop
  const queryParamRole = searchParams?.get('role')?.toLowerCase();
  const initialRole: LoginRole = defaultRole
    ? defaultRole
    : queryParamRole === 'borrower' || queryParamRole === 'pyme' || queryParamRole === 'sme'
    ? 'borrower'
    : 'investor';

  const [selectedRole, setSelectedRole] = useState<LoginRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Missing role activation state (Issue #54)
  const [missingRoleInfo, setMissingRoleInfo] = useState<MissingRoleInfo | null>(null);
  const [isActivatingProfile, setIsActivatingProfile] = useState(false);

  // Password Recovery State
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);

  useEffect(() => {
    if (defaultRole) {
      setSelectedRole(defaultRole);
    }
  }, [defaultRole]);

  const getClient = (): SupabaseClient => {
    return supabaseClient || createSupabaseBrowserClient();
  };

  // Determine query param redirect if not passed as prop
  const queryRedirect = redirectUrl !== undefined ? redirectUrl : searchParams?.get('redirect');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Ingrese un correo electrónico válido.';
    }

    if (!password) {
      newErrors.password = 'La contraseña es obligatoria.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const determineRedirectDestination = (
    targetRole: LoginRole,
    isAdminUser: boolean = false
  ): string => {
    // 1. If sanitized redirect query parameter is valid, prioritize it
    const sanitized = sanitizeRedirectUrl(queryRedirect);
    if (sanitized) {
      return sanitized;
    }

    // 2. Admin dashboard
    if (isAdminUser) {
      return '/admin';
    }

    // 3. Role-specific dashboard
    if (targetRole === 'borrower') {
      return '/dashboard/pyme';
    }

    return '/dashboard/inversor';
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, currentTab: LoginRole) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nextTab: LoginRole = currentTab === 'borrower' ? 'investor' : 'borrower';
      setSelectedRole(nextTab);
      setMissingRoleInfo(null);
      const nextElem = document.getElementById(nextTab === 'borrower' ? 'tab-pyme' : 'tab-investor');
      nextElem?.focus();
    }
  };

  const handleActivateProfile = async () => {
    if (!missingRoleInfo) return;
    setIsActivatingProfile(true);
    setAuthError(null);

    try {
      const client = getClient();
      const targetRole = missingRoleInfo.missingRole;
      const updatedRoles = Array.from(new Set([...missingRoleInfo.roles, targetRole]));

      if (client.auth.updateUser) {
        await client.auth.updateUser({
          data: {
            roles: updatedRoles,
            role: targetRole,
            active_role: targetRole,
          },
        });
      }

      try {
        if (client.from) {
          await client.from('profiles').update({ role: targetRole }).eq('id', missingRoleInfo.userId);
        }
      } catch {
        // Best effort profile update
      }

      const destination = determineRedirectDestination(targetRole, false);
      setMissingRoleInfo(null);

      if (onSuccess) {
        onSuccess(destination);
      } else {
        router.push(destination);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Error al activar el nuevo perfil.');
    } finally {
      setIsActivatingProfile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setMissingRoleInfo(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const client = getClient();
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed')) {
          setAuthError(
            'Tu correo electrónico no ha sido verificado. Por favor, revisá tu casilla de correo para confirmar tu cuenta.'
          );
        } else if (
          msg.includes('invalid login credentials') ||
          msg.includes('invalid credentials') ||
          (error as any).status === 400
        ) {
          setAuthError('Credenciales incorrectas. Verificá tu correo electrónico y contraseña.');
        } else {
          setAuthError(error.message || 'Error al iniciar sesión. Por favor, verifique sus datos.');
        }
        setIsLoading(false);
        return;
      }

      const user = data?.user;
      if (!user) {
        setAuthError('Error al iniciar sesión. No se pudo obtener la información de usuario.');
        setIsLoading(false);
        return;
      }

      // Collect user roles from metadata
      const collectedRoles: string[] = [];
      if (Array.isArray(user.user_metadata?.roles)) {
        collectedRoles.push(...user.user_metadata.roles);
      }
      if (user.user_metadata?.role && !collectedRoles.includes(user.user_metadata.role)) {
        collectedRoles.push(user.user_metadata.role);
      }

      // Check profiles table if needed
      try {
        if (client.from) {
          const { data: profile } = await client
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.role && !collectedRoles.includes(profile.role)) {
            collectedRoles.push(profile.role);
          }
        }
      } catch {
        // Ignored
      }

      const isAdminUser = collectedRoles.includes('admin');

      // Check if user possesses the selected role
      const hasSelectedRole =
        isAdminUser ||
        (selectedRole === 'borrower'
          ? collectedRoles.includes('borrower') || collectedRoles.includes('sme')
          : collectedRoles.includes('investor'));

      if (!hasSelectedRole && collectedRoles.length > 0) {
        // Authenticated successfully, but missing the requested profile
        setMissingRoleInfo({
          missingRole: selectedRole,
          userId: user.id,
          roles: collectedRoles,
        });
        setIsLoading(false);
        return;
      }

      // Establish active session role in user metadata
      try {
        if (client.auth.updateUser) {
          await client.auth.updateUser({
            data: {
              active_role: selectedRole,
              role: selectedRole,
            },
          });
        }
      } catch {
        // Best effort
      }

      const destination = determineRedirectDestination(selectedRole, isAdminUser);

      if (onSuccess) {
        onSuccess(destination);
      } else {
        router.push(destination);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Ocurrió un error inesperado al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryMessage(null);

    const targetEmail = (recoveryEmail || email).trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setRecoveryMessage({
        type: 'error',
        text: 'Por favor, ingrese un correo electrónico válido para recuperar su contraseña.',
      });
      return;
    }

    setIsRecoveryLoading(true);

    try {
      const client = getClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lencord.com.ar';
      const { error } = await client.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${origin}/login?recovery=true`,
      });

      if (error) {
        setRecoveryMessage({
          type: 'error',
          text: error.message || 'No pudimos enviar el correo de recuperación. Reintente más tarde.',
        });
      } else {
        setRecoveryMessage({
          type: 'success',
          text: `Te enviamos un enlace de recuperación a ${targetEmail}. Revisá tu casilla de correo.`,
        });
      }
    } catch (err: any) {
      setRecoveryMessage({
        type: 'error',
        text: err?.message || 'Error inesperado al solicitar el restablecimiento.',
      });
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Iniciar sesión</h1>
          <p className={styles.subtitle}>
            Ingresá a tu cuenta de Lencord para gestionar tus créditos o inversiones.
          </p>
        </div>

        {/* Role Selector Tabs (Issue #54) */}
        <div
          className={styles.roleSelector}
          role="tablist"
          aria-label="Seleccionar tipo de cuenta para ingresar"
        >
          <button
            type="button"
            role="tab"
            id="tab-pyme"
            aria-selected={selectedRole === 'borrower'}
            aria-controls="login-form"
            tabIndex={selectedRole === 'borrower' ? 0 : -1}
            className={`${styles.roleTab} ${selectedRole === 'borrower' ? styles.roleTabActive : ''}`}
            onClick={() => {
              setSelectedRole('borrower');
              setMissingRoleInfo(null);
            }}
            onKeyDown={(e) => handleTabKeyDown(e, 'borrower')}
            data-testid="tab-login-pyme"
          >
            <span className={styles.roleTabTitle}>Ingresar como PyME</span>
            <span className={styles.roleTabDesc}>Gestioná tus créditos</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-investor"
            aria-selected={selectedRole === 'investor'}
            aria-controls="login-form"
            tabIndex={selectedRole === 'investor' ? 0 : -1}
            className={`${styles.roleTab} ${selectedRole === 'investor' ? styles.roleTabActive : ''}`}
            onClick={() => {
              setSelectedRole('investor');
              setMissingRoleInfo(null);
            }}
            onKeyDown={(e) => handleTabKeyDown(e, 'investor')}
            data-testid="tab-login-investor"
          >
            <span className={styles.roleTabTitle}>Ingresar como Inversor</span>
            <span className={styles.roleTabDesc}>Gestioná tus inversiones</span>
          </button>
        </div>

        {/* Missing Role Warning & Activation Action (Issue #54) */}
        {missingRoleInfo && (
          <div
            className={styles.missingRoleBox}
            role="alert"
            data-testid="missing-role-alert"
          >
            <p className={styles.missingRoleText}>
              {missingRoleInfo.missingRole === 'borrower'
                ? 'Tu cuenta no posee un perfil PyME activo.'
                : 'Tu cuenta no posee un perfil Inversor activo.'}
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isActivatingProfile}
              onClick={handleActivateProfile}
              data-testid="activate-profile-btn"
            >
              {missingRoleInfo.missingRole === 'borrower'
                ? 'Activar perfil de empresa'
                : 'Activar perfil de inversor'}
            </Button>
          </div>
        )}

        {/* Auth Error Alert */}
        {authError && (
          <div className={`${styles.alert} ${styles.alertError}`} role="alert" data-testid="auth-error-alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{authError}</span>
          </div>
        )}

        <form id="login-form" onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.formGroup}>
            <Input
              label="Correo electrónico"
              type="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
              placeholder="nombre@ejemplo.com"
              error={errors.email}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.passwordLabelRow}>
              <label htmlFor="login-password" className={styles.label}>
                Contraseña
              </label>
              <button
                type="button"
                className={styles.forgotPasswordLink}
                onClick={() => {
                  setShowRecovery((prev) => !prev);
                  setRecoveryMessage(null);
                  if (!recoveryEmail && email) {
                    setRecoveryEmail(email);
                  }
                }}
                data-testid="forgot-password-link"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <Input
              id="login-password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.password;
                    return next;
                  });
                }
              }}
              placeholder="Ingresá tu contraseña"
              error={errors.password}
              autoComplete="current-password"
              required
            />
          </div>

          {/* Password Recovery Panel */}
          {showRecovery && (
            <div className={styles.recoveryBox} data-testid="password-recovery-panel">
              <h3 className={styles.recoveryTitle}>Recuperar contraseña</h3>
              <p className={styles.recoveryDesc}>
                Ingresá tu correo electrónico registrado y te enviaremos las instrucciones para restablecer tu contraseña.
              </p>

              {recoveryMessage && (
                <div
                  className={`${styles.alert} ${
                    recoveryMessage.type === 'success' ? styles.alertSuccess : styles.alertError
                  }`}
                  role="alert"
                >
                  <span>{recoveryMessage.text}</span>
                </div>
              )}

              <Input
                label="Correo de recuperación"
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="nombre@ejemplo.com"
              />

              <div className={styles.recoveryActions}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRecovery(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isRecoveryLoading}
                  onClick={handlePasswordRecovery}
                  data-testid="submit-recovery-btn"
                >
                  Enviar enlace
                </Button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            className={styles.submitBtn}
            data-testid="submit-login-btn"
          >
            Iniciar sesión
          </Button>
        </form>

        <div className={styles.registerPrompt}>
          ¿No tenés una cuenta en Lencord?
          <Link href="/registro" className={styles.registerLink}>
            Registrate gratis
          </Link>
        </div>
      </div>
    </div>
  );
};
