'use client';

import React, { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './hero-simulator.module.css';

export type SimulatorMode = 'borrower' | 'investor';
export type RateType = 'fixed' | 'cer';

export interface TermOption {
  id: string;
  label: string;
  days: number;
  months: number;
}

export const TERM_OPTIONS: TermOption[] = [
  { id: '30d', label: '30 días', days: 30, months: 1 },
  { id: '60d', label: '60 días', days: 60, months: 2 },
  { id: '90d', label: '90 días', days: 90, months: 3 },
  { id: '6m', label: '6 meses', days: 180, months: 6 },
  { id: '12m', label: '12 meses', days: 360, months: 12 },
];

export const BORROWER_MIN_AMOUNT = 100_000;
export const BORROWER_MAX_AMOUNT = 20_000_000;
export const BORROWER_DEFAULT_AMOUNT = 2_000_000;
export const BORROWER_STEP = 50_000;

export const INVESTOR_MIN_AMOUNT = 10_000;
export const INVESTOR_MAX_AMOUNT = 10_000_000;
export const INVESTOR_DEFAULT_AMOUNT = 500_000;
export const INVESTOR_STEP = 10_000;

// Benchmark annual rates
export const BORROWER_FIXED_TNA = 0.48; // 48% TNA
export const BORROWER_CER_MARGIN = 0.15; // 15% CER spread
export const INVESTOR_FIXED_TNA = 0.45; // 45% TNA
export const INVESTOR_CER_MARGIN = 0.125; // 12.5% CER spread

/**
 * Format numeric value as Argentine currency ($ 1.500.000).
 */
export function formatCurrency(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '$ 0';
  const rounded = Math.round(value);
  const parts = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$ ${parts}` : `$ ${parts}`;
}

/**
 * Calculate French amortization monthly installment:
 * A = P * [ r*(1+r)^n / ((1+r)^n - 1) ]
 */
export function calculateBorrowerInstallment(
  amount: number,
  termMonths: number,
  rateType: RateType
): number {
  if (amount <= 0 || termMonths <= 0) return 0;

  const annualRate = rateType === 'fixed' ? BORROWER_FIXED_TNA : BORROWER_CER_MARGIN;
  const monthlyRate = annualRate / 12;

  if (termMonths === 1) {
    return amount * (1 + monthlyRate);
  }

  const factor = Math.pow(1 + monthlyRate, termMonths);
  const installment = (amount * (monthlyRate * factor)) / (factor - 1);
  return installment;
}

/**
 * Calculate investor yields:
 * Total return = capital + interest (or total interest profit)
 * Monthly interest payout = capital * monthlyRate
 */
export function calculateInvestorYield(
  amount: number,
  termMonths: number,
  rateType: RateType
): { totalProfit: number; totalReturn: number; monthlyInterest: number } {
  if (amount <= 0 || termMonths <= 0) {
    return { totalProfit: 0, totalReturn: 0, monthlyInterest: 0 };
  }

  const annualRate = rateType === 'fixed' ? INVESTOR_FIXED_TNA : INVESTOR_CER_MARGIN;
  const monthlyRate = annualRate / 12;

  const monthlyInterest = amount * monthlyRate;
  const totalProfit = monthlyInterest * termMonths;
  const totalReturn = amount + totalProfit;

  return { totalProfit, totalReturn, monthlyInterest };
}

export interface HeroSimulatorProps {
  initialMode?: SimulatorMode;
  className?: string;
}

export function HeroSimulator({ initialMode = 'borrower', className = '' }: HeroSimulatorProps) {
  const [mode, setMode] = useState<SimulatorMode>(initialMode);
  const [borrowerAmount, setBorrowerAmount] = useState<number>(BORROWER_DEFAULT_AMOUNT);
  const [investorAmount, setInvestorAmount] = useState<number>(INVESTOR_DEFAULT_AMOUNT);
  const [selectedTerm, setSelectedTerm] = useState<TermOption>(TERM_OPTIONS[2]); // Default 90 days
  const [rateType, setRateType] = useState<RateType>('fixed');

  const borrowerSliderId = useId();
  const investorSliderId = useId();

  // Borrower calculations
  const clampedBorrowerAmount = Math.min(
    Math.max(borrowerAmount, BORROWER_MIN_AMOUNT),
    BORROWER_MAX_AMOUNT
  );
  const borrowerMonthlyInstallment = useMemo(() => {
    return calculateBorrowerInstallment(clampedBorrowerAmount, selectedTerm.months, rateType);
  }, [clampedBorrowerAmount, selectedTerm.months, rateType]);

  const borrowerTotalRepayment = useMemo(() => {
    return borrowerMonthlyInstallment * selectedTerm.months;
  }, [borrowerMonthlyInstallment, selectedTerm.months]);

  // Investor calculations
  const clampedInvestorAmount = Math.min(
    Math.max(investorAmount, INVESTOR_MIN_AMOUNT),
    INVESTOR_MAX_AMOUNT
  );
  const investorYields = useMemo(() => {
    return calculateInvestorYield(clampedInvestorAmount, selectedTerm.months, rateType);
  }, [clampedInvestorAmount, selectedTerm.months, rateType]);

  return (
    <section className={`${styles.heroSection} ${className}`} aria-label="Simulador de financiamiento e inversión">
      <div className={styles.container}>
        <div className={styles.heroText}>
          <div className={styles.badgePill}>
            <span>Plataforma P2P para PyMEs Argentinas</span>
          </div>
          <h1 className={styles.title}>
            Financiamiento colectivo sin burocracia. Retornos reales sin intermediarios.
          </h1>
          <p className={styles.subtitle}>
            Conectamos PyMEs argentinas en crecimiento, con inversores que buscan retornos reales, sin intermediarios bancarios.
          </p>

          <div className={styles.trustHighlights}>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>Evaluación 100% online en 24h</span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>Subastas transparentes con pagaré digital</span>
            </div>
            <div className={styles.highlightItem}>
              <span className={styles.highlightIcon}>✓</span>
              <span>Protección y análisis de riesgo BCRA</span>
            </div>
          </div>
        </div>

        <div className={styles.simulatorCard} data-testid="hero-simulator">
          {/* Mode Switcher */}
          <div className={styles.modeToggle} role="tablist" aria-label="Tipo de simulador">
            <button
              type="button"
              role="tab"
              id="tab-borrower"
              aria-selected={mode === 'borrower'}
              aria-controls="panel-borrower"
              className={`${styles.modeButton} ${mode === 'borrower' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('borrower')}
            >
              Quiero financiación
            </button>
            <button
              type="button"
              role="tab"
              id="tab-investor"
              aria-selected={mode === 'investor'}
              aria-controls="panel-investor"
              className={`${styles.modeButton} ${mode === 'investor' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('investor')}
            >
              Quiero invertir
            </button>
          </div>

          {/* Borrower Mode Panel */}
          {mode === 'borrower' && (
            <div
              id="panel-borrower"
              role="tabpanel"
              aria-labelledby="tab-borrower"
              className={styles.simulatorBody}
              data-testid="borrower-panel"
            >
              {/* Amount Slider */}
              <div className={styles.formGroup}>
                <div className={styles.groupHeader}>
                  <label htmlFor={borrowerSliderId} className={styles.label}>
                    Monto a solicitar
                  </label>
                  <span className={styles.amountDisplay} data-testid="borrower-amount-display">
                    {formatCurrency(clampedBorrowerAmount)}
                  </span>
                </div>
                <input
                  id={borrowerSliderId}
                  type="range"
                  min={BORROWER_MIN_AMOUNT}
                  max={BORROWER_MAX_AMOUNT}
                  step={BORROWER_STEP}
                  value={clampedBorrowerAmount}
                  onChange={(e) => setBorrowerAmount(Number(e.target.value))}
                  className={styles.slider}
                  aria-label="Monto a solicitar en pesos argentinos"
                  aria-valuemin={BORROWER_MIN_AMOUNT}
                  aria-valuemax={BORROWER_MAX_AMOUNT}
                  aria-valuenow={clampedBorrowerAmount}
                />
                <div className={styles.sliderLabels}>
                  <span>{formatCurrency(BORROWER_MIN_AMOUNT)}</span>
                  <span>{formatCurrency(BORROWER_MAX_AMOUNT)}</span>
                </div>
              </div>

              {/* Term Selector */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Plazo de amortización</label>
                <div className={styles.termButtonGroup} role="radiogroup" aria-label="Plazo de amortización">
                  {TERM_OPTIONS.map((term) => (
                    <button
                      key={term.id}
                      type="button"
                      role="radio"
                      aria-checked={selectedTerm.id === term.id}
                      className={`${styles.termButton} ${
                        selectedTerm.id === term.id ? styles.termButtonActive : ''
                      }`}
                      onClick={() => setSelectedTerm(term)}
                      data-testid={`term-option-${term.id}`}
                    >
                      {term.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate Scheme Selector */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Esquema de tasa</label>
                <div className={styles.rateButtonGroup} role="radiogroup" aria-label="Esquema de tasa">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={rateType === 'fixed'}
                    className={`${styles.rateButton} ${
                      rateType === 'fixed' ? styles.rateButtonActive : ''
                    }`}
                    onClick={() => setRateType('fixed')}
                    data-testid="rate-fixed-btn"
                  >
                    <span className={styles.rateTitle}>Tasa Fija (TNA)</span>
                    <span className={styles.rateSubtitle}>Estimada 48% TNA</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={rateType === 'cer'}
                    className={`${styles.rateButton} ${
                      rateType === 'cer' ? styles.rateButtonActive : ''
                    }`}
                    onClick={() => setRateType('cer')}
                    data-testid="rate-cer-btn"
                  >
                    <span className={styles.rateTitle}>Tasa CER + margen</span>
                    <span className={styles.rateSubtitle}>CER + 15% anual</span>
                  </button>
                </div>
              </div>

              {/* Calculation Output Box */}
              <div className={styles.resultBox} data-testid="borrower-results">
                <div className={styles.resultRow}>
                  <div className={styles.resultLabelGroup}>
                    <span className={styles.resultLabel}>Cuota mensual estimada</span>
                    <span className={styles.resultSubtext}>
                      {selectedTerm.months === 1
                        ? '1 pago al vencimiento'
                        : `${selectedTerm.months} cuotas mensuales`}
                    </span>
                  </div>
                  <div className={styles.resultValue} data-testid="borrower-installment-value">
                    {formatCurrency(borrowerMonthlyInstallment)}
                  </div>
                </div>

                <div className={styles.resultDivider} />

                <div className={styles.secondaryResultRow}>
                  <span className={styles.secondaryLabel}>Total estimado a devolver:</span>
                  <span className={styles.secondaryValue} data-testid="borrower-total-repayment">
                    {formatCurrency(borrowerTotalRepayment)}
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <Link href="/solicitar" className={styles.ctaButton} data-testid="borrower-cta-btn">
                Solicitar financiación
              </Link>
            </div>
          )}

          {/* Investor Mode Panel */}
          {mode === 'investor' && (
            <div
              id="panel-investor"
              role="tabpanel"
              aria-labelledby="tab-investor"
              className={styles.simulatorBody}
              data-testid="investor-panel"
            >
              {/* Amount Slider */}
              <div className={styles.formGroup}>
                <div className={styles.groupHeader}>
                  <label htmlFor={investorSliderId} className={styles.label}>
                    Monto a invertir
                  </label>
                  <span className={styles.amountDisplay} data-testid="investor-amount-display">
                    {formatCurrency(clampedInvestorAmount)}
                  </span>
                </div>
                <input
                  id={investorSliderId}
                  type="range"
                  min={INVESTOR_MIN_AMOUNT}
                  max={INVESTOR_MAX_AMOUNT}
                  step={INVESTOR_STEP}
                  value={clampedInvestorAmount}
                  onChange={(e) => setInvestorAmount(Number(e.target.value))}
                  className={styles.slider}
                  aria-label="Monto a invertir en pesos argentinos"
                  aria-valuemin={INVESTOR_MIN_AMOUNT}
                  aria-valuemax={INVESTOR_MAX_AMOUNT}
                  aria-valuenow={clampedInvestorAmount}
                />
                <div className={styles.sliderLabels}>
                  <span>{formatCurrency(INVESTOR_MIN_AMOUNT)}</span>
                  <span>{formatCurrency(INVESTOR_MAX_AMOUNT)}</span>
                </div>
              </div>

              {/* Term Selector */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Plazo de colocación</label>
                <div className={styles.termButtonGroup} role="radiogroup" aria-label="Plazo de colocación">
                  {TERM_OPTIONS.map((term) => (
                    <button
                      key={term.id}
                      type="button"
                      role="radio"
                      aria-checked={selectedTerm.id === term.id}
                      className={`${styles.termButton} ${
                        selectedTerm.id === term.id ? styles.termButtonActive : ''
                      }`}
                      onClick={() => setSelectedTerm(term)}
                      data-testid={`investor-term-option-${term.id}`}
                    >
                      {term.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate Scheme Selector */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de rendimiento</label>
                <div className={styles.rateButtonGroup} role="radiogroup" aria-label="Tipo de rendimiento">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={rateType === 'fixed'}
                    className={`${styles.rateButton} ${
                      rateType === 'fixed' ? styles.rateButtonActive : ''
                    }`}
                    onClick={() => setRateType('fixed')}
                    data-testid="investor-rate-fixed-btn"
                  >
                    <span className={styles.rateTitle}>Tasa Fija (TNA)</span>
                    <span className={styles.rateSubtitle}>Estimada 45% TNA</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={rateType === 'cer'}
                    className={`${styles.rateButton} ${
                      rateType === 'cer' ? styles.rateButtonActive : ''
                    }`}
                    onClick={() => setRateType('cer')}
                    data-testid="investor-rate-cer-btn"
                  >
                    <span className={styles.rateTitle}>Tasa CER + margen</span>
                    <span className={styles.rateSubtitle}>CER + 12,5% anual</span>
                  </button>
                </div>
              </div>

              {/* Calculation Output Box */}
              <div className={styles.resultBox} data-testid="investor-results">
                <div className={styles.resultRow}>
                  <div className={styles.resultLabelGroup}>
                    <span className={styles.resultLabel}>Retorno total estimado</span>
                    <span className={styles.resultSubtext}>
                      Capital + ganancia ({formatCurrency(investorYields.totalProfit)} de interés)
                    </span>
                  </div>
                  <div className={styles.resultValue} data-testid="investor-total-return">
                    {formatCurrency(investorYields.totalReturn)}
                  </div>
                </div>

                <div className={styles.resultDivider} />

                <div className={styles.secondaryResultRow}>
                  <span className={styles.secondaryLabel}>Cobro mensual de interés:</span>
                  <span className={styles.secondaryValue} data-testid="investor-monthly-interest">
                    {formatCurrency(investorYields.monthlyInterest)}
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <Link href="/marketplace" className={styles.ctaButton} data-testid="investor-cta-btn">
                Ver oportunidades en Marketplace
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
