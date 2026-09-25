import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  HeroSimulator,
  formatCurrency,
  calculateBorrowerInstallment,
  calculateInvestorYield,
  BORROWER_MIN_AMOUNT,
  BORROWER_MAX_AMOUNT,
  INVESTOR_MIN_AMOUNT,
  INVESTOR_MAX_AMOUNT,
} from '@/components/home/HeroSimulator';

describe('HeroSimulator Component', () => {
  it('renders hero headline, subtitle, and trust highlights', () => {
    render(<HeroSimulator />);

    expect(
      screen.getByText('Financiamiento colectivo sin burocracia. Retornos reales sin intermediarios.')
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Conectamos PyMEs argentinas en crecimiento, con inversores que buscan retornos reales, sin intermediarios bancarios.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Evaluación 100% online en 24h')).toBeInTheDocument();
  });

  it('switches between borrower and investor modes using interactive toggle', () => {
    render(<HeroSimulator initialMode="borrower" />);

    // Initially in borrower mode
    expect(screen.getByTestId('borrower-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('investor-panel')).not.toBeInTheDocument();

    // Toggle to investor mode
    const investorTab = screen.getByRole('tab', { name: /quiero invertir/i });
    fireEvent.click(investorTab);

    expect(screen.getByTestId('investor-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('borrower-panel')).not.toBeInTheDocument();

    // Toggle back to borrower mode
    const borrowerTab = screen.getByRole('tab', { name: /quiero financiación/i });
    fireEvent.click(borrowerTab);

    expect(screen.getByTestId('borrower-panel')).toBeInTheDocument();
  });

  describe('Borrower Mode', () => {
    it('renders amount slider with bounds ($100.000 to $20.000.000) and updates installment immediately on slider change', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const slider = screen.getByLabelText(/monto a solicitar/i);
      expect(slider).toHaveAttribute('min', String(BORROWER_MIN_AMOUNT));
      expect(slider).toHaveAttribute('max', String(BORROWER_MAX_AMOUNT));

      // Change amount to 1.500.000
      fireEvent.change(slider, { target: { value: '1500000' } });

      const amountDisplay = screen.getByTestId('borrower-amount-display');
      expect(amountDisplay.textContent).toBe('$ 1.500.000');

      const installmentDisplay = screen.getByTestId('borrower-installment-value');
      expect(installmentDisplay.textContent).toMatch(/^\$\s[\d.]+/);
    });

    it('renders all term options (30, 60, 90 days, 6, 12 months) and updates calculations on term selection', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const term30d = screen.getByTestId('term-option-30d');
      const term60d = screen.getByTestId('term-option-60d');
      const term90d = screen.getByTestId('term-option-90d');
      const term6m = screen.getByTestId('term-option-6m');
      const term12m = screen.getByTestId('term-option-12m');

      expect(term30d).toBeInTheDocument();
      expect(term60d).toBeInTheDocument();
      expect(term90d).toBeInTheDocument();
      expect(term6m).toBeInTheDocument();
      expect(term12m).toBeInTheDocument();

      // Click 12 months
      fireEvent.click(term12m);
      expect(term12m).toHaveAttribute('aria-checked', 'true');

      // Click 30 days
      fireEvent.click(term30d);
      expect(term30d).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText('1 pago al vencimiento')).toBeInTheDocument();
    });

    it('allows toggling between Fixed TNA and CER + margin rate schemes and updates installment', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const fixedBtn = screen.getByTestId('rate-fixed-btn');
      const cerBtn = screen.getByTestId('rate-cer-btn');

      expect(fixedBtn).toHaveAttribute('aria-checked', 'true');

      const initialInstallment = screen.getByTestId('borrower-installment-value').textContent;

      // Select CER
      fireEvent.click(cerBtn);
      expect(cerBtn).toHaveAttribute('aria-checked', 'true');

      const cerInstallment = screen.getByTestId('borrower-installment-value').textContent;
      expect(cerInstallment).not.toBe(initialInstallment);
    });

    it('renders CTA button linking to /solicitar', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const ctaBtn = screen.getByTestId('borrower-cta-btn');
      expect(ctaBtn).toBeInTheDocument();
      expect(ctaBtn).toHaveAttribute('href', '/solicitar');
    });
  });

  describe('Investor Mode', () => {
    it('renders ticket slider ($10.000 to $10.000.000) and displays estimated total return and monthly interest payout', () => {
      render(<HeroSimulator initialMode="investor" />);

      const slider = screen.getByLabelText(/monto a invertir/i);
      expect(slider).toHaveAttribute('min', String(INVESTOR_MIN_AMOUNT));
      expect(slider).toHaveAttribute('max', String(INVESTOR_MAX_AMOUNT));

      fireEvent.change(slider, { target: { value: '1000000' } });

      expect(screen.getByTestId('investor-amount-display').textContent).toBe('$ 1.000.000');

      // Check estimated return & monthly interest payout displays
      const totalReturn = screen.getByTestId('investor-total-return');
      const monthlyInterest = screen.getByTestId('investor-monthly-interest');

      expect(totalReturn.textContent).toMatch(/^\$\s[\d.]+/);
      expect(monthlyInterest.textContent).toMatch(/^\$\s[\d.]+/);
    });

    it('updates investor yields when selecting term and rate options', () => {
      render(<HeroSimulator initialMode="investor" />);

      const term6m = screen.getByTestId('investor-term-option-6m');
      fireEvent.click(term6m);

      const cerBtn = screen.getByTestId('investor-rate-cer-btn');
      fireEvent.click(cerBtn);

      expect(screen.getByTestId('investor-total-return').textContent).toMatch(/^\$\s[\d.]+/);
    });

    it('renders CTA button linking to /marketplace', () => {
      render(<HeroSimulator initialMode="investor" />);

      const ctaBtn = screen.getByTestId('investor-cta-btn');
      expect(ctaBtn).toBeInTheDocument();
      expect(ctaBtn).toHaveAttribute('href', '/marketplace');
    });
  });

  describe('Mathematical Calculations & Edge Cases', () => {
    it('formats Argentine currency correctly ($ 1.500.000)', () => {
      expect(formatCurrency(1500000)).toBe('$ 1.500.000');
      expect(formatCurrency(100000)).toBe('$ 100.000');
      expect(formatCurrency(20000000)).toBe('$ 20.000.000');
      expect(formatCurrency(0)).toBe('$ 0');
    });

    it('handles borrower edge cases: minimum amount and maximum amount without error', () => {
      const minInstallment = calculateBorrowerInstallment(BORROWER_MIN_AMOUNT, 1, 'fixed');
      expect(minInstallment).toBeGreaterThan(BORROWER_MIN_AMOUNT);

      const maxInstallment = calculateBorrowerInstallment(BORROWER_MAX_AMOUNT, 12, 'fixed');
      expect(maxInstallment).toBeGreaterThan(0);
      expect(Number.isFinite(maxInstallment)).toBe(true);

      // 0 or negative
      expect(calculateBorrowerInstallment(0, 3, 'fixed')).toBe(0);
      expect(calculateBorrowerInstallment(-500, 3, 'fixed')).toBe(0);
    });

    it('handles investor edge cases: minimum ticket and maximum ticket accurately', () => {
      const minYield = calculateInvestorYield(INVESTOR_MIN_AMOUNT, 1, 'fixed');
      expect(minYield.monthlyInterest).toBeGreaterThan(0);
      expect(minYield.totalReturn).toBe(INVESTOR_MIN_AMOUNT + minYield.totalProfit);

      const maxYield = calculateInvestorYield(INVESTOR_MAX_AMOUNT, 12, 'cer');
      expect(maxYield.totalReturn).toBeGreaterThan(INVESTOR_MAX_AMOUNT);
      expect(Number.isFinite(maxYield.totalReturn)).toBe(true);
    });
  });
});
