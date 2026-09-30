'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Installment, Loan, LoanStatus } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { LOAN_CATEGORY_LABELS, calculateDaysRemaining, formatRateDisplay } from '@/components/marketplace/LoanCard';
import { PromissoryNoteModal } from '@/components/legal/PromissoryNoteModal';
import { NotificationPreferencesCard } from './NotificationPreferencesCard';
import { computeFundingDeadline, type DeadlineOption } from '@/components/solicitar/StepProjectConditions';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { cleanCuit, validateCuit, formatCuit } from '@/components/solicitar/cuitValidator';
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
  rejected: { label: 'Rechazado', className: styles.statusRefunded },
  expired: { label: 'Vencido / Expirado', className: styles.statusRefunded },
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
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(null);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  // Deadline definition modal state (Issue #56)
  const [deadlineModalLoan, setDeadlineModalLoan] = useState<Loan | null>(null);
  const [deadlineOption, setDeadlineOption] = useState<DeadlineOption>('30_days');
  const [customDeadlineInput, setCustomDeadlineInput] = useState<string>('');
  const [deadlineModalError, setDeadlineModalError] = useState<string | null>(null);
  const [isSavingDeadline, setIsSavingDeadline] = useState<boolean>(false);

  // Dual-role Investor activation state
  const [hasInvestorRole, setHasInvestorRole] = useState<boolean>(false);
  const [investorLegalName, setInvestorLegalName] = useState<string>('');
  const [investorTaxId, setInvestorTaxId] = useState<string>('');
  const [investorCbu, setInvestorCbu] = useState<string>('');
  const [investorErrors, setInvestorErrors] = useState<{ name?: string; taxId?: string; cbu?: string }>({});
  const [isActivatingInvestor, setIsActivatingInvestor] = useState<boolean>(false);
  const [investorActivationSuccess, setInvestorActivationSuccess] = useState<string | null>(null);

  // Check investor role for current borrower user
  useEffect(() => {
    let isMounted = true;
    async function checkInvestorRole() {
      const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === currentBorrowerId);
      if (mockProfile && (mockProfile.role === 'investor' || (mockProfile as any).has_investor_role)) {
        if (isMounted) setHasInvestorRole(true);
      }

      try {
        const client = createSupabaseBrowserClient();
        const { data: authData } = await client.auth.getUser();
        if (authData?.user && isMounted) {
          const userRoles = Array.isArray(authData.user.user_metadata?.roles)
            ? authData.user.user_metadata.roles
            : [authData.user.user_metadata?.role].filter(Boolean);
          if (userRoles.includes('investor') || authData.user.user_metadata?.role === 'investor') {
            setHasInvestorRole(true);
          }
        }

        const { data: profile } = await client
          .from('profiles')
          .select('id, role')
          .eq('id', currentBorrowerId)
          .maybeSingle();

        if (profile?.role === 'investor' && isMounted) {
          setHasInvestorRole(true);
        }
      } catch {
        // Ignored
      }
    }

    checkInvestorRole();
    return () => {
      isMounted = false;
    };
  }, [currentBorrowerId]);


  // Keep state synced with props or resolve session user
  useEffect(() => {
    if (borrowerId) {
      setCurrentBorrowerId(borrowerId);
    }
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

  const handleActivateInvestorRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; taxId?: string; cbu?: string } = {};

    if (!investorLegalName.trim()) {
      errors.name = 'El nombre completo o razón social es obligatorio.';
    }

    const cleanTax = cleanCuit(investorTaxId);
    if (!cleanTax) {
      errors.taxId = 'El DNI o CUIT es obligatorio.';
    } else if (cleanTax.length < 7 || (cleanTax.length > 8 && cleanTax.length < 11) || cleanTax.length > 11) {
      errors.taxId = 'Ingrese un DNI válido (7 u 8 dígitos) o CUIT (11 dígitos).';
    } else if (cleanTax.length === 11 && !validateCuit(cleanTax)) {
      errors.taxId = 'El CUIT de 11 dígitos no es válido según el algoritmo oficial (ARCA/AFIP).';
    }

    const cleanBankCbu = investorCbu.replace(/\D/g, '');
    if (cleanBankCbu && cleanBankCbu.length !== 22) {
      errors.cbu = 'El CBU o CVU bancario debe tener exactamente 22 dígitos.';
    }

    if (Object.keys(errors).length > 0) {
      setInvestorErrors(errors);
      return;
    }

    setIsActivatingInvestor(true);
    setInvestorErrors({});

    try {
      const client = createSupabaseBrowserClient();
      let currentRoles: string[] = ['borrower'];
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData?.user) {
          if (Array.isArray(authData.user.user_metadata?.roles)) {
            currentRoles = authData.user.user_metadata.roles;
          } else if (authData.user.user_metadata?.role) {
            currentRoles = [authData.user.user_metadata.role];
          }
        }
      } catch {
        // Ignored
      }

      const updatedRoles = Array.from(new Set([...currentRoles, 'investor']));

      try {
        await client.auth.updateUser({
          data: {
            roles: updatedRoles,
            active_role: 'investor',
            investor_legal_name: investorLegalName.trim(),
            investor_tax_id: cleanTax,
            investor_cbu: cleanBankCbu || undefined,
          },
        });
      } catch {
        // Ignored
      }

      // Update mock store
      const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === currentBorrowerId);
      if (mockProfile) {
        (mockProfile as any).has_investor_role = true;
      }
      const existingInvestor = defaultMockStateStore.profiles.find(
        (p) => p.tax_id === cleanTax && p.role === 'investor'
      );
      if (!existingInvestor) {
        defaultMockStateStore.profiles.push({
          id: `prof-inv-${Date.now()}`,
          role: 'investor',
          tax_id: cleanTax,
          legal_name: investorLegalName.trim(),
          email: 'inversor@lencord.com',
          bank_cbu_cvu: cleanBankCbu || '0000000000000000000000',
          custody_balance: 0,
          kyc_status: 'verified',
          created_at: new Date().toISOString(),
        } as any);
      }

      setHasInvestorRole(true);
      setInvestorActivationSuccess(
        '¡Perfil inversor activado con éxito! Ahora podés explorar el marketplace e invertir.'
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-state-change'));
      }
    } catch (err: any) {
      setInvestorErrors({ name: err?.message || 'Error al activar el perfil inversor.' });
    } finally {
      setIsActivatingInvestor(false);
    }
  };

  const renderInvestorOnboardingCard = () => {
    if (hasInvestorRole && !investorActivationSuccess) {
      return (
        <div className={styles.onboardingRoleCardActive} data-testid="investor-role-active-banner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className={styles.statusBadge} style={{ backgroundColor: '#eff6ff', color: '#1e40af', marginBottom: '0.25rem', display: 'inline-block' }}>
                ✓ Perfil inversor activo
              </span>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155' }}>
                Tu cuenta dispone de permisos como inversor. Podés participar en subastas de crédito y rentabilizar excedentes de liquidez.
              </p>
            </div>
            <Link href="/dashboard/inversor">
              <Button variant="bordered" size="sm" data-testid="btn-go-to-investor-dashboard">
                Ir a mi panel inversor →
              </Button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <section className={styles.onboardingRoleCard} data-testid="investor-onboarding-section">
        <div className={styles.onboardingRoleHeader}>
          <div className={styles.onboardingRoleBadge}>Expansión de cuenta</div>
          <h3 className={styles.onboardingRoleTitle}>
            ¿Querés rentabilizar los excedentes de tu empresa o personales? Activá tu perfil inversor
          </h3>
          <p className={styles.onboardingRoleDesc}>
            Con tu misma cuenta podés invertir en préstamos a otras empresas argentinas con rendimientos competitivos y cobro mensual automatizado.
          </p>
        </div>

        {investorActivationSuccess ? (
          <div className={styles.onboardingSuccessAlert} data-testid="investor-activation-success" role="status">
            <p style={{ margin: 0, fontWeight: 600 }}>✓ {investorActivationSuccess}</p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <Link href="/dashboard/inversor">
                <Button variant="primary" size="sm" data-testid="btn-success-go-to-investor">
                  Ir a mi Panel Inversor →
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="bordered" size="sm" data-testid="btn-success-go-to-marketplace">
                  Explorar Marketplace
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleActivateInvestorRole} className={styles.onboardingRoleForm} data-testid="investor-activation-form" noValidate>
            <div className={styles.onboardingRoleGrid}>
              <Input
                label="Nombre completo o razón social del titular *"
                id="input-investor-name"
                value={investorLegalName}
                onChange={(e) => {
                  setInvestorLegalName(e.target.value);
                  if (investorErrors.name) setInvestorErrors((p) => ({ ...p, name: '' }));
                }}
                placeholder="Ej: Juan Pérez o Inversiones del Centro S.A."
                error={investorErrors.name}
                data-testid="input-investor-name"
              />
              <Input
                label="DNI o CUIT del titular *"
                id="input-investor-tax-id"
                value={investorTaxId}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cleaned = cleanCuit(raw);
                  if (cleaned.length > 8) {
                    setInvestorTaxId(formatCuit(raw));
                  } else {
                    setInvestorTaxId(cleaned);
                  }
                  if (investorErrors.taxId) setInvestorErrors((p) => ({ ...p, taxId: '' }));
                }}
                placeholder="Ej: 34567890 o 20-34567890-4"
                helperText="DNI (7-8 dígitos) o CUIT (11 dígitos)."
                className="font-mono"
                error={investorErrors.taxId}
                data-testid="input-investor-tax-id"
              />
              <Input
                label="CBU/CVU bancario para cobro de cuotas"
                id="input-investor-cbu"
                value={investorCbu}
                onChange={(e) => {
                  setInvestorCbu(e.target.value.replace(/\D/g, '').slice(0, 22));
                  if (investorErrors.cbu) setInvestorErrors((p) => ({ ...p, cbu: '' }));
                }}
                placeholder="22 dígitos bancarios"
                helperText="Donde se acreditarán tus cobranzas mensuales."
                className="font-mono"
                error={investorErrors.cbu}
                data-testid="input-investor-cbu"
              />
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isActivatingInvestor}
                data-testid="btn-activate-investor-role"
              >
                Activar perfil inversor
              </Button>
            </div>
          </form>
        )}
      </section>
    );
  };


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

        {/* Dual-Role Investor Onboarding Card or Active Banner (bottom of panel) */}
        {renderInvestorOnboardingCard()}
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

  const handleSimulatePayment = async (inst: Installment) => {
    try {
      setPayingInstallmentId(inst.id);
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      // Trigger payment collection simulation if payments service is active
      try {
        if (resolvedServices.payments?.collectInstallment) {
          await resolvedServices.payments.collectInstallment(
            inst.id,
            '0720123488000012345678',
            inst.principal_amount + inst.interest_borrower
          );
        }
      } catch (err) {
        console.warn('Payment gateway simulation note:', err);
      }

      // Update state locally
      const updatedInsts = installments.map((i) =>
        i.id === inst.id
          ? { ...i, status: 'paid' as const, paid_at: new Date().toISOString() }
          : i
      );
      setInstallments(updatedInsts);

      const allPaid = updatedInsts.every((i) => i.status === 'paid');
      if (allPaid && currentLoan) {
        setLoans((prev) =>
          prev.map((l) => (l.id === currentLoan.id ? { ...l, status: 'repaid' as const } : l))
        );
      }

      setPaymentSuccessMsg(`¡Pago de la cuota #${inst.installment_number} registrado con éxito!`);
      setTimeout(() => setPaymentSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Error simulating installment payment:', err);
    } finally {
      setPayingInstallmentId(null);
    }
  };

  const handleOpenDeadlineModal = (loan: Loan) => {
    setDeadlineModalLoan(loan);
    setDeadlineOption('30_days');
    setCustomDeadlineInput('');
    setDeadlineModalError(null);
  };

  const handleSaveDeadline = async () => {
    if (!deadlineModalLoan) return;
    setDeadlineModalError(null);

    if (deadlineOption === 'custom') {
      if (!customDeadlineInput) {
        setDeadlineModalError('Por favor seleccioná una fecha personalizada.');
        return;
      }
      const selected = new Date(`${customDeadlineInput}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected.getTime() < today.getTime()) {
        setDeadlineModalError('La fecha límite no puede ser anterior a hoy.');
        return;
      }
    }

    const computed = computeFundingDeadline(deadlineOption, customDeadlineInput);
    if (!computed && deadlineOption !== 'no_limit') {
      setDeadlineModalError('Error al calcular la fecha límite.');
      return;
    }

    try {
      setIsSavingDeadline(true);
      const targetLoanId = deadlineModalLoan.id;
      setLoans((prev) =>
        prev.map((l) => (l.id === targetLoanId ? { ...l, funding_deadline: computed } : l))
      );

      const mockLoan = defaultMockStateStore.loans.find((l) => l.id === targetLoanId);
      if (mockLoan) {
        mockLoan.funding_deadline = computed;
      }

      try {
        const client = createSupabaseBrowserClient();
        await client.from('loans').update({ funding_deadline: computed }).eq('id', targetLoanId);
      } catch {
        // Ignored in mock/offline mode
      }

      setDeadlineModalLoan(null);
    } catch (err: any) {
      setDeadlineModalError(err?.message || 'Error al guardar el vencimiento.');
    } finally {
      setIsSavingDeadline(false);
    }
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
              data-testid="borrower-loan-select"
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
            <span className={styles.metricLabel}>Monto solicitado</span>
            <div className={styles.tierStatAmount}>{formatCurrency(currentLoan.amount_requested)}</div>
            <div className={styles.secondaryText}>Plazo: {currentLoan.term_months} meses</div>
          </div>

          <div className={styles.tierStatItem} style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <span className={styles.metricLabel}>Esquema de tasa</span>
            <div className={styles.tierStatAmount}>
              {currentLoan.borrower_rate > 0
                ? formatRateDisplay(currentLoan.rate_type, currentLoan.borrower_rate)
                : currentLoan.rate_type === 'TNA_FIXED'
                  ? 'Tasa fija (TNA)'
                  : 'CER/UVA + spread'}
            </div>
            <div className={styles.secondaryText}>
              {currentLoan.borrower_rate > 0 ? 'Tasa final aprobada' : 'A definir en scoring'}
            </div>
          </div>

          <div className={styles.tierStatItem} style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <span className={styles.metricLabel}>Estado actual</span>
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
                en tu CBU/CVU bancario, es necesario firmar el <strong>pagaré digital</strong> correspondiente.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleSigningClick}
            data-testid="btn-sign-promissory-note"
          >
            Firmar pagaré digital
          </Button>
        </section>
      )}

      {/* STATE 4: active or repaid */}
      {(currentLoan.status === 'active' || currentLoan.status === 'repaid') && (
        <section className={styles.section} aria-labelledby="amortization-table-title">
          <div className={styles.sectionHeader}>
            <h2 id="amortization-table-title" className={styles.sectionTitle}>
              Cuadro de amortización (sistema francés)
            </h2>
            <p className={styles.sectionDescription}>
              Detalle de cuotas mensuales, vencimientos, amortización de capital e intereses a abonar.
            </p>
          </div>

          {paymentSuccessMsg && (
            <div className={styles.successAlert} role="status" data-testid="payment-success-alert">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{paymentSuccessMsg}</span>
            </div>
          )}

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
                    <th scope="col">Amortización (capital)</th>
                    <th scope="col">Interés</th>
                    <th scope="col">Total cuota</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acción</th>
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
                        <td>
                          {inst.status !== 'paid' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={payingInstallmentId === inst.id}
                              onClick={() => handleSimulatePayment(inst)}
                              data-testid={`btn-pay-installment-${inst.installment_number}`}
                            >
                              {payingInstallmentId === inst.id ? 'Procesando...' : 'Simular pago'}
                            </Button>
                          ) : (
                            <span style={{ fontSize: '0.8125rem', color: '#047857', fontWeight: 500 }}>
                              Abonada
                            </span>
                          )}
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

      {/* Historical and all loan applications list (Issue #56) */}
      {loans.length > 0 && (
        <section
          className={styles.historySection}
          aria-labelledby="loan-history-title"
          data-testid="borrower-loans-history-section"
        >
          <div className={styles.sectionHeader}>
            <h2 id="loan-history-title" className={styles.sectionTitle}>
              Historial de solicitudes de financiamiento
            </h2>
            <p className={styles.sectionDescription}>
              Registro completo de solicitudes activas, fondeadas y finalizadas de tu empresa.
            </p>
          </div>

          <div className={styles.tableCard} data-testid="borrower-loans-history">
            <table className={styles.table} role="table">
              <thead>
                <tr>
                  <th scope="col">Proyecto/Destino</th>
                  <th scope="col">Monto solicitado</th>
                  <th scope="col">Plazo y tasa</th>
                  <th scope="col">Fecha de solicitud</th>
                  <th scope="col">Vencimiento de subasta</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const loanStatusMeta = LOAN_STATUS_LABELS[loan.status] ?? {
                    label: loan.status,
                    className: styles.statusPending,
                  };
                  const formattedRequestedDate = new Date(loan.created_at).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const formattedDeadline = loan.funding_deadline
                    ? new Date(loan.funding_deadline).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                    : 'Sin fecha límite';

                  const isFundingNoDeadline = loan.status === 'funding' && !loan.funding_deadline;

                  return (
                    <tr key={loan.id} data-testid={`loan-history-row-${loan.id}`}>
                      {/* 1. Proyecto / Destino */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className={styles.categoryBadge} data-testid={`category-badge-${loan.id}`}>
                            {LOAN_CATEGORY_LABELS[loan.category] ?? loan.category}
                          </span>
                          <span
                            className={styles.secondaryText}
                            style={{ fontSize: '0.8125rem' }}
                            data-testid={`loan-desc-${loan.id}`}
                          >
                            {loan.description || 'Sin descripción detallada'}
                          </span>
                        </div>
                      </td>

                      {/* 2. Monto solicitado */}
                      <td data-testid={`loan-amount-${loan.id}`}>
                        <strong>{formatCurrency(loan.amount_requested)}</strong>
                      </td>

                      {/* 3. Plazo y Tasa */}
                      <td data-testid={`loan-terms-${loan.id}`}>
                        <div>{loan.term_months} meses</div>
                        <div className={styles.secondaryText} style={{ fontSize: '0.75rem' }}>
                          {loan.rate_type === 'TNA_FIXED' ? 'Tasa Fija (TNA)' : 'CER + spread'}
                        </div>
                      </td>

                      {/* 4. Fecha de solicitud */}
                      <td data-testid={`loan-date-${loan.id}`}>{formattedRequestedDate}</td>

                      {/* 5. Vencimiento de subasta */}
                      <td data-testid={`loan-deadline-${loan.id}`}>
                        {loan.funding_deadline ? (
                          formattedDeadline
                        ) : (
                          <span
                            className={styles.statusBadge}
                            style={{ backgroundColor: '#f1f5f9', color: '#475569' }}
                          >
                            Sin fecha límite
                          </span>
                        )}
                      </td>

                      {/* 6. Estado */}
                      <td>
                        <span
                          className={`${styles.statusBadge} ${loanStatusMeta.className}`}
                          data-testid={`loan-status-${loan.id}`}
                        >
                          {loanStatusMeta.label}
                        </span>
                      </td>

                      {/* 7. Acciones */}
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Button
                            variant={loan.id === currentLoan.id ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setSelectedLoanId(loan.id)}
                            data-testid={`btn-select-loan-${loan.id}`}
                          >
                            {loan.id === currentLoan.id ? 'Seleccionado' : 'Ver detalle'}
                          </Button>

                          {loan.status === 'funded' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedLoanId(loan.id);
                                handleSigningClick();
                              }}
                              data-testid={`btn-sign-promissory-loan-${loan.id}`}
                            >
                              Firmar pagaré
                            </Button>
                          )}

                          {loan.status === 'funding' && (
                            <Button
                              variant="bordered"
                              size="sm"
                              onClick={() => handleOpenDeadlineModal(loan)}
                              data-testid={`btn-define-deadline-${loan.id}`}
                            >
                              {isFundingNoDeadline ? 'Definir vencimiento' : 'Modificar vencimiento'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal para Definir o Modificar Vencimiento de Subasta (Issue #56) */}
      {deadlineModalLoan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deadline-modal-title"
          className={styles.modalOverlay}
          data-testid="deadline-modal"
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 id="deadline-modal-title" className={styles.modalTitle}>
                Definir vencimiento de subasta
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setDeadlineModalLoan(null)}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalDescription}>
                Establecé o modificá el plazo de cierre para el fondeo colectivo de tu solicitud de{' '}
                <strong>{LOAN_CATEGORY_LABELS[deadlineModalLoan.category]}</strong>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <label htmlFor="modal-deadline-select" className={styles.fieldLabel}>
                  Plazo de vigencia de la subasta:
                </label>
                <select
                  id="modal-deadline-select"
                  className={styles.selectInput}
                  value={deadlineOption}
                  onChange={(e) => setDeadlineOption(e.target.value as DeadlineOption)}
                  data-testid="modal-deadline-select"
                >
                  <option value="15_days">15 días adicionales</option>
                  <option value="30_days">30 días adicionales</option>
                  <option value="45_days">45 días adicionales</option>
                  <option value="custom">Fecha personalizada</option>
                  <option value="no_limit">Sin fecha límite (abierta)</option>
                </select>

                {deadlineOption === 'custom' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <Input
                      label="Fecha de cierre *"
                      id="modal-custom-date"
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={customDeadlineInput}
                      onChange={(e) => {
                        setCustomDeadlineInput(e.target.value);
                        if (deadlineModalError) setDeadlineModalError(null);
                      }}
                      error={deadlineModalError ?? undefined}
                      data-testid="modal-custom-date"
                    />
                  </div>
                )}

                {deadlineModalError && deadlineOption !== 'custom' && (
                  <span className={styles.errorMessage} role="alert" data-testid="deadline-modal-error">
                    {deadlineModalError}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <Button
                variant="bordered"
                size="md"
                onClick={() => setDeadlineModalLoan(null)}
                disabled={isSavingDeadline}
                data-testid="btn-cancel-deadline"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={isSavingDeadline}
                onClick={handleSaveDeadline}
                data-testid="btn-save-deadline"
              >
                Guardar vencimiento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* User Notification Preferences (SMS / WhatsApp / Email) */}
      <NotificationPreferencesCard
        userId={currentBorrowerId}
        onSave={async (prefs) => {
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
            if (resolvedServices.multiChannelNotifications) {
              await resolvedServices.multiChannelNotifications.updateUserPreferences(
                currentBorrowerId,
                prefs
              );
            }
          } catch (err) {
            console.warn('Failed to update notification preferences:', err);
          }
        }}
      />

      {/* Dual-Role Investor Onboarding Card or Active Banner (bottom of panel) */}
      {renderInvestorOnboardingCard()}

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
