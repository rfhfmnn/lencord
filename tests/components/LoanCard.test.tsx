import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Loan } from '@/types';
import {
  LoanCard,
  formatRateDisplay,
  calculateDaysRemaining,
  truncateDescription,
} from '@/components/marketplace/LoanCard';

describe('LoanCard Component (Task 9)', () => {
  const mockLoan: Loan = {
    id: 'loan-test-001',
    borrower_id: 'prof-sme-001',
    amount_requested: 10_000_000,
    amount_funded: 4_000_000,
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 48.0,
    platform_spread: 2.5,
    borrower_rate: 50.5,
    base_uva_value: null,
    category: 'working_capital',
    status: 'funding',
    funding_deadline: '2026-10-31T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  it('renders borrower category label', () => {
    render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
    expect(screen.getByTestId('loan-category')).toHaveTextContent('Capital de trabajo');
  });

  it('renders anonymized risk badge with design system tier tokens', () => {
    render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
    const badge = screen.getByTestId('loan-risk-badge');
    expect(badge).toHaveTextContent('Tier A');
    expect(badge).toHaveAttribute('data-tier', 'A');
  });

  it('renders fixed TNA rate correctly formatted', () => {
    render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
    expect(screen.getByTestId('loan-rate')).toHaveTextContent('48,0% TNA');
  });

  it('renders CER + margin rate correctly formatted', () => {
    const cerLoan: Loan = {
      ...mockLoan,
      rate_type: 'CER_VARIABLE',
      investor_rate: 14.5,
    };
    render(<LoanCard loan={cerLoan} riskTier="Tier B" />);
    expect(screen.getByTestId('loan-rate')).toHaveTextContent('CER + 14,5%');
  });

  it('renders loan term in months', () => {
    render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
    expect(screen.getByTestId('loan-term')).toHaveTextContent('6 meses');
  });

  it('displays funding progress bar and percentage calculation', () => {
    render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
    expect(screen.getByTestId('loan-percentage')).toHaveTextContent('40% financiado');

    const progressFill = screen.getByTestId('loan-progress-fill');
    expect(progressFill).toHaveStyle({ width: '40%' });
  });

  it('displays remaining amount to fund in formatted Argentine currency', () => {
    render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
    // 10.000.000 - 4.000.000 = 6.000.000
    expect(screen.getByTestId('loan-remaining-amount')).toHaveTextContent('$ 6.000.000');
  });

  it('displays days remaining until deadline', () => {
    const referenceDate = new Date('2026-10-21T00:00:00.000Z');
    render(<LoanCard loan={mockLoan} riskTier="Tier A" referenceDate={referenceDate} />);
    // 31 - 21 = 11 days remaining
    expect(screen.getByTestId('loan-days-remaining')).toHaveTextContent('11 días restantes');
  });

  it('links to /marketplace/[id]', () => {
    render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
    const link = screen.getByTestId('loan-card-loan-test-001');
    expect(link).toHaveAttribute('href', '/marketplace/loan-test-001');
  });

  it('rate format helper handles edge case rate numbers correctly', () => {
    expect(formatRateDisplay('TNA_FIXED', 45)).toBe('45,0% TNA');
    expect(formatRateDisplay('CER_VARIABLE', 12.75)).toBe('CER + 12,8%');
  });

  it('calculates days remaining edge cases (past deadline = 0)', () => {
    const pastDate = new Date('2026-11-05T00:00:00.000Z');
    expect(calculateDaysRemaining('2026-10-31T23:59:59.000Z', pastDate)).toBe(0);
  });

  it('caps funding progress bar at 100% and does not exceed boundaries', () => {
    const overfundedLoan: Loan = {
      ...mockLoan,
      amount_funded: 12_000_000,
    };
    render(<LoanCard loan={overfundedLoan} riskTier="Tier A" />);
    expect(screen.getByTestId('loan-percentage')).toHaveTextContent('100% financiado');
    const progressFill = screen.getByTestId('loan-progress-fill');
    expect(progressFill).toHaveStyle({ width: '100%' });
  });

  describe('Project Description (Issue #59)', () => {
    it('renders brief description when provided in loan', () => {
      const loanWithDesc: Loan = {
        ...mockLoan,
        description: 'Financiamiento para compra de materia prima y stock estacional.',
      };
      render(<LoanCard loan={loanWithDesc} riskTier="Tier A" />);
      const descEl = screen.getByTestId('loan-description');
      expect(descEl).toBeInTheDocument();
      expect(descEl).toHaveTextContent('Financiamiento para compra de materia prima y stock estacional.');
    });

    it('truncates description exceeding 90 characters with ellipsis', () => {
      const longDescription =
        'Este es un proyecto productivo de una PyME metalúrgica de Córdoba para ampliar su capacidad operativa y comprar tornos CNC de alta precisión.';
      const loanWithLongDesc: Loan = {
        ...mockLoan,
        description: longDescription,
      };
      render(<LoanCard loan={loanWithLongDesc} riskTier="Tier A" />);
      const descEl = screen.getByTestId('loan-description');
      expect(descEl).toHaveTextContent(`${longDescription.slice(0, 90)}...`);
    });

    it('renders fallback description when loan description is not provided or empty', () => {
      render(<LoanCard loan={mockLoan} riskTier="Tier A" />);
      const descEl = screen.getByTestId('loan-description');
      expect(descEl).toHaveTextContent('Sin descripción informada para este proyecto.');

      const emptyLoan: Loan = { ...mockLoan, description: '   ' };
      render(<LoanCard loan={emptyLoan} riskTier="Tier A" />);
      const allDescs = screen.getAllByTestId('loan-description');
      expect(allDescs[1]).toHaveTextContent('Sin descripción informada para este proyecto.');
    });

    it('truncateDescription helper handles edge cases correctly', () => {
      expect(truncateDescription(null)).toBe('Sin descripción informada para este proyecto.');
      expect(truncateDescription(undefined)).toBe('Sin descripción informada para este proyecto.');
      expect(truncateDescription('')).toBe('Sin descripción informada para este proyecto.');
      expect(truncateDescription('   ')).toBe('Sin descripción informada para este proyecto.');

      const exactly90 = 'A'.repeat(90);
      expect(truncateDescription(exactly90)).toBe(exactly90);

      const exactly91 = 'A'.repeat(91);
      expect(truncateDescription(exactly91)).toBe(`${'A'.repeat(90)}...`);
    });
  });
});

