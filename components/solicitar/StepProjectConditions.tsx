'use client';

import React, { useState } from 'react';
import type { LoanCategory, RateType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './solicitar.module.css';

export interface Step2FormData {
  category: LoanCategory;
  amount_requested: number;
  term_months: number;
  rate_type: RateType;
  description: string;
}

export interface StepProjectConditionsProps {
  initialData?: Partial<Step2FormData>;
  onBack: (data?: Step2FormData) => void;
  onContinue: (data: Step2FormData) => void;
}

export const CATEGORY_OPTIONS: { value: LoanCategory; label: string; desc: string }[] = [
  {
    value: 'working_capital',
    label: 'Capital de trabajo',
    desc: 'Compra de mercadería, pago a proveedores y liquidez corriente.',
  },
  {
    value: 'machinery',
    label: 'Maquinaria y equipamiento',
    desc: 'Adquisición de bienes de uso y tecnología productiva.',
  },
  {
    value: 'refinancing',
    label: 'Refinanciación de pasivos',
    desc: 'Consolidación de deudas de corto plazo a mejores tasas.',
  },
  {
    value: 'expansion',
    label: 'Expansión comercial',
    desc: 'Apertura de locales, obras o nuevos canales comerciales.',
  },
  {
    value: 'new_sme',
    label: 'Emprender / Nuevas PyMEs',
    desc: 'Inversión inicial para proyectos en etapa de consolidación.',
  },
];

export const TERM_OPTIONS = [
  { value: 1, label: '30 días' },
  { value: 2, label: '60 días' },
  { value: 3, label: '90 días' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

export function StepProjectConditions({
  initialData,
  onBack,
  onContinue,
}: StepProjectConditionsProps) {
  const [formData, setFormData] = useState<Step2FormData>({
    category: initialData?.category ?? 'working_capital',
    amount_requested: initialData?.amount_requested ?? 5000000,
    term_months: initialData?.term_months ?? 6,
    rate_type: initialData?.rate_type ?? 'TNA_FIXED',
    description: initialData?.description ?? '',
  });

  const [amountStr, setAmountStr] = useState<string>(
    initialData?.amount_requested ? String(initialData.amount_requested) : '5000000'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setAmountStr(raw);
    const parsed = raw ? parseInt(raw, 10) : 0;
    setFormData((prev) => ({ ...prev, amount_requested: parsed }));

    if (errors.amount_requested) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.amount_requested;
        return copy;
      });
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setFormData((prev) => ({ ...prev, description: text }));

    if (text.length > 500) {
      setErrors((prev) => ({
        ...prev,
        description: 'La descripción no puede exceder los 500 caracteres.',
      }));
    } else if (errors.description) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.description;
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount_requested || formData.amount_requested <= 0) {
      newErrors.amount_requested = 'El monto solicitado debe ser mayor a cero.';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Ingresá una breve descripción del destino de los fondos.';
    } else if (formData.description.length > 500) {
      newErrors.description = 'La descripción supera el límite permitido de 500 caracteres.';
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

  const remainingChars = 500 - formData.description.length;
  const isOverLimit = remainingChars < 0;

  return (
    <form onSubmit={handleSubmit} data-testid="step2-project-form">
      <div className={styles.formCard}>
        <h2 className={styles.stepTitle}>Proyecto y condiciones financieras</h2>
        <p className={styles.stepDescription}>
          Definí el monto que necesita tu empresa, el plazo de repago y el esquema de tasa preferido.
        </p>

        <div className={styles.formGrid}>
          {/* Categoría de Destino */}
          <div className={styles.fieldGroup}>
            <label htmlFor="category" className={styles.fieldLabel}>
              Categoría de destino *
            </label>
            <select
              id="category"
              className={styles.fieldSelect}
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, category: e.target.value as LoanCategory }))
              }
              data-testid="select-category"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.desc}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.formGrid} ${styles.formGridTwoCols}`}>
            {/* Monto Solicitado */}
            <Input
              label="Monto solicitado (ARS) *"
              id="amount_requested"
              type="text"
              inputMode="numeric"
              prefix="$"
              placeholder="5.000.000"
              value={amountStr ? parseInt(amountStr, 10).toLocaleString('es-AR') : ''}
              onChange={handleAmountChange}
              error={errors.amount_requested}
              helperText="Monto total en pesos a financiar en la subasta"
              data-testid="input-amount-requested"
            />

            {/* Plazo Pretendido */}
            <div className={styles.fieldGroup}>
              <label htmlFor="term_months" className={styles.fieldLabel}>
                Plazo pretendido *
              </label>
              <select
                id="term_months"
                className={styles.fieldSelect}
                value={formData.term_months}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, term_months: parseInt(e.target.value, 10) }))
                }
                data-testid="select-term-months"
              >
                {TERM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preferencia de Tasa */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Preferencia de tasa *</label>
            <div className={styles.radioOptionsGrid}>
              <label
                className={`${styles.radioCard} ${
                  formData.rate_type === 'TNA_FIXED' ? styles.radioCardSelected : ''
                }`}
                data-testid="radio-rate-fixed"
              >
                <input
                  type="radio"
                  name="rate_type"
                  value="TNA_FIXED"
                  checked={formData.rate_type === 'TNA_FIXED'}
                  onChange={() => setFormData((prev) => ({ ...prev, rate_type: 'TNA_FIXED' }))}
                  style={{ marginTop: '0.25rem' }}
                />
                <div>
                  <span className={styles.radioCardTitle}>Tasa Fija (TNA)</span>
                  <span className={styles.radioCardDesc}>
                    Cuotas fijas en pesos durante toda la vida del préstamo.
                  </span>
                </div>
              </label>

              <label
                className={`${styles.radioCard} ${
                  formData.rate_type === 'CER_VARIABLE' ? styles.radioCardSelected : ''
                }`}
                data-testid="radio-rate-cer"
              >
                <input
                  type="radio"
                  name="rate_type"
                  value="CER_VARIABLE"
                  checked={formData.rate_type === 'CER_VARIABLE'}
                  onChange={() => setFormData((prev) => ({ ...prev, rate_type: 'CER_VARIABLE' }))}
                  style={{ marginTop: '0.25rem' }}
                />
                <div>
                  <span className={styles.radioCardTitle}>CER + spread</span>
                  <span className={styles.radioCardDesc}>
                    Ajustable por inflación (UVA / CER) con spread competitivo.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Descripción del Proyecto (con live character counter) */}
          <div className={styles.fieldGroup}>
            <label htmlFor="project_description" className={styles.fieldLabel}>
              Descripción del proyecto *
            </label>
            <div className={styles.fieldTextareaWrapper}>
              <textarea
                id="project_description"
                className={`${styles.fieldTextarea} ${
                  errors.description || isOverLimit ? styles.fieldTextareaError : ''
                }`}
                placeholder="Describí brevemente el destino de los fondos, el modelo de negocio y cómo impactará la financiación en la producción de tu PyME..."
                value={formData.description}
                onChange={handleDescriptionChange}
                maxLength={600}
                data-testid="textarea-description"
              />
              <div className={styles.charCounterRow}>
                <span className={styles.charCounterDesc}>Máximo 500 caracteres</span>
                <span
                  className={`${styles.charCounter} ${
                    isOverLimit ? styles.charCounterLimitExceeded : ''
                  }`}
                  data-testid="char-counter"
                >
                  {formData.description.length}/500 caracteres
                </span>
              </div>
              {errors.description && (
                <span className={styles.errorMessage} role="alert" data-testid="error-description">
                  {errors.description}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.buttonRow}>
          <Button
            type="button"
            variant="bordered"
            size="lg"
            onClick={() => onBack(formData)}
            data-testid="step2-back-button"
          >
            ← Volver al paso 1
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isOverLimit}
            data-testid="step2-continue-button"
          >
            Continuar al paso 3 →
          </Button>
        </div>
      </div>
    </form>
  );
}
