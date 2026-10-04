'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CustodyTransaction, Installment, Investment, Loan, RiskTier, SmeCreditProfile } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { TierBadge } from '@/components/ui/TierBadge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { LOAN_CATEGORY_LABELS, formatRateDisplay } from '@/components/marketplace/LoanCard';
import { createSupabaseBrowserClient } from '@/services/supabase';
import { Input } from '@/components/ui/Input';
import { cleanCuit, validateCuit, formatCuit } from '@/components/solicitar/cuitValidator';
import { defaultMockStateStore } from '@/services/mock/mockState';
import { SEED_PROFILES } from '@/services/mock/seedData';
import { WithdrawalModal } from './WithdrawalModal';
import { PromissoryNoteModal } from '@/components/legal/PromissoryNoteModal';
import styles from './dashboard.module.css';

export interface InvestorDashboardProps {
  investorId?: string;
  legalName?: string;
  userEmail?: string;
  cbuCvu?: string;
  custodyBalance?: number;
  initialInvestments?: Investment[];
  initialLoans?: Loan[];
  initialInstallments?: Installment[];
  initialCreditProfiles?: Record<string, SmeCreditProfile>;
  initialBorrowerNames?: Record<string, string>;
  initialTaxId?: string | null;
  className?: string;
}

interface EnrichedInvestment {
  investment: Investment;
  loan: Loan | null;
  riskTier: RiskTier;
  borrowerName?: string;
}

interface EnrichedInstallment {
  installment: Installment;
  loan: Loan | null;
  investorSharePrincipal: number;
  investorShareInterest: number;
  borrowerName?: string;
}

export function InvestorDashboard({
  investorId: investorIdProp,
  legalName,
  userEmail,
  cbuCvu,
  custodyBalance: custodyBalanceProp,
  initialInvestments,
  initialLoans,
  initialInstallments,
  initialCreditProfiles,
  initialBorrowerNames,
  initialTaxId,
  className = '',
}: InvestorDashboardProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  // If investorId is not passed and initialInvestments is provided (unit test mode), use 'prof-inv-001'.
  // Otherwise, default to empty string so authenticated users don't momentarily load mock profile data.
  const [currentInvestorId, setCurrentInvestorId] = useState<string>(
    investorIdProp || (initialInvestments ? 'prof-inv-001' : '')
  );
  const initialProfile = (
    defaultMockStateStore.profiles.find((p) => p.id === (investorIdProp || (initialInvestments ? 'prof-inv-001' : ''))) ||
    SEED_PROFILES.find((p) => p.id === (investorIdProp || (initialInvestments ? 'prof-inv-001' : '')))
  );

  const [investorName, setInvestorName] = useState<string>(legalName ?? initialProfile?.legal_name ?? '');
  const [investorEmail, setInvestorEmail] = useState<string>(userEmail ?? initialProfile?.email ?? '');
  const [investorCbu, setInvestorCbu] = useState<string>(() => {
    const val = cbuCvu ?? initialProfile?.bank_cbu_cvu ?? '';
    return val === '0000000000000000000000' ? '' : val;
  });
  const [investorAlias, setInvestorAlias] = useState<string>((initialProfile as any)?.bank_alias ?? '');
  const [isEditingCbu, setIsEditingCbu] = useState<boolean>(false);
  const [cbuInput, setCbuInput] = useState<string>('');
  const [aliasInput, setAliasInput] = useState<string>('');
  const [cbuError, setCbuError] = useState<string | null>(null);
  const [cbuSuccess, setCbuSuccess] = useState<string | null>(null);
  const [isSavingCbu, setIsSavingCbu] = useState<boolean>(false);
  const [custodyTransactions, setCustodyTransactions] = useState<CustodyTransaction[]>([]);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState<boolean>(false);
  const [custodyBalanceState, setCustodyBalanceState] = useState<number | null>(
    custodyBalanceProp !== undefined ? custodyBalanceProp : null
  );
  const [taxId, setTaxId] = useState<string | null>(initialTaxId ?? null);
  const [isEditingDni, setIsEditingDni] = useState<boolean>(false);
  const [dniInput, setDniInput] = useState<string>('');
  const [dniError, setDniError] = useState<string | null>(null);
  const [dniSuccess, setDniSuccess] = useState<string | null>(null);
  const [isSavingDni, setIsSavingDni] = useState<boolean>(false);
  const [investments, setInvestments] = useState<Investment[]>(initialInvestments ?? []);
  const [selectedLoanForPagare, setSelectedLoanForPagare] = useState<Loan | null>(null);
  const [selectedInvestmentForPagare, setSelectedInvestmentForPagare] = useState<Investment | null>(null);
  const [isPagareModalOpen, setIsPagareModalOpen] = useState<boolean>(false);

  const handleOpenPagare = (loan: Loan, investment: Investment) => {
    setSelectedLoanForPagare(loan);
    setSelectedInvestmentForPagare(investment);
    setIsPagareModalOpen(true);
  };
  const [loansMap, setLoansMap] = useState<Record<string, Loan>>(() => {
    if (!initialLoans) return {};
    return initialLoans.reduce<Record<string, Loan>>((acc, l) => {
      acc[l.id] = l;
      return acc;
    }, {});
  });
  const [creditProfilesMap, setCreditProfilesMap] = useState<Record<string, SmeCreditProfile>>(
    initialCreditProfiles ?? {}
  );
  const [installments, setInstallments] = useState<Installment[]>(initialInstallments ?? []);
  const [borrowerNamesMap, setBorrowerNamesMap] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = { ...(initialBorrowerNames ?? {}) };
    SEED_PROFILES.forEach((p) => {
      if (p.id && (p.legal_name || (p as any).pyme_company_name)) {
        initialMap[p.id] = (p as any).pyme_company_name || p.legal_name;
      }
    });
    defaultMockStateStore.profiles.forEach((p) => {
      if (p.id && (p.legal_name || (p as any).pyme_company_name)) {
        initialMap[p.id] = (p as any).pyme_company_name || p.legal_name;
      }
    });
    return initialMap;
  });
  const [scheduleCompanyFilter, setScheduleCompanyFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(!initialInvestments);

  // Dual-role PyME activation state
  const [hasBorrowerRole, setHasBorrowerRole] = useState<boolean>(false);
  const [pymeCompanyName, setPymeCompanyName] = useState<string>('');
  const [pymeCuit, setPymeCuit] = useState<string>('');
  const [pymePhone, setPymePhone] = useState<string>('');
  const [pymeCbu, setPymeCbu] = useState<string>('');
  const [pymeErrors, setPymeErrors] = useState<{ companyName?: string; cuit?: string; cbu?: string }>({});
  const [isActivatingPyme, setIsActivatingPyme] = useState<boolean>(false);
  const [pymeActivationSuccess, setPymeActivationSuccess] = useState<string | null>(null);

  // Reset all state when user switches or logs out to prevent cross-contamination
  const resetInvestorState = useCallback(() => {
    if (initialInvestments) return;
    setInvestments([]);
    setLoansMap({});
    setCreditProfilesMap({});
    setInstallments([]);
    setCustodyTransactions([]);
    const initialProf =
      defaultMockStateStore.profiles.find((p) => p.id === (investorIdProp || '')) ||
      SEED_PROFILES.find((p) => p.id === (investorIdProp || ''));
    if (!legalName) setInvestorName(initialProf?.legal_name ?? '');
    if (!userEmail) setInvestorEmail(initialProf?.email ?? '');
    if (cbuCvu === undefined) {
      const val = initialProf?.bank_cbu_cvu ?? '';
      setInvestorCbu(val === '0000000000000000000000' ? '' : val);
    }
    setInvestorAlias((initialProf as any)?.bank_alias ?? '');
    setIsEditingCbu(false);
    setCbuError(null);
    setCbuSuccess(null);
    if (custodyBalanceProp === undefined) setCustodyBalanceState(initialProf?.custody_balance ?? null);
    if (initialTaxId === undefined) setTaxId(initialProf?.tax_id ?? null);
    setHasBorrowerRole(false);
  }, [
    initialInvestments,
    investorIdProp,
    legalName,
    userEmail,
    cbuCvu,
    custodyBalanceProp,
    initialTaxId,
  ]);

  // Sync if prop changes or detect authenticated user
  useEffect(() => {
    let isMounted = true;
    const client = createSupabaseBrowserClient();

    async function resolveInvestorId(forceReset = false) {
      if (initialInvestments) {
        return;
      }
      if (investorIdProp) {
        setCurrentInvestorId((prev) => {
          if (forceReset || (prev && prev !== investorIdProp)) {
            resetInvestorState();
          }
          return investorIdProp;
        });
        return;
      }
      try {
        const { data } = await client.auth.getUser();
        if (isMounted) {
          if (data?.user?.id) {
            setCurrentInvestorId((prev) => {
              if (forceReset || (prev && prev !== data.user.id)) {
                resetInvestorState();
              }
              return data.user.id;
            });
            return;
          } else {
            // Logged out / no session
            resetInvestorState();
            setCurrentInvestorId('');
            return;
          }
        }
      } catch {
        if (investorIdProp && isMounted) {
          setCurrentInvestorId(investorIdProp);
          return;
        }
      }
      // If no authenticated user and no prop passed
      if (isMounted) {
        resetInvestorState();
        setCurrentInvestorId('');
      }
    }

    resolveInvestorId();

    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (!isMounted || initialInvestments) return;
      if (event === 'SIGNED_OUT' || !session) {
        resetInvestorState();
        setCurrentInvestorId(investorIdProp || '');
      } else if (session?.user?.id) {
        resolveInvestorId(true);
      }
    });

    const handleWindowAuth = () => {
      if (isMounted && !initialInvestments) {
        resolveInvestorId(true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-state-change', handleWindowAuth);
    }

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-state-change', handleWindowAuth);
      }
    };
  }, [investorIdProp, initialInvestments, resetInvestorState]);

  // Reset taxId when currentInvestorId changes if not locked by initialTaxId prop
  useEffect(() => {
    if (initialTaxId === undefined) {
      setTaxId(null);
    }
  }, [currentInvestorId, initialTaxId]);

  useEffect(() => {
    let isMounted = true;
    async function loadProfileData() {
      if (!currentInvestorId) {
        if (!legalName) setInvestorName('');
        if (!userEmail) setInvestorEmail('');
        if (cbuCvu === undefined) setInvestorCbu('');
        setInvestorAlias('');
        setIsEditingCbu(false);
        setCbuError(null);
        setCbuSuccess(null);
        if (custodyBalanceProp === undefined) setCustodyBalanceState(null);
        if (initialTaxId === undefined) setTaxId(null);
        setHasBorrowerRole(false);
        return;
      }

      // 1. Check in mockStateStore first
      const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === currentInvestorId);
      if (mockProfile) {
        if (!legalName) {
          const invName = (mockProfile as any).investor_legal_name || (mockProfile as any).investor_name || mockProfile.legal_name;
          if (invName && isMounted) setInvestorName(invName);
        }
        if (!userEmail && mockProfile.email && isMounted) setInvestorEmail(mockProfile.email);
        if (cbuCvu === undefined && mockProfile.bank_cbu_cvu && isMounted) {
          setInvestorCbu(mockProfile.bank_cbu_cvu === '0000000000000000000000' ? '' : mockProfile.bank_cbu_cvu);
        }
        if ((mockProfile as any).bank_alias && isMounted) setInvestorAlias((mockProfile as any).bank_alias);
        if (
          custodyBalanceProp === undefined &&
          mockProfile.custody_balance !== undefined &&
          mockProfile.custody_balance !== null &&
          isMounted
        ) {
          setCustodyBalanceState(mockProfile.custody_balance);
        }
        if (initialTaxId === undefined && isMounted) {
          setTaxId(mockProfile.tax_id || null);
        }
        if (mockProfile.role === 'borrower' || (mockProfile as any).has_pyme_role) {
          if (isMounted) setHasBorrowerRole(true);
        }
      }

      // 2. Try Supabase client for authenticated session user and profile
      const isRealSupabase =
        typeof process !== 'undefined' &&
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (isRealSupabase) {
        try {
          const client = createSupabaseBrowserClient();
          const { data: authData } = await client.auth.getUser();
          if (authData?.user && isMounted) {
            const u = authData.user;
            const authName =
              u.user_metadata?.investor_legal_name ||
              u.user_metadata?.investor_name ||
              u.user_metadata?.legal_name ||
              u.user_metadata?.name ||
              u.user_metadata?.full_name;
            if (!legalName && authName) setInvestorName(authName);
            if (!userEmail && u.email) setInvestorEmail(u.email);

            const userRoles = Array.isArray(u.user_metadata?.roles)
              ? u.user_metadata.roles
              : [u.user_metadata?.role].filter(Boolean);
            if (
              userRoles.includes('borrower') ||
              userRoles.includes('sme') ||
              u.user_metadata?.role === 'borrower'
            ) {
              setHasBorrowerRole(true);
            }
          }

          let profile: any = null;
          try {
            const res = await client
              .from('profiles')
              .select('id, role, legal_name, email, bank_cbu_cvu, bank_alias, tax_id, custody_balance')
              .eq('id', currentInvestorId)
              .maybeSingle();
            profile = res.data;
          } catch {
            const res = await client
              .from('profiles')
              .select('id, role, legal_name, email, bank_cbu_cvu, tax_id, custody_balance')
              .eq('id', currentInvestorId)
              .maybeSingle();
            profile = res.data;
          }

          if (profile && isMounted) {
            if (!legalName) {
              const profileInvName = (profile as any).investor_legal_name || profile.legal_name;
              if (profileInvName) setInvestorName(profileInvName);
            }
            if (!userEmail && profile.email) setInvestorEmail(profile.email);
            if (cbuCvu === undefined && profile.bank_cbu_cvu) {
              setInvestorCbu(profile.bank_cbu_cvu === '0000000000000000000000' ? '' : profile.bank_cbu_cvu);
            }
            if ((profile as any)?.bank_alias) {
              setInvestorAlias((profile as any).bank_alias);
            }
            if (
              custodyBalanceProp === undefined &&
              profile.custody_balance !== undefined &&
              profile.custody_balance !== null
            ) {
              setCustodyBalanceState(profile.custody_balance);
            }
            if (initialTaxId === undefined) {
              setTaxId(profile.tax_id || null);
            }
            if (profile.role === 'borrower') {
              setHasBorrowerRole(true);
            }
          } else if (!mockProfile && isMounted && initialTaxId === undefined) {
            setTaxId(null);
          }
        } catch {
          // Fallback already handled
        }
      }
    }

    loadProfileData();
    return () => {
      isMounted = false;
    };
  }, [currentInvestorId, legalName, userEmail, cbuCvu, custodyBalanceProp, initialTaxId]);

  const handleActivatePymeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { companyName?: string; cuit?: string; cbu?: string } = {};

    if (!pymeCompanyName.trim()) {
      errors.companyName = 'La razón social o nombre de la empresa es obligatorio.';
    }

    const cleanTax = cleanCuit(pymeCuit);
    if (!cleanTax) {
      errors.cuit = 'El CUIT de la empresa es obligatorio.';
    } else if (cleanTax.length !== 11 || !validateCuit(cleanTax)) {
      errors.cuit = 'El CUIT de 11 dígitos no es válido según el algoritmo oficial (ARCA/AFIP).';
    }

    const cleanBankCbu = pymeCbu.replace(/\D/g, '');
    if (cleanBankCbu && cleanBankCbu.length !== 22) {
      errors.cbu = 'El CBU o CVU bancario debe tener exactamente 22 dígitos.';
    }

    if (Object.keys(errors).length > 0) {
      setPymeErrors(errors);
      return;
    }

    setIsActivatingPyme(true);
    setPymeErrors({});

    try {
      const client = createSupabaseBrowserClient();
      let currentRoles: string[] = ['investor'];
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

      const updatedRoles = Array.from(new Set([...currentRoles, 'borrower']));

      try {
        await client.auth.updateUser({
          data: {
            roles: updatedRoles,
            active_role: 'borrower',
            pyme_company_name: pymeCompanyName.trim(),
            pyme_tax_id: cleanTax,
            pyme_phone: pymePhone.trim(),
            pyme_cbu: cleanBankCbu || undefined,
          },
        });
      } catch {
        // Ignored
      }

      // Update mock store
      const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === currentInvestorId);
      if (mockProfile) {
        (mockProfile as any).has_pyme_role = true;
      }
      const existingPyme = defaultMockStateStore.profiles.find((p) => p.tax_id === cleanTax);
      if (!existingPyme) {
        defaultMockStateStore.profiles.push({
          id: `prof-sme-${Date.now()}`,
          role: 'borrower',
          tax_id: cleanTax,
          legal_name: pymeCompanyName.trim(),
          email: investorEmail || 'empresa@lencord.com',
          bank_cbu_cvu: cleanBankCbu || '0000000000000000000000',
          kyc_status: 'verified',
          created_at: new Date().toISOString(),
        } as any);
      }

      setHasBorrowerRole(true);
      setPymeActivationSuccess(
        '¡Perfil PyME activado con éxito! Ahora podés operar como empresa y solicitar financiamiento.'
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-state-change'));
      }
    } catch (err: any) {
      setPymeErrors({ companyName: err?.message || 'Error al activar el perfil PyME.' });
    } finally {
      setIsActivatingPyme(false);
    }
  };

  const renderPymeOnboardingCard = () => {
    if (hasBorrowerRole && !pymeActivationSuccess) {
      return (
        <div className={styles.onboardingRoleCardActive} data-testid="pyme-role-active-banner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className={styles.statusBadge} style={{ backgroundColor: '#d1fae5', color: '#065f46', marginBottom: '0.25rem', display: 'inline-block' }}>
                ✓ Perfil PyME activo
              </span>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155' }}>
                Tu cuenta dispone de permisos como empresa (PyME). Podés solicitar financiamiento y gestionar tus solicitudes de crédito comercial.
              </p>
            </div>
            <Link href="/dashboard/pyme">
              <Button variant="bordered" size="sm" data-testid="btn-go-to-pyme-dashboard">
                Ir a mi panel PyME →
              </Button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <section className={styles.onboardingRoleCard} data-testid="pyme-onboarding-card">
        <div className={styles.onboardingRoleHeader}>
          <div className={styles.onboardingRoleBadge}>Expansión de cuenta</div>
          <h3 className={styles.onboardingRoleTitle}>
            ¿Tenés una empresa y buscás financiación? Activá tu perfil PyME
          </h3>
          <p className={styles.onboardingRoleDesc}>
            Con tu mismo correo electrónico podés registrar los datos legales de tu empresa para solicitar créditos productivos, descontar cheques y acceder a financiamiento de inversores.
          </p>
        </div>

        {pymeActivationSuccess ? (
          <div className={styles.onboardingSuccessAlert} data-testid="pyme-activation-success" role="status">
            <p style={{ margin: 0, fontWeight: 600 }}>✓ {pymeActivationSuccess}</p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link href="/dashboard/pyme">
                <Button variant="primary" size="sm" data-testid="btn-success-go-to-pyme">
                  Ir a mi panel PyME →
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleActivatePymeRole} className={styles.onboardingRoleForm} data-testid="pyme-activation-form" noValidate>
            <div className={styles.onboardingRoleGrid}>
              <Input
                label="Razón Social de la empresa *"
                id="input-pyme-company-name"
                value={pymeCompanyName}
                onChange={(e) => {
                  setPymeCompanyName(e.target.value);
                  if (pymeErrors.companyName) setPymeErrors((p) => ({ ...p, companyName: '' }));
                }}
                placeholder="Ej: Distribuidora Norte S.R.L."
                error={pymeErrors.companyName}
                data-testid="input-pyme-company-name"
              />
              <Input
                label="CUIT de la empresa *"
                id="input-pyme-cuit"
                value={pymeCuit}
                onChange={(e) => {
                  setPymeCuit(formatCuit(e.target.value));
                  if (pymeErrors.cuit) setPymeErrors((p) => ({ ...p, cuit: '' }));
                }}
                placeholder="30-71234567-8"
                helperText="11 dígitos (validación oficial ARCA/AFIP)."
                className="font-mono"
                error={pymeErrors.cuit}
                data-testid="input-pyme-cuit"
              />
              <Input
                label="Teléfono de contacto comercial"
                id="input-pyme-phone"
                value={pymePhone}
                onChange={(e) => setPymePhone(e.target.value)}
                placeholder="Ej: 11 4567-8900"
                data-testid="input-pyme-phone"
              />
              <Input
                label="CBU / CVU bancario de la empresa"
                id="input-pyme-cbu"
                value={pymeCbu}
                onChange={(e) => {
                  setPymeCbu(e.target.value.replace(/\D/g, '').slice(0, 22));
                  if (pymeErrors.cbu) setPymeErrors((p) => ({ ...p, cbu: '' }));
                }}
                placeholder="22 dígitos bancarios"
                helperText="Donde recibirás los fondos desembolsados."
                className="font-mono"
                error={pymeErrors.cbu}
                data-testid="input-pyme-cbu"
              />
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isActivatingPyme}
                data-testid="btn-activate-pyme-role"
              >
                Activar perfil PyME
              </Button>
            </div>
          </form>
        )}
      </section>
    );
  };



  const hasValidCbu = Boolean(
    investorCbu &&
    investorCbu.trim() !== '' &&
    investorCbu !== '0000000000000000000000'
  );

  const handleSaveCbu = async () => {
    setCbuError(null);
    setCbuSuccess(null);
    const cleanedCbu = cbuInput.replace(/\D/g, '');
    const cleanedAlias = aliasInput.trim().toLowerCase();

    if (!cleanedCbu) {
      setCbuError('El CBU o CVU es obligatorio.');
      return;
    }

    if (cleanedCbu.length !== 22 || cleanedCbu === '0000000000000000000000') {
      setCbuError('El CBU o CVU debe contener exactamente 22 dígitos numéricos.');
      return;
    }

    if (cleanedAlias && (cleanedAlias.length < 6 || cleanedAlias.length > 20)) {
      setCbuError('El alias bancario debe tener entre 6 y 20 caracteres.');
      return;
    }

    try {
      setIsSavingCbu(true);
      const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === currentInvestorId);
      if (mockProfile) {
        mockProfile.bank_cbu_cvu = cleanedCbu;
        (mockProfile as any).bank_alias = cleanedAlias || null;
      }
      try {
        const client = createSupabaseBrowserClient();
        const updatePayload: Record<string, any> = { bank_cbu_cvu: cleanedCbu };
        if (cleanedAlias) {
          updatePayload.bank_alias = cleanedAlias;
        }
        const { error } = await client.from('profiles').update(updatePayload).eq('id', currentInvestorId);
        if (error && error.message?.includes('bank_alias')) {
          await client.from('profiles').update({ bank_cbu_cvu: cleanedCbu }).eq('id', currentInvestorId);
        }
      } catch {
        // Ignored in mock/offline mode
      }

      setInvestorCbu(cleanedCbu);
      if (cleanedAlias) {
        setInvestorAlias(cleanedAlias);
      }
      setIsEditingCbu(false);
      setCbuSuccess('CBU/CVU bancario guardado con éxito.');
    } catch (err: any) {
      setCbuError(err?.message || 'Error al guardar el CBU/CVU bancario.');
    } finally {
      setIsSavingCbu(false);
    }
  };

  const handleSaveDni = async () => {
    setDniError(null);
    setDniSuccess(null);
    const cleaned = cleanCuit(dniInput);
    if (!cleaned) {
      setDniError('El DNI o CUIT es obligatorio.');
      return;
    }
    if (cleaned.length < 7 || (cleaned.length > 8 && cleaned.length < 11) || cleaned.length > 11) {
      setDniError('Ingrese un DNI válido (7 u 8 dígitos) o CUIT (11 dígitos).');
      return;
    }
    if (cleaned.length === 11 && !validateCuit(cleaned)) {
      setDniError('El CUIT de 11 dígitos no es válido según el algoritmo oficial (ARCA/AFIP).');
      return;
    }

    try {
      setIsSavingDni(true);
      const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === currentInvestorId);
      if (mockProfile) {
        mockProfile.tax_id = cleaned;
      }
      try {
        const client = createSupabaseBrowserClient();
        await client.from('profiles').update({ tax_id: cleaned }).eq('id', currentInvestorId);
      } catch {
        // Ignored
      }

      setTaxId(cleaned);
      setIsEditingDni(false);
      setDniSuccess('DNI registrado con éxito.');
    } catch (err: any) {
      setDniError(err?.message || 'Error al guardar el DNI.');
    } finally {
      setIsSavingDni(false);
    }
  };

  useEffect(() => {
    if (initialInvestments) {
      setInvestments(initialInvestments);
      if (initialLoans) {
        setLoansMap(
          initialLoans.reduce<Record<string, Loan>>((acc, l) => {
            acc[l.id] = l;
            return acc;
          }, {})
        );
      }
      if (initialCreditProfiles) setCreditProfilesMap(initialCreditProfiles);
      if (initialInstallments) setInstallments(initialInstallments);
      if (initialBorrowerNames) setBorrowerNamesMap((prev) => ({ ...prev, ...initialBorrowerNames }));
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadInvestorData() {
      if (!currentInvestorId) {
        setInvestments([]);
        setLoansMap({});
        setCreditProfilesMap({});
        setInstallments([]);
        setCustodyTransactions([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setInvestments([]);
        const resolvedServices =
          servicesFromContext ??
          (() => {
            try {
              return createServices();
            } catch {
              return createServices({ useMocks: true });
            }
          })();

        // 1. Fetch investments for this investor
        const invs = await resolvedServices.investments.getInvestmentsByInvestor(currentInvestorId);

        // 2. Fetch associated loans
        const uniqueLoanIds = Array.from(new Set(invs.map((i) => i.loan_id)));
        const loansList = await Promise.all(
          uniqueLoanIds.map(async (loanId) => {
            try {
              return await resolvedServices.loans.getLoanById(loanId);
            } catch {
              return null;
            }
          })
        );

        const newLoansMap: Record<string, Loan> = {};
        loansList.forEach((l) => {
          if (l) newLoansMap[l.id] = l;
        });

        // 3. Fetch credit profiles for risk tiers
        const uniqueBorrowerIds = Array.from(
          new Set(
            Object.values(newLoansMap)
              .map((l) => l.borrower_id)
              .filter(Boolean)
          )
        );

        const newCreditProfiles: Record<string, SmeCreditProfile> = {};
        await Promise.all(
          uniqueBorrowerIds.map(async (borrowerId) => {
            try {
              const cp = await resolvedServices.creditScoring.getCreditProfileByProfileId(borrowerId);
              if (cp) newCreditProfiles[borrowerId] = cp;
            } catch {
              // ignore
            }
          })
        );

        const newBorrowerNames: Record<string, string> = {};
        const missingBorrowerIds: string[] = [];
        uniqueBorrowerIds.forEach((borrowerId) => {
          const mockB =
            defaultMockStateStore.profiles.find((p) => p.id === borrowerId) ||
            SEED_PROFILES.find((p) => p.id === borrowerId);
          if (mockB && (mockB.legal_name || (mockB as any).pyme_company_name)) {
            newBorrowerNames[borrowerId] = (mockB as any).pyme_company_name || mockB.legal_name;
          } else {
            missingBorrowerIds.push(borrowerId);
          }
        });

        const isRealSupabase =
          typeof process !== 'undefined' &&
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

        if (missingBorrowerIds.length > 0 && isRealSupabase) {
          try {
            const client = createSupabaseBrowserClient();
            const { data: borrowerProfiles } = await client
              .from('profiles')
              .select('id, legal_name')
              .in('id', missingBorrowerIds);
            if (borrowerProfiles) {
              borrowerProfiles.forEach((bp: any) => {
                if (bp.id && bp.legal_name) {
                  newBorrowerNames[bp.id] = bp.legal_name;
                }
              });
            }
          } catch {
            // ignore
          }
        }

        // 4. Fetch installments for all associated loans
        const allInstallmentsLists = await Promise.all(
          uniqueLoanIds.map(async (loanId) => {
            try {
              return await resolvedServices.loans.getInstallmentsByLoan(loanId);
            } catch {
              return [];
            }
          })
        );
        const combinedInstallments = allInstallmentsLists.flat();

        // 5. Fetch custody transactions and live balance
        let txs: CustodyTransaction[] = [];
        if (resolvedServices.investments.getCustodyTransactions) {
          try {
            txs = await resolvedServices.investments.getCustodyTransactions(currentInvestorId);
          } catch (err) {
            console.warn('Error fetching custody transactions:', err);
          }
        }
        if (resolvedServices.investments.getCustodyBalance) {
          try {
            const bal = await resolvedServices.investments.getCustodyBalance(currentInvestorId);
            if (isMounted && custodyBalanceProp === undefined) {
              setCustodyBalanceState(bal);
            }
          } catch (err) {
            console.warn('Error fetching custody balance:', err);
          }
        }

        if (isMounted) {
          setInvestments(invs);
          setLoansMap(newLoansMap);
          setCreditProfilesMap(newCreditProfiles);
          setBorrowerNamesMap((prev) => ({ ...prev, ...newBorrowerNames }));
          setInstallments(combinedInstallments);
          setCustodyTransactions(txs);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading investor dashboard data:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadInvestorData();

    return () => {
      isMounted = false;
    };
  }, [currentInvestorId, initialInvestments, initialLoans, initialCreditProfiles, initialInstallments, servicesFromContext]);

  // Filter active investments: committed or settled
  const activeInvestments = useMemo(() => {
    return investments.filter((i) => i.status === 'committed' || i.status === 'settled');
  }, [investments]);

  // Enriched investments with loan data and risk tier
  const enrichedInvestments: EnrichedInvestment[] = useMemo(() => {
    return activeInvestments.map((inv) => {
      const loan = loansMap[inv.loan_id] ?? null;
      let riskTier: RiskTier = 'Tier B';
      if (loan && loan.borrower_id && creditProfilesMap[loan.borrower_id]) {
        riskTier = creditProfilesMap[loan.borrower_id].risk_tier;
      }
      const borrowerName =
        (loan as any)?.borrower_name ||
        (loan as any)?.company_name ||
        (loan as any)?.legal_name ||
        (loan?.borrower_id && borrowerNamesMap[loan.borrower_id]) ||
        (loan?.borrower_id && defaultMockStateStore.profiles.find((p) => p.id === loan.borrower_id)?.legal_name) ||
        (loan?.borrower_id && SEED_PROFILES.find((p) => p.id === loan.borrower_id)?.legal_name) ||
        (loan?.borrower_id ? `Razón Social (${loan.borrower_id})` : 'Razón Social no especificada');

      return {
        investment: inv,
        loan,
        riskTier,
        borrowerName,
      };
    });
  }, [activeInvestments, loansMap, creditProfilesMap, borrowerNamesMap]);

  // Summary Metrics calculations
  const totalCapitalInvertido = useMemo(() => {
    return activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);
  }, [activeInvestments]);

  const activeInvestmentsCount = activeInvestments.length;

  // Estimated return / earned interest:
  // For each investment: ticket * (rate / 100) * (term_months / 12)
  const estimatedTotalYield = useMemo(() => {
    return enrichedInvestments.reduce((sum, item) => {
      if (!item.loan) return sum;
      const rate = item.loan.investor_rate || 0;
      const term = item.loan.term_months || 0;
      const annualReturn = item.investment.amount * (rate / 100);
      const loanTermReturn = annualReturn * (term / 12);
      return sum + loanTermReturn;
    }, 0);
  }, [enrichedInvestments]);

  // Risk Tier Breakdown
  const tierDistribution = useMemo(() => {
    const counts = { 'Tier A': 0, 'Tier B': 0, 'Tier C': 0 };
    const amounts = { 'Tier A': 0, 'Tier B': 0, 'Tier C': 0 };

    enrichedInvestments.forEach((item) => {
      counts[item.riskTier] += 1;
      amounts[item.riskTier] += item.investment.amount;
    });

    const total = totalCapitalInvertido > 0 ? totalCapitalInvertido : 1;
    const percentages = {
      'Tier A': totalCapitalInvertido > 0 ? (amounts['Tier A'] / total) * 100 : 0,
      'Tier B': totalCapitalInvertido > 0 ? (amounts['Tier B'] / total) * 100 : 0,
      'Tier C': totalCapitalInvertido > 0 ? (amounts['Tier C'] / total) * 100 : 0,
    };

    return { counts, amounts, percentages };
  }, [enrichedInvestments, totalCapitalInvertido]);

  // Enriched Installments for payment schedule table
  const enrichedInstallments: EnrichedInstallment[] = useMemo(() => {
    const list: EnrichedInstallment[] = [];

    // Group active investments by loan to combine multiple investments in the same loan
    const loanTotalInvestedMap = new Map<string, number>();
    enrichedInvestments.forEach(({ investment, loan }) => {
      if (!loan) return;
      const current = loanTotalInvestedMap.get(loan.id) ?? 0;
      loanTotalInvestedMap.set(loan.id, current + (investment.amount || 0));
    });

    const seenLoans = new Set<string>();
    enrichedInvestments.forEach(({ loan, borrowerName }) => {
      if (!loan || seenLoans.has(loan.id)) return;
      seenLoans.add(loan.id);

      const totalInvestorAmount = loanTotalInvestedMap.get(loan.id) || 0;
      const totalFunded = loan.amount_funded > 0 ? loan.amount_funded : loan.amount_requested;
      const share = totalFunded > 0 ? totalInvestorAmount / totalFunded : 0;

      const loanInstallments = installments.filter((inst) => inst.loan_id === loan.id);
      loanInstallments.forEach((inst) => {
        list.push({
          installment: inst,
          loan,
          investorSharePrincipal: inst.principal_amount * share,
          investorShareInterest: inst.interest_investors * share,
          borrowerName,
        });
      });
    });

    // Sort by due date ascending
    return list.sort((a, b) => new Date(a.installment.due_date).getTime() - new Date(b.installment.due_date).getTime());
  }, [enrichedInvestments, installments]);

  // Available companies for payment schedule filter
  const availableBorrowersForFilter = useMemo(() => {
    const map = new Map<string, string>();
    enrichedInvestments.forEach(({ loan, borrowerName }) => {
      if (loan?.borrower_id) {
        map.set(loan.borrower_id, borrowerName || 'Razón Social no especificada');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [enrichedInvestments]);

  // Filtered installments according to scheduleCompanyFilter
  const filteredInstallments = useMemo(() => {
    if (scheduleCompanyFilter === 'all') {
      return enrichedInstallments;
    }
    return enrichedInstallments.filter((item) => item.loan?.borrower_id === scheduleCompanyFilter);
  }, [enrichedInstallments, scheduleCompanyFilter]);

  const effectiveCustodyBalance = useMemo(() => {
    if (custodyBalanceProp !== undefined) return custodyBalanceProp;
    if (custodyBalanceState !== null && custodyBalanceState !== undefined) return custodyBalanceState;
    if (custodyTransactions.length > 0) {
      return custodyTransactions[0].balance_after;
    }
    const mockProfile = defaultMockStateStore.profiles.find((p) => p.id === currentInvestorId);
    if (mockProfile && mockProfile.custody_balance !== undefined && mockProfile.custody_balance !== null) {
      return mockProfile.custody_balance;
    }
    if (currentInvestorId === 'prof-inv-001') return 5_250_000;
    return 0;
  }, [custodyBalanceProp, custodyBalanceState, custodyTransactions, currentInvestorId]);

  if (loading) {
    return (
      <div className={`${styles.dashboardContainer} ${className}`} data-testid="investor-dashboard-loading">
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando panel del inversor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.dashboardContainer} ${className}`} data-testid="investor-dashboard">
      {/* Dashboard Header */}
      <header className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.title}>Panel del inversor</h1>
          <p className={styles.subtitle}>
            {investorName ? (
              <>
                Bienvenido, <strong data-testid="investor-name">{investorName}</strong>. Seguimiento de capital invertido, rendimientos estimados y calendario de cobros.
              </>
            ) : (
              'Seguimiento de capital invertido, rendimientos estimados y calendario de cobros.'
            )}
          </p>
        </div>
      </header>

      {/* Illustrative Custody Balance & Mandatory Regulatory Disclaimer */}
      <section
        className={styles.custodyDisclaimerCard}
        aria-label="Saldo en custodia y advertencia regulatoria"
        data-testid="custody-balance-card"
      >
        <div className={styles.custodyDisclaimerLeft}>
          <div className={styles.custodyIcon} aria-hidden="true">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <span className={styles.metricLabel}>Saldo disponible en custodia</span>
            <div className={styles.custodyBalanceAmount} data-testid="available-custody-balance">
              Saldo disponible en custodia: {formatCurrency(effectiveCustodyBalance, { decimals: true })}
            </div>
            <span className="sr-only" data-testid="illustrative-custody-balance">
              {formatCurrency(effectiveCustodyBalance, { decimals: true })}
            </span>
            <p className={styles.custodyDisclaimerText} data-testid="custody-disclaimer">
              <strong>Aviso regulatorio:</strong> Los fondos líquidos y transacciones se encuentran bajo custodia de una entidad financiera y/o Proveedor de Servicios de Pago (PSP) autorizado por el Banco Central de la República Argentina (BCRA). Lencord es una plataforma tecnológica y no realiza intermediación financiera, captación no autorizada ni custodia directa de saldos monetarios de terceros.
            </p>
          </div>
        </div>
        <div className={styles.custodyDisclaimerRight}>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsWithdrawalModalOpen(true)}
            data-testid="btn-withdraw-funds"
          >
            Retirar fondos a mi CBU
          </Button>
        </div>
      </section>

      {/* Empty State when no active investments */}
      {activeInvestments.length === 0 ? (
        <section className={styles.emptyStateCard} data-testid="investor-empty-state">
          <div className={styles.emptyStateIcon} aria-hidden="true">
            <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className={styles.emptyStateTitle}>No poseés inversiones activas</h2>
          <p className={styles.emptyStateDescription}>
            Aún no has participado en ninguna subasta de financiamiento. Explorá las oportunidades
            disponibles en el marketplace y comenzá a rentabilizar tu capital.
          </p>
          <Link href="/marketplace">
            <Button variant="primary" size="md" data-testid="explore-opportunities-button">
              Explorar oportunidades
            </Button>
          </Link>
        </section>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <section className={styles.metricsGrid} aria-label="Métricas principales de inversión">
            <div className={styles.metricCard} data-testid="metric-total-capital">
              <span className={styles.metricLabel}>Capital invertido</span>
              <span className={styles.metricValue}>{formatCurrency(totalCapitalInvertido, { decimals: true })}</span>
              <span className={styles.metricSubtextNeutral}>Capital activo en subastas y préstamos</span>
            </div>

            <div className={styles.metricCard} data-testid="metric-estimated-returns">
              <span className={styles.metricLabel}>Rendimiento estimado/intereses ganados</span>
              <span className={styles.metricValue}>{formatCurrency(estimatedTotalYield, { decimals: true })}</span>
              <span className={styles.metricSubtext}>+ Rendimiento total proyectado al vencimiento</span>
            </div>

            <div className={styles.metricCard} data-testid="metric-active-investments">
              <span className={styles.metricLabel}>Inversiones Activas</span>
              <span className={styles.metricValue}>{activeInvestmentsCount}</span>
              <span className={styles.metricSubtextNeutral}>
                {activeInvestmentsCount === 1 ? '1 préstamo participado' : `${activeInvestmentsCount} préstamos participados`}
              </span>
            </div>
          </section>

          {/* Portfolio Breakdown by Risk Tier */}
          <section className={styles.section} aria-labelledby="portfolio-breakdown-title">
            <div className={styles.sectionHeader}>
              <h2 id="portfolio-breakdown-title" className={styles.sectionTitle}>
                Distribución por nivel de riesgo
              </h2>
              <p className={styles.sectionDescription}>
                Composición de tu cartera según la clasificación crediticia de solvencia PyME.
              </p>
            </div>

            <div className={styles.breakdownCard} data-testid="portfolio-breakdown-chart">
              {/* Segmented Progress Bar */}
              <div
                className={styles.progressContainer}
                role="progressbar"
                aria-label="Distribución porcentual por riesgo"
                aria-valuenow={100}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={styles.progressBarTierA}
                  style={{ width: `${tierDistribution.percentages['Tier A']}%` }}
                  title={`Tier A: ${tierDistribution.percentages['Tier A'].toFixed(1)}%`}
                />
                <div
                  className={styles.progressBarTierB}
                  style={{ width: `${tierDistribution.percentages['Tier B']}%` }}
                  title={`Tier B: ${tierDistribution.percentages['Tier B'].toFixed(1)}%`}
                />
                <div
                  className={styles.progressBarTierC}
                  style={{ width: `${tierDistribution.percentages['Tier C']}%` }}
                  title={`Tier C: ${tierDistribution.percentages['Tier C'].toFixed(1)}%`}
                />
              </div>

              {/* Tier Cards Grid */}
              <div className={styles.breakdownGrid}>
                {/* Tier A */}
                <div className={`${styles.tierStatItem} ${styles.tierStatItemTierA}`} data-testid="tier-a-stat">
                  <div className={styles.tierStatHeader}>
                    <TierBadge tier="Tier A" />
                    <span className={styles.tierStatPercentage}>
                      {tierDistribution.percentages['Tier A'].toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.tierStatAmount}>
                    {formatCurrency(tierDistribution.amounts['Tier A'])}
                  </div>
                  <div className={styles.secondaryText}>
                    {tierDistribution.counts['Tier A']} {tierDistribution.counts['Tier A'] === 1 ? 'inversión' : 'inversiones'}
                  </div>
                </div>

                {/* Tier B */}
                <div className={`${styles.tierStatItem} ${styles.tierStatItemTierB}`} data-testid="tier-b-stat">
                  <div className={styles.tierStatHeader}>
                    <TierBadge tier="Tier B" />
                    <span className={styles.tierStatPercentage}>
                      {tierDistribution.percentages['Tier B'].toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.tierStatAmount}>
                    {formatCurrency(tierDistribution.amounts['Tier B'])}
                  </div>
                  <div className={styles.secondaryText}>
                    {tierDistribution.counts['Tier B']} {tierDistribution.counts['Tier B'] === 1 ? 'inversión' : 'inversiones'}
                  </div>
                </div>

                {/* Tier C */}
                <div className={`${styles.tierStatItem} ${styles.tierStatItemTierC}`} data-testid="tier-c-stat">
                  <div className={styles.tierStatHeader}>
                    <TierBadge tier="Tier C" />
                    <span className={styles.tierStatPercentage}>
                      {tierDistribution.percentages['Tier C'].toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.tierStatAmount}>
                    {formatCurrency(tierDistribution.amounts['Tier C'])}
                  </div>
                  <div className={styles.secondaryText}>
                    {tierDistribution.counts['Tier C']} {tierDistribution.counts['Tier C'] === 1 ? 'inversión' : 'inversiones'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Active Investments Table */}
          <section className={styles.section} aria-labelledby="active-investments-title">
            <div className={styles.sectionHeader}>
              <h2 id="active-investments-title" className={styles.sectionTitle}>
                Inversiones activas
              </h2>
              <p className={styles.sectionDescription}>
                Préstamos fondeados y participaciones en curso con su correspondiente tasa y estado.
              </p>
            </div>

            <div className={styles.tableCard} data-testid="investments-table">
              <table className={styles.table} data-testid="active-investments-table">
                <thead>
                  <tr>
                    <th scope="col">Destino/oportunidad</th>
                    <th scope="col">Ticket invertido</th>
                    <th scope="col">Tasa de interés</th>
                    <th scope="col">Riesgo</th>
                    <th scope="col">Plazo</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Pagaré digital</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedInvestments.map(({ investment, loan, riskTier, borrowerName }) => {
                    const categoryLabel = loan
                      ? LOAN_CATEGORY_LABELS[loan.category] ?? loan.category
                      : 'Préstamo PyME';
                    const rateDisplay = loan
                      ? formatRateDisplay(loan.rate_type, loan.investor_rate)
                      : 'N/A';
                    const isSettled = investment.status === 'settled';
                    const isSigned = loan && (loan.status === 'active' || loan.status === 'repaid');
                    const loanId = loan ? loan.id : investment.loan_id;

                    return (
                      <tr key={investment.id} data-testid={`investment-row-${investment.id}`}>
                        <td>
                          <div className={styles.primaryText}>{categoryLabel}</div>
                          <div
                            className={styles.secondaryText}
                            data-testid={`investment-borrower-${investment.id}`}
                          >
                            {borrowerName}
                          </div>
                        </td>
                        <td>
                          <div className={styles.primaryText}>{formatCurrency(investment.amount)}</div>
                        </td>
                        <td>
                          <div className={styles.primaryText}>{rateDisplay}</div>
                        </td>
                        <td>
                          <TierBadge tier={riskTier} />
                        </td>
                        <td>{loan ? `${loan.term_months} meses` : '-'}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${isSettled ? styles.statusSettled : styles.statusCommitted
                              }`}
                            data-testid={`investment-status-${investment.id}`}
                          >
                            {isSettled ? 'settled' : 'committed'}
                          </span>
                        </td>
                        <td>
                          {isSigned ? (
                            <Button
                              variant="bordered"
                              size="sm"
                              onClick={() => loan && handleOpenPagare(loan, investment)}
                              data-testid={`btn-view-promissory-note-${loanId}`}
                            >
                              Ver pagaré firmado
                            </Button>
                          ) : (
                            <Button
                              variant="bordered"
                              size="sm"
                              disabled
                              data-testid={`btn-view-promissory-note-${loanId}`}
                            >
                              Pendiente de firma
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Payment Schedule Calendar/Table */}
          <section className={styles.section} aria-labelledby="payment-schedule-title">
            <div className={styles.scheduleHeaderWithFilter}>
              <div className={styles.sectionHeader} style={{ marginBottom: 0 }}>
                <h2 id="payment-schedule-title" className={styles.sectionTitle}>
                  Cronograma de pagos
                </h2>
                <p className={styles.sectionDescription}>
                  Calendario de cuotas mensuales de amortización e interés a percibir en tu cuenta.
                </p>
              </div>

              {availableBorrowersForFilter.length > 0 && (
                <div className={styles.scheduleFilterContainer}>
                  <label htmlFor="schedule-company-filter" className={styles.scheduleFilterLabel}>
                    Filtrar por empresa:
                  </label>
                  <select
                    id="schedule-company-filter"
                    value={scheduleCompanyFilter}
                    onChange={(e) => setScheduleCompanyFilter(e.target.value)}
                    className={styles.scheduleFilterSelect}
                    data-testid="schedule-company-filter"
                    aria-label="Filtrar cronograma de pagos por empresa"
                  >
                    <option value="all">Todas las empresas</option>
                    {availableBorrowersForFilter.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.tableCard}>
              {filteredInstallments.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }} data-testid="no-installments-msg">
                  {enrichedInstallments.length === 0
                    ? 'No hay cuotas programadas para las inversiones seleccionadas aún.'
                    : 'No hay cuotas programadas para la empresa seleccionada.'}
                </div>
              ) : (
                <table className={styles.table} data-testid="payment-schedule-table">
                  <thead>
                    <tr>
                      <th scope="col">Vencimiento</th>
                      <th scope="col">Empresa</th>
                      <th scope="col">Cuota</th>
                      <th scope="col">Capital</th>
                      <th scope="col">Interés estimado</th>
                      <th scope="col">Total cuota</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstallments.map(
                      ({ installment, investorSharePrincipal, investorShareInterest, borrowerName }, idx) => {
                        const totalCuota = investorSharePrincipal + investorShareInterest;
                        const statusClass =
                          installment.status === 'paid'
                            ? styles.statusPaid
                            : installment.status === 'overdue'
                              ? styles.statusOverdue
                              : styles.statusPending;

                        return (
                          <tr key={`${installment.id}-${idx}`} data-testid={`installment-row-${installment.id}`}>
                            <td>
                              <div className={styles.primaryText}>{installment.due_date}</div>
                            </td>
                            <td>
                              <div className={styles.primaryText} data-testid={`installment-borrower-${installment.id}`}>
                                {borrowerName}
                              </div>
                            </td>
                            <td>Cuota #{installment.installment_number}</td>
                            <td>{formatCurrency(investorSharePrincipal)}</td>
                            <td>{formatCurrency(investorShareInterest)}</td>
                            <td className={styles.primaryText}>{formatCurrency(totalCuota)}</td>
                            <td>
                              <span
                                className={`${styles.statusBadge} ${statusClass}`}
                                data-testid={`installment-status-${installment.id}`}
                              >
                                {installment.status}
                              </span>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      {/* Historial de Movimientos de Cuenta Auditables (Issue #70) */}
      <section
        className={styles.section}
        aria-labelledby="custody-transactions-title"
        data-testid="custody-transactions-section"
      >
        <div className={styles.sectionHeader}>
          <h2 id="custody-transactions-title" className={styles.sectionTitle}>
            Movimientos de cuenta
          </h2>
          <p className={styles.sectionDescription}>
            Historial cronológico y auditable de ingresos por cuotas, colocaciones en préstamos y retiros de fondos.
          </p>
        </div>

        <div className={styles.tableCard}>
          {custodyTransactions.length === 0 ? (
            <div className={styles.noTransactionsEmptyState} data-testid="no-transactions-empty-state">
              <div className={styles.noTransactionsIcon} aria-hidden="true">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                No registrás movimientos en tu cuenta
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, maxWidth: '420px' }}>
                Aún no has participado en subastas, percibido cobros ni solicitado retiros a tu CBU.
              </p>
              <Link href="/marketplace">
                <Button variant="bordered" size="sm" data-testid="explore-marketplace-from-empty-transactions">
                  Explorar marketplace
                </Button>
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table} data-testid="custody-transactions-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha y hora</th>
                    <th scope="col">Tipo de movimiento</th>
                    <th scope="col">Referencia/Préstamo</th>
                    <th scope="col">Importe</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {custodyTransactions.map((tx) => {
                    const isCredit =
                      tx.type === 'installment_payout' ||
                      tx.type === 'card_deposit' ||
                      tx.type === 'refund';
                    const typeLabel =
                      tx.type === 'installment_payout'
                        ? 'Cobro de cuota'
                        : tx.type === 'investment_hold'
                        ? 'Inversión'
                        : tx.type === 'withdrawal'
                        ? 'Retiro'
                        : tx.type === 'card_deposit'
                        ? 'Depósito'
                        : tx.type === 'refund'
                        ? 'Reembolso'
                        : tx.type;

                    const formattedDate = new Date(tx.created_at).toLocaleString('es-AR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const referenceDisplay =
                      tx.payment_metadata?.description ||
                      (tx.reference_id ? `Ref: ${tx.reference_id}` : (tx.type === 'withdrawal' ? 'Transferencia a CBU' : '-'));

                    const statusClass =
                      tx.status === 'completed'
                        ? styles.statusSettled
                        : tx.status === 'pending'
                        ? styles.statusPending
                        : styles.statusCommitted;

                    const statusLabel =
                      tx.status === 'completed'
                        ? 'Completado'
                        : tx.status === 'pending'
                        ? 'Pendiente'
                        : tx.status === 'failed'
                        ? 'Fallido'
                        : tx.status;

                    return (
                      <tr key={tx.id} data-testid={`custody-tx-row-${tx.id}`}>
                        <td>
                          <span className={styles.secondaryText}>{formattedDate}</span>
                        </td>
                        <td>
                          <span className={styles.primaryText}>{typeLabel}</span>
                        </td>
                        <td>
                          <span className={styles.monoText}>{referenceDisplay}</span>
                        </td>
                        <td>
                          <span
                            className={isCredit ? styles.amountPositive : styles.amountNegative}
                            data-testid={`custody-tx-amount-${tx.id}`}
                          >
                            {isCredit ? `+ ${formatCurrency(tx.amount, { decimals: true })}` : `- ${formatCurrency(tx.amount, { decimals: true })}`}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${statusClass}`}
                            data-testid={`custody-tx-status-${tx.id}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Mi Perfil / Estado de Identidad & Datos de Cuenta */}
      <section
        id="perfil"
        className={styles.section}
        aria-labelledby="perfil-section-title"
        data-testid="investor-profile-section"
      >
        <div className={styles.sectionHeader}>
          <h2 id="perfil-section-title" className={styles.sectionTitle}>
            Mi perfil
          </h2>
          <p className={styles.sectionDescription}>
            Información de la cuenta, cuenta bancaria asociada e identificación tributaria conforme a normativa UIF.
          </p>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          {/* Correo electrónico */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
              Correo electrónico registrado
            </span>
            <strong style={{ fontSize: '0.9375rem', color: '#0f172a' }} data-testid="profile-email">
              {investorEmail || 'No informado'}
            </strong>
          </div>

          {/* Bloque CBU / CVU bancario */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0f172a' }}>
                  CBU/CVU bancario asociado:
                </span>
                <span
                  data-testid="cbu-badge"
                  className={`${styles.statusBadge} ${hasValidCbu ? styles.statusSettled : styles.statusPending}`}
                >
                  {hasValidCbu ? 'CBU vinculado' : 'CBU pendiente'}
                </span>
              </div>

              {!isEditingCbu && (
                <Button
                  variant={hasValidCbu ? 'bordered' : 'primary'}
                  size="sm"
                  onClick={() => {
                    setCbuInput(hasValidCbu ? investorCbu : '');
                    setAliasInput(investorAlias || '');
                    setIsEditingCbu(true);
                    setCbuError(null);
                    setCbuSuccess(null);
                  }}
                  data-testid={hasValidCbu ? 'edit-cbu-button' : 'add-cbu-button'}
                >
                  {hasValidCbu ? 'Modificar CBU/CVU' : '+ Agregar CBU/CVU'}
                </Button>
              )}
            </div>

            {!isEditingCbu && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#475569' }}>
                {hasValidCbu ? (
                  <>
                    CBU/CVU registrado: <strong className="font-mono" data-testid="profile-cbu">{investorCbu}</strong>
                    {investorAlias && (
                      <span style={{ marginLeft: '1rem', color: '#64748b' }}>
                        Alias: <strong className="font-mono" data-testid="profile-alias">{investorAlias}</strong>
                      </span>
                    )}
                  </>
                ) : (
                  <div>
                    Estado: <strong data-testid="profile-cbu">No vinculado</strong>
                    <p style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: '#64748b' }}>
                      No tenés una cuenta bancaria vinculada para cobrar las cuotas de tus préstamos ni retirar tus fondos en custodia.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isEditingCbu && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '450px' }}>
                <Input
                  label="CBU o CVU (22 dígitos) *"
                  id="input-profile-cbu"
                  value={cbuInput}
                  onChange={(e) => {
                    setCbuInput(e.target.value.replace(/\D/g, '').slice(0, 22));
                    if (cbuError) setCbuError(null);
                  }}
                  placeholder="Ej: 0720123488000012345678"
                  error={cbuError ?? undefined}
                  helperText="22 dígitos numéricos provistos por tu banco o billetera virtual."
                  className="font-mono"
                  data-testid="input-cbu"
                />
                <Input
                  label="Alias bancario (opcional)"
                  id="input-profile-alias"
                  value={aliasInput}
                  onChange={(e) => {
                    setAliasInput(e.target.value.trim().toLowerCase().slice(0, 20));
                    if (cbuError) setCbuError(null);
                  }}
                  placeholder="Ej: inversor.lencord.ars"
                  helperText="De 6 a 20 caracteres (letras, números, puntos o guiones)."
                  className="font-mono"
                  data-testid="input-alias"
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    type="button"
                    variant="bordered"
                    size="sm"
                    onClick={() => {
                      setIsEditingCbu(false);
                      setCbuError(null);
                    }}
                    data-testid="cancel-cbu-button"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingCbu}
                    onClick={handleSaveCbu}
                    data-testid="save-cbu-button"
                  >
                    Guardar CBU/CVU
                  </Button>
                </div>
              </div>
            )}

            {cbuSuccess && (
              <div
                style={{ marginTop: '0.75rem', color: '#065f46', backgroundColor: '#d1fae5', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem' }}
                role="status"
                data-testid="cbu-success-message"
              >
                ✓ {cbuSuccess}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0f172a' }}>
                Documento de Identidad (DNI/CUIT):
              </span>
              <span
                data-testid="dni-badge"
                className={`${styles.statusBadge} ${taxId ? styles.statusSettled : styles.statusPending}`}
              >
                {taxId ? 'DNI cargado' : 'DNI pendiente'}
              </span>
            </div>

            {taxId && !isEditingDni && (
              <Button
                variant="bordered"
                size="sm"
                onClick={() => {
                  setDniInput(taxId);
                  setIsEditingDni(true);
                  setDniError(null);
                  setDniSuccess(null);
                }}
                data-testid="edit-dni-button"
              >
                Modificar DNI
              </Button>
            )}
          </div>

          {taxId && !isEditingDni && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#475569' }}>
              Número registrado: <strong className="font-mono" data-testid="current-tax-id">{taxId}</strong>
            </div>
          )}

          {(!taxId || isEditingDni) && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}>
              <Input
                label="Ingresá tu DNI o CUIT"
                id="input-profile-dni"
                value={dniInput}
                onChange={(e) => {
                  setDniInput(e.target.value);
                  if (dniError) setDniError(null);
                }}
                placeholder="Ej: 32456789 o 20-32456789-4"
                error={dniError ?? undefined}
                helperText="DNI (7-8 dígitos) o CUIT (11 dígitos)."
                className="font-mono"
                data-testid="input-dni"
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isEditingDni && (
                  <Button
                    type="button"
                    variant="bordered"
                    size="sm"
                    onClick={() => {
                      setIsEditingDni(false);
                      setDniError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingDni}
                  onClick={handleSaveDni}
                  data-testid="save-dni-button"
                >
                  Guardar DNI
                </Button>
              </div>
            </div>
          )}

          {dniSuccess && (
            <div
              style={{ marginTop: '0.75rem', color: '#065f46', backgroundColor: '#d1fae5', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem' }}
              role="status"
              data-testid="dni-success-message"
            >
              ✓ {dniSuccess}
            </div>
          )}
        </div>
      </section>

      {/* Dual-Role PyME Onboarding Card or Active Banner (at bottom of panel) */}
      {renderPymeOnboardingCard()}

      {/* Retiro de Fondos a CBU Modal (Issue #70) */}
      <WithdrawalModal
        isOpen={isWithdrawalModalOpen}
        onClose={() => setIsWithdrawalModalOpen(false)}
        investorId={currentInvestorId}
        availableBalance={effectiveCustodyBalance}
        bankCbuCvu={investorCbu}
        bankAlias={investorAlias}
        onSuccess={(tx, amount) => {
          setCustodyTransactions((prev) => [tx, ...prev]);
          setCustodyBalanceState((prev) => {
            const current = prev ?? effectiveCustodyBalance;
            return Math.max(0, current - amount);
          });
        }}
      />

      {/* Modal de visualización de pagaré firmado con Anexo I (Issue #83) */}
      {isPagareModalOpen && selectedLoanForPagare && (
        <PromissoryNoteModal
          isOpen={isPagareModalOpen}
          onClose={() => {
            setIsPagareModalOpen(false);
            setSelectedLoanForPagare(null);
            setSelectedInvestmentForPagare(null);
          }}
          loan={selectedLoanForPagare}
          readOnly={true}
          currentUserRole="investor"
          currentInvestor={{
            id: currentInvestorId,
            legal_name: investorName || 'Inversor Registrado',
            tax_id: taxId || 'DNI/CUIT no informado',
            amount: selectedInvestmentForPagare?.amount || 0,
          }}
        />
      )}
    </div>
  );
}
