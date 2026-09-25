import React from 'react';
import Link from 'next/link';
import type { Loan, RiskTier } from '@/types';
import { TierBadge } from '@/components/ui/TierBadge';
import { formatCurrency } from '@/components/home/HeroSimulator';
import styles from './loan-card.module.css';

export const LOAN_CATEGORY_LABELS: Record<string, string> = {
  working_capital: 'Capital de trabajo',
  machinery: 'Maquinaria y equipamiento',
  refinancing: 'Refinanciación de pasivos',
  expansion: 'Expansión comercial',
  new_sme: 'Nuevas PyMEs',
};

export function formatRateDisplay(rateType: string, rate: number): string {
  const formattedRate = rate.toFixed(1).replace('.', ',');
  if (rateType === 'TNA_FIXED') {
    return `${formattedRate}% TNA`;
  }
  return `CER + ${formattedRate}%`;
}

export function calculateDaysRemaining(deadline: string, referenceDate: Date = new Date()): number {
  const deadlineTime = new Date(deadline).getTime();
  const currentTime = referenceDate.getTime();
  const diffMs = deadlineTime - currentTime;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export interface LoanCardProps {
  loan: Loan;
  riskTier?: RiskTier;
  referenceDate?: Date;
  className?: string;
}

export function LoanCard({
  loan,
  riskTier = 'Tier B',
  referenceDate,
  className = '',
}: LoanCardProps) {
  const categoryLabel = LOAN_CATEGORY_LABELS[loan.category] ?? loan.category;
  const rateDisplay = formatRateDisplay(loan.rate_type, loan.investor_rate);
  const termDisplay = `${loan.term_months} ${loan.term_months === 1 ? 'mes' : 'meses'}`;

  const fundingPercentage = Math.min(
    100,
    Math.max(0, Math.round((loan.amount_funded / loan.amount_requested) * 100))
  );

  const remainingAmount = Math.max(0, loan.amount_requested - loan.amount_funded);
  const daysRemaining = calculateDaysRemaining(loan.funding_deadline, referenceDate);

  return (
    <Link
      href={`/marketplace/${loan.id}`}
      className={`${styles.card} ${className}`}
      data-testid={`loan-card-${loan.id}`}
      aria-label={`Préstamo para ${categoryLabel}, ${termDisplay}, tasa ${rateDisplay}`}
    >
      {/* Header: Category and Anonymized Risk Tier Badge */}
      <div className={styles.headerRow}>
        <span className={styles.categoryBadge} data-testid="loan-category">
          {categoryLabel}
        </span>
        <TierBadge tier={riskTier} data-testid="loan-risk-badge" />
      </div>

      {/* Financial Metrics: Rate & Term */}
      <div className={styles.financialMetrics}>
        <div className={styles.metricBlock}>
          <span className={styles.metricLabel}>Tasa Inversor</span>
          <span className={styles.metricValue} data-testid="loan-rate">
            {rateDisplay}
          </span>
        </div>
        <div className={styles.metricBlock}>
          <span className={styles.metricLabel}>Plazo</span>
          <span className={styles.metricValue} data-testid="loan-term">
            {termDisplay}
          </span>
        </div>
      </div>

      {/* Progress Bar & Funding Percentage */}
      <div className={styles.progressSection}>
        <div className={styles.progressInfo}>
          <span className={styles.progressPercentage} data-testid="loan-percentage">
            {fundingPercentage}% financiado
          </span>
          <span className={styles.requestedAmount} data-testid="loan-requested">
            de {formatCurrency(loan.amount_requested)}
          </span>
        </div>
        <div
          className={styles.progressBarTrack}
          role="progressbar"
          aria-valuenow={fundingPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de fondeo"
        >
          <div
            className={styles.progressBarFill}
            style={{ width: `${fundingPercentage}%` }}
            data-testid="loan-progress-fill"
          />
        </div>
      </div>

      {/* Footer: Remaining Amount & Days Remaining */}
      <div className={styles.footerRow}>
        <div className={styles.remainingAmount}>
          <span className={styles.remainingLabel}>Falta financiar</span>
          <span className={styles.remainingValue} data-testid="loan-remaining-amount">
            {formatCurrency(remainingAmount)}
          </span>
        </div>
        <div className={styles.deadlineBadge} data-testid="loan-days-remaining">
          <span className={styles.deadlineIcon}>⏱</span>
          <span>{daysRemaining === 0 ? 'Cierra hoy' : `${daysRemaining} días restantes`}</span>
        </div>
      </div>
    </Link>
  );
}
