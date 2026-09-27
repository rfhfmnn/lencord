'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './login.module.css';

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
  onSuccess?: (destination: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  supabaseClient,
  redirectUrl,
  onSuccess,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Password Recovery State
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);

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

  const determineRedirectDestination = async (
    client: SupabaseClient,
    userId?: string,
    userRole?: string
  ): Promise<string> => {
    // 1. If sanitized redirect query parameter is valid, prioritize it
    const sanitized = sanitizeRedirectUrl(queryRedirect);
    if (sanitized) {
      return sanitized;
    }

    // 2. Fetch role from user or profiles table to route to appropriate dashboard
    let role = userRole;

    if (!role && userId) {
      try {
        const { data: profile } = await client
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (profile?.role) {
          role = profile.role;
        }
      } catch {
        // Fall back to default
      }
    }

    if (role === 'borrower' || role === 'sme') {
      return '/dashboard/pyme';
    }

    if (role === 'admin') {
      return '/admin';
    }

    // Default for investors or unassigned accounts
    return '/dashboard/inversor';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

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
      const userRole = user?.user_metadata?.role;
      const destination = await determineRedirectDestination(client, user?.id, userRole);

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

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
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
