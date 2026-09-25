'use client';

import React, { useState, useId } from 'react';
import type { CommitInvestmentResult, Loan } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/components/home/HeroSimulator';
import styles from './investment-modal.module.css';

export const MIN_INVESTMENT_TICKET = 10000;

export interface InvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan;
  onSuccess?: (result: CommitInvestmentResult) => void;
  investorId?: string;
}

export function InvestmentModal({
  isOpen,
  onClose,
  loan,
  onSuccess,
  investorId = 'prof-inv-001',
}: InvestmentModalProps) {
  const [amountStr, setAmountStr] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<CommitInvestmentResult | null>(null);

  const titleId = useId();

  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  if (!isOpen) return null;

  const remainingCapacity = Math.max(0, loan.amount_requested - loan.amount_funded);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    setAmountStr(rawVal);
    setSubmitError(null);

    if (!rawVal) {
      setValidationError(null);
      return;
    }

    const numVal = parseInt(rawVal, 10);

    if (numVal <= 0) {
      setValidationError('El monto a invertir debe ser mayor a cero.');
    } else if (numVal < MIN_INVESTMENT_TICKET) {
      setValidationError(`El ticket mínimo de inversión es de ${formatCurrency(MIN_INVESTMENT_TICKET)}.`);
    } else if (numVal > remainingCapacity) {
      setValidationError(
        `El monto ingresado (${formatCurrency(numVal)}) supera el cupo remanente disponible (${formatCurrency(
          remainingCapacity
        )}).`
      );
    } else {
      setValidationError(null);
    }
  };

  const parsedAmount = amountStr ? parseInt(amountStr, 10) : 0;
  const isInputValid =
    parsedAmount > 0 &&
    parsedAmount >= MIN_INVESTMENT_TICKET &&
    parsedAmount <= remainingCapacity &&
    !validationError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInputValid || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      const result = await resolvedServices.investments.commitInvestment({
        loan_id: loan.id,
        investor_id: investorId,
        amount: parsedAmount,
      });

      setSuccessResult(result);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la inversión.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAmountStr('');
    setValidationError(null);
    setSubmitError(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="investment-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={styles.modal}>
        {successResult ? (
          <div className={styles.successContainer} data-testid="investment-success-view">
            <div className={styles.successIcon}>✓</div>
            <h3 className={styles.successTitle}>¡Inversión confirmada con éxito!</h3>
            <p className={styles.successMessage}>
              Has comprometido una orden de inversión en esta PyME. Los fondos han sido reservados en custodia
              mediante el sistema de pagos.
            </p>

            <div className={styles.successDetails}>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>Monto invertido:</span>
                <span className={styles.successDetailValue} data-testid="success-amount">
                  {formatCurrency(successResult.investment.amount)}
                </span>
              </div>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>Nuevo total financiado:</span>
                <span className={styles.successDetailValue}>
                  {formatCurrency(successResult.amount_funded)}
                </span>
              </div>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>ID de retención (BaaS):</span>
                <span className={styles.successDetailValue} style={{ fontFamily: 'monospace' }}>
                  {successResult.investment.external_payment_id}
                </span>
              </div>
              {successResult.is_fully_funded && (
                <div
                  style={{
                    color: '#065f46',
                    backgroundColor: '#d1fae5',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    marginTop: '0.5rem',
                  }}
                  data-testid="success-fully-funded-banner"
                >
                  🎉 ¡Subasta completada al 100%!
                </div>
              )}
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={handleClose}
              data-testid="close-success-button"
            >
              Cerrar y continuar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.header}>
              <div>
                <h3 id={titleId} className={styles.title}>
                  Invertir en esta PyME
                </h3>
                <p className={styles.subtitle}>Ingresá el monto en pesos que deseas aportar a esta subasta.</p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={handleClose}
                aria-label="Cerrar modal"
                data-testid="modal-close-button"
              >
                ✕
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.capacitySummary}>
                <div>
                  <span className={styles.summaryLabel}>Cupo disponible</span>
                  <span className={styles.summaryValue} data-testid="modal-remaining-capacity">
                    {formatCurrency(remainingCapacity)}
                  </span>
                </div>
                <div>
                  <span className={styles.summaryLabel}>Ticket mínimo</span>
                  <span className={styles.summaryValue} style={{ color: '#64748b', fontSize: '0.9375rem' }}>
                    {formatCurrency(MIN_INVESTMENT_TICKET)}
                  </span>
                </div>
              </div>

              <Input
                label="Monto a invertir (ARS)"
                id="investment-amount-input"
                type="text"
                inputMode="numeric"
                prefix="$"
                placeholder="10.000"
                value={amountStr ? parseInt(amountStr, 10).toLocaleString('es-AR') : ''}
                onChange={handleAmountChange}
                error={validationError ?? undefined}
                helperText={!validationError ? 'El monto se reservará en tu cuenta bancaria asociada' : undefined}
                data-testid="investment-amount-input"
                autoFocus
              />

              {submitError && (
                <div className={styles.errorBanner} role="alert" data-testid="modal-submit-error">
                  <span>⚠️</span>
                  <span>{submitError}</span>
                </div>
              )}

              <div className={styles.rulesList}>
                <span>• El ticket mínimo para participar es de {formatCurrency(MIN_INVESTMENT_TICKET)}.</span>
                <span>• No se admiten inversiones que superen el cupo restante de la subasta.</span>
                <span>• Podrás seguir los pagos de capital e intereses en tu panel de inversor.</span>
              </div>
            </div>

            <div className={styles.footer}>
              <Button
                variant="bordered"
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                data-testid="modal-cancel-button"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={!isInputValid || isSubmitting}
                isLoading={isSubmitting}
                data-testid="modal-confirm-button"
              >
                Confirmar inversión
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
