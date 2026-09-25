import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TierBadge } from '@/components/ui/TierBadge';

describe('TierBadge Primitive (Semáforo de Riesgo)', () => {
  it('renders Tier A badge with soft green bg #D1FAE5 and emerald text #065F46', () => {
    render(<TierBadge tier="A" />);
    const badge = screen.getByTestId('tier-badge');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Tier A');
    expect(badge).toHaveAttribute('data-tier', 'A');
    expect(badge).toHaveStyle({
      backgroundColor: '#D1FAE5',
      color: '#065F46',
    });
  });

  it('renders Tier B badge with soft amber bg #FEF3C7 and warm brown text #92400E', () => {
    render(<TierBadge tier="B" />);
    const badge = screen.getByTestId('tier-badge');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Tier B');
    expect(badge).toHaveAttribute('data-tier', 'B');
    expect(badge).toHaveStyle({
      backgroundColor: '#FEF3C7',
      color: '#92400E',
    });
  });

  it('renders Tier C badge with soft orange bg #FFEDD5 and terracotta text #9A3412', () => {
    render(<TierBadge tier="C" />);
    const badge = screen.getByTestId('tier-badge');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Tier C');
    expect(badge).toHaveAttribute('data-tier', 'C');
    expect(badge).toHaveStyle({
      backgroundColor: '#FFEDD5',
      color: '#9A3412',
    });
  });

  it('handles "Tier A", "Tier B", and "Tier C" string formats correctly', () => {
    const { rerender } = render(<TierBadge tier="Tier A" />);
    expect(screen.getByTestId('tier-badge')).toHaveAttribute('data-tier', 'A');

    rerender(<TierBadge tier="Tier B" />);
    expect(screen.getByTestId('tier-badge')).toHaveAttribute('data-tier', 'B');

    rerender(<TierBadge tier="Tier C" />);
    expect(screen.getByTestId('tier-badge')).toHaveAttribute('data-tier', 'C');
  });

  it('renders custom children when provided', () => {
    render(<TierBadge tier="A">Riesgo Bajo (A)</TierBadge>);
    const badge = screen.getByTestId('tier-badge');
    expect(badge).toHaveTextContent('Riesgo Bajo (A)');
    expect(badge).toHaveStyle({
      backgroundColor: '#D1FAE5',
      color: '#065F46',
    });
  });
});
