'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { useServices } from '@/context/ServiceProvider';
import { validateCuit, formatCuit, cleanCuit } from '@/components/solicitar/cuitValidator';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './register.module.css';

export type RegisterRole = 'borrower' | 'investor';

export interface RegisterFormProps {
  supabaseClient?: SupabaseClient;
  defaultRole?: RegisterRole;
  onSuccess?: (userEmail: string, role: RegisterRole) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  supabaseClient,
  defaultRole = 'borrower',
  onSuccess,
}) => {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [role, setRole] = useState<RegisterRole>(defaultRole);

  // PyME / Borrower Form State
  const [companyName, setCompanyName] = useState('');
  const [cuit, setCuit] = useState('');
  const [representativeName, setRepresentativeName] = useState('');

  // Investor Form State
  const [fullName, setFullName] = useState('');
  const [taxId, setTaxId] = useState('');

  // Common Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI / Status State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const getClient = (): SupabaseClient => {
    return supabaseClient || createSupabaseBrowserClient();
  };

  const handleRoleChange = (newRole: RegisterRole) => {
    setRole(newRole);
    setErrors({});
    setServerError(null);
  };

  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCuit(e.target.value);
    setCuit(formatted);
    if (errors.cuit) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.cuit;
        return next;
      });
    }
  };

  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = cleanCuit(raw);
    if (cleaned.length > 8) {
      setTaxId(formatCuit(raw));
    } else {
      setTaxId(cleaned);
    }
    if (errors.taxId) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.taxId;
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Common Email Validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Ingrese un correo electrónico válido.';
    }

    // Common Password Validation (weak password protection)
    if (!password) {
      newErrors.password = 'La contraseña es obligatoria.';
    } else if (password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      newErrors.password = 'La contraseña debe incluir al menos una letra y un número.';
    }

    // SME Specific Validation
    if (role === 'borrower') {
      if (!companyName.trim()) {
        newErrors.companyName = 'La razón social o nombre de la empresa es obligatorio.';
      }

      if (!cuit.trim()) {
        newErrors.cuit = 'El CUIT es obligatorio.';
      } else if (!validateCuit(cuit)) {
        newErrors.cuit =
          'El CUIT ingresado no es válido según el algoritmo de verificación oficial (ARCA/AFIP).';
      }

      if (!representativeName.trim()) {
        newErrors.representativeName = 'El nombre del apoderado o representante es obligatorio.';
      }
    }

    // Investor Specific Validation
    if (role === 'investor') {
      if (!fullName.trim()) {
        newErrors.fullName = 'El nombre y apellido completo es obligatorio.';
      }

      const cleanId = cleanCuit(taxId);
      if (!cleanId) {
        newErrors.taxId = 'El DNI o CUIT es obligatorio.';
      } else if (cleanId.length < 7) {
        newErrors.taxId = 'Ingrese un DNI o CUIT válido (mínimo 7 dígitos).';
      } else if (cleanId.length === 11 && !validateCuit(cleanId)) {
        newErrors.taxId = 'El CUIT de 11 dígitos no es válido según el algoritmo oficial.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const client = getClient();
      const cleanEmail = email.trim().toLowerCase();
      const profileRole = role === 'borrower' ? 'borrower' : 'investor';
      const cleanTaxId = role === 'borrower' ? cleanCuit(cuit) : cleanCuit(taxId);
      const legalName = role === 'borrower' ? companyName.trim() : fullName.trim();
      const repName = role === 'borrower' ? representativeName.trim() : '';

      // 1. Supabase Auth Registration
      const { data, error: signUpError } = await client.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            role: profileRole,
            legal_name: legalName,
            tax_id: cleanTaxId,
            representative_name: repName,
          },
        },
      });

      if (signUpError) {
        const errorMsg = signUpError.message.toLowerCase();
        if (
          errorMsg.includes('already registered') ||
          errorMsg.includes('duplicate') ||
          errorMsg.includes('exists') ||
          (signUpError as any).status === 422
        ) {
          setServerError('Ya existe una cuenta registrada con este correo electrónico.');
        } else {
          setServerError(signUpError.message || 'Error al procesar el registro. Intente nuevamente.');
        }
        setIsLoading(false);
        return;
      }

      // 2. Persist profile record in profiles table
      if (data?.user) {
        try {
          const { error: profileError } = await client.from('profiles').upsert({
            id: data.user.id,
            role: profileRole,
            tax_id: cleanTaxId,
            legal_name: legalName,
            email: cleanEmail,
            first_name: role === 'borrower' ? representativeName.trim() : fullName.trim().split(' ')[0] || '',
            last_name: role === 'borrower' ? '' : fullName.trim().split(' ').slice(1).join(' ') || '',
            phone: '',
            bank_cbu_cvu: '0000000000000000000000',
            kyc_status: 'pending',
            notification_preferences: { email: true, sms: true, whatsapp: true },
          });

          if (profileError) {
            console.error('[RegisterForm] Error creating profile:', profileError.message || profileError);
          }
        } catch (err: any) {
          console.warn('[RegisterForm] Profile upsert exception:', err?.message || err);
        }
      }

      setRegisteredEmail(cleanEmail);
      setIsSuccess(true);

      // Trigger registration welcome email (graceful error handling)
      if (servicesFromContext?.email) {
        try {
          servicesFromContext.email
            .sendRegistrationEmail({
              to: cleanEmail,
              recipientName: legalName || cleanEmail,
              role,
            })
            .catch((err) => {
              console.warn('[RegisterForm] Registration email dispatch failed:', err?.message || err);
            });
        } catch (err: any) {
          console.warn('[RegisterForm] Registration email trigger exception:', err?.message || err);
        }
      }

      if (onSuccess) {
        onSuccess(cleanEmail, role);
      }
    } catch (err: any) {
      setServerError(err?.message || 'Ocurrió un error inesperado. Por favor, reintente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirmation / Email Verification Prompt State
  if (isSuccess) {
    return (
      <div className={styles.container}>
        <div className={styles.card} data-testid="registration-confirmation">
          <div className={styles.confirmationContainer}>
            <div className={styles.confirmationIcon} aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className={styles.confirmationTitle}>¡Verificá tu correo electrónico!</h2>
            <p className={styles.confirmationText}>
              Hemos enviado un enlace de confirmación a{' '}
              <span className={styles.emailHighlight}>{registeredEmail}</span>.
              <br />
              Hacé clic en el enlace del correo para activar tu cuenta de{' '}
              {role === 'borrower' ? 'empresa (PyME)' : 'inversor'} y comenzar a operar en Lencord.
            </p>
            <Link href="/login">
              <Button variant="primary" size="lg" fullWidth>
                Ir a iniciar sesión
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Crear cuenta en Lencord</h1>
          <p className={styles.subtitle}>
            Financiamiento colectivo transparente y seguro para el desarrollo productivo argentino.
          </p>
        </div>

        {/* Dual-Tab Role Selector */}
        <div
          className={styles.roleSelector}
          role="tablist"
          aria-label="Selección de tipo de cuenta"
        >
          <button
            type="button"
            role="tab"
            aria-selected={role === 'borrower'}
            className={`${styles.roleTab} ${role === 'borrower' ? styles.roleTabActive : ''}`}
            onClick={() => handleRoleChange('borrower')}
            data-testid="role-tab-sme"
          >
            <span className={styles.roleTabTitle}>Soy Empresa (PyME)</span>
            <span className={styles.roleTabDesc}>Solicitar crédito productivo</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'investor'}
            className={`${styles.roleTab} ${role === 'investor' ? styles.roleTabActive : ''}`}
            onClick={() => handleRoleChange('investor')}
            data-testid="role-tab-investor"
          >
            <span className={styles.roleTabTitle}>Soy Inversor</span>
            <span className={styles.roleTabDesc}>Invertir y obtener rentabilidad</span>
          </button>
        </div>

        {/* Global Server Error Alert */}
        {serverError && (
          <div className={`${styles.alert} ${styles.alertError}`} role="alert" data-testid="server-error-alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {/* SME Form Fields */}
          {role === 'borrower' && (
            <>
              <div className={styles.formGroup}>
                <Input
                  label="Razón social de la empresa"
                  name="companyName"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (errors.companyName) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.companyName;
                        return next;
                      });
                    }
                  }}
                  placeholder="Ej: Acero del Sur S.R.L."
                  error={errors.companyName}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <Input
                  label="CUIT de la empresa (ARCA / AFIP)"
                  name="cuit"
                  value={cuit}
                  onChange={handleCuitChange}
                  placeholder="30-12345678-9"
                  error={errors.cuit}
                  helperText="11 dígitos con dígito verificador oficial"
                  className="font-mono"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <Input
                  label="Nombre y apellido del apoderado / representante"
                  name="representativeName"
                  value={representativeName}
                  onChange={(e) => {
                    setRepresentativeName(e.target.value);
                    if (errors.representativeName) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.representativeName;
                        return next;
                      });
                    }
                  }}
                  placeholder="Ej: Laura Gómez"
                  error={errors.representativeName}
                  required
                />
              </div>
            </>
          )}

          {/* Investor Form Fields */}
          {role === 'investor' && (
            <>
              <div className={styles.formGroup}>
                <Input
                  label="Nombre y apellido completo"
                  name="fullName"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.fullName;
                        return next;
                      });
                    }
                  }}
                  placeholder="Ej: Martín Pérez"
                  error={errors.fullName}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <Input
                  label="DNI o CUIT tributario"
                  name="taxId"
                  value={taxId}
                  onChange={handleTaxIdChange}
                  placeholder="Ej: 32456789 o 20-32456789-4"
                  error={errors.taxId}
                  helperText="DNI (7-8 dígitos) o CUIT (11 dígitos)"
                  className="font-mono"
                  required
                />
              </div>
            </>
          )}

          {/* Common Email Field */}
          <div className={styles.formGroup}>
            <Input
              label={role === 'borrower' ? 'Correo electrónico corporativo' : 'Correo electrónico'}
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

          {/* Common Password Field */}
          <div className={styles.formGroup}>
            <Input
              label="Contraseña"
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
              placeholder="Mínimo 8 caracteres (letras y números)"
              error={errors.password}
              helperText="Debe contener al menos 8 caracteres, incluyendo letras y números."
              autoComplete="new-password"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            className={styles.submitBtn}
            data-testid="submit-register-btn"
          >
            {role === 'borrower' ? 'Registrar mi empresa' : 'Crear cuenta de inversor'}
          </Button>
        </form>

        <div className={styles.loginPrompt}>
          ¿Ya tenés una cuenta?
          <Link href="/login" className={styles.loginLink}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
};
