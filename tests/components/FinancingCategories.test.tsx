import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FinancingCategories,
  FINANCING_CATEGORIES,
  CategoryIcon,
  BriefcaseIcon,
  MachineryIcon,
  RefinancingIcon,
  ExpansionIcon,
  NewSmeIcon,
} from '@/components/home/FinancingCategories';

describe('FinancingCategories Component & Vector SVG Icons', () => {
  it('renders section headline, badge pill, subtitle, and all 5 category cards', () => {
    render(<FinancingCategories />);

    expect(screen.getByRole('heading', { level: 2, name: 'Financiá tu empresa' })).toBeInTheDocument();
    expect(screen.getByText('Destinos de Fondos')).toBeInTheDocument();
    expect(
      screen.getByText('Diseñamos opciones de crédito a medida para cada etapa y necesidad productiva de tu negocio.')
    ).toBeInTheDocument();

    expect(screen.getByTestId('category-card-working_capital')).toBeInTheDocument();
    expect(screen.getByTestId('category-card-machinery')).toBeInTheDocument();
    expect(screen.getByTestId('category-card-refinancing')).toBeInTheDocument();
    expect(screen.getByTestId('category-card-expansion')).toBeInTheDocument();
    expect(screen.getByTestId('category-card-new_sme')).toBeInTheDocument();
  });

  it('renders vector SVG icons for each category card with aria-hidden="true" and 28x28 dimensions', () => {
    render(<FinancingCategories />);

    const workingCapitalIcon = screen.getByTestId('icon-working_capital');
    expect(workingCapitalIcon.tagName.toLowerCase()).toBe('svg');
    expect(workingCapitalIcon).toHaveAttribute('aria-hidden', 'true');
    expect(workingCapitalIcon).toHaveAttribute('width', '28');
    expect(workingCapitalIcon).toHaveAttribute('height', '28');

    const machineryIcon = screen.getByTestId('icon-machinery');
    expect(machineryIcon.tagName.toLowerCase()).toBe('svg');
    expect(machineryIcon).toHaveAttribute('aria-hidden', 'true');
    expect(machineryIcon).toHaveAttribute('width', '28');
    expect(machineryIcon).toHaveAttribute('height', '28');

    const refinancingIcon = screen.getByTestId('icon-refinancing');
    expect(refinancingIcon.tagName.toLowerCase()).toBe('svg');
    expect(refinancingIcon).toHaveAttribute('aria-hidden', 'true');
    expect(refinancingIcon).toHaveAttribute('width', '28');
    expect(refinancingIcon).toHaveAttribute('height', '28');

    const expansionIcon = screen.getByTestId('icon-expansion');
    expect(expansionIcon.tagName.toLowerCase()).toBe('svg');
    expect(expansionIcon).toHaveAttribute('aria-hidden', 'true');
    expect(expansionIcon).toHaveAttribute('width', '28');
    expect(expansionIcon).toHaveAttribute('height', '28');

    const newSmeIcon = screen.getByTestId('icon-new_sme');
    expect(newSmeIcon.tagName.toLowerCase()).toBe('svg');
    expect(newSmeIcon).toHaveAttribute('aria-hidden', 'true');
    expect(newSmeIcon).toHaveAttribute('width', '28');
    expect(newSmeIcon).toHaveAttribute('height', '28');
  });

  it('ensures no OS-dependent emojis exist in the category items', () => {
    const { container } = render(<FinancingCategories />);

    const emojis = ['💼', '⚙️', '🗓️', '🚀', '🌱'];
    emojis.forEach((emoji) => {
      expect(container.textContent).not.toContain(emoji);
    });
  });

  it('links each category card to the expected /solicitar destination url', () => {
    render(<FinancingCategories />);

    FINANCING_CATEGORIES.forEach((cat) => {
      const card = screen.getByTestId(`category-card-${cat.id}`);
      expect(card).toHaveAttribute('href', cat.href);
    });
  });

  describe('Individual SVG Icon Components', () => {
    it('renders BriefcaseIcon with custom dimensions and className', () => {
      const { container } = render(<BriefcaseIcon width={24} height={24} className="test-custom-icon" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '24');
      expect(svg).toHaveAttribute('height', '24');
      expect(svg).toHaveClass('test-custom-icon');
    });

    it('renders MachineryIcon, RefinancingIcon, ExpansionIcon, and NewSmeIcon directly', () => {
      const { container: c1 } = render(<MachineryIcon />);
      expect(c1.querySelector('svg')).toBeInTheDocument();

      const { container: c2 } = render(<RefinancingIcon />);
      expect(c2.querySelector('svg')).toBeInTheDocument();

      const { container: c3 } = render(<ExpansionIcon />);
      expect(c3.querySelector('svg')).toBeInTheDocument();

      const { container: c4 } = render(<NewSmeIcon />);
      expect(c4.querySelector('svg')).toBeInTheDocument();
    });

    it('renders CategoryIcon fallback gracefully for unknown id', () => {
      const { container } = render(<CategoryIcon id="unknown_id" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('data-testid', 'icon-working_capital');
    });
  });
});
