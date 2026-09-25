'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Installment, Investment, Loan, RiskTier, SmeCreditProfile } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { TierBadge } from '@/components/ui/TierBadge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/components/home/HeroSimulator';
import { LOAN_CATEGORY_LABELS, formatRateDisplay } from '@/components/marketplace/LoanCard';
import styles from './dashboard.module.css';

export interface InvestorDashboardProps {
  investorId?: string;
  initialInvestments?: Investment[];
  initialLoans?: Loan[];
  initialInstallments?: Installment[];
  initialCreditProfiles?: Record<string, SmeCreditProfile>;
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
}

export function InvestorDashboard({
  investorId = 'prof-inv-001',
  initialInvestments,
  initialLoans,
  initialInstallments,
  initialCreditProfiles,
  className = '',
}: InvestorDashboardProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [currentInvestorId, setCurrentInvestorId] = useState<string>(investorId);
  const [investments, setInvestments] = useState<Investment[]>(initialInvestments ?? []);
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
  const [loading, setLoading] = useState<boolean>(!initialInvestments);

  // Sync if prop changes
  useEffect(() => {
    if (investorId) {
      setCurrentInvestorId(investorId);
    }
  }, [investorId]);

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
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadInvestorData() {
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

        if (isMounted) {
          setInvestments(invs);
          setLoansMap(newLoansMap);
          setCreditProfilesMap(newCreditProfiles);
          setInstallments(combinedInstallments);
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
      return {
        investment: inv,
        loan,
        riskTier,
      };
    });
  }, [activeInvestments, loansMap, creditProfilesMap]);

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

    enrichedInvestments.forEach(({ investment, loan }) => {
      if (!loan) return;
      const loanInstallments = installments.filter((inst) => inst.loan_id === loan.id);
      const totalFunded = loan.amount_funded > 0 ? loan.amount_funded : loan.amount_requested;
      const share = totalFunded > 0 ? investment.amount / totalFunded : 0;

      loanInstallments.forEach((inst) => {
        list.push({
          installment: inst,
          loan,
          investorSharePrincipal: inst.principal_amount * share,
          investorShareInterest: inst.interest_investors * share,
        });
      });
    });

    // Sort by due date ascending
    return list.sort((a, b) => new Date(a.installment.due_date).getTime() - new Date(b.installment.due_date).getTime());
  }, [enrichedInvestments, installments]);

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
          <h1 className={styles.title}>Panel del Inversor</h1>
          <p className={styles.subtitle}>
            Seguimiento de capital invertido, rendimientos estimados y calendario de cobros.
          </p>
        </div>

        {/* Demo Investor Selector */}
        <div className={styles.investorSelector}>
          <label htmlFor="investor-select" className={styles.selectorLabel}>
            Perfil inversor:
          </label>
          <select
            id="investor-select"
            value={currentInvestorId}
            onChange={(e) => setCurrentInvestorId(e.target.value)}
            className={styles.selectInput}
            aria-label="Seleccionar cuenta de inversor"
          >
            <option value="prof-inv-001">Juan Ignacio Pérez (Retail)</option>
            <option value="prof-inv-002">Inversora Austral S.A. (Institucional)</option>
            <option value="prof-inv-003">Mariana Gómez Valenzuela (Calificada)</option>
            <option value="prof-inv-empty">Inversor Nuevo (Sin inversiones)</option>
          </select>
        </div>
      </header>

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
            Aún no has participado en ninguna subasta de financiamiento PyME. Explorá las oportunidades
            disponibles en el marketplace y comenzá a rentabilizar tu capital con retornos reales.
          </p>
          <Link href="/marketplace">
            <Button variant="primary" size="md">
              Explorar marketplace
            </Button>
          </Link>
        </section>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <section className={styles.metricsGrid} aria-label="Métricas principales de inversión">
            <div className={styles.metricCard} data-testid="metric-total-capital">
              <span className={styles.metricLabel}>Total Capital Invertido</span>
              <span className={styles.metricValue}>{formatCurrency(totalCapitalInvertido)}</span>
              <span className={styles.metricSubtextNeutral}>Capital activo en subastas y préstamos</span>
            </div>

            <div className={styles.metricCard} data-testid="metric-estimated-returns">
              <span className={styles.metricLabel}>Rendimiento Estimado / Intereses Ganados</span>
              <span className={styles.metricValue}>{formatCurrency(estimatedTotalYield)}</span>
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

            <div className={styles.tableCard}>
              <table className={styles.table} data-testid="active-investments-table">
                <thead>
                  <tr>
                    <th scope="col">Destino / Oportunidad</th>
                    <th scope="col">Ticket invertido</th>
                    <th scope="col">Tasa de interés</th>
                    <th scope="col">Riesgo</th>
                    <th scope="col">Plazo</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedInvestments.map(({ investment, loan, riskTier }) => {
                    const categoryLabel = loan
                      ? LOAN_CATEGORY_LABELS[loan.category] ?? loan.category
                      : 'Préstamo PyME';
                    const rateDisplay = loan
                      ? formatRateDisplay(loan.rate_type, loan.investor_rate)
                      : 'N/A';
                    const isSettled = investment.status === 'settled';

                    return (
                      <tr key={investment.id} data-testid={`investment-row-${investment.id}`}>
                        <td>
                          <div className={styles.primaryText}>{categoryLabel}</div>
                          <div className={styles.monoText}>ID: {investment.loan_id}</div>
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
                            className={`${styles.statusBadge} ${
                              isSettled ? styles.statusSettled : styles.statusCommitted
                            }`}
                            data-testid={`investment-status-${investment.id}`}
                          >
                            {isSettled ? 'settled' : 'committed'}
                          </span>
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
            <div className={styles.sectionHeader}>
              <h2 id="payment-schedule-title" className={styles.sectionTitle}>
                Cronograma de pagos
              </h2>
              <p className={styles.sectionDescription}>
                Calendario de cuotas mensuales de amortización e interés a percibir en tu cuenta.
              </p>
            </div>

            <div className={styles.tableCard}>
              {enrichedInstallments.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }} data-testid="no-installments-msg">
                  No hay cuotas programadas para las inversiones seleccionadas aún.
                </div>
              ) : (
                <table className={styles.table} data-testid="payment-schedule-table">
                  <thead>
                    <tr>
                      <th scope="col">Vencimiento</th>
                      <th scope="col">Cuota</th>
                      <th scope="col">Capital</th>
                      <th scope="col">Interés estimado</th>
                      <th scope="col">Total cuota</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedInstallments.map(
                      ({ installment, investorSharePrincipal, investorShareInterest }) => {
                        const totalCuota = investorSharePrincipal + investorShareInterest;
                        const statusClass =
                          installment.status === 'paid'
                            ? styles.statusPaid
                            : installment.status === 'overdue'
                            ? styles.statusOverdue
                            : styles.statusPending;

                        return (
                          <tr key={installment.id} data-testid={`installment-row-${installment.id}`}>
                            <td>
                              <div className={styles.primaryText}>{installment.due_date}</div>
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
    </div>
  );
}
