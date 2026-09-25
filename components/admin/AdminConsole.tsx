'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { BcraSituation, Loan, Profile, RiskTier, SmeCreditProfile } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { Button } from '@/components/ui/Button';
import { TierBadge } from '@/components/ui/TierBadge';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { LOAN_CATEGORY_LABELS } from '@/components/marketplace/LoanCard';
import { SEED_PROFILES } from '@/services/mock/seedData';
import styles from './admin.module.css';

export interface AdminConsoleProps {
  initialLoans?: Loan[];
  initialProfiles?: Record<string, Profile>;
  initialCreditProfiles?: Record<string, SmeCreditProfile>;
  className?: string;
}

export function AdminConsole({
  initialLoans,
  initialProfiles,
  initialCreditProfiles,
  className = '',
}: AdminConsoleProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [loans, setLoans] = useState<Loan[]>(initialLoans ?? []);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(() => {
    if (initialLoans) {
      const inReview = initialLoans.find((l) => l.status === 'in_review');
      return inReview ? inReview.id : null;
    }
    return null;
  });
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>(() => {
    if (initialProfiles) return initialProfiles;
    return SEED_PROFILES.reduce<Record<string, Profile>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
  });
  const [creditProfilesMap, setCreditProfilesMap] = useState<Record<string, SmeCreditProfile>>(
    initialCreditProfiles ?? {}
  );
  const [loading, setLoading] = useState<boolean>(!initialLoans);

  // Form states for approval
  const [bcraSituation, setBcraSituation] = useState<number>(1);
  const [riskTier, setRiskTier] = useState<RiskTier>('Tier A');
  const [investorRate, setInvestorRate] = useState<number>(45.0);
  const [platformSpread, setPlatformSpread] = useState<number>(2.5);
  const [fundingDeadline, setFundingDeadline] = useState<string>(() => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return future.toISOString().slice(0, 16);
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load in_review loans from service
  useEffect(() => {
    if (initialLoans) {
      setLoans(initialLoans);
      const inReviewList = initialLoans.filter((l) => l.status === 'in_review');
      if (inReviewList.length > 0) {
        setSelectedLoanId(inReviewList[0].id);
      }
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadAdminData() {
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

        // Fetch loans in_review
        const inReviewLoans = await resolvedServices.loans.listLoans({ status: 'in_review' });

        // Fetch credit profiles
        const newCreditProfiles: Record<string, SmeCreditProfile> = {};
        await Promise.all(
          inReviewLoans.map(async (l) => {
            try {
              const cp = await resolvedServices.creditScoring.getCreditProfileByProfileId(l.borrower_id);
              if (cp) newCreditProfiles[l.borrower_id] = cp;
            } catch {
              // ignore
            }
          })
        );

        if (isMounted) {
          setLoans(inReviewLoans);
          if (inReviewLoans.length > 0) {
            setSelectedLoanId(inReviewLoans[0].id);
          }
          setCreditProfilesMap(newCreditProfiles);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading admin console data:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [initialLoans, servicesFromContext]);

  // Pending loans
  const pendingLoans = useMemo(() => {
    return loans.filter((l) => l.status === 'in_review');
  }, [loans]);

  // Selected loan
  const selectedLoan = useMemo(() => {
    if (!selectedLoanId) {
      return pendingLoans.length > 0 ? pendingLoans[0] : null;
    }
    return loans.find((l) => l.id === selectedLoanId) ?? null;
  }, [loans, selectedLoanId, pendingLoans]);

  // Reset form when selected loan changes
  useEffect(() => {
    if (selectedLoan) {
      setFormError(null);
      const cp = creditProfilesMap[selectedLoan.borrower_id];
      if (cp) {
        if (cp.bcra_situation) setBcraSituation(cp.bcra_situation);
        if (cp.risk_tier) setRiskTier(cp.risk_tier);
      } else {
        setBcraSituation(1);
        setRiskTier('Tier A');
      }

      // Default rate scheme
      if (selectedLoan.rate_type === 'TNA_FIXED') {
        setInvestorRate(45.0);
      } else {
        setInvestorRate(14.0);
      }
      setPlatformSpread(2.5);

      const defaultDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      setFundingDeadline(defaultDeadline.toISOString().slice(0, 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLoanId]);

  // Dynamic borrower final rate calculation
  const calculatedBorrowerRate = useMemo(() => {
    const inv = isNaN(investorRate) ? 0 : investorRate;
    const spread = isNaN(platformSpread) ? 0 : platformSpread;
    return Number((inv + spread).toFixed(2));
  }, [investorRate, platformSpread]);

  // Approval & Publication handler
  const handleApproveAndPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    setFormError(null);
    setSuccessMessage(null);

    // Validation rules
    if (platformSpread < 0) {
      setFormError('El spread de plataforma no puede ser negativo.');
      return;
    }

    if (investorRate <= 0) {
      setFormError('La tasa para inversores debe ser mayor a 0%.');
      return;
    }

    if (!fundingDeadline) {
      setFormError('Debes seleccionar una fecha límite de subasta.');
      return;
    }

    const deadlineTimestamp = new Date(fundingDeadline).getTime();
    if (isNaN(deadlineTimestamp) || deadlineTimestamp <= Date.now()) {
      setFormError('La fecha límite de subasta debe ser una fecha y hora futura.');
      return;
    }

    if (bcraSituation < 1 || bcraSituation > 5) {
      setFormError('La situación BCRA debe ser un valor entre 1 y 5.');
      return;
    }

    try {
      setSubmitting(true);
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      const isoDeadline = new Date(fundingDeadline).toISOString();

      const updatedLoan = await resolvedServices.loans.approveAndPublishLoan({
        loan_id: selectedLoan.id,
        risk_tier: riskTier,
        investor_rate: investorRate,
        platform_spread: platformSpread,
        funding_deadline: isoDeadline,
      });

      // Update state
      setLoans((prev) => prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l)));
      setSuccessMessage(
        `¡Préstamo ${selectedLoan.id} aprobado con éxito! La subasta ha sido publicada y ya está activa en el marketplace.`
      );

      // Select next pending loan if available
      const remainingPending = pendingLoans.filter((l) => l.id !== selectedLoan.id);
      if (remainingPending.length > 0) {
        setSelectedLoanId(remainingPending[0].id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error al aprobar y publicar el préstamo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={`${styles.adminContainer} ${className}`} data-testid="admin-console-loading">
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <p>Cargando consola de administración...</p>
        </div>
      </div>
    );
  }

  const selectedProfile = selectedLoan ? profilesMap[selectedLoan.borrower_id] : null;
  const selectedCreditProfile = selectedLoan ? creditProfilesMap[selectedLoan.borrower_id] : null;

  return (
    <div className={`${styles.adminContainer} ${className}`} data-testid="admin-console">
      {/* Header */}
      <header className={styles.adminHeader}>
        <div>
          <h1 className={styles.title}>Mesa de Crédito y Aprobaciones</h1>
          <p className={styles.subtitle}>
            Evaluación crediticia de PyMEs solicitantes, scoring de riesgo y publicación en subasta.
          </p>
        </div>
        <div>
          <span className={styles.badgeAdmin}>Rol: Backoffice Administrador</span>
        </div>
      </header>

      {/* Global Alerts */}
      {successMessage && (
        <div className={styles.successAlert} data-testid="success-alert" role="alert">
          {successMessage}
        </div>
      )}

      {/* Main Layout Grid */}
      <div className={styles.layoutGrid}>
        {/* Left Column: Pending Applications List */}
        <section className={styles.panelCard} aria-labelledby="pending-loans-title">
          <h2 id="pending-loans-title" className={styles.panelTitle}>
            <span>Solicitudes en revisión</span>
            <span className={styles.categoryTag} data-testid="pending-count-badge">
              {pendingLoans.length} pendientes
            </span>
          </h2>

          {pendingLoans.length === 0 ? (
            <div className={styles.noSelectionPlaceholder} data-testid="no-pending-loans">
              <p>No hay solicitudes pendientes de evaluación crediticia.</p>
            </div>
          ) : (
            <div className={styles.applicationsList} data-testid="pending-loans-list">
              {pendingLoans.map((loan) => {
                const profile = profilesMap[loan.borrower_id];
                const companyName = profile?.legal_name ?? `PyME ID: ${loan.borrower_id}`;
                const cuit = profile?.tax_id ?? 'CUIT no disponible';
                const isSelected = selectedLoan?.id === loan.id;
                const category = LOAN_CATEGORY_LABELS[loan.category] ?? loan.category;

                return (
                  <button
                    key={loan.id}
                    type="button"
                    onClick={() => {
                      setSelectedLoanId(loan.id);
                      setSuccessMessage(null);
                    }}
                    className={`${styles.applicationItem} ${
                      isSelected ? styles.applicationItemSelected : ''
                    }`}
                    data-testid={`loan-item-${loan.id}`}
                  >
                    <div className={styles.appItemHeader}>
                      <span className={styles.companyName}>{companyName}</span>
                      <span className={styles.cuitText}>{cuit}</span>
                    </div>

                    <div className={styles.appItemDetails}>
                      <span className={styles.requestedAmount}>
                        {formatCurrency(loan.amount_requested)}
                      </span>
                      <span className={styles.categoryTag}>{category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Application Detail & Scoring Console */}
        <section className={styles.panelCard} aria-labelledby="scoring-console-title">
          {!selectedLoan ? (
            <div className={styles.noSelectionPlaceholder} data-testid="no-loan-selected">
              <p>Seleccioná una solicitud para evaluar la documentación y parametrizar la subasta.</p>
            </div>
          ) : (
            <div data-testid="loan-detail-view">
              {/* Application Details */}
              <div className={styles.detailSection}>
                <div className={styles.detailHeader}>
                  <h2 id="scoring-console-title" className={styles.detailTitle}>
                    {selectedProfile?.legal_name ?? 'Solicitud PyME'}
                  </h2>
                  <span className={styles.categoryTag}>
                    {LOAN_CATEGORY_LABELS[selectedLoan.category] ?? selectedLoan.category}
                  </span>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>CUIT / Identificación Fiscal</span>
                    <span className={`${styles.infoValue} ${styles.cuitText}`} data-testid="detail-cuit">
                      {selectedProfile?.tax_id ?? 'N/A'}
                    </span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Monto Solicitado</span>
                    <span className={styles.infoValue} data-testid="detail-amount">
                      {formatCurrency(selectedLoan.amount_requested)}
                    </span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Plazo Pretendido</span>
                    <span className={styles.infoValue}>{selectedLoan.term_months} meses</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Esquema de Tasa</span>
                    <span className={styles.infoValue}>
                      {selectedLoan.rate_type === 'TNA_FIXED' ? 'TNA Fija' : 'CER + Spread'}
                    </span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Teléfono de Contacto</span>
                    <span className={styles.infoValue}>{selectedProfile?.phone ?? 'N/A'}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>CBU/CVU de Desembolso</span>
                    <span className={`${styles.infoValue} ${styles.cuitText}`}>
                      {selectedProfile?.bank_cbu_cvu ?? 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Project Description */}
                <div>
                  <span className={styles.infoLabel}>Destino y Proyecto</span>
                  <p className={styles.projectDescription} data-testid="detail-description">
                    Financiamiento para {LOAN_CATEGORY_LABELS[selectedLoan.category] ?? selectedLoan.category}.
                    Plazo solicitado de {selectedLoan.term_months} meses bajo modalidad{' '}
                    {selectedLoan.rate_type === 'TNA_FIXED' ? 'tasa nominal fija' : 'indexada por CER'}.
                  </p>
                </div>
              </div>

              {/* Uploaded Documents Section */}
              <div className={styles.detailSection} data-testid="document-inspection-section">
                <span className={styles.infoLabel}>Documentación Respaldatoria</span>
                <div className={styles.documentsGrid}>
                  <a
                    href="https://storage.lencord.ar/documents/constancia-afip.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.docLink}
                    data-testid="link-doc-afip"
                  >
                    📄 Constancia AFIP/ARCA
                  </a>

                  <a
                    href="https://storage.lencord.ar/documents/extractos-bancarios.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.docLink}
                    data-testid="link-doc-bank"
                  >
                    📄 Extractos bancarios (3m)
                  </a>

                  {selectedCreditProfile?.balance_sheet_url ? (
                    <a
                      href={selectedCreditProfile.balance_sheet_url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.docLink}
                      data-testid="link-doc-balance"
                    >
                      📄 Balance contable
                    </a>
                  ) : (
                    <div className={styles.docDisabled} data-testid="doc-balance-missing">
                      📄 Balance: No presentado
                    </div>
                  )}

                  {selectedCreditProfile?.f931_url ? (
                    <a
                      href={selectedCreditProfile.f931_url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.docLink}
                      data-testid="link-doc-f931"
                    >
                      📄 Formulario 931
                    </a>
                  ) : (
                    <div className={styles.docDisabled} data-testid="doc-f931-missing">
                      📄 Formulario 931: No presentado
                    </div>
                  )}
                </div>
              </div>

              {/* Scoring and Publication Form */}
              <form onSubmit={handleApproveAndPublish} data-testid="scoring-form">
                <h3 className={styles.panelTitle}>Parametrización y Aprobación</h3>

                {formError && (
                  <div className={styles.errorAlert} data-testid="form-error-alert" role="alert">
                    {formError}
                  </div>
                )}

                <div className={styles.formRow}>
                  {/* BCRA Situation */}
                  <div className={styles.formGroup}>
                    <label htmlFor="bcra-situation-select" className={styles.formLabel}>
                      Situación BCRA (1 a 5)
                    </label>
                    <select
                      id="bcra-situation-select"
                      value={bcraSituation}
                      onChange={(e) => setBcraSituation(Number(e.target.value))}
                      className={styles.formSelect}
                      data-testid="select-bcra-situation"
                    >
                      <option value={1}>1 - Situación normal (sin mora)</option>
                      <option value={2}>2 - Con seguimiento especial (&lt; 60 días)</option>
                      <option value={3}>3 - Con problemas (mora hasta 120 días)</option>
                      <option value={4}>4 - Alto riesgo de insolvencia</option>
                      <option value={5}>5 - Irrecuperable</option>
                    </select>
                  </div>

                  {/* Risk Tier */}
                  <div className={styles.formGroup}>
                    <label htmlFor="risk-tier-select" className={styles.formLabel}>
                      Nivel de Riesgo Asignado
                    </label>
                    <select
                      id="risk-tier-select"
                      value={riskTier}
                      onChange={(e) => setRiskTier(e.target.value as RiskTier)}
                      className={styles.formSelect}
                      data-testid="select-risk-tier"
                    >
                      <option value="Tier A">Tier A (Bajo riesgo / Máxima solvencia)</option>
                      <option value="Tier B">Tier B (Riesgo moderado / Solvencia estándar)</option>
                      <option value="Tier C">Tier C (Mayor rendimiento / Evaluación)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  {/* Investor Rate */}
                  <div className={styles.formGroup}>
                    <label htmlFor="investor-rate-input" className={styles.formLabel}>
                      Tasa Inversor ({selectedLoan.rate_type === 'TNA_FIXED' ? '% TNA' : '% Spread CER'})
                    </label>
                    <input
                      id="investor-rate-input"
                      type="number"
                      step="0.1"
                      min="0"
                      value={investorRate}
                      onChange={(e) => setInvestorRate(parseFloat(e.target.value) || 0)}
                      className={styles.formInput}
                      data-testid="input-investor-rate"
                    />
                  </div>

                  {/* Platform Spread */}
                  <div className={styles.formGroup}>
                    <label htmlFor="platform-spread-input" className={styles.formLabel}>
                      Spread Lencord (%)
                    </label>
                    <input
                      id="platform-spread-input"
                      type="number"
                      step="0.05"
                      min="0"
                      value={platformSpread}
                      onChange={(e) => setPlatformSpread(parseFloat(e.target.value) || 0)}
                      className={styles.formInput}
                      data-testid="input-platform-spread"
                    />
                  </div>
                </div>

                {/* Final Rate Calculation Box */}
                <div className={styles.rateCalculationBox} data-testid="rate-calculation-box">
                  <div>
                    <span className={styles.infoLabel}>Tasa Final PyME Resultante</span>
                    <div className={styles.rateFormula}>
                      Tasa Inversor ({investorRate}%) + Spread Lencord ({platformSpread}%)
                    </div>
                  </div>
                  <div className={styles.finalRateDisplay} data-testid="borrower-final-rate">
                    {calculatedBorrowerRate.toFixed(2)}%
                  </div>
                </div>

                {/* Auction Deadline */}
                <div className={styles.formGroup}>
                  <label htmlFor="funding-deadline-input" className={styles.formLabel}>
                    Fecha límite de subasta (Cierre)
                  </label>
                  <input
                    id="funding-deadline-input"
                    type="datetime-local"
                    value={fundingDeadline}
                    onChange={(e) => setFundingDeadline(e.target.value)}
                    className={styles.formInput}
                    data-testid="input-funding-deadline"
                  />
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={submitting}
                  onClick={handleApproveAndPublish}
                  data-testid="btn-approve-publish"
                >
                  {submitting ? 'Aprobando y publicando...' : 'Aprobar y publicar en subasta'}
                </Button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
