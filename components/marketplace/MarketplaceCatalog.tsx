'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Loan, RateType, RiskTier } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { LoanCard } from './LoanCard';
import styles from './marketplace.module.css';

export type TermFilter = 'all' | 'short' | 'medium' | 'long';

export interface MarketplaceCatalogProps {
  initialLoans?: Loan[];
  initialRiskMap?: Record<string, RiskTier>;
  className?: string;
}

export function MarketplaceCatalog({
  initialLoans,
  initialRiskMap,
  className = '',
}: MarketplaceCatalogProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [loans, setLoans] = useState<Loan[]>(initialLoans ?? []);
  const [riskMap, setRiskMap] = useState<Record<string, RiskTier>>(initialRiskMap ?? {});
  const [loading, setLoading] = useState<boolean>(!initialLoans);

  // Filter states
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [rateFilter, setRateFilter] = useState<string>('all');
  const [termFilter, setTermFilter] = useState<TermFilter>('all');

  // Load active funding loans and credit profiles
  useEffect(() => {
    if (initialLoans) {
      setLoans(initialLoans);
      if (initialRiskMap) setRiskMap(initialRiskMap);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadMarketplaceData() {
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

        // Only active loans in funding stage
        const fundingLoans = await resolvedServices.loans.listLoans({ status: 'funding' });

        // Retrieve risk tiers for each unique borrower
        const uniqueBorrowerIds = Array.from(
          new Set(fundingLoans.map((l: Loan) => l.borrower_id))
        );
        const creditProfiles: { borrowerId: string; riskTier: RiskTier }[] = await Promise.all(
          uniqueBorrowerIds.map(async (borrowerId) => {
            try {
              const profile = await resolvedServices.creditScoring.getCreditProfileByProfileId(
                borrowerId
              );
              return { borrowerId, riskTier: profile?.risk_tier ?? ('Tier B' as RiskTier) };
            } catch {
              return { borrowerId, riskTier: 'Tier B' as RiskTier };
            }
          })
        );

        const newRiskMap: Record<string, RiskTier> = {};
        for (const item of creditProfiles) {
          newRiskMap[item.borrowerId] = item.riskTier;
        }

        if (isMounted) {
          setLoans(fundingLoans);
          setRiskMap(newRiskMap);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading loans for marketplace:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMarketplaceData();

    return () => {
      isMounted = false;
    };
  }, [servicesFromContext, initialLoans, initialRiskMap]);

  // Multi-criteria filtering
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      // 1. Risk Tier filter
      if (riskFilter !== 'all') {
        const loanRisk = riskMap[loan.borrower_id] ?? 'Tier B';
        if (loanRisk !== riskFilter) {
          return false;
        }
      }

      // 2. Rate Type filter
      if (rateFilter !== 'all') {
        if (loan.rate_type !== rateFilter) {
          return false;
        }
      }

      // 3. Term Range filter
      if (termFilter !== 'all') {
        if (termFilter === 'short' && loan.term_months > 3) {
          return false;
        }
        if (termFilter === 'medium' && loan.term_months !== 6) {
          return false;
        }
        if (termFilter === 'long' && loan.term_months < 12) {
          return false;
        }
      }

      return true;
    });
  }, [loans, riskMap, riskFilter, rateFilter, termFilter]);

  const hasActiveFilters = riskFilter !== 'all' || rateFilter !== 'all' || termFilter !== 'all';

  const handleResetFilters = () => {
    setRiskFilter('all');
    setRateFilter('all');
    setTermFilter('all');
  };

  return (
    <div className={`${styles.catalogWrapper} ${className}`} data-testid="marketplace-catalog">
      <div className={styles.catalogHeader}>
        <h1 className={styles.pageTitle}>Oportunidades de Inversión</h1>
        <p className={styles.pageSubtitle}>
          Financiá proyectos de PyMEs argentinas en subastas colectivas. Cobrá capital e interés mes a mes con la seguridad de pagarés digitales.
        </p>
      </div>

      {/* Filter Bar */}
      <section className={styles.filterBar} aria-label="Filtros del catálogo de préstamos">
        <div className={styles.filterControls}>
          {/* Risk Tier Filter */}
          <div className={styles.filterGroup}>
            <label htmlFor="filter-risk" className={styles.filterLabel}>
              Nivel de riesgo
            </label>
            <select
              id="filter-risk"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className={styles.select}
              data-testid="filter-risk-select"
            >
              <option value="all">Todos los niveles</option>
              <option value="Tier A">Tier A (Bajo riesgo)</option>
              <option value="Tier B">Tier B (Riesgo medio)</option>
              <option value="Tier C">Tier C (Mayor rendimiento)</option>
            </select>
          </div>

          {/* Rate Type Filter */}
          <div className={styles.filterGroup}>
            <label htmlFor="filter-rate" className={styles.filterLabel}>
              Esquema de tasa
            </label>
            <select
              id="filter-rate"
              value={rateFilter}
              onChange={(e) => setRateFilter(e.target.value)}
              className={styles.select}
              data-testid="filter-rate-select"
            >
              <option value="all">Todas las tasas</option>
              <option value="TNA_FIXED">Tasa Fija (TNA)</option>
              <option value="CER_VARIABLE">Tasa CER + margen</option>
            </select>
          </div>

          {/* Term Range Filter */}
          <div className={styles.filterGroup}>
            <label htmlFor="filter-term" className={styles.filterLabel}>
              Plazo de amortización
            </label>
            <select
              id="filter-term"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value as TermFilter)}
              className={styles.select}
              data-testid="filter-term-select"
            >
              <option value="all">Todos los plazos</option>
              <option value="short">Corto plazo (hasta 3 meses)</option>
              <option value="medium">Mediano plazo (6 meses)</option>
              <option value="long">Largo plazo (12 meses o más)</option>
            </select>
          </div>

          {/* Reset Filters Action */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className={styles.resetButton}
              data-testid="reset-filters-btn"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Results Count & Status Summary */}
        <div className={styles.resultsSummary}>
          <span data-testid="results-count">
            Mostrando <strong>{filteredLoans.length}</strong>{' '}
            {filteredLoans.length === 1 ? 'oportunidad activa' : 'oportunidades activas'}
          </span>
          {hasActiveFilters && (
            <span className={styles.activeFiltersBadge} data-testid="active-filters-indicator">
              Filtros activos aplicados
            </span>
          )}
        </div>
      </section>

      {/* Loading State */}
      {loading && (
        <div className={styles.loadingState} data-testid="loading-state">
          <div className={styles.spinner} role="status" aria-label="Cargando oportunidades..." />
          <span>Cargando oportunidades activas...</span>
        </div>
      )}

      {/* Loan Cards Grid */}
      {!loading && filteredLoans.length > 0 && (
        <div className={styles.loanGrid} data-testid="loan-grid">
          {filteredLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              riskTier={riskMap[loan.borrower_id] ?? 'Tier B'}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredLoans.length === 0 && (
        <div className={styles.emptyState} data-testid="empty-state">
          <div className={styles.emptyIcon}>🔍</div>
          <h2 className={styles.emptyTitle}>No se encontraron préstamos</h2>
          <p className={styles.emptyDescription}>
            No hay solicitudes activas de financiamiento que coincidan con los filtros seleccionados. Probá modificando los criterios de búsqueda.
          </p>
          {hasActiveFilters && (
            <div className={styles.emptyAction}>
              <button
                type="button"
                onClick={handleResetFilters}
                className={styles.resetButton}
                data-testid="empty-reset-btn"
              >
                Restablecer todos los filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
