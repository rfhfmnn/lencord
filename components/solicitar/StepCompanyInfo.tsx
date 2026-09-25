'use client';

import React, { useState } from 'react';
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
  rep_name: string;
  rep_dni: string;
  rep_phone: string;
}

export interface StepCompanyInfoProps {
  initialData?: Partial<Step1FormData>;
  onContinue: (data: Step1FormData) => void;
}

export function StepCompanyInfo({ initialData, onContinue }: StepCompanyInfoProps) {
  const [formData, setFormData] = useState<Step1FormData>({
    legal_name: initialData?.legal_name ?? '',
    tax_id: initialData?.tax_id ?? '',
    company_type: (initialData?.company_type as CompanyType) ?? 'SRL',
    start_date: initialData?.start_date ?? '',
    rep_name: initialData?.rep_name ?? '',
    rep_dni: initialData?.rep_dni ?? '',
    rep_phone: initialData?.rep_phone ?? '',
  });

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

    if (!formData.rep_name.trim()) {
      newErrors.rep_name = 'Ingresá el nombre completo del apoderado o titular.';
    }

    const cleanedDni = formData.rep_dni.replace(/\D/g, '');
    if (!cleanedDni) {
      newErrors.rep_dni = 'Ingresá el DNI del apoderado.';
    } else if (cleanedDni.length < 7 || cleanedDni.length > 8) {
      newErrors.rep_dni = 'El DNI debe tener 7 u 8 dígitos.';
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
      onContinue(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="step1-company-form">
      <div className={styles.formCard}>
        <h2 className={styles.stepTitle}>Datos de la empresa y contacto</h2>
        <p className={styles.stepDescription}>
          Ingresá la información societaria e impositiva de tu PyME para la evaluación inicial.
        </p>

        <div className={styles.formGrid}>
          {/* Razón Social */}
          <Input
            label="Razón social o nombre de fantasía *"
            id="legal_name"
            placeholder="Ej: Metalúrgica Quilmes S.R.L."
            value={formData.legal_name}
            onChange={(e) => handleFieldChange('legal_name', e.target.value)}
            error={errors.legal_name}
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
              helperText="11 dígitos con validación de dígito verificador AFIP"
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
              >
                <option value="SRL">S.R.L. (Sociedad de Responsabilidad Limitada)</option>
                <option value="SA">S.A. (Sociedad Anónima)</option>
                <option value="SAS">S.A.S. (Sociedad por Acciones Simplificada)</option>
                <option value="Responsable Inscripto">Responsable Inscripto (Persona humana)</option>
                <option value="Monotributo">Monotributo</option>
              </select>
            </div>
          </div>

          {/* Fecha de inicio de actividades */}
          <Input
            label="Fecha de inicio de actividades *"
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => handleFieldChange('start_date', e.target.value)}
            error={errors.start_date}
            data-testid="input-start-date"
          />

          {/* Datos del Apoderado */}
          <div className={styles.sectionHeader}>Representante o apoderado legal</div>

          <div className={`${styles.formGrid} ${styles.formGridTwoCols}`}>
            <Input
              label="Nombre y apellido del apoderado *"
              id="rep_name"
              placeholder="Ej: Martín Rodríguez"
              value={formData.rep_name}
              onChange={(e) => handleFieldChange('rep_name', e.target.value)}
              error={errors.rep_name}
              data-testid="input-rep-name"
            />

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
