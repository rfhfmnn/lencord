'use client';

import React, { useState, useId, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CommitInvestmentResult,
  CheckoutInvestmentResult,
  InvestmentPaymentMethod,
  Loan,
} from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/components/home/HeroSimulator';
import styles from './investment-modal.module.css';

export const MIN_INVESTMENT_TICKET = 10000;

export interface FinancialRates {
  tna: number;
  tem: number;
  tea: number;
  tnaDisplay: string;
  temDisplay: string;
  teaDisplay: string;
}

export function calculateFinancialRates(loan: Loan): FinancialRates {
  const tna = loan.investor_rate;
  const tem = tna / 12;
  const tea = (Math.pow(1 + tem / 100, 12) - 1) * 100;

  const tnaFormatted = tna.toFixed(1).replace('.', ',');
  const temFormatted = Number(tem.toFixed(2)).toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const teaFormatted = tea.toFixed(1).replace('.', ',');

  const tnaDisplay = loan.rate_type === 'CER_VARIABLE' ? `CER + ${tnaFormatted}%` : `${tnaFormatted}% TNA`;
  const temDisplay = `${temFormatted}% TEM`;
  const teaDisplay = `${teaFormatted}% TEA`;

  return {
    tna,
    tem,
    tea,
    tnaDisplay,
    temDisplay,
    teaDisplay,
  };
}

export interface InvestmentReturn {
  profit: number;
  totalReturn: number;
}

export function calculateInvestmentReturn(
  amount: number,
  termMonths: number,
  investorRate: number
): InvestmentReturn {
  if (
    !amount ||
    isNaN(amount) ||
    amount < MIN_INVESTMENT_TICKET ||
    termMonths <= 0 ||
    investorRate <= 0
  ) {
    return { profit: 0, totalReturn: 0 };
  }

  const tem = investorRate / 12;
  const profit = Math.round(amount * (tem / 100) * termMonths);
  const totalReturn = amount + profit;

  return { profit, totalReturn };
}

export function detectCardBrand(numberStr: string): 'VISA' | 'Mastercard' | null {
  const clean = numberStr.replace(/\s/g, '');
  if (clean.startsWith('4')) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'Mastercard';
  return null;
}

export function formatCardNumber(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 16);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export function formatExpiry(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

export interface InvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan;
  onSuccess?: (result: CommitInvestmentResult & Partial<CheckoutInvestmentResult>) => void;
  investorId?: string;
  investorTaxId?: string | null;
  defaultCreditRiskAccepted?: boolean;
}

export function InvestmentModal({
  isOpen,
  onClose,
  loan,
  onSuccess,
  investorId = 'prof-inv-001',
  investorTaxId,
  defaultCreditRiskAccepted = false,
}: InvestmentModalProps) {
  let router: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const [effectiveInvestorId, setEffectiveInvestorId] = useState<string>(investorId);

  useEffect(() => {
    let isMounted = true;
    async function resolveAuthUser() {
      try {
        const client = createSupabaseBrowserClient();
        const { data } = await client.auth.getUser();
        if (isMounted && data?.user?.id) {
          if (!investorId || investorId === 'prof-inv-001') {
            setEffectiveInvestorId(data.user.id);
          }
        }
      } catch {
        // mock/offline
      }
    }
    if (!investorId || investorId === 'prof-inv-001') {
      resolveAuthUser();
    } else {
      setEffectiveInvestorId(investorId);
    }
    return () => {
      isMounted = false;
    };
  }, [investorId]);

  const [amountStr, setAmountStr] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Custody balance state
  const [custodyBalance, setCustodyBalance] = useState<number>(() => {
    const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === investorId);
    if (mockProfile && typeof mockProfile.custody_balance === 'number') {
      return mockProfile.custody_balance;
    }
    return 0;
  });

  // Payment method selection ('custody_balance' vs 'credit_card')
  const [paymentMethod, setPaymentMethod] = useState<InvestmentPaymentMethod>(() => {
    return custodyBalance >= MIN_INVESTMENT_TICKET ? 'custody_balance' : 'credit_card';
  });

  // Card form state
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>('');
  const [showCvv, setShowCvv] = useState<boolean>(false);
  const [creditRiskAccepted, setCreditRiskAccepted] = useState<boolean>(defaultCreditRiskAccepted);
  const [cardErrors, setCardErrors] = useState<{
    number?: string;
    expiry?: string;
    cvv?: string;
    holder?: string;
  }>({});

  const [hasTaxId, setHasTaxId] = useState<boolean>(() => {
    if (investorTaxId !== undefined) {
      return Boolean(investorTaxId && investorTaxId.trim() !== '');
    }
    const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === investorId);
    if (mockProfile) {
      return Boolean(mockProfile.tax_id && mockProfile.tax_id.trim() !== '');
    }
    return true;
  });

  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  useEffect(() => {
    if (investorTaxId !== undefined) {
      setHasTaxId(Boolean(investorTaxId && investorTaxId.trim() !== ''));
      return;
    }

    const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === effectiveInvestorId || p.id === investorId);
    if (mockProfile) {
      setHasTaxId(Boolean(mockProfile.tax_id && mockProfile.tax_id.trim() !== ''));
      if (typeof mockProfile.custody_balance === 'number') {
        setCustodyBalance(mockProfile.custody_balance);
      }
      return;
    }

    let isMounted = true;
    async function checkTaxIdAndBalance() {
      try {
        const client = createSupabaseBrowserClient();
        const { data } = await client
          .from('profiles')
          .select('tax_id, custody_balance')
          .eq('id', effectiveInvestorId)
          .maybeSingle();

        if (isMounted && data) {
          setHasTaxId(Boolean(data.tax_id && data.tax_id.trim() !== ''));
          if (typeof data.custody_balance === 'number') {
            setCustodyBalance(data.custody_balance);
          }
        }
      } catch {
        // Ignored
      }
    }
    checkTaxIdAndBalance();
    return () => {
      isMounted = false;
    };
  }, [effectiveInvestorId, investorId, investorTaxId]);

  // Auto-preselect alternative payment method when custody balance is insufficient (Issue #81)
  useEffect(() => {
    if (custodyBalance < MIN_INVESTMENT_TICKET && paymentMethod === 'custody_balance') {
      setPaymentMethod('credit_card');
    }
  }, [custodyBalance, paymentMethod]);

  const handleAddTestFunds = () => {
    const recharge = 1000000;
    setCustodyBalance((prev) => prev + recharge);
    setPaymentMethod('custody_balance');
    setSubmitError(null);

    const mockProfile = defaultMockStateStore.profiles.find(
      (p) => p.id === effectiveInvestorId || p.id === investorId
    );
    if (mockProfile) {
      mockProfile.custody_balance = (mockProfile.custody_balance || 0) + recharge;
    }
  };

  const titleId = useId();

  if (!isOpen) return null;

  const remainingCapacity = Math.max(0, loan.amount_requested - loan.amount_funded);
  const isSelfFunding = Boolean(
    effectiveInvestorId && loan.borrower_id && effectiveInvestorId === loan.borrower_id
  );

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    setAmountStr(rawVal);
    setSubmitError(null);

    if (isSelfFunding) {
      setValidationError('No podés invertir en tu propia solicitud de crédito.');
      return;
    }

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
  const { tnaDisplay, temDisplay, teaDisplay } = calculateFinancialRates(loan);
  const { profit, totalReturn } = calculateInvestmentReturn(
    parsedAmount,
    loan.term_months,
    loan.investor_rate
  );

  const isInputValid =
    parsedAmount > 0 &&
    parsedAmount >= MIN_INVESTMENT_TICKET &&
    parsedAmount <= remainingCapacity &&
    !validationError &&
    !isSelfFunding;

  const cardBrand = detectCardBrand(cardNumber);

  // Sandbox quick test buttons
  const fillValidCard = () => {
    setCardNumber('4500 1234 5678 9010');
    setCardExpiry('12/28');
    setCardCvv('123');
    setCardHolder('Juan Ignacio Pérez');
    setCardErrors({});
    setSubmitError(null);
  };

  const fillRejectedCard = () => {
    setCardNumber('4500 0000 0000 0002');
    setCardExpiry('12/28');
    setCardCvv('999');
    setCardHolder('Juan Ignacio Pérez');
    setCardErrors({});
    setSubmitError(null);
  };

  const validateCardDetails = (): boolean => {
    const errors: { number?: string; expiry?: string; cvv?: string; holder?: string } = {};
    const cleanNum = cardNumber.replace(/\s/g, '');

    if (!cleanNum || cleanNum.length < 15) {
      errors.number = 'El número de tarjeta debe tener 16 dígitos.';
    }

    if (!cardExpiry) {
      errors.expiry = 'Ingresá la fecha de vencimiento (MM/AA).';
    } else {
      const match = cardExpiry.match(/^(\d{2})\/(\d{2})$/);
      if (!match) {
        errors.expiry = 'Formato inválido. Usá MM/AA.';
      } else {
        const month = parseInt(match[1], 10);
        const year = 2000 + parseInt(match[2], 10);
        if (month < 1 || month > 12) {
          errors.expiry = 'Mes inválido (01-12).';
        } else if (year < 2026 || (year === 2026 && month < 10)) {
          errors.expiry = 'La tarjeta se encuentra vencida.';
        }
      }
    }

    if (!cardCvv || cardCvv.length < 3) {
      errors.cvv = 'El CVV debe tener al menos 3 dígitos.';
    }

    if (!cardHolder || cardHolder.trim().length < 3) {
      errors.holder = 'Ingresá el nombre completo del titular.';
    }

    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isSelfFunding) {
      setSubmitError('No podés invertir en tu propia solicitud de crédito.');
      return;
    }
    if (!hasTaxId) {
      setSubmitError('Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil.');
      return;
    }
    if (!creditRiskAccepted) {
      setSubmitError('Debés confirmar que aceptás el riesgo crediticio de la operación para continuar.');
      return;
    }
    if (!isInputValid) return;

    // Validate payment method specifics
    if (paymentMethod === 'custody_balance') {
      if (parsedAmount > custodyBalance) {
        setSubmitError('Saldo en custodia insuficiente para completar la inversión.');
        return;
      }
    } else if (paymentMethod === 'credit_card') {
      const isValid = validateCardDetails();
      if (!isValid) return;

      // Simulated rejection check
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (cleanNum.endsWith('0002') || cleanNum === '4500000000000002') {
        setSubmitError('Fondos insuficientes: La entidad bancaria emisora rechazó la operación.');
        return;
      }
    }

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

      const cleanNum = cardNumber.replace(/\s/g, '');
      const cardLastFour = cleanNum ? cleanNum.slice(-4) : '9010';
      const detectedBrand = cardBrand || 'Visa';

      let result: any;
      if (typeof resolvedServices.investments.checkoutInvestment === 'function') {
        result = await resolvedServices.investments.checkoutInvestment({
          loan_id: loan.id,
          investor_id: effectiveInvestorId,
          amount: parsedAmount,
          payment_method: paymentMethod,
          card_last_four: paymentMethod === 'credit_card' ? cardLastFour : undefined,
          card_brand: paymentMethod === 'credit_card' ? detectedBrand : undefined,
        });

        // Ensure backward compatibility with commitInvestment return shape
        if (!result.investment) {
          result.investment = {
            id: result.investment_id,
            loan_id: loan.id,
            investor_id: effectiveInvestorId,
            amount: parsedAmount,
            status: 'committed',
            external_payment_id: result.transaction_id,
            created_at: result.timestamp,
          };
        }
        if (!result.loan) {
          result.loan = {
            ...loan,
            amount_funded: result.amount_funded,
            status: result.loan_status,
          };
        }
        result.is_fully_funded =
          result.is_fully_funded ?? (result.amount_funded >= loan.amount_requested);
      } else {
        const commitRes = await resolvedServices.investments.commitInvestment({
          loan_id: loan.id,
          investor_id: effectiveInvestorId,
          amount: parsedAmount,
        });
        result = {
          ...commitRes,
          success: true,
          investment_id: commitRes.investment.id,
          transaction_id: commitRes.investment.external_payment_id || `ctx-${Date.now()}`,
          payment_method: paymentMethod,
          card_last_four: paymentMethod === 'credit_card' ? cardLastFour : undefined,
          card_brand: paymentMethod === 'credit_card' ? detectedBrand : undefined,
          timestamp: new Date().toISOString(),
        };
      }

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
    setCardErrors({});
    setCreditRiskAccepted(false);
    onClose();
  };

  const isCustodyAvailable = custodyBalance >= MIN_INVESTMENT_TICKET;
  const formattedCustodyBalance =
    custodyBalance === 0 ? '$ 0,00' : formatCurrency(custodyBalance);

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
                  {formatCurrency(
                    successResult.investment?.amount ?? parsedAmount
                  )}
                </span>
              </div>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>Nuevo total financiado:</span>
                <span className={styles.successDetailValue} data-testid="success-funded-total">
                  {formatCurrency(successResult.amount_funded)}
                </span>
              </div>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>Medio de pago:</span>
                <span className={styles.successDetailValue} data-testid="success-payment-method">
                  {successResult.payment_method === 'custody_balance'
                    ? 'Saldo en custodia'
                    : `Tarjeta ${successResult.card_brand || 'Visa'} •••• ${
                        successResult.card_last_four || '9010'
                      }`}
                </span>
              </div>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>ID de transacción:</span>
                <span
                  className={styles.successDetailValue}
                  style={{ fontFamily: 'monospace' }}
                  data-testid="success-transaction-id"
                >
                  {successResult.transaction_id ||
                    successResult.investment?.external_payment_id ||
                    'ctx-confirmed'}
                </span>
              </div>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>ID de retención (BaaS):</span>
                <span
                  className={styles.successDetailValue}
                  style={{ fontFamily: 'monospace' }}
                  data-testid="success-hold-id"
                >
                  {successResult.investment?.external_payment_id ||
                    successResult.transaction_id}
                </span>
              </div>
              <div className={styles.successDetailRow}>
                <span className={styles.successDetailLabel}>Fecha y hora:</span>
                <span className={styles.successDetailValue} data-testid="success-timestamp">
                  {new Date(successResult.timestamp || Date.now()).toLocaleString('es-AR')}
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
                  ¡Subasta completada al 100%!
                </div>
              )}
            </div>

            <div className={styles.receiptActions}>
              <Button
                variant="bordered"
                fullWidth
                onClick={handleClose}
                data-testid="close-success-button"
              >
                Volver al Marketplace
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  handleClose();
                  if (router?.push) {
                    router.push('/dashboard/inversor');
                  } else if (typeof window !== 'undefined') {
                    window.location.href = '/dashboard/inversor';
                  }
                }}
                data-testid="go-to-investments-button"
              >
                Ir a Mis inversiones
              </Button>
            </div>
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

              {/* Financial Rates Section (Issue #59) */}
              <div className={styles.ratesSummary} data-testid="financial-rates">
                <div className={styles.rateBlock}>
                  <span className={styles.rateLabel}>TNA</span>
                  <span className={styles.rateValue} data-testid="modal-rate-tna">
                    {tnaDisplay}
                  </span>
                </div>
                <div className={styles.rateBlock}>
                  <span className={styles.rateLabel}>TEM</span>
                  <span className={styles.rateValue} data-testid="modal-rate-tem">
                    {temDisplay}
                  </span>
                </div>
                <div className={styles.rateBlock}>
                  <span className={styles.rateLabel}>TEA</span>
                  <span className={styles.rateValue} data-testid="modal-rate-tea">
                    {teaDisplay}
                  </span>
                </div>
              </div>

              {isSelfFunding && (
                <div className={styles.errorBanner} role="alert" data-testid="self-funding-warning">
                  <span>⚠️</span>
                  <span>No podés invertir en tu propia solicitud de crédito.</span>
                </div>
              )}

              {!hasTaxId && (
                <div className={styles.errorBanner} role="alert" data-testid="missing-tax-id-alert">
                  <span>⚠️</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                    <span>Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil.</span>
                    <Button
                      type="button"
                      variant="bordered"
                      size="sm"
                      onClick={() => {
                        handleClose();
                        if (router?.push) {
                          router.push('/dashboard/inversor#perfil');
                        } else if (typeof window !== 'undefined') {
                          window.location.href = '/dashboard/inversor#perfil';
                        }
                      }}
                      data-testid="complete-dni-button"
                    >
                      Completar DNI en mi perfil
                    </Button>
                  </div>
                </div>
              )}

              <Input
                label="Monto a invertir (ARS)"
                id="investment-amount-input"
                type="text"
                inputMode="numeric"
                prefix="$"
                placeholder="10.000"
                value={amountStr ? parseInt(amountStr, 10).toLocaleString('es-AR') : ''}
                onChange={handleAmountChange}
                disabled={isSelfFunding || isSubmitting}
                error={validationError ?? undefined}
                helperText={!validationError && !isSelfFunding ? 'El monto se debitará del medio de pago seleccionado' : undefined}
                data-testid="investment-amount-input"
                autoFocus={!isSelfFunding}
              />

              {/* Dynamic Estimated Yield / Return (Issue #59) */}
              <div className={styles.yieldContainer} data-testid="investment-returns-summary">
                <div className={styles.yieldRow}>
                  <span className={styles.yieldLabel}>Importe a ganar</span>
                  <span className={styles.yieldProfit} data-testid="modal-estimated-profit">
                    {formatCurrency(profit)}
                  </span>
                </div>
                <div className={styles.yieldDivider} />
                <div className={styles.yieldRow}>
                  <span className={styles.yieldTotalLabel}>Monto total a cobrar</span>
                  <span className={styles.yieldTotalValue} data-testid="modal-total-return">
                    {formatCurrency(totalReturn)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector (Issue #66) */}
              <div className={styles.paymentMethodSection}>
                <h4 className={styles.paymentMethodSectionTitle}>Medio de pago</h4>
                <div className={styles.paymentMethodList}>
                  {/* Custody Balance Option */}
                  <label
                    className={`${styles.paymentMethodOption} ${
                      paymentMethod === 'custody_balance' ? styles.paymentMethodOptionSelected : ''
                    } ${!isCustodyAvailable ? styles.paymentMethodOptionDisabled : ''}`}
                    data-testid="payment-method-custody-label"
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value="custody_balance"
                      checked={paymentMethod === 'custody_balance'}
                      onChange={() => {
                        if (isCustodyAvailable) {
                          setPaymentMethod('custody_balance');
                          setSubmitError(null);
                        }
                      }}
                      disabled={!isCustodyAvailable || isSubmitting}
                      className={styles.paymentMethodRadio}
                      data-testid="payment-method-custody"
                    />
                    <div className={styles.paymentMethodContent}>
                      <div className={styles.paymentMethodLabelRow}>
                        <span className={styles.paymentMethodLabel}>
                          Saldo en cuenta de custodia
                        </span>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: isCustodyAvailable ? '#0369a1' : '#64748b',
                          }}
                          data-testid="custody-balance-label"
                        >
                          {isCustodyAvailable
                            ? `${formatCurrency(custodyBalance)} disponible`
                            : `Saldo insuficiente (${formattedCustodyBalance})`}
                        </span>
                      </div>
                      <span className={styles.paymentMethodDesc}>
                        {isCustodyAvailable
                          ? 'Debito directo e instantáneo de tus fondos disponibles.'
                          : `Saldo insuficiente (${formattedCustodyBalance}). Podés fondear tu cuenta o pagar con tarjeta.`}
                      </span>
                      {(!isCustodyAvailable || custodyBalance < MIN_INVESTMENT_TICKET) && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <Button
                            type="button"
                            variant="bordered"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAddTestFunds();
                            }}
                            data-testid="btn-add-test-funds"
                          >
                            Cargar saldo de prueba
                          </Button>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Credit/Debit Card Option */}
                  <label
                    className={`${styles.paymentMethodOption} ${
                      paymentMethod === 'credit_card' ? styles.paymentMethodOptionSelected : ''
                    }`}
                    data-testid="payment-method-card-label"
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value="credit_card"
                      checked={paymentMethod === 'credit_card'}
                      onChange={() => {
                        setPaymentMethod('credit_card');
                        setSubmitError(null);
                      }}
                      disabled={isSubmitting}
                      className={styles.paymentMethodRadio}
                      data-testid="payment-method-card"
                    />
                    <div className={styles.paymentMethodContent}>
                      <div className={styles.paymentMethodLabelRow}>
                        <span className={styles.paymentMethodLabel}>
                          Pagar con tarjeta de débito / crédito
                        </span>
                        <span className={styles.sandboxBadge}>BaaS Sandbox</span>
                      </div>
                      <span className={styles.paymentMethodDesc}>
                        Aceptamos Visa, Mastercard y tarjetas corporativas mediante pasarela segura.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* BaaS Card Form (Only when credit_card is selected) */}
              {paymentMethod === 'credit_card' && (
                <div className={styles.cardFormContainer} data-testid="card-form-container">
                  {/* Sandbox Testing Buttons */}
                  <div className={styles.sandboxControls}>
                    <div className={styles.sandboxControlsHeader}>
                      <span>🧪</span>
                      <span>Opciones de prueba rápida (Sandbox BaaS):</span>
                    </div>
                    <div className={styles.sandboxButtonsRow}>
                      <button
                        type="button"
                        className={styles.sandboxBtn}
                        onClick={fillValidCard}
                        data-testid="sandbox-valid-card-button"
                      >
                        💳 Tarjeta válida de prueba
                      </button>
                      <button
                        type="button"
                        className={`${styles.sandboxBtn} ${styles.sandboxBtnDanger}`}
                        onClick={fillRejectedCard}
                        data-testid="sandbox-rejected-card-button"
                      >
                        ⚠️ Simular tarjeta rechazada
                      </button>
                    </div>
                  </div>

                  {/* Card Number */}
                  <div className={styles.inputGroup}>
                    <div className={styles.inputLabelRow}>
                      <label htmlFor="card-number" className={styles.inputLabel}>
                        Número de tarjeta
                      </label>
                      {cardBrand && (
                        <span
                          className={`${styles.cardBrandBadge} ${
                            cardBrand === 'VISA'
                              ? styles.cardBrandVisa
                              : styles.cardBrandMastercard
                          }`}
                          data-testid="card-brand-badge"
                        >
                          {cardBrand}
                        </span>
                      )}
                    </div>
                    <input
                      id="card-number"
                      type="text"
                      inputMode="numeric"
                      placeholder="4500 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => {
                        setCardNumber(formatCardNumber(e.target.value));
                        if (cardErrors.number) {
                          setCardErrors((prev) => ({ ...prev, number: undefined }));
                        }
                      }}
                      className={`${styles.fieldInput} ${
                        cardErrors.number ? styles.fieldInputError : ''
                      }`}
                      data-testid="card-number-input"
                      disabled={isSubmitting}
                    />
                    {cardErrors.number && (
                      <p
                        className={styles.fieldErrorText}
                        role="alert"
                        data-testid="card-number-error"
                      >
                        {cardErrors.number}
                      </p>
                    )}
                  </div>

                  {/* Expiry and CVV Row */}
                  <div className={styles.cardRow}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="card-expiry" className={styles.inputLabel}>
                        Vencimiento (MM/AA)
                      </label>
                      <input
                        id="card-expiry"
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => {
                          setCardExpiry(formatExpiry(e.target.value));
                          if (cardErrors.expiry) {
                            setCardErrors((prev) => ({ ...prev, expiry: undefined }));
                          }
                        }}
                        className={`${styles.fieldInput} ${
                          cardErrors.expiry ? styles.fieldInputError : ''
                        }`}
                        data-testid="card-expiry-input"
                        disabled={isSubmitting}
                      />
                      {cardErrors.expiry && (
                        <p
                          className={styles.fieldErrorText}
                          role="alert"
                          data-testid="card-expiry-error"
                        >
                          {cardErrors.expiry}
                        </p>
                      )}
                    </div>

                    <div className={styles.inputGroup}>
                      <label htmlFor="card-cvv" className={styles.inputLabel}>
                        Código CVV
                      </label>
                      <div className={styles.fieldInputWrapper}>
                        <input
                          id="card-cvv"
                          type={showCvv ? 'text' : 'password'}
                          inputMode="numeric"
                          placeholder="123"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => {
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
                            if (cardErrors.cvv) {
                              setCardErrors((prev) => ({ ...prev, cvv: undefined }));
                            }
                          }}
                          className={`${styles.fieldInput} ${
                            cardErrors.cvv ? styles.fieldInputError : ''
                          }`}
                          data-testid="card-cvv-input"
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          className={styles.cvvToggleBtn}
                          onClick={() => setShowCvv((prev) => !prev)}
                          data-testid="toggle-cvv-visibility"
                          aria-label={showCvv ? 'Ocultar CVV' : 'Mostrar CVV'}
                        >
                          {showCvv ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>
                      {cardErrors.cvv && (
                        <p
                          className={styles.fieldErrorText}
                          role="alert"
                          data-testid="card-cvv-error"
                        >
                          {cardErrors.cvv}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Cardholder Name */}
                  <div className={styles.inputGroup}>
                    <label htmlFor="card-holder" className={styles.inputLabel}>
                      Nombre y apellido del titular
                    </label>
                    <input
                      id="card-holder"
                      type="text"
                      placeholder="Como figura en la tarjeta"
                      value={cardHolder}
                      onChange={(e) => {
                        setCardHolder(e.target.value);
                        if (cardErrors.holder) {
                          setCardErrors((prev) => ({ ...prev, holder: undefined }));
                        }
                      }}
                      className={`${styles.fieldInput} ${
                        cardErrors.holder ? styles.fieldInputError : ''
                      }`}
                      data-testid="card-holder-input"
                      disabled={isSubmitting}
                    />
                    {cardErrors.holder && (
                      <p
                        className={styles.fieldErrorText}
                        role="alert"
                        data-testid="card-holder-error"
                      >
                        {cardErrors.holder}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Credit Risk Acceptance Checkbox (Issue #72) */}
              <div className={styles.riskConsentContainer} data-testid="risk-consent-container">
                <label className={styles.riskConsentLabel}>
                  <input
                    type="checkbox"
                    checked={creditRiskAccepted}
                    onChange={(e) => {
                      setCreditRiskAccepted(e.target.checked);
                      if (submitError) setSubmitError(null);
                    }}
                    disabled={isSubmitting}
                    className={styles.riskConsentCheckbox}
                    data-testid="credit-risk-checkbox"
                    required
                  />
                  <span className={styles.riskConsentText}>
                    Entiendo y acepto que esta operación conlleva <strong>riesgo crediticio</strong> y no cuenta con garantía estatal de depósitos (SEDESA/BCRA). He leído los{' '}
                    <a href="/terminos" target="_blank" rel="noopener noreferrer" className={styles.riskConsentLink}>
                      Términos y Condiciones
                    </a>{' '}
                    y la{' '}
                    <a href="/privacidad" target="_blank" rel="noopener noreferrer" className={styles.riskConsentLink}>
                      Advertencia de Riesgos
                    </a>.
                  </span>
                </label>
              </div>

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
                disabled={!isInputValid || isSubmitting || !hasTaxId || !creditRiskAccepted}
                isLoading={isSubmitting}
                aria-busy={isSubmitting}
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
