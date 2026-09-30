'use client';

import React, { useMemo, useState } from 'react';
import type { LoanCategory, RateType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { calculateBorrowerInstallment, formatCurrency } from '@/components/home/HeroSimulator';
import styles from './solicitar.module.css';

export type DeadlineOption = 'no_limit' | '15_days' | '30_days' | '45_days' | 'custom';

export interface Step2FormData {
  category: LoanCategory;
  amount_requested: number;
  term_months: number;
  rate_type: RateType;
  description: string;
  deadline_option?: DeadlineOption;
  custom_deadline?: string;
  funding_deadline?: string | null;
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
  { value: 1, label: '1 mes' },
  { value: 2, label: '2 meses' },
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

export const DEADLINE_OPTIONS: { value: DeadlineOption; label: string }[] = [
  { value: 'no_limit', label: 'Sin fecha límite (abierta hasta completar fondeo)' },
  { value: '15_days', label: '15 días' },
  { value: '30_days', label: '30 días' },
  { value: '45_days', label: '45 días' },
  { value: 'custom', label: 'Fecha personalizada' },
];

export function computeFundingDeadline(
  option: DeadlineOption = 'no_limit',
  customDate?: string,
  now: Date = new Date()
): string | null {
  if (option === 'no_limit') return null;
  if (option === '15_days') {
    const d = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }
  if (option === '30_days') {
    const d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }
  if (option === '45_days') {
    const d = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }
  if (option === 'custom' && customDate) {
    const d = new Date(`${customDate}T23:59:59.000Z`);
    return d.toISOString();
  }
  return null;
}

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
    deadline_option: initialData?.deadline_option ?? 'no_limit',
    custom_deadline: initialData?.custom_deadline ?? '',
    funding_deadline: initialData?.funding_deadline ?? null,
  });

  const [amountStr, setAmountStr] = useState<string>(
    initialData?.amount_requested !== undefined ? String(initialData.amount_requested) : '5000000'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const estimatedInstallment = useMemo(() => {
    if (!formData.amount_requested || formData.amount_requested <= 0 || isNaN(formData.amount_requested)) {
      return 0;
    }
    const rateTypeParam = formData.rate_type === 'CER_VARIABLE' ? 'cer' : 'fixed';
    return calculateBorrowerInstallment(formData.amount_requested, formData.term_months, rateTypeParam);
  }, [formData.amount_requested, formData.term_months, formData.rate_type]);

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

    if (formData.deadline_option === 'custom') {
      if (!formData.custom_deadline) {
        newErrors.custom_deadline = 'Por favor seleccioná una fecha límite personalizada.';
      } else {
        const selectedDate = new Date(`${formData.custom_deadline}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate.getTime() < today.getTime()) {
          newErrors.custom_deadline = 'La fecha límite no puede ser anterior a hoy.';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const computedDeadline = computeFundingDeadline(
        formData.deadline_option,
        formData.custom_deadline
      );
      onContinue({
        ...formData,
        funding_deadline: computedDeadline,
      });
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

          {/* Simulador de Cuotas y Disclaimer (Issue #57) */}
          <div className={styles.simulatorCard} data-testid="installment-simulator-card">
            <div className={styles.simulatorHeader}>
              <span className={styles.simulatorLabel}>Simulador de cuota</span>
              <div className={styles.simulatorAmount} data-testid="estimated-installment">
                Cuota mensual estimada:{' '}
                <span data-testid="simulator-installment-value">
                  {formatCurrency(estimatedInstallment)}
                </span>{' '}
                / mes
              </div>
              <span className={styles.simulatorSubtext}>
                Amortización francesa · {formData.rate_type === 'TNA_FIXED' ? 'TNA fija de referencia (48,0%)' : 'CER + 15,0% spread'}
              </span>
            </div>

            <div className={styles.simulatorDisclaimer} role="note" data-testid="simulator-disclaimer">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" className={styles.disclaimerIcon}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={styles.disclaimerText}>
                <strong>Nota informativa:</strong> Cuota mensual estimada bajo sistema de amortización francés según tasa de referencia base de la plataforma. El valor final dependerá del resultado de la subasta colectiva y la tasa efectivamente ofertada por los inversores. No constituye oferta vinculante.
              </p>
            </div>
          </div>

          {/* Vencimiento de subasta (Issue #56) */}
          <div className={styles.fieldGroup}>
            <label htmlFor="deadline_option" className={styles.fieldLabel}>
              Vencimiento de subasta (opcional)
            </label>
            <select
              id="deadline_option"
              className={styles.deadlineSelect}
              value={formData.deadline_option}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  deadline_option: e.target.value as DeadlineOption,
                }))
              }
              data-testid="select-deadline-option"
            >
              {DEADLINE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {formData.deadline_option === 'custom' && (
              <div style={{ marginTop: '0.75rem' }}>
                <Input
                  label="Fecha límite personalizada *"
                  id="custom_deadline"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.custom_deadline || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({ ...prev, custom_deadline: val }));
                    if (errors.custom_deadline) {
                      setErrors((errs) => {
                        const copy = { ...errs };
                        delete copy.custom_deadline;
                        return copy;
                      });
                    }
                  }}
                  error={errors.custom_deadline}
                  helperText="Seleccioná la fecha límite en la que concluirá la subasta."
                  data-testid="input-custom-deadline"
                />
              </div>
            )}
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
