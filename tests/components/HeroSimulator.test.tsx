import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  HeroSimulator,
  formatCurrency,
  formatCurrencyPrecise,
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

    expect(screen.getByText(/Evaluación 100% online/i)).toBeInTheDocument();

    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(3);
    checkmarks.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
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

      const slider = screen.getByRole('slider', { name: /monto a solicitar/i });
      expect(slider).toHaveAttribute('min', String(BORROWER_MIN_AMOUNT));
      expect(slider).toHaveAttribute('max', String(BORROWER_MAX_AMOUNT));

      // Change amount to 1.500.000
      fireEvent.change(slider, { target: { value: '1500000' } });

      const amountDisplay = screen.getByTestId('borrower-amount-display');
      expect(amountDisplay.textContent).toBe('$ 1.500.000');

      const amountInput = screen.getByTestId('borrower-amount-input') as HTMLInputElement;
      expect(amountInput.value).toBe('$ 1.500.000');

      const installmentDisplay = screen.getByTestId('borrower-installment-value');
      expect(installmentDisplay.textContent).toMatch(/^\$\s[\d.]+/);
    });

    it('renders all term options (1, 2, 3, 6, 12 months) and updates calculations on term selection', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const term1m = screen.getByTestId('term-option-1m');
      const term2m = screen.getByTestId('term-option-2m');
      const term3m = screen.getByTestId('term-option-3m');
      const term6m = screen.getByTestId('term-option-6m');
      const term12m = screen.getByTestId('term-option-12m');

      expect(term1m).toBeInTheDocument();
      expect(term2m).toBeInTheDocument();
      expect(term3m).toBeInTheDocument();
      expect(term6m).toBeInTheDocument();
      expect(term12m).toBeInTheDocument();

      // Click 12 months
      fireEvent.click(term12m);
      expect(term12m).toHaveAttribute('aria-checked', 'true');

      // Click 1 month
      fireEvent.click(term1m);
      expect(term1m).toHaveAttribute('aria-checked', 'true');
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

    it('handles manual typing in amount input, strips non-numeric characters, and updates slider/calculations in real time', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const input = screen.getByTestId('borrower-amount-input') as HTMLInputElement;
      expect(input).toHaveAttribute('name', 'borrowerAmount');
      expect(input).toHaveAttribute('autoComplete', 'off');
      expect(input).toHaveAttribute('spellcheck', 'false');
      expect(input).toHaveAttribute('inputMode', 'numeric');
      expect(input).toHaveAttribute('aria-label', 'Monto a solicitar en pesos argentinos');
      expect(input.value).toBe('$ 2.000.000');

      // Type a valid amount within bounds
      fireEvent.change(input, { target: { value: '3500000' } });
      expect(input.value).toBe('$ 3.500.000');

      const slider = screen.getByRole('slider', { name: /monto a solicitar/i });
      expect(slider).toHaveValue('3500000');

      // Typing non-numeric characters strips them
      fireEvent.change(input, { target: { value: '$ 3.500.000abc' } });
      expect(input.value).toBe('$ 3.500.000');
    });

    it('clamps entered amount on blur when below minimum or above maximum', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const input = screen.getByTestId('borrower-amount-input') as HTMLInputElement;
      const slider = screen.getByRole('slider', { name: /monto a solicitar/i });

      // Enter value lower than minimum ($ 50.000 < $ 100.000)
      fireEvent.change(input, { target: { value: '50000' } });
      fireEvent.blur(input);

      expect(input.value).toBe('$ 100.000');
      expect(slider).toHaveValue(String(BORROWER_MIN_AMOUNT));

      // Enter value higher than maximum ($ 25.000.000 > $ 20.000.000)
      fireEvent.change(input, { target: { value: '25000000' } });
      fireEvent.blur(input);

      expect(input.value).toBe('$ 20.000.000');
      expect(slider).toHaveValue(String(BORROWER_MAX_AMOUNT));

      // Enter empty value and blur
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(input.value).toBe('$ 100.000');
      expect(slider).toHaveValue(String(BORROWER_MIN_AMOUNT));
    });

    it('renders quick preset chips and updates amount, slider, and calculations on click', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const preset500k = screen.getByTestId('borrower-preset-500000');
      const preset2M = screen.getByTestId('borrower-preset-2000000');
      const preset5M = screen.getByTestId('borrower-preset-5000000');
      const preset10M = screen.getByTestId('borrower-preset-10000000');

      expect(preset500k).toBeInTheDocument();
      expect(preset2M).toBeInTheDocument();
      expect(preset5M).toBeInTheDocument();
      expect(preset10M).toBeInTheDocument();

      // Initially 2.000.000 is active
      expect(preset2M).toHaveAttribute('aria-pressed', 'true');
      expect(preset5M).toHaveAttribute('aria-pressed', 'false');

      // Click 5M preset
      fireEvent.click(preset5M);

      const input = screen.getByTestId('borrower-amount-input') as HTMLInputElement;
      expect(input.value).toBe('$ 5.000.000');

      const slider = screen.getByRole('slider', { name: /monto a solicitar/i });
      expect(slider).toHaveValue('5000000');

      expect(preset5M).toHaveAttribute('aria-pressed', 'true');
      expect(preset2M).toHaveAttribute('aria-pressed', 'false');
    });

    it('conditionally displays dynamic CER clarification notice only when CER is selected', () => {
      render(<HeroSimulator initialMode="borrower" />);

      // Initially fixed rate -> notice is hidden
      expect(screen.queryByTestId('borrower-cer-notice')).not.toBeInTheDocument();

      // Switch to CER rate
      fireEvent.click(screen.getByTestId('rate-cer-btn'));

      const notice = screen.getByTestId('borrower-cer-notice');
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent(/coeficiente CER publicado por el BCRA más el margen pactado \(15% anual\)/i);

      // Switch back to fixed rate -> notice is removed
      fireEvent.click(screen.getByTestId('rate-fixed-btn'));
      expect(screen.queryByTestId('borrower-cer-notice')).not.toBeInTheDocument();
    });
  });

  describe('Investor Mode', () => {
    it('renders ticket slider ($10.000 to $10.000.000) and displays estimated total return and monthly interest payout', () => {
      render(<HeroSimulator initialMode="investor" />);

      const slider = screen.getByRole('slider', { name: /monto a invertir/i });
      expect(slider).toHaveAttribute('min', String(INVESTOR_MIN_AMOUNT));
      expect(slider).toHaveAttribute('max', String(INVESTOR_MAX_AMOUNT));

      fireEvent.change(slider, { target: { value: '1000000' } });

      expect(screen.getByTestId('investor-amount-display').textContent).toBe('$ 1.000.000');

      const input = screen.getByTestId('investor-amount-input') as HTMLInputElement;
      expect(input.value).toBe('$ 1.000.000');

      // Check estimated return & monthly interest payout displays
      const totalReturn = screen.getByTestId('investor-total-return');
      const monthlyInterest = screen.getByTestId('investor-monthly-interest');

      expect(totalReturn.textContent).toMatch(/^\$\s[\d.]+/);
      expect(monthlyInterest.textContent).toMatch(/^\$\s[\d.]+/);
    });

    it('handles manual typing in investor amount input, clamps on blur, and resets on empty', () => {
      render(<HeroSimulator initialMode="investor" />);

      const input = screen.getByTestId('investor-amount-input') as HTMLInputElement;
      const slider = screen.getByRole('slider', { name: /monto a invertir/i });

      expect(input).toHaveAttribute('name', 'investorAmount');
      expect(input).toHaveAttribute('autoComplete', 'off');
      expect(input).toHaveAttribute('spellcheck', 'false');
      expect(input.value).toBe('$ 500.000');
      expect(input).toHaveAttribute('inputMode', 'numeric');
      expect(input).toHaveAttribute('aria-label', 'Monto a invertir en pesos argentinos');

      // Type valid amount
      fireEvent.change(input, { target: { value: '2500000' } });
      expect(input.value).toBe('$ 2.500.000');
      expect(slider).toHaveValue('2500000');

      // Under minimum ($ 5.000 < $ 10.000)
      fireEvent.change(input, { target: { value: '5000' } });
      fireEvent.blur(input);
      expect(input.value).toBe('$ 10.000');
      expect(slider).toHaveValue(String(INVESTOR_MIN_AMOUNT));

      // Over maximum ($ 15.000.000 > $ 10.000.000)
      fireEvent.change(input, { target: { value: '15000000' } });
      fireEvent.blur(input);
      expect(input.value).toBe('$ 10.000.000');
      expect(slider).toHaveValue(String(INVESTOR_MAX_AMOUNT));

      // Empty on blur
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(input.value).toBe('$ 10.000');
      expect(slider).toHaveValue(String(INVESTOR_MIN_AMOUNT));
    });

    it('renders investor quick preset chips and updates calculations on click', () => {
      render(<HeroSimulator initialMode="investor" />);

      const preset50k = screen.getByTestId('investor-preset-50000');
      const preset200k = screen.getByTestId('investor-preset-200000');
      const preset1M = screen.getByTestId('investor-preset-1000000');
      const preset5M = screen.getByTestId('investor-preset-5000000');

      expect(preset50k).toBeInTheDocument();
      expect(preset200k).toBeInTheDocument();
      expect(preset1M).toBeInTheDocument();
      expect(preset5M).toBeInTheDocument();

      // Click 1M preset
      fireEvent.click(preset1M);

      const input = screen.getByTestId('investor-amount-input') as HTMLInputElement;
      expect(input.value).toBe('$ 1.000.000');

      const slider = screen.getByRole('slider', { name: /monto a invertir/i });
      expect(slider).toHaveValue('1000000');
      expect(preset1M).toHaveAttribute('aria-pressed', 'true');
    });

    it('updates investor yields when selecting term and rate options', () => {
      render(<HeroSimulator initialMode="investor" />);

      const term6m = screen.getByTestId('investor-term-option-6m');
      fireEvent.click(term6m);

      const cerBtn = screen.getByTestId('investor-rate-cer-btn');
      fireEvent.click(cerBtn);

      expect(screen.getByTestId('investor-total-return').textContent).toMatch(/^\$\s[\d.]+/);
    });

    it('conditionally displays investor CER clarification notice', () => {
      render(<HeroSimulator initialMode="investor" />);

      expect(screen.queryByTestId('investor-cer-notice')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('investor-rate-cer-btn'));

      const notice = screen.getByTestId('investor-cer-notice');
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent(/índice CER del BCRA más un margen adicional del 12,5% anual/i);

      fireEvent.click(screen.getByTestId('investor-rate-fixed-btn'));
      expect(screen.queryByTestId('investor-cer-notice')).not.toBeInTheDocument();
    });

    it('renders CTA button linking to /marketplace', () => {
      render(<HeroSimulator initialMode="investor" />);

      const ctaBtn = screen.getByTestId('investor-cta-btn');
      expect(ctaBtn).toBeInTheDocument();
      expect(ctaBtn).toHaveAttribute('href', '/marketplace');
    });
  });

  describe('Mathematical Calculations & Edge Cases', () => {
    it('formats Argentine currency correctly ($ 1.500.000) and supports decimals ($ 1.500.000,00)', () => {
      expect(formatCurrency(1500000)).toBe('$ 1.500.000');
      expect(formatCurrency(100000)).toBe('$ 100.000');
      expect(formatCurrency(20000000)).toBe('$ 20.000.000');
      expect(formatCurrency(0)).toBe('$ 0');

      // With decimals option (Issue #84)
      expect(formatCurrency(1500000, { decimals: true })).toBe('$ 1.500.000,00');
      expect(formatCurrency(100000.5, { decimals: true })).toBe('$ 100.000,50');
      expect(formatCurrency(1234.567, { decimals: true })).toBe('$ 1.234,57');
      expect(formatCurrency(0, { decimals: true })).toBe('$ 0,00');
      expect(formatCurrencyPrecise(250000.75)).toBe('$ 250.000,75');
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

    it('ensures investor returns are strictly less than borrower repayments under French amortization', () => {
      const amount = 100000;
      const termMonths = 12;

      const borrowerMonthly = calculateBorrowerInstallment(amount, termMonths, 'fixed');
      const borrowerTotal = borrowerMonthly * termMonths;

      const investorYield = calculateInvestorYield(amount, termMonths, 'fixed');

      // Borrower pays French installment (48% TNA): ~$127.863
      expect(Math.round(borrowerTotal)).toBe(127863);

      // Investor receives French installment (45% TNA): ~$126.015
      expect(Math.round(investorYield.totalReturn)).toBe(126015);

      // Investor total return is strictly lower than borrower total repayment (platform spread)
      expect(investorYield.totalReturn).toBeLessThan(borrowerTotal);
      expect(investorYield.monthlyInstallment).toBeLessThan(borrowerMonthly);
      expect(investorYield.monthlyInstallment).toBeGreaterThan(0);
    });
  });
});
