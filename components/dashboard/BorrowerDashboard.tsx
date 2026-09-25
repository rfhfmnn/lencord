'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Installment, Loan, LoanStatus } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { LOAN_CATEGORY_LABELS, calculateDaysRemaining, formatRateDisplay } from '@/components/marketplace/LoanCard';
import { PromissoryNoteModal } from '@/components/legal/PromissoryNoteModal';
import styles from './dashboard.module.css';

export interface BorrowerDashboardProps {
  borrowerId?: string;
  loanId?: string;
  initialLoans?: Loan[];
  initialInstallments?: Installment[];
  referenceDate?: Date;
  onSignPromissoryNote?: (loanId: string) => void;
  className?: string;
}

export const LOAN_STATUS_LABELS: Record<LoanStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: styles.statusPending },
  in_review: { label: 'En revisión', className: styles.badgeInReview },
  funding: { label: 'En subasta', className: styles.badgeFunding },
  funded: { label: 'Subasta completada', className: styles.badgeFunded },
  active: { label: 'Préstamo activo', className: styles.badgeActive },
  repaid: { label: 'Cancelado / Pagado', className: styles.statusSettled },
  cancelled: { label: 'Cancelado', className: styles.statusRefunded },
};

export function BorrowerDashboard({
  borrowerId = 'prof-sme-001',
  loanId,
  initialLoans,
  initialInstallments,
  referenceDate = new Date(),
  onSignPromissoryNote,
  className = '',
}: BorrowerDashboardProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [currentBorrowerId, setCurrentBorrowerId] = useState<string>(borrowerId);
  const [loans, setLoans] = useState<Loan[]>(initialLoans ?? []);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(
    loanId ?? (initialLoans && initialLoans.length > 0 ? initialLoans[0].id : null)
  );
  const [installments, setInstallments] = useState<Installment[]>(initialInstallments ?? []);
  const [loading, setLoading] = useState<boolean>(!initialLoans);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState<boolean>(false);

  // Keep state synced with props
  useEffect(() => {
    if (borrowerId) setCurrentBorrowerId(borrowerId);
  }, [borrowerId]);

  useEffect(() => {
    if (loanId) setSelectedLoanId(loanId);
  }, [loanId]);

  // Load borrower loans
  useEffect(() => {
    if (initialLoans) {
      setLoans(initialLoans);
      if (!selectedLoanId && initialLoans.length > 0) {
        setSelectedLoanId(initialLoans[0].id);
      }
      if (initialInstallments) {
        setInstallments(initialInstallments);
      }
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadBorrowerData() {
      try {
        setLoading(true);
        const resolvedServices =
          servicesFromContext ??
          (() => {
            try {
              return createServices();
            } catch {
              return createServices({ useMocks: true });
            }
          })();

        // List loans for this borrower
        const borrowerLoans = await resolvedServices.loans.listLoans({
          borrower_id: currentBorrowerId,
        });

        if (isMounted) {
          setLoans(borrowerLoans);
          const firstLoan = borrowerLoans.length > 0 ? borrowerLoans[0] : null;
          const targetId = selectedLoanId ?? (firstLoan ? firstLoan.id : null);
          setSelectedLoanId(targetId);

          if (targetId) {
            const insts = await resolvedServices.loans.getInstallmentsByLoan(targetId);
            if (isMounted) setInstallments(insts);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading borrower dashboard data:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadBorrowerData();

    return () => {
      isMounted = false;
    };
  }, [currentBorrowerId, initialLoans, initialInstallments, servicesFromContext]);

  // Fetch installments when selected loan changes
  useEffect(() => {
    if (!selectedLoanId || initialInstallments || initialLoans) return;

    let isMounted = true;
    async function fetchInstallments() {
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
        const insts = await resolvedServices.loans.getInstallmentsByLoan(selectedLoanId!);
        if (isMounted) setInstallments(insts);
      } catch (err) {
        console.error('Error fetching loan installments:', err);
      }
    }

    fetchInstallments();

    return () => {
      isMounted = false;
    };
  }, [selectedLoanId, initialInstallments, servicesFromContext]);

  // Find currently active/selected loan
  const currentLoan = useMemo(() => {
    if (loans.length === 0) return null;
    if (selectedLoanId) {
      const match = loans.find((l) => l.id === selectedLoanId);
      if (match) return match;
    }
    return loans[0];
  }, [loans, selectedLoanId]);

  if (loading) {
    return (
      <div className={`${styles.dashboardContainer} ${className}`} data-testid="borrower-dashboard-loading">
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando panel de la empresa...</p>
        </div>
      </div>
    );
  }

  if (!currentLoan) {
    return (
      <div className={`${styles.dashboardContainer} ${className}`} data-testid="borrower-empty-state">
        <header className={styles.dashboardHeader}>
          <div>
            <h1 className={styles.title}>Panel PyME</h1>
            <p className={styles.subtitle}>Seguimiento de solicitudes y obligaciones financieras.</p>
          </div>
        </header>

        <section className={styles.emptyStateCard}>
          <div className={styles.emptyStateIcon} aria-hidden="true">
            <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className={styles.emptyStateTitle}>No poseés solicitudes activas</h2>
          <p className={styles.emptyStateDescription}>
            Aún no has solicitado financiamiento para tu empresa. Solicitá crédito 100% online y fondeá
            tu capital de trabajo, maquinaria o expansión comercial sin burocracia bancaria.
          </p>
          <Link href="/solicitar">
            <Button variant="primary" size="md">
              Solicitar financiación
            </Button>
          </Link>
        </section>
      </div>
    );
  }

  const categoryLabel = LOAN_CATEGORY_LABELS[currentLoan.category] ?? currentLoan.category;
  const statusMeta = LOAN_STATUS_LABELS[currentLoan.status] ?? {
    label: currentLoan.status,
    className: styles.statusCommitted,
  };

  // Funding calculations
  const fundedPercent = currentLoan.amount_requested > 0
    ? Math.min(100, Math.round((currentLoan.amount_funded / currentLoan.amount_requested) * 100))
    : 0;
  const daysRemaining = calculateDaysRemaining(currentLoan.funding_deadline, referenceDate);

  const handleSigningClick = () => {
    setIsSigningModalOpen(true);
    if (onSignPromissoryNote) {
      onSignPromissoryNote(currentLoan.id);
    }
  };

  const handleContractSigned = (_signedContract: any) => {
    // Transition loan status to 'active' (or ready for disbursement)
    setLoans((prevLoans) =>
      prevLoans.map((l) => (l.id === currentLoan.id ? { ...l, status: 'active' } : l))
    );
  };

  return (
    <div className={`${styles.dashboardContainer} ${className}`} data-testid="borrower-dashboard">
      {/* Dashboard Header */}
      <header className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.title}>Panel PyME</h1>
          <p className={styles.subtitle}>
            Estado de tu solicitud de crédito, progreso de subasta y cronograma de amortización.
          </p>
        </div>

        {/* Loan selector if multiple loans exist */}
        {loans.length > 1 && (
          <div className={styles.investorSelector}>
            <label htmlFor="loan-select" className={styles.selectorLabel}>
              Solicitud:
            </label>
            <select
              id="loan-select"
              value={currentLoan.id}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className={styles.selectInput}
              aria-label="Seleccionar solicitud de préstamo"
            >
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {LOAN_CATEGORY_LABELS[l.category] ?? l.category} - {formatCurrency(l.amount_requested)} ({l.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Main Loan Header & Status Badge */}
      <div className={styles.borrowerHeroCard}>
        <div className={styles.loanHeaderBar}>
          <div className={styles.loanTitleGroup}>
            <h2 className={styles.loanHeading}>{categoryLabel}</h2>
            <span
              className={`${styles.statusBadge} ${statusMeta.className}`}
              data-testid="borrower-status-badge"
            >
              {currentLoan.status}
            </span>
          </div>

          <div className={styles.monoText}>ID de préstamo: {currentLoan.id}</div>
        </div>

        {/* Key figures */}
        <div className={styles.breakdownGrid}>
          <div className={styles.tierStatItem} style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <span className={styles.metricLabel}>Monto Solicitado</span>
            <div className={styles.tierStatAmount}>{formatCurrency(currentLoan.amount_requested)}</div>
            <div className={styles.secondaryText}>Plazo: {currentLoan.term_months} meses</div>
          </div>

          <div className={styles.tierStatItem} style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <span className={styles.metricLabel}>Esquema de Tasa</span>
            <div className={styles.tierStatAmount}>
              {currentLoan.borrower_rate > 0
                ? formatRateDisplay(currentLoan.rate_type, currentLoan.borrower_rate)
                : currentLoan.rate_type === 'TNA_FIXED'
                ? 'Tasa Fija (TNA)'
                : 'CER / UVA + Spread'}
            </div>
            <div className={styles.secondaryText}>
              {currentLoan.borrower_rate > 0 ? 'Tasa final aprobada' : 'A definir en scoring'}
            </div>
          </div>

          <div className={styles.tierStatItem} style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <span className={styles.metricLabel}>Estado Actual</span>
            <div className={styles.tierStatAmount} style={{ textTransform: 'capitalize' }}>
              {statusMeta.label}
            </div>
            <div className={styles.secondaryText}>
              Fecha creación: {new Date(currentLoan.created_at).toLocaleDateString('es-AR')}
            </div>
          </div>
        </div>
      </div>

      {/* STATE 1: in_review */}
      {currentLoan.status === 'in_review' && (
        <section className={styles.inReviewCard} data-testid="in-review-card">
          <div className={styles.inReviewHeader}>
            <div className={styles.inReviewIcon} aria-hidden="true">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className={styles.inReviewTitle}>Solicitud en evaluación crediticia</h3>
              <p className={styles.inReviewText}>
                Tu solicitud de financiamiento está siendo analizada por nuestro equipo de riesgos.
                Estamos consultando tu historial en la Central de Deudores del BCRA y verificando la
                documentación fiscal presentada. El proceso de evaluación demora entre <strong>24 y 48 horas hábiles</strong>.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* STATE 2: funding */}
      {currentLoan.status === 'funding' && (
        <section className={styles.auctionMonitorCard} data-testid="auction-monitor-card">
          <div className={styles.auctionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>Monitor de subasta en vivo</h3>
              <p className={styles.sectionDescription}>
                Tu oportunidad está visible para inversores individuales e institucionales en el marketplace.
              </p>
            </div>

            <div className={styles.countdownBadge} data-testid="countdown-timer">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{daysRemaining} días restantes</span>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className={styles.auctionProgressTrack}
            role="progressbar"
            aria-valuenow={fundedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de fondeo de la subasta"
          >
            <div
              className={styles.auctionProgressBar}
              style={{ width: `${fundedPercent}%` }}
              data-testid="funding-progress-bar"
            />
          </div>

          <div className={styles.auctionStatsRow}>
            <div>
              <span className={styles.primaryText} data-testid="amount-pledged">
                {formatCurrency(currentLoan.amount_funded)}
              </span>
              <span> comprometidos de {formatCurrency(currentLoan.amount_requested)}</span>
            </div>
            <div className={styles.primaryText} data-testid="funding-percentage">
              {fundedPercent}% completado
            </div>
          </div>
        </section>
      )}

      {/* STATE 3: funded */}
      {currentLoan.status === 'funded' && (
        <section className={styles.signingNotification} data-testid="signing-notification">
          <div className={styles.signingContent}>
            <div className={styles.signingIcon} aria-hidden="true">
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className={styles.signingTitle}>¡Subasta financiada al 100%!</h3>
              <p className={styles.signingDescription}>
                Tu proyecto ha alcanzado el fondeo total. Para proceder con el desembolso directo de los fondos
                en tu CBU/CVU bancario, es necesario firmar el <strong>Pagaré Digital</strong> correspondiente.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleSigningClick}
            data-testid="btn-sign-promissory-note"
          >
            Firmar Pagaré Digital
          </Button>
        </section>
      )}

      {/* STATE 4: active */}
      {currentLoan.status === 'active' && (
        <section className={styles.section} aria-labelledby="amortization-table-title">
          <div className={styles.sectionHeader}>
            <h2 id="amortization-table-title" className={styles.sectionTitle}>
              Cuadro de amortización (Sistema Francés)
            </h2>
            <p className={styles.sectionDescription}>
              Detalle de cuotas mensuales, vencimientos, amortización de capital e intereses a abonar.
            </p>
          </div>

          <div className={styles.tableCard}>
            {installments.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                No se registraron cuotas generadas para este préstamo.
              </div>
            ) : (
              <table className={styles.table} data-testid="amortization-table">
                <thead>
                  <tr>
                    <th scope="col">Cuota #</th>
                    <th scope="col">Vencimiento</th>
                    <th scope="col">Amortización (Capital)</th>
                    <th scope="col">Interés</th>
                    <th scope="col">Total cuota</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst) => {
                    const totalCuota = inst.principal_amount + inst.interest_borrower;
                    const statusClass =
                      inst.status === 'paid'
                        ? styles.statusPaid
                        : inst.status === 'overdue'
                        ? styles.statusOverdue
                        : styles.statusPending;

                    return (
                      <tr key={inst.id} data-testid={`amortization-row-${inst.installment_number}`}>
                        <td>
                          <span className={styles.primaryText}>Cuota #{inst.installment_number}</span>
                        </td>
                        <td>{inst.due_date}</td>
                        <td>{formatCurrency(inst.principal_amount)}</td>
                        <td>{formatCurrency(inst.interest_borrower)}</td>
                        <td>
                          <span className={styles.primaryText}>{formatCurrency(totalCuota)}</span>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${statusClass}`}
                            data-testid={`installment-badge-${inst.installment_number}`}
                          >
                            {inst.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* Electronic Promissory Note Signing Modal */}
      {currentLoan && (
        <PromissoryNoteModal
          isOpen={isSigningModalOpen}
          onClose={() => setIsSigningModalOpen(false)}
          loan={currentLoan}
          installments={installments}
          onSuccess={handleContractSigned}
        />
      )}
    </div>
  );
}
