'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BcraCreditReport,
  BcraSituation,
  Loan,
  Profile,
  RiskTier,
  SmeCreditProfile,
} from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { isUsingMocks } from '@/services/env';
import { createSupabaseBrowserClient, SupabaseStorageService } from '@/services/supabase';
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
  pollIntervalMs?: number;
  storageService?: SupabaseStorageService;
}

export function AdminConsole({
  initialLoans,
  initialProfiles,
  initialCreditProfiles,
  className = '',
  pollIntervalMs,
  storageService,
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

  // Confirmation modal & Rejection modal states
  const [isConfirmApprovalOpen, setIsConfirmApprovalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<boolean>(false);

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

        // Build profiles map from real DB and fallbacks
        const newProfiles: Record<string, Profile> = { ...profilesMap };
        const borrowerIds = Array.from(new Set(inReviewLoans.map((l) => l.borrower_id)));

        if (borrowerIds.length > 0) {
          if (!isUsingMocks()) {
            try {
              const client = createSupabaseBrowserClient();
              const { data: dbProfiles } = await client
                .from('profiles')
                .select('*')
                .in('id', borrowerIds);

              if (dbProfiles) {
                dbProfiles.forEach((p: any) => {
                  newProfiles[p.id] = p;
                });
              }
            } catch {
              // Keep fallback
            }
          }

          borrowerIds.forEach((bId) => {
            if (!newProfiles[bId]) {
              const mock = SEED_PROFILES.find((p: Profile) => p.id === bId);
              if (mock) {
                newProfiles[bId] = mock as any;
              }
            }
          });
        }

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
          setProfilesMap(newProfiles);
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

  // Refresh applications from service
  const refreshApplications = useCallback(async () => {
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

      const inReviewLoans = await resolvedServices.loans.listLoans({ status: 'in_review' });
      setLoans((prev) => {
        const otherLoans = prev.filter((l) => l.status !== 'in_review');
        return [...otherLoans, ...inReviewLoans];
      });
    } catch (err) {
      console.error('Error refreshing applications in admin console:', err);
    }
  }, [servicesFromContext]);

  // Periodic polling for real-time application queue updates
  useEffect(() => {
    const interval = pollIntervalMs ?? (initialLoans ? 0 : 5000);
    if (!interval || interval <= 0) return;

    const timer = setInterval(() => {
      refreshApplications();
    }, interval);

    return () => clearInterval(timer);
  }, [pollIntervalMs, initialLoans, refreshApplications]);

  // Supabase Realtime channel subscription
  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();
      const channel = supabase
        .channel('admin-realtime-loans')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'loans' },
          () => {
            refreshApplications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // In mock/test environments without real Supabase connection
    }
  }, [refreshApplications]);

  // Pending loans ordered chronologically by submission date (newest first)
  const pendingLoans = useMemo(() => {
    return [...loans]
      .filter((l) => l.status === 'in_review')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [loans]);

  // Selected loan
  const selectedLoan = useMemo(() => {
    if (!selectedLoanId) {
      return pendingLoans.length > 0 ? pendingLoans[0] : null;
    }
    return loans.find((l) => l.id === selectedLoanId) ?? null;
  }, [loans, selectedLoanId, pendingLoans]);

  const selectedProfile = useMemo(() => {
    return selectedLoan ? profilesMap[selectedLoan.borrower_id] ?? null : null;
  }, [selectedLoan, profilesMap]);

  const selectedCreditProfile = useMemo(() => {
    return selectedLoan ? creditProfilesMap[selectedLoan.borrower_id] ?? null : null;
  }, [selectedLoan, creditProfilesMap]);

  // Short-lived signed URLs (15-min expiration) via Supabase Storage client
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let isCancelled = false;

    async function resolveSignedUrls() {
      if (!selectedCreditProfile) {
        setSignedUrls({});
        setDocErrors({});
        return;
      }

      const newSignedUrls: Record<string, string> = {};
      const newErrors: Record<string, string> = {};

      const afipRaw =
        selectedCreditProfile.afip_url !== undefined
          ? selectedCreditProfile.afip_url
          : (isUsingMocks() && selectedCreditProfile.balance_sheet_url
            ? '/documents/constancia-afip.pdf'
            : null);

      const bankRaw =
        selectedCreditProfile.bank_statements_url !== undefined
          ? selectedCreditProfile.bank_statements_url
          : (isUsingMocks() && selectedCreditProfile.balance_sheet_url
            ? '/documents/extractos-bancarios.pdf'
            : null);

      const docsToResolve: Array<{ key: 'balance' | 'f931' | 'afip' | 'bank'; rawUrl: string | null }> = [
        { key: 'afip', rawUrl: afipRaw },
        { key: 'bank', rawUrl: bankRaw },
        { key: 'balance', rawUrl: selectedCreditProfile.balance_sheet_url },
        { key: 'f931', rawUrl: selectedCreditProfile.f931_url },
      ];

      let effectiveService = storageService;
      if (!effectiveService && !isUsingMocks()) {
        try {
          effectiveService = new SupabaseStorageService(createSupabaseBrowserClient());
        } catch {
          // ignore
        }
      }

      for (const { key, rawUrl } of docsToResolve) {
        if (!rawUrl) continue;

        if (effectiveService) {
          try {
            const cleanPath = rawUrl
              .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/loan-documents\//, '')
              .replace(/^https?:\/\/[^/]+\/documents\//, '')
              .replace(/^\/?documents\//, '')
              .replace(/^loan-documents\//, '');

            const res = await effectiveService.createSignedDocumentUrl(cleanPath, 900);
            if (res.signedUrl) {
              newSignedUrls[key] = res.signedUrl;
            } else if (res.error) {
              newErrors[key] = res.error.message || 'Error al generar enlace seguro: No autorizado o token expirado.';
            }
          } catch (err: any) {
            newErrors[key] = err?.message || 'Error al generar enlace seguro: No autorizado o token expirado.';
          }
        } else {
          newSignedUrls[key] = rawUrl;
        }
      }

      if (!isCancelled) {
        setSignedUrls(newSignedUrls);
        setDocErrors(newErrors);
      }
    }

    resolveSignedUrls();

    return () => {
      isCancelled = true;
    };
  }, [selectedCreditProfile, storageService]);

  // BCRA Credit Report State and Live Fetching
  const [bcraReport, setBcraReport] = useState<BcraCreditReport | null>(null);
  const [bcraLoading, setBcraLoading] = useState<boolean>(false);
  const [bcraError, setBcraError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchBcraReport() {
      if (!selectedProfile?.tax_id) {
        setBcraReport(null);
        setBcraError(null);
        setBcraLoading(false);
        return;
      }

      const cleanCuit = selectedProfile.tax_id.replace(/\D/g, '');
      if (!cleanCuit || cleanCuit.length !== 11) {
        setBcraReport(null);
        setBcraError('CUIT inválido: debe contener 11 dígitos.');
        setBcraLoading(false);
        return;
      }

      setBcraLoading(true);
      setBcraError(null);

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

        let report: BcraCreditReport;
        if (resolvedServices?.creditScoring) {
          report = await resolvedServices.creditScoring.getBcraReport(cleanCuit);
        } else {
          const res = await fetch(`/api/bcra/${cleanCuit}`);
          if (!res.ok) {
            throw new Error('Servicio BCRA no disponible');
          }
          report = await res.json();
        }

        if (!isCancelled) {
          setBcraReport(report);
          setBcraLoading(false);

          if (
            report.statusDescription?.includes('no disponible') ||
            report.statusDescription?.includes('Tiempo de espera agotado') ||
            report.statusDescription?.includes('inválido')
          ) {
            setBcraError(report.statusDescription);
          } else if (report.worstSituation) {
            setBcraSituation(report.worstSituation);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setBcraLoading(false);
          setBcraError(err?.message || 'Error de conexión con el servicio BCRA.');
        }
      }
    }

    fetchBcraReport();

    return () => {
      isCancelled = true;
    };
  }, [selectedProfile?.tax_id, servicesFromContext]);

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

      const deadlineDate = selectedLoan.funding_deadline
        ? new Date(selectedLoan.funding_deadline)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      setFundingDeadline(isNaN(deadlineDate.getTime()) ? '' : deadlineDate.toISOString().slice(0, 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLoanId]);

  // Dynamic borrower final rate calculation
  const calculatedBorrowerRate = useMemo(() => {
    const inv = isNaN(investorRate) ? 0 : investorRate;
    const spread = isNaN(platformSpread) ? 0 : platformSpread;
    return Number((inv + spread).toFixed(2));
  }, [investorRate, platformSpread]);

  // Approval validation & confirmation modal trigger
  const handleInitiateApproval = (e: React.FormEvent) => {
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

    // Validation passed, open confirmation modal
    setIsConfirmApprovalOpen(true);
  };

  // Final approval execution after confirmation modal
  const handleConfirmApproval = async () => {
    if (!selectedLoan) return;

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
      setIsConfirmApprovalOpen(false);

      // Select next pending loan if available
      const remainingPending = pendingLoans.filter((l) => l.id !== selectedLoan.id);
      if (remainingPending.length > 0) {
        setSelectedLoanId(remainingPending[0].id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error al aprobar y publicar el préstamo.');
      setIsConfirmApprovalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Rejection handlers
  const handleOpenRejectModal = () => {
    setRejectionReason('');
    setRejectionError(null);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedLoan) return;

    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      setRejectionError('Debes ingresar un motivo de rechazo no vacío.');
      return;
    }

    try {
      setRejecting(true);
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      const updatedLoan = await resolvedServices.loans.rejectLoan(selectedLoan.id, trimmedReason);

      setLoans((prev) => prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l)));
      setSuccessMessage(
        `La solicitud ${selectedLoan.id} ha sido rechazada correctamente.`
      );
      setIsRejectModalOpen(false);

      // Select next pending loan if available
      const remainingPending = pendingLoans.filter((l) => l.id !== selectedLoan.id);
      if (remainingPending.length > 0) {
        setSelectedLoanId(remainingPending[0].id);
      }
    } catch (err: any) {
      setRejectionError(err.message || 'Error al rechazar la solicitud.');
    } finally {
      setRejecting(false);
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
              <p>No hay solicitudes pendientes de revisión</p>
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

                    <div className={styles.appItemMeta}>
                      <span data-testid={`loan-term-${loan.id}`}>
                        Plazo: {loan.term_months} meses
                      </span>
                      <span data-testid={`loan-rate-${loan.id}`}>
                        {loan.rate_type === 'TNA_FIXED' ? 'TNA Fija' : 'CER + Spread'}
                      </span>
                      <span
                        data-testid={`loan-timestamp-${loan.id}`}
                        className={styles.timestampText}
                      >
                        {new Date(loan.created_at).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
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
                    <span className={styles.infoValue}>{selectedProfile?.phone || 'No registrado'}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>CBU/CVU de Desembolso</span>
                    <span className={`${styles.infoValue} ${styles.cuitText}`}>
                      {selectedProfile?.bank_cbu_cvu || 'No registrado'}
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
                  {[
                    {
                      key: 'afip' as const,
                      title: 'Constancia AFIP/ARCA',
                      icon: '📄',
                      url:
                        selectedCreditProfile?.afip_url !== undefined
                          ? selectedCreditProfile.afip_url
                          : (isUsingMocks() && selectedCreditProfile?.balance_sheet_url
                            ? '/documents/constancia-afip.pdf'
                            : null),
                    },
                    {
                      key: 'bank' as const,
                      title: 'Extractos bancarios (3m)',
                      icon: '📄',
                      url:
                        selectedCreditProfile?.bank_statements_url !== undefined
                          ? selectedCreditProfile.bank_statements_url
                          : (isUsingMocks() && selectedCreditProfile?.balance_sheet_url
                            ? '/documents/extractos-bancarios.pdf'
                            : null),
                    },
                    {
                      key: 'balance' as const,
                      title: 'Balance contable',
                      icon: '📄',
                      url: selectedCreditProfile?.balance_sheet_url ?? null,
                    },
                    {
                      key: 'f931' as const,
                      title: 'Formulario 931',
                      icon: '📄',
                      url: selectedCreditProfile?.f931_url ?? null,
                    },
                  ].map((doc) => {
                    const resolvedHref = (signedUrls[doc.key] ?? doc.url) || '#';
                    if (doc.url) {
                      if (docErrors[doc.key]) {
                        return (
                          <div
                            key={doc.key}
                            className={styles.docErrorBox}
                            data-testid={`doc-error-${doc.key}`}
                            role="alert"
                          >
                            {docErrors[doc.key]}
                          </div>
                        );
                      }
                      return (
                        <div key={doc.key} className={styles.docCard} data-testid={`doc-card-${doc.key}`}>
                          <div className={styles.docCardHeader}>
                            <span className={styles.docTitle}>{doc.icon} {doc.title}</span>
                            <span className={styles.badgeSuccess} data-testid={`badge-${doc.key}-provided`}>
                              Presentado
                            </span>
                          </div>
                          <div className={styles.docActions}>
                            <a
                              href={resolvedHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.docLink}
                              data-testid={`link-doc-${doc.key}`}
                              title="Vista previa en pestaña segura"
                            >
                              {doc.icon} {doc.title}
                            </a>
                            <a
                              href={resolvedHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.docPreviewBtn}
                              data-testid={`btn-preview-${doc.key}`}
                            >
                              👁 Vista previa
                            </a>
                            <a
                              href={resolvedHref}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.docDownloadBtn}
                              data-testid={`btn-download-${doc.key}`}
                            >
                              ⬇ Descargar
                            </a>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={doc.key}
                        className={styles.docDisabled}
                        data-testid={`doc-${doc.key}-missing`}
                        aria-disabled="true"
                      >
                        <div className={styles.docCardHeader}>
                          <span className={styles.docTitle}>{doc.icon} {doc.title}</span>
                          <span className={styles.badgeNeutral} data-testid={`badge-${doc.key}-omitted`}>
                            No presentado
                          </span>
                        </div>
                        <span>{doc.icon} {doc.title}: No presentado</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BCRA Central de Deudores Scoring Section */}
              <div className={styles.bcraSection} data-testid="bcra-scoring-section">
                <div className={styles.bcraSectionHeader}>
                  <h3 className={styles.bcraTitle}>
                    <span>🏛️ Historial Crediticio Central de Deudores BCRA</span>
                  </h3>
                  {selectedProfile?.tax_id && (
                    <span className={styles.cuitText} data-testid="bcra-cuit-display">
                      CUIT: {selectedProfile.tax_id}
                    </span>
                  )}
                </div>

                {bcraLoading ? (
                  <div className={styles.loadingBox} data-testid="bcra-loading">
                    <div className={styles.spinner} />
                    <p>Consultando Central de Deudores BCRA...</p>
                  </div>
                ) : bcraError ? (
                  <div className={styles.bcraErrorBox} data-testid="bcra-fallback-message" role="alert">
                    <span>⚠️</span>
                    <span>{bcraError}</span>
                  </div>
                ) : bcraReport ? (
                  <div>
                    {/* Worst-case situation prominent highlight */}
                    {bcraReport.worstSituation && bcraReport.worstSituation > 1 ? (
                      <div className={styles.worstSituationAlert} data-testid="bcra-worst-situation" role="alert">
                        <strong>
                          Máximo Riesgo Detectado: Situación {bcraReport.worstSituation}
                        </strong>
                        <p>{bcraReport.statusDescription}</p>
                      </div>
                    ) : bcraReport.entities.length > 0 ? (
                      <div className={styles.cleanSituationBox} data-testid="bcra-worst-situation">
                        <strong>Situación General: Situación 1 - Normal (Sin atrasos)</strong>
                      </div>
                    ) : null}

                    {/* Entities debt details or clean status */}
                    {bcraReport.entities.length > 0 ? (
                      <div className={styles.bcraDebtsTableContainer} data-testid="bcra-debts-table">
                        <div className={styles.bcraTotalDebtRow}>
                          <span>Deuda Total en Sistema Financiero:</span>
                          <strong data-testid="bcra-total-debt">
                            {formatCurrency(bcraReport.totalDebt)}
                          </strong>
                        </div>
                        <table className={styles.bcraTable}>
                          <thead>
                            <tr>
                              <th>Entidad Financiera</th>
                              <th>Monto</th>
                              <th>Situación</th>
                              <th>Días de Atraso</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bcraReport.entities.map((entity, idx) => (
                              <tr key={`${entity.entityName}-${idx}`} data-testid={`bcra-entity-row-${idx}`}>
                                <td data-testid={`bcra-entity-name-${idx}`}>{entity.entityName}</td>
                                <td data-testid={`bcra-entity-amount-${idx}`}>
                                  {formatCurrency(entity.amount)}
                                </td>
                                <td data-testid={`bcra-entity-situation-${idx}`}>
                                  <span
                                    className={
                                      entity.situation === 1
                                        ? styles.badgeSituation1
                                        : styles.badgeSituationAlert
                                    }
                                  >
                                    Situación {entity.situation}
                                  </span>
                                </td>
                                <td data-testid={`bcra-entity-delay-${idx}`}>
                                  {entity.daysPastDue !== undefined
                                    ? `${entity.daysPastDue} días`
                                    : '0 días'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={styles.bcraCleanBox} data-testid="bcra-clean-status">
                        <span className={styles.badgeSituation1}>Situación 1</span>
                        <p>Sin deuda bancaria registrada / Situación 1</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.bcraCleanBox} data-testid="bcra-clean-status">
                    <span className={styles.badgeSituation1}>Situación 1</span>
                    <p>Sin deuda bancaria registrada / Situación 1</p>
                  </div>
                )}
              </div>

              {/* Scoring and Publication Form */}
              <form onSubmit={handleInitiateApproval} data-testid="scoring-form">
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

                {/* Auction Deadline (Read-only, chosen by borrower) */}
                <div className={styles.formGroup}>
                  <label htmlFor="funding-deadline-input" className={styles.formLabel}>
                    Fecha límite de subasta (Fijada por PyME solicitante)
                  </label>
                  <input
                    id="funding-deadline-input"
                    type="datetime-local"
                    value={fundingDeadline}
                    onChange={(e) => setFundingDeadline(e.target.value)}
                    readOnly
                    tabIndex={-1}
                    className={styles.formInput}
                    style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                    data-testid="input-funding-deadline"
                  />
                  <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Solo lectura. La fecha es propuesta por la PyME. Si no es adecuada, rechazar la solicitud indicando el motivo.
                  </small>
                </div>

                {/* Submit & Reject Actions */}
                <div className={styles.formActionsGroup}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    disabled={submitting}
                    onClick={handleInitiateApproval}
                    data-testid="btn-approve-publish"
                  >
                    {submitting ? 'Aprobando y publicando...' : 'Aprobar y publicar en subasta'}
                  </Button>
                  <Button
                    type="button"
                    variant="bordered"
                    size="md"
                    disabled={submitting || rejecting}
                    onClick={handleOpenRejectModal}
                    data-testid="btn-reject-loan"
                  >
                    Rechazar solicitud
                  </Button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>

      {/* Confirmation Modal for Approval & Publication */}
      {isConfirmApprovalOpen && selectedLoan && (
        <div className={styles.modalBackdrop} data-testid="approval-confirmation-modal">
          <div className={styles.modalBox} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
            <h3 id="confirm-modal-title" className={styles.modalTitle}>
              Confirmar Aprobación y Publicación
            </h3>
            <p className={styles.modalDescription}>
              ¿Estás seguro de que deseas aprobar esta solicitud y publicarla inmediatamente en la subasta del marketplace?
            </p>

            <div className={styles.modalSummaryTable}>
              <div className={styles.modalSummaryRow}>
                <span>Solicitante:</span>
                <strong>{selectedProfile?.legal_name ?? selectedLoan.borrower_id}</strong>
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Monto a financiar:</span>
                <strong>{formatCurrency(selectedLoan.amount_requested)}</strong>
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Calificación Asignada:</span>
                <TierBadge tier={riskTier} />
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Tasa Inversores:</span>
                <strong>{investorRate}%</strong>
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Spread Lencord:</span>
                <strong>{platformSpread}%</strong>
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Tasa Final PyME:</span>
                <strong>{calculatedBorrowerRate.toFixed(2)}%</strong>
              </div>
              <div className={styles.modalSummaryRow}>
                <span>Cierre de Subasta:</span>
                <strong>{new Date(fundingDeadline).toLocaleString('es-AR')}</strong>
              </div>
            </div>

            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                size="md"
                disabled={submitting}
                onClick={() => setIsConfirmApprovalOpen(false)}
                data-testid="btn-cancel-approve"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={submitting}
                onClick={handleConfirmApproval}
                data-testid="btn-confirm-approve"
              >
                {submitting ? 'Aprobando...' : 'Confirmar y publicar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {isRejectModalOpen && selectedLoan && (
        <div className={styles.modalBackdrop} data-testid="rejection-modal">
          <div className={styles.modalBox} role="dialog" aria-modal="true" aria-labelledby="reject-modal-title">
            <h3 id="reject-modal-title" className={styles.modalTitle}>
              Rechazar Solicitud de Crédito
            </h3>
            <p className={styles.modalDescription}>
              Indica el motivo del rechazo para la PyME <strong>{selectedProfile?.legal_name ?? selectedLoan.borrower_id}</strong>. Esta acción marcará la solicitud como rechazada.
            </p>

            {rejectionError && (
              <div className={styles.errorAlert} data-testid="rejection-error-alert" role="alert">
                {rejectionError}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="rejection-reason-input" className={styles.formLabel}>
                Motivo del rechazo <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="rejection-reason-input"
                className={styles.rejectionTextarea}
                placeholder="Ej: Ratio de apalancamiento elevado, antecedentes negativos en BCRA, o documentación insuficiente..."
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError(null);
                }}
                data-testid="input-rejection-reason"
              />
            </div>

            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                size="md"
                disabled={rejecting}
                onClick={() => setIsRejectModalOpen(false)}
                data-testid="btn-cancel-reject"
              >
                Cancelar
              </Button>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={rejecting}
                onClick={handleConfirmReject}
                data-testid="btn-confirm-reject"
              >
                {rejecting ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
