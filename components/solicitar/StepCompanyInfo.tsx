'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCuit, validateCuit } from './cuitValidator';
import styles from './solicitar.module.css';

export type CompanyType = 'SAS' | 'SA' | 'SRL' | 'Monotributo' | 'Responsable Inscripto';

export interface Step1FormData {
  legal_name: string;
  tax_id: string; // formatted XX-XXXXXXXX-X
  company_type: CompanyType;
  start_date: string;
  rep_first_name?: string;
  rep_last_name?: string;
  rep_name: string;
  rep_dni: string;
  rep_phone: string;
  email?: string;
}

export interface StepCompanyInfoProps {
  initialData?: Partial<Step1FormData>;
  isPrepopulated?: boolean;
  onContinue: (data: Step1FormData) => void;
}

export function StepCompanyInfo({
  initialData,
  isPrepopulated = false,
  onContinue,
}: StepCompanyInfoProps) {
  const initialFirstName =
    initialData?.rep_first_name ??
    (initialData?.rep_name ? initialData.rep_name.trim().split(' ')[0] : '');
  const initialLastName =
    initialData?.rep_last_name ??
    (initialData?.rep_name ? initialData.rep_name.trim().split(' ').slice(1).join(' ') : '');

  const [formData, setFormData] = useState<Step1FormData>({
    legal_name: initialData?.legal_name ?? '',
    tax_id: initialData?.tax_id ?? '',
    company_type: (initialData?.company_type as CompanyType) ?? 'SRL',
    start_date: initialData?.start_date ?? '',
    rep_first_name: initialFirstName,
    rep_last_name: initialLastName,
    rep_name: initialData?.rep_name ?? `${initialFirstName} ${initialLastName}`.trim(),
    rep_dni: initialData?.rep_dni ?? '',
    rep_phone: initialData?.rep_phone ?? '',
    email: initialData?.email ?? '',
  });

  useEffect(() => {
    if (initialData) {
      const fName =
        initialData.rep_first_name ??
        (initialData.rep_name ? initialData.rep_name.trim().split(' ')[0] : '');
      const lName =
        initialData.rep_last_name ??
        (initialData.rep_name ? initialData.rep_name.trim().split(' ').slice(1).join(' ') : '');

      setFormData((prev) => ({
        ...prev,
        legal_name: initialData.legal_name ?? prev.legal_name,
        tax_id: initialData.tax_id ?? prev.tax_id,
        company_type: (initialData.company_type as CompanyType) ?? prev.company_type,
        start_date: initialData.start_date ?? prev.start_date,
        rep_first_name: fName || prev.rep_first_name,
        rep_last_name: lName || prev.rep_last_name,
        rep_name: initialData.rep_name ?? prev.rep_name ?? `${fName} ${lName}`.trim(),
        rep_dni: initialData.rep_dni ?? prev.rep_dni,
        rep_phone: initialData.rep_phone ?? prev.rep_phone,
        email: initialData.email ?? prev.email,
      }));
    }
  }, [initialData]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatCuit(raw);
    setFormData((prev) => ({ ...prev, tax_id: formatted }));

    if (errors.tax_id) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.tax_id;
        return copy;
      });
    }
  };

  const handleFieldChange = (field: keyof Step1FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.legal_name.trim()) {
      newErrors.legal_name = 'Ingresá la razón social o nombre de fantasía de la empresa.';
    }

    if (!formData.tax_id.trim()) {
      newErrors.tax_id = 'Ingresá el número de CUIT.';
    } else if (!validateCuit(formData.tax_id)) {
      newErrors.tax_id = 'El CUIT ingresado no es válido (verificá los 11 dígitos y el dígito verificador).';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Seleccioná la fecha de inicio de actividades.';
    }

    const effectiveFirstName = formData.rep_first_name?.trim() || '';
    const effectiveLastName = formData.rep_last_name?.trim() || '';
    const effectiveRepName = formData.rep_name?.trim() || '';

    if (!effectiveFirstName && !effectiveRepName) {
      newErrors.rep_first_name = 'Ingresá el nombre del apoderado o titular.';
    }

    if (!effectiveLastName && !effectiveRepName) {
      newErrors.rep_last_name = 'Ingresá el apellido del apoderado o titular.';
    }

    if (!effectiveRepName && (!effectiveFirstName || !effectiveLastName)) {
      newErrors.rep_name = 'Ingresá el nombre completo del apoderado o titular.';
    }

    const cleanedDni = formData.rep_dni.replace(/\D/g, '');
    if (!cleanedDni) {
      newErrors.rep_dni = 'Ingresá el DNI del apoderado.';
    } else if (cleanedDni.length < 7 || cleanedDni.length > 8) {
      newErrors.rep_dni = 'El DNI debe tener 7 u 8 dígitos.';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ingresá un correo electrónico válido.';
    }

    if (!formData.rep_phone.trim()) {
      newErrors.rep_phone = 'Ingresá un número de teléfono celular de contacto.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const combinedRepName = (
        formData.rep_name.trim() ||
        `${formData.rep_first_name || ''} ${formData.rep_last_name || ''}`.trim()
      );
      const fName = formData.rep_first_name?.trim() || combinedRepName.split(' ')[0] || '';
      const lName = formData.rep_last_name?.trim() || combinedRepName.split(' ').slice(1).join(' ') || '';

      const payload: Step1FormData = {
        ...formData,
        rep_name: combinedRepName,
        rep_first_name: fName,
        rep_last_name: lName,
      };
      if (!payload.email) {
        delete (payload as any).email;
      }
      onContinue(payload);
    }
  };

  const isVerifiedAccount = isPrepopulated && Boolean(formData.legal_name || formData.tax_id);

  return (
    <form onSubmit={handleSubmit} data-testid="step1-company-form">
      <div className={styles.formCard}>
        <h2 className={styles.stepTitle}>Datos de la empresa y contacto</h2>
        <p className={styles.stepDescription}>
          Ingresá la información societaria e impositiva de tu PyME para la evaluación inicial.
        </p>

        {isVerifiedAccount && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '0.625rem 0.875rem',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
            data-testid="verified-company-notice"
          >
            🔒 <strong>Datos fiscales verificados:</strong> La información societaria e impositiva corresponde a tu cuenta registrada y se encuentra precargada para confirmar la solicitud.
          </div>
        )}

        <div className={styles.formGrid}>
          {/* Razón Social */}
          <Input
            label="Razón social o nombre de fantasía *"
            id="legal_name"
            placeholder="Ej: Metalúrgica Quilmes S.R.L."
            value={formData.legal_name}
            onChange={(e) => handleFieldChange('legal_name', e.target.value)}
            error={errors.legal_name}
            readOnly={Boolean(isPrepopulated && formData.legal_name)}
            helperText={isPrepopulated && formData.legal_name ? 'Dato verificado de la empresa (solo lectura)' : undefined}
            data-testid="input-legal-name"
          />

          <div className={`${styles.formGrid} ${styles.formGridTwoCols}`}>
            {/* CUIT */}
            <Input
              label="CUIT de la empresa *"
              id="tax_id"
              placeholder="30-12345678-9"
              value={formData.tax_id}
              onChange={handleCuitChange}
              error={errors.tax_id}
              readOnly={Boolean(isPrepopulated && formData.tax_id)}
              helperText={
                isPrepopulated && formData.tax_id
                  ? 'CUIT verificado de la cuenta (solo lectura)'
                  : '11 dígitos con validación de dígito verificador AFIP'
              }
              data-testid="input-tax-id"
            />

            {/* Tipo Societario */}
            <div className={styles.fieldGroup}>
              <label htmlFor="company_type" className={styles.fieldLabel}>
                Tipo societario *
              </label>
              <select
                id="company_type"
                className={styles.fieldSelect}
                value={formData.company_type}
                onChange={(e) => handleFieldChange('company_type', e.target.value as CompanyType)}
                data-testid="select-company-type"
                disabled={Boolean(isPrepopulated && initialData?.company_type)}
              >
                <option value="SRL">S.R.L. (Sociedad de Responsabilidad Limitada)</option>
                <option value="SA">S.A. (Sociedad Anónima)</option>
                <option value="SAS">S.A.S. (Sociedad por Acciones Simplificada)</option>
                <option value="Responsable Inscripto">Responsable Inscripto (Persona humana)</option>
                <option value="Monotributo">Monotributo</option>
              </select>
              {isPrepopulated && initialData?.company_type && (
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Tipo societario registrado (solo lectura)
                </span>
              )}
            </div>
          </div>

          <div className={`${styles.formGrid} ${styles.formGridTwoCols}`}>
            {/* Fecha de inicio de actividades */}
            <Input
              label="Fecha de inicio de actividades *"
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => handleFieldChange('start_date', e.target.value)}
              error={errors.start_date}
              readOnly={Boolean(isPrepopulated && initialData?.start_date)}
              helperText={
                isPrepopulated && initialData?.start_date
                  ? 'Fecha de inicio registrada (solo lectura)'
                  : undefined
              }
              data-testid="input-start-date"
            />

            {/* Correo electrónico corporativo */}
            <Input
              label="Correo electrónico corporativo"
              id="email"
              type="email"
              placeholder="contacto@pyme.com.ar"
              value={formData.email || ''}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              readOnly={Boolean(isPrepopulated && formData.email)}
              error={errors.email}
              helperText={
                isPrepopulated && formData.email
                  ? 'Email verificado de tu cuenta (solo lectura)'
                  : undefined
              }
              data-testid="input-email"
            />
          </div>

          {/* Datos del Apoderado */}
          <div className={styles.sectionHeader}>Representante o apoderado legal</div>

          <div className={`${styles.formGrid} ${styles.formGridTwoCols}`}>
            <Input
              label="Nombre del apoderado/titular *"
              id="rep_first_name"
              placeholder="Ej: Martín"
              value={formData.rep_first_name ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  rep_first_name: val,
                  rep_name: `${val} ${prev.rep_last_name || ''}`.trim(),
                }));
                if (errors.rep_first_name || errors.rep_name) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.rep_first_name;
                    delete copy.rep_name;
                    return copy;
                  });
                }
              }}
              error={errors.rep_first_name}
              data-testid="input-rep-first-name"
            />

            <Input
              label="Apellido del apoderado/titular *"
              id="rep_last_name"
              placeholder="Ej: Rodríguez"
              value={formData.rep_last_name ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  rep_last_name: val,
                  rep_name: `${prev.rep_first_name || ''} ${val}`.trim(),
                }));
                if (errors.rep_last_name || errors.rep_name) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.rep_last_name;
                    delete copy.rep_name;
                    return copy;
                  });
                }
              }}
              error={errors.rep_last_name}
              data-testid="input-rep-last-name"
            />
          </div>

          {/* Backward compatibility input for input-rep-name */}
          <input
            type="hidden"
            id="rep_name"
            data-testid="input-rep-name"
            value={formData.rep_name}
            onChange={(e) => {
              const val = e.target.value;
              const fName = val.trim().split(' ')[0] || '';
              const lName = val.trim().split(' ').slice(1).join(' ') || '';
              setFormData((prev) => ({
                ...prev,
                rep_name: val,
                rep_first_name: fName,
                rep_last_name: lName,
              }));
            }}
          />

          <div className={`${styles.formGrid} ${styles.formGridTwoCols}`}>
            <Input
              label="DNI del apoderado *"
              id="rep_dni"
              placeholder="Ej: 32456789"
              value={formData.rep_dni}
              onChange={(e) => handleFieldChange('rep_dni', e.target.value.replace(/\D/g, ''))}
              error={errors.rep_dni}
              data-testid="input-rep-dni"
            />
          </div>

          <Input
            label="Celular de contacto *"
            id="rep_phone"
            type="tel"
            placeholder="+54 9 11 5555-1234"
            value={formData.rep_phone}
            onChange={(e) => handleFieldChange('rep_phone', e.target.value)}
            error={errors.rep_phone}
            helperText="Se utilizará para notificaciones sobre el estado de la solicitud"
            data-testid="input-rep-phone"
          />
        </div>

        <div className={styles.buttonRow} style={{ justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            data-testid="step1-continue-button"
          >
            Continuar al paso 2 →
          </Button>
        </div>
      </div>
    </form>
  );
}
