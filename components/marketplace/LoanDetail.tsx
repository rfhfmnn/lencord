'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CommitInvestmentResult, Loan, RiskTier, SmeCreditProfile } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { TierBadge } from '@/components/ui/TierBadge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { calculateDaysRemaining, formatRateDisplay, LOAN_CATEGORY_LABELS } from './LoanCard';
import { InvestmentModal } from './InvestmentModal';
import styles from './loan-detail.module.css';

export const CATEGORY_DESTINATION_DESCRIPTIONS: Record<string, string> = {
  working_capital:
    'Financiamiento destinado a capital de trabajo operativo, adquisición de materias primas y gestión de inventario para atender el incremento de demanda productiva.',
  machinery:
    'Inversión para adquisición y modernización de bienes de capital y maquinaria industrial de última generación para incrementar la capacidad operativa.',
  refinancing:
    'Optimización del perfil financiero de la empresa mediante la consolidación de pasivos de corto plazo en condiciones más competitivas.',
  expansion:
    'Financiamiento integral para la apertura de nuevas sucursales, desarrollo de canales de distribución y expansión territorial de la compañía.',
  new_sme:
    'Impulso financiero inicial para emprendimientos productivos y nuevas PyMEs en etapa de consolidación comercial en el mercado local.',
};

export function formatBcraScoreDisplay(situation: number | null | undefined): string {
  if (situation === 1) {
    return 'Situación 1 - Normal (Cumplimiento puntual sin atrasos)';
  }
  if (situation === 2) {
    return 'Situación 2 - Con seguimiento especial (Atraso menor)';
  }
  if (situation === 3) {
    return 'Situación 3 - Con problemas (Atraso significativo)';
  }
  if (situation === 4) {
    return 'Situación 4 - Con alto riesgo de insolvencia';
  }
  if (situation === 5) {
    return 'Situación 5 - Irrecuperable';
  }
  return 'Sin deuda financiera registrada en Central de Deudores BCRA';
}

export interface LoanDetailProps {
  loanId: string;
  initialLoan?: Loan;
  initialCreditProfile?: SmeCreditProfile;
  investorId?: string;
  referenceDate?: Date;
}

export function LoanDetail({
  loanId,
  initialLoan,
  initialCreditProfile,
  investorId = 'prof-inv-001',
  referenceDate,
}: LoanDetailProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [loan, setLoan] = useState<Loan | null>(initialLoan ?? null);
  const [creditProfile, setCreditProfile] = useState<SmeCreditProfile | null>(
    initialCreditProfile ?? null
  );
  const [loading, setLoading] = useState<boolean>(!initialLoan);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialLoan) {
      setLoan(initialLoan);
      if (initialCreditProfile) setCreditProfile(initialCreditProfile);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const resolvedServices =
          servicesFromContext ??
          (() => {
            try {
              return createServices();
            } catch {
              return createServices({ useMocks: true });
            }
          })();

        const fetchedLoan = await resolvedServices.loans.getLoanById(loanId);
        if (!fetchedLoan) {
          if (isMounted) {
            setError('Oportunidad de préstamo no encontrada.');
            setLoading(false);
          }
          return;
        }

        let fetchedCreditProfile: SmeCreditProfile | null = null;
        try {
          fetchedCreditProfile = await resolvedServices.creditScoring.getCreditProfileByProfileId(
            fetchedLoan.borrower_id
          );
        } catch {
          fetchedCreditProfile = null;
        }

        if (isMounted) {
          setLoan(fetchedLoan);
          setCreditProfile(fetchedCreditProfile);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error al cargar la información del préstamo.');
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [loanId, initialLoan, initialCreditProfile, servicesFromContext]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState} data-testid="loan-detail-loading">
          <div className={styles.loadingSpinner} />
          <p>Cargando detalles de la oportunidad...</p>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState} data-testid="loan-detail-error">
          <h2>No se encontró la oportunidad</h2>
          <p>{error ?? 'El préstamo solicitado no existe o no se encuentra disponible.'}</p>
          <Link href="/marketplace" className={styles.backLink} style={{ justifyContent: 'center' }}>
            ← Volver al catálogo de préstamos
          </Link>
        </div>
      </div>
    );
  }

  const riskTier: RiskTier = creditProfile?.risk_tier ?? 'Tier B';
  const categoryLabel = LOAN_CATEGORY_LABELS[loan.category] ?? loan.category;
  const destinationDesc =
    creditProfile?.scoring_notes ||
    CATEGORY_DESTINATION_DESCRIPTIONS[loan.category] ||
    'Financiamiento colectivo para proyecto productivo de PyME argentina.';

  const rateDisplay = formatRateDisplay(loan.rate_type, loan.investor_rate);
  const termDisplay = `${loan.term_months} ${loan.term_months === 1 ? 'mes' : 'meses'}`;

  const remainingCapacity = Math.max(0, loan.amount_requested - loan.amount_funded);
  const fundingPercentage = Math.min(
    100,
    Math.max(0, Math.round((loan.amount_funded / loan.amount_requested) * 100))
  );

  const isCompleted = loan.status === 'funded' || loan.amount_funded >= loan.amount_requested;
  const daysRemaining = calculateDaysRemaining(loan.funding_deadline, referenceDate);

  const handleInvestmentSuccess = (result: CommitInvestmentResult) => {
    setLoan(result.loan);
  };

  return (
    <div className={styles.container} data-testid="loan-detail-view">
      <Link href="/marketplace" className={styles.backLink} data-testid="back-to-marketplace">
        ← Volver al catálogo de oportunidades
      </Link>

      {/* Main Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.topRow}>
          <div className={styles.badgeGroup}>
            <span className={styles.categoryBadge} data-testid="detail-category-badge">
              {categoryLabel}
            </span>
            <TierBadge tier={riskTier} data-testid="detail-risk-badge" />
          </div>

          <span
            className={`${styles.statusBadge} ${
              isCompleted ? styles.statusCompleted : styles.statusFunding
            }`}
            data-testid="detail-status-badge"
          >
            {isCompleted ? 'Subasta completada' : 'En subasta pública'}
          </span>
        </div>

        <h1 className={styles.title} data-testid="detail-title">
          Financiamiento PyME: {categoryLabel}
        </h1>

        <p className={styles.destinationDescription} data-testid="detail-destination-desc">
          {destinationDesc}
        </p>

        {/* Metrics Grid */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Rendimiento anual</span>
            <span className={`${styles.metricValue} ${styles.metricAccent}`} data-testid="detail-rate">
              {rateDisplay}
            </span>
          </div>

          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Plazo de amortización</span>
            <span className={styles.metricValue} data-testid="detail-term">
              {termDisplay}
            </span>
          </div>

          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Cierre de subasta</span>
            <span className={styles.metricValue} data-testid="detail-deadline">
              {isCompleted ? 'Finalizada' : daysRemaining === 0 ? 'Cierra hoy' : `${daysRemaining} días restantes`}
            </span>
          </div>

          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Calificación crediticia</span>
            <span className={styles.metricValue} data-testid="detail-tier-label">
              {riskTier}
            </span>
          </div>
        </div>

        {/* Funding Progress Section */}
        <div className={styles.fundingSection}>
          <div className={styles.progressHeader}>
            <div>
              <span className={styles.fundedAmount} data-testid="detail-amount-funded">
                {formatCurrency(loan.amount_funded)}
              </span>
              <span className={styles.targetAmount} data-testid="detail-amount-requested">
                {' '}
                recaudados de {formatCurrency(loan.amount_requested)}
              </span>
            </div>
            <span className={styles.percentageLabel} data-testid="detail-percentage">
              {fundingPercentage}% financiado
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
              className={`${styles.progressBarFill} ${
                isCompleted ? styles.progressBarFillCompleted : ''
              }`}
              style={{ width: `${fundingPercentage}%` }}
              data-testid="detail-progress-fill"
            />
          </div>

          <div className={styles.capacityRow}>
            <span className={styles.capacityText}>Cupo disponible restante:</span>
            <span className={styles.capacityValue} data-testid="detail-remaining-capacity">
              {formatCurrency(remainingCapacity)}
            </span>
          </div>

          <div className={styles.actionRow}>
            {isCompleted ? (
              <Button
                variant="primary"
                disabled
                size="lg"
                data-testid="detail-invest-button"
              >
                Subasta completada
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsModalOpen(true)}
                data-testid="detail-invest-button"
              >
                Invertir en esta PyME
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Credit Risk & Scoring Section */}
      <div className={styles.creditSection}>
        <h2 className={styles.sectionTitle}>Evaluación crediticia y solvencia</h2>
        <div className={styles.creditList}>
          <div className={styles.creditItem}>
            <span className={styles.creditItemLabel}>Situación Deudores BCRA</span>
            <span className={styles.creditItemValue} data-testid="detail-bcra-score">
              {formatBcraScoreDisplay(creditProfile?.bcra_situation)}
            </span>
          </div>

          <div className={styles.creditItem}>
            <span className={styles.creditItemLabel}>Nivel de riesgo de solvencia</span>
            <span className={styles.creditItemValue} data-testid="detail-solvency-tier">
              {riskTier} (Evaluado por Lencord Scoring)
            </span>
          </div>

          <div className={styles.creditItem}>
            <span className={styles.creditItemLabel}>Esquema de tasa</span>
            <span className={styles.creditItemValue}>
              {loan.rate_type === 'TNA_FIXED' ? 'Tasa fija en pesos' : 'Ajustable por inflación (CER / UVA)'}
            </span>
          </div>
        </div>
      </div>

      {/* Investment Commitment Modal */}
      {isModalOpen && (
        <InvestmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          loan={loan}
          onSuccess={handleInvestmentSuccess}
          investorId={investorId}
        />
      )}
    </div>
  );
}
