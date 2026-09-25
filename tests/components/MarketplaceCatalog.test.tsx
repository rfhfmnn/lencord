import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Loan, RiskTier } from '@/types';
import { MarketplaceCatalog } from '@/components/marketplace/MarketplaceCatalog';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { defaultMockStateStore } from '@/services/mock/mockState';

describe('MarketplaceCatalog Component (Task 9)', () => {
  const mockLoans: Loan[] = [
    {
      id: 'loan-1',
      borrower_id: 'sme-1',
      amount_requested: 10_000_000,
      amount_funded: 5_000_000,
      term_months: 3,
      rate_type: 'TNA_FIXED',
      investor_rate: 45.0,
      platform_spread: 2.5,
      borrower_rate: 47.5,
      base_uva_value: null,
      category: 'working_capital',
      status: 'funding',
      funding_deadline: '2026-10-30T23:59:59.000Z',
      created_at: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'loan-2',
      borrower_id: 'sme-2',
      amount_requested: 20_000_000,
      amount_funded: 10_000_000,
      term_months: 12,
      rate_type: 'CER_VARIABLE',
      investor_rate: 14.0,
      platform_spread: 2.0,
      borrower_rate: 16.0,
      base_uva_value: 1200,
      category: 'machinery',
      status: 'funding',
      funding_deadline: '2026-10-25T23:59:59.000Z',
      created_at: '2026-09-02T10:00:00.000Z',
    },
    {
      id: 'loan-3',
      borrower_id: 'sme-3',
      amount_requested: 15_000_000,
      amount_funded: 3_000_000,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 55.0,
      platform_spread: 3.0,
      borrower_rate: 58.0,
      base_uva_value: null,
      category: 'refinancing',
      status: 'funding',
      funding_deadline: '2026-10-20T23:59:59.000Z',
      created_at: '2026-09-03T10:00:00.000Z',
    },
  ];

  const mockRiskMap: Record<string, RiskTier> = {
    'sme-1': 'Tier A',
    'sme-2': 'Tier B',
    'sme-3': 'Tier C',
  };

  beforeEach(() => {
    defaultMockStateStore.reset();
  });

  it('renders catalog header and initial active loans', () => {
    render(
      <MarketplaceCatalog initialLoans={mockLoans} initialRiskMap={mockRiskMap} />
    );

    expect(screen.getByText('Oportunidades de Inversión')).toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-1')).toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-2')).toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-3')).toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('3');
  });

  it('filters loans by Risk Tier (Tier A, Tier B, Tier C)', () => {
    render(
      <MarketplaceCatalog initialLoans={mockLoans} initialRiskMap={mockRiskMap} />
    );

    const riskSelect = screen.getByTestId('filter-risk-select');

    // Filter by Tier A
    fireEvent.change(riskSelect, { target: { value: 'Tier A' } });

    expect(screen.getByTestId('loan-card-loan-1')).toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-3')).not.toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');

    // Filter by Tier B
    fireEvent.change(riskSelect, { target: { value: 'Tier B' } });
    expect(screen.getByTestId('loan-card-loan-2')).toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-1')).not.toBeInTheDocument();

    // Reset to all
    fireEvent.change(riskSelect, { target: { value: 'all' } });
    expect(screen.getByTestId('results-count')).toHaveTextContent('3');
  });

  it('filters loans by Rate Type (TNA_FIXED vs. CER_VARIABLE)', () => {
    render(
      <MarketplaceCatalog initialLoans={mockLoans} initialRiskMap={mockRiskMap} />
    );

    const rateSelect = screen.getByTestId('filter-rate-select');

    // Filter by CER
    fireEvent.change(rateSelect, { target: { value: 'CER_VARIABLE' } });

    expect(screen.getByTestId('loan-card-loan-2')).toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-3')).not.toBeInTheDocument();

    // Filter by Fixed TNA
    fireEvent.change(rateSelect, { target: { value: 'TNA_FIXED' } });
    expect(screen.getByTestId('loan-card-loan-1')).toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-3')).toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-2')).not.toBeInTheDocument();
  });

  it('filters loans by Term range (short, medium, long)', () => {
    render(
      <MarketplaceCatalog initialLoans={mockLoans} initialRiskMap={mockRiskMap} />
    );

    const termSelect = screen.getByTestId('filter-term-select');

    // Filter short term (<= 3 months)
    fireEvent.change(termSelect, { target: { value: 'short' } });
    expect(screen.getByTestId('loan-card-loan-1')).toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-3')).not.toBeInTheDocument();

    // Filter long term (>= 12 months)
    fireEvent.change(termSelect, { target: { value: 'long' } });
    expect(screen.getByTestId('loan-card-loan-2')).toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-1')).not.toBeInTheDocument();
  });

  it('displays empty state with clear messaging and reset button when no loans match filters', () => {
    render(
      <MarketplaceCatalog initialLoans={mockLoans} initialRiskMap={mockRiskMap} />
    );

    // Apply incompatible filters (Tier A with 12 months)
    const riskSelect = screen.getByTestId('filter-risk-select');
    const termSelect = screen.getByTestId('filter-term-select');

    fireEvent.change(riskSelect, { target: { value: 'Tier A' } });
    fireEvent.change(termSelect, { target: { value: 'long' } });

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No se encontraron préstamos')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No hay solicitudes activas de financiamiento que coincidan con los filtros seleccionados. Probá modificando los criterios de búsqueda.'
      )
    ).toBeInTheDocument();

    // Click reset button in empty state
    const resetBtn = screen.getByTestId('empty-reset-btn');
    fireEvent.click(resetBtn);

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-1')).toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('3');
  });

  it('retrieves active funding loans automatically from service layer', async () => {
    const services = createServices({ useMocks: true });

    render(
      <ServiceProvider services={services}>
        <MarketplaceCatalog />
      </ServiceProvider>
    );

    // Should load seed active funding loans
    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    // Seed data has 4 active loans with status: 'funding' (seed 1, 2, 3, 5)
    expect(screen.getByTestId('loan-card-loan-seed-001')).toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-seed-002')).toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-seed-003')).toBeInTheDocument();
    expect(screen.getByTestId('loan-card-loan-seed-005')).toBeInTheDocument();

    // Funded loan (seed 4) or in-review loan (seed 6) must NOT be shown
    expect(screen.queryByTestId('loan-card-loan-seed-004')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-card-loan-seed-006')).not.toBeInTheDocument();
  });
});
