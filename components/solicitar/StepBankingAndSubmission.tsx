'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './solicitar.module.css';

export interface Step4FormData {
  cbu_cvu: string;
  funds_declaration: boolean;
  terms_accepted: boolean;
}

export interface StepBankingAndSubmissionProps {
  initialData?: Partial<Step4FormData>;
  onBack: (data?: Step4FormData) => void;
  onSubmit: (data: Step4FormData) => Promise<void>;
  isSubmitting?: boolean;
  submitError?: string | null;
}

export function validateCbu(cbu: string): boolean {
  const cleaned = cbu.replace(/\D/g, '');
  return cleaned.length === 22;
}

export function StepBankingAndSubmission({
  initialData,
  onBack,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: StepBankingAndSubmissionProps) {
  const [formData, setFormData] = useState<Step4FormData>({
    cbu_cvu: initialData?.cbu_cvu ?? '',
    funds_declaration: initialData?.funds_declaration ?? false,
    terms_accepted: initialData?.terms_accepted ?? false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCbuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 22);
    setFormData((prev) => ({ ...prev, cbu_cvu: raw }));

    if (errors.cbu_cvu) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.cbu_cvu;
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const cleaned = formData.cbu_cvu.replace(/\D/g, '');
    if (!cleaned) {
      newErrors.cbu_cvu = 'Ingresá la clave bancaria uniforme (CBU) o CVU de la cuenta de la empresa.';
    } else if (cleaned.length !== 22) {
      newErrors.cbu_cvu = 'El CBU o CVU debe contener exactamente 22 dígitos numéricos.';
    }

    if (!formData.funds_declaration) {
      newErrors.funds_declaration =
        'Debes aceptar la declaración jurada sobre el origen lícito de los fondos para continuar.';
    }

    if (!formData.terms_accepted) {
      newErrors.terms_accepted =
        'Debes aceptar los términos, condiciones y emisión del pagaré digital para enviar la solicitud.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="step4-banking-form">
      <div className={styles.formCard}>
        <h2 className={styles.stepTitle}>Datos bancarios y conformidad</h2>
        <p className={styles.stepDescription}>
          Indicá la cuenta bancaria donde se acreditarán los fondos una vez adjudicada la subasta y confirmá
          las declaraciones regulatorias (BCRA / UIF).
        </p>

        <div className={styles.formGrid}>
          {/* CBU / CVU */}
          <Input
            label="CBU o CVU de acreditación de fondos *"
            id="cbu_cvu"
            type="text"
            inputMode="numeric"
            placeholder="0720123488000012345678"
            value={formData.cbu_cvu}
            onChange={handleCbuChange}
            error={errors.cbu_cvu}
            helperText="22 dígitos numéricos de la cuenta de titularidad de la PyME"
            data-testid="input-cbu"
          />

          {/* Declaración Jurada Licitud de Fondos */}
          <div className={styles.fieldGroup}>
            <label
              className={`${styles.checkboxCard} ${
                formData.funds_declaration ? styles.checkboxCardSelected : ''
              }`}
              data-testid="label-funds-declaration"
            >
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={formData.funds_declaration}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData((prev) => ({ ...prev, funds_declaration: checked }));
                  if (checked && errors.funds_declaration) {
                    setErrors((errs) => {
                      const copy = { ...errs };
                      delete copy.funds_declaration;
                      return copy;
                    });
                  }
                }}
                data-testid="checkbox-funds-declaration"
              />
              <div className={styles.checkboxContent}>
                <span className={styles.checkboxTitle}>
                  Declaración jurada sobre licitud de fondos y veracidad *
                </span>
                <span className={styles.checkboxText}>
                  Declaro bajo juramento que los fondos requeridos y los fondos a utilizar para la amortización del
                  crédito provienen de actividades legítimas y lícitas, conforme a las resoluciones vigentes de la
                  Unidad de Información Financiera (UIF) y las normas de Prevención de Lavado de Activos.
                </span>
              </div>
            </label>
            {errors.funds_declaration && (
              <span className={styles.errorMessage} role="alert" data-testid="error-funds-declaration">
                {errors.funds_declaration}
              </span>
            )}
          </div>

          {/* Aceptación de Términos y Pagaré Digital */}
          <div className={styles.fieldGroup}>
            <label
              className={`${styles.checkboxCard} ${
                formData.terms_accepted ? styles.checkboxCardSelected : ''
              }`}
              data-testid="label-terms-accepted"
            >
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={formData.terms_accepted}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData((prev) => ({ ...prev, terms_accepted: checked }));
                  if (checked && errors.terms_accepted) {
                    setErrors((errs) => {
                      const copy = { ...errs };
                      delete copy.terms_accepted;
                      return copy;
                    });
                  }
                }}
                data-testid="checkbox-terms-accepted"
              />
              <div className={styles.checkboxContent}>
                <span className={styles.checkboxTitle}>
                  Términos y condiciones del mutuo y emisión del pagaré digital *
                </span>
                <span className={styles.checkboxText}>
                  Acepto el contrato marco de financiamiento colaborativo de Lencord y presto conformidad para la
                  emisión del pagaré digital garantizado (Ley 27.444 y art. 1820 del CCyC) a suscribirse una vez
                  finalizada la subasta colectiva.
                </span>
              </div>
            </label>
            {errors.terms_accepted && (
              <span className={styles.errorMessage} role="alert" data-testid="error-terms-accepted">
                {errors.terms_accepted}
              </span>
            )}
          </div>

          {submitError && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
              role="alert"
              data-testid="submit-error-banner"
            >
              ⚠️ {submitError}
            </div>
          )}
        </div>

        <div className={styles.buttonRow}>
          <Button
            type="button"
            variant="bordered"
            size="lg"
            onClick={() => onBack(formData)}
            disabled={isSubmitting}
            data-testid="step4-back-button"
          >
            ← Volver al paso 3
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            data-testid="step4-submit-button"
          >
            Enviar solicitud de préstamo
          </Button>
        </div>
      </div>
    </form>
  );
}
