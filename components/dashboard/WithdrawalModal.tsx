'use client';

import React, { useState } from 'react';
import type { CustodyTransaction } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import styles from './withdrawal-modal.module.css';

export interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  investorId: string;
  availableBalance: number;
  bankCbuCvu?: string | null;
  bankAlias?: string | null;
  onSuccess?: (transaction: CustodyTransaction, amount: number) => void;
  className?: string;
}

export function WithdrawalModal({
  isOpen,
  onClose,
  investorId,
  availableBalance,
  bankCbuCvu,
  bankAlias,
  onSuccess,
  className = '',
}: WithdrawalModalProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [amountStr, setAmountStr] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedTx, setCompletedTx] = useState<CustodyTransaction | null>(null);

  if (!isOpen) return null;

  const handleWithdrawAll = () => {
    setAmountStr(availableBalance.toFixed(2));
    setError(null);
  };

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setError(null);

    const parsedAmount = parseFloat(amountStr);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El importe a retirar debe ser mayor a cero.');
      return;
    }

    if (parsedAmount > availableBalance) {
      setError('El monto supera tu saldo disponible en custodia.');
      return;
    }

    if (!bankCbuCvu) {
      setError('No poseés una cuenta bancaria configurada para recibir transferencias.');
      return;
    }

    setIsSubmitting(true);

    try {
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      if (!resolvedServices.investments.requestWithdrawal) {
        throw new Error('Servicio de retiros no disponible');
      }

      const tx = await resolvedServices.investments.requestWithdrawal({
        investor_id: investorId,
        amount: parsedAmount,
        bank_cbu_cvu: bankCbuCvu,
        bank_alias: bankAlias ?? undefined,
      });

      setCompletedTx(tx);
      if (onSuccess) {
        onSuccess(tx, parsedAmount);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al procesar la solicitud de retiro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseReceipt = () => {
    setCompletedTx(null);
    setAmountStr('');
    setError(null);
    onClose();
  };

  return (
    <div
      className={`${styles.overlay} ${className}`}
      data-testid="withdrawal-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdrawal-modal-title"
    >
      <div className={styles.modal} data-testid="withdrawal-modal">
        {/* Modal Header */}
        <header className={styles.header}>
          <div>
            <h2 id="withdrawal-modal-title" className={styles.title}>
              Retirar fondos a mi CBU
            </h2>
            <p className={styles.subtitle}>
              Transferencia de saldo en custodia a tu cuenta bancaria registrada
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar modal"
            data-testid="btn-close-withdrawal-modal"
          >
            &times;
          </button>
        </header>

        {/* Modal Content: Receipt vs Form */}
        {completedTx ? (
          <div className={styles.receiptContainer} data-testid="withdrawal-receipt">
            <div className={styles.receiptIcon} aria-hidden="true">
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className={styles.receiptHeading}>
              Solicitud de retiro registrada: La transferencia a tu CBU está en proceso
            </h3>

            <div className={styles.receiptDetailsCard}>
              <div className={styles.receiptRow}>
                <span className={styles.receiptRowLabel}>Importe solicitado:</span>
                <span className={styles.receiptRowValue}>{formatCurrency(completedTx.amount, { decimals: true })}</span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptRowLabel}>CBU de destino:</span>
                <span className={`${styles.receiptRowValue} ${styles.mono}`}>
                  {completedTx.payment_metadata?.bank_cbu_cvu || bankCbuCvu}
                </span>
              </div>
              {bankAlias && (
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>Alias bancario:</span>
                  <span className={styles.receiptRowValue}>{bankAlias}</span>
                </div>
              )}
              <div className={styles.receiptRow}>
                <span className={styles.receiptRowLabel}>Plazo estimado:</span>
                <span className={styles.receiptRowValue}>En las próximas 24 horas hábiles</span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptRowLabel}>ID de transacción:</span>
                <span className={`${styles.receiptRowValue} ${styles.mono}`}>{completedTx.id}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleCloseReceipt}
              data-testid="btn-close-receipt"
              style={{ width: '100%' }}
            >
              Entendido
            </Button>
          </div>
        ) : (
          <form onSubmit={handleConfirm}>
            <div className={styles.body}>
              {/* Available Balance Box */}
              <div className={styles.balanceBox} data-testid="modal-available-balance">
                <div>
                  <span className={styles.balanceLabel}>Saldo disponible en custodia</span>
                  <span className={styles.balanceValue}>{formatCurrency(availableBalance, { decimals: true })}</span>
                </div>
              </div>

              {/* Destination Bank Account or Missing Bank Alert */}
              {bankCbuCvu ? (
                <div className={styles.bankAccountCard} data-testid="modal-cbu-display">
                  <div className={styles.bankAccountHeader}>
                    <span className={styles.bankAccountTitle}>Cuenta bancaria de destino</span>
                    <span className={styles.verifiedBadge}>Cuenta vinculada</span>
                  </div>
                  <div className={styles.accountDetails}>
                    <div>
                      CBU/CVU: <strong className={styles.mono}>{bankCbuCvu}</strong>
                    </div>
                    {bankAlias && (
                      <div>
                        Alias: <strong>{bankAlias}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.missingBankAlert} data-testid="missing-bank-account-alert">
                  <p className={styles.missingBankText}>
                    No tenés una cuenta bancaria configurada. Por favor, agregá tu CBU o CVU en tu perfil antes de solicitar un retiro.
                  </p>
                  <a
                    href="#perfil"
                    className={styles.profileLink}
                    onClick={() => onClose()}
                    data-testid="link-to-profile"
                  >
                    Ir a Mi perfil
                  </a>
                </div>
              )}

              {/* Amount Input */}
              <div className={styles.amountGroup}>
                <div className={styles.amountHeader}>
                  <label htmlFor="withdrawal-amount" className={styles.amountLabel}>
                    Importe a transferir
                  </label>
                  {availableBalance > 0 && (
                    <button
                      type="button"
                      className={styles.quickFillBtn}
                      onClick={handleWithdrawAll}
                      data-testid="btn-withdraw-all"
                    >
                      Retirar el total disponible
                    </button>
                  )}
                </div>

                <div className={styles.inputWrapper}>
                  <span className={styles.currencyPrefix}>$</span>
                  <input
                    id="withdrawal-amount"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={amountStr}
                    onChange={(e) => {
                      setAmountStr(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={!bankCbuCvu || availableBalance <= 0}
                    className={`${styles.input} ${error ? styles.inputError : ''}`}
                    data-testid="withdrawal-amount-input"
                  />
                </div>

                {error && (
                  <p className={styles.errorText} role="alert" data-testid="withdrawal-error">
                    {error}
                  </p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <footer className={styles.footer}>
              <Button
                type="button"
                variant="bordered"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
                data-testid="btn-cancel-withdrawal"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                disabled={!bankCbuCvu || availableBalance <= 0}
                onClick={handleConfirm}
                data-testid="btn-confirm-withdrawal"
              >
                Confirmar retiro
              </Button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
