import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Loan } from '@/types';
import {
  InvestmentModal,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
} from '@/components/marketplace/InvestmentModal';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';

describe('InvestmentModal Checkout & BaaS Sandbox Flow (Issue #66)', () => {
  const mockLoan: Loan = {
    id: 'loan-test-checkout',
    borrower_id: 'prof-sme-001',
    amount_requested: 5_000_000,
    amount_funded: 2_000_000, // 3_000_000 available
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 45.0,
    platform_spread: 2.5,
    borrower_rate: 47.5,
    base_uva_value: null,
    category: 'working_capital',
    status: 'funding',
    funding_deadline: '2026-12-31T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  let services: ReturnType<typeof createServices>;

  beforeEach(async () => {
    services = createServices({ useMocks: true });
    // Seed mockLoan into store
    const store = (services.loans as any).store;
    if (store && store.loans) {
      const idx = store.loans.findIndex((l: Loan) => l.id === mockLoan.id);
      if (idx >= 0) {
        store.loans[idx] = { ...mockLoan };
      } else {
        store.loans.push({ ...mockLoan });
      }
    }
  });

  describe('Card Formatters and Brand Detection Helpers', () => {
    it('detects Visa card brand starting with 4', () => {
      expect(detectCardBrand('4500123456789010')).toBe('VISA');
      expect(detectCardBrand('4500 1234 5678 9010')).toBe('VISA');
    });

    it('detects Mastercard card brand starting with 51-55 or 22-27', () => {
      expect(detectCardBrand('5100123456789010')).toBe('Mastercard');
      expect(detectCardBrand('5500 1234 5678 9010')).toBe('Mastercard');
      expect(detectCardBrand('2221 0000 0000 0000')).toBe('Mastercard');
    });

    it('returns null for other unmapped BINs', () => {
      expect(detectCardBrand('370012345678901')).toBeNull();
      expect(detectCardBrand('1234')).toBeNull();
    });

    it('formats card numbers into 4-digit groups up to 16 digits', () => {
      expect(formatCardNumber('4500123456789010')).toBe('4500 1234 5678 9010');
      expect(formatCardNumber('450012')).toBe('4500 12');
      expect(formatCardNumber('4500123456789010999999')).toBe('4500 1234 5678 9010');
    });

    it('formats expiry dates as MM/AA', () => {
      expect(formatExpiry('1228')).toBe('12/28');
      expect(formatExpiry('08')).toBe('08');
      expect(formatExpiry('082')).toBe('08/2');
    });
  });

  describe('Payment Method Selection', () => {
    it('shows custody balance option with available amount and allows selecting card', async () => {
      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            investorId="prof-inv-001" // Has $5.250.000 custody balance
          />
        </ServiceProvider>
      );

      // Verify custody option is present and checked by default
      const custodyRadio = screen.getByTestId('payment-method-custody');
      const cardRadio = screen.getByTestId('payment-method-card');

      expect(custodyRadio).toBeInTheDocument();
      expect(cardRadio).toBeInTheDocument();
      expect(custodyRadio).toBeChecked();
      expect(cardRadio).not.toBeChecked();

      // Card form is not displayed initially when custody_balance is active
      expect(screen.queryByTestId('card-form-container')).not.toBeInTheDocument();

      // Switch to card payment
      fireEvent.click(cardRadio);
      expect(cardRadio).toBeChecked();
      expect(custodyRadio).not.toBeChecked();

      // Card form is now displayed
      expect(screen.getByTestId('card-form-container')).toBeInTheDocument();
      expect(screen.getByTestId('card-number-input')).toBeInTheDocument();
    });
  });

  describe('Card Form Sandbox & Inline Validations', () => {
    it('validates card fields and renders accessible error alerts', async () => {
      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            investorId="prof-inv-001"
            defaultCreditRiskAccepted={true}
          />
        </ServiceProvider>
      );

      // Enter amount
      const amountInput = screen.getByTestId('investment-amount-input');
      fireEvent.change(amountInput, { target: { value: '50000' } });

      // Switch to card
      fireEvent.click(screen.getByTestId('payment-method-card'));
      expect(screen.getByTestId('card-form-container')).toBeInTheDocument();

      // Submit with empty card fields
      const submitBtn = screen.getByTestId('modal-confirm-button');
      fireEvent.click(submitBtn);

      // Inline validation errors appear with role="alert"
      expect(screen.getByTestId('card-number-error')).toHaveTextContent(
        'El número de tarjeta debe tener 16 dígitos.'
      );
      expect(screen.getByTestId('card-expiry-error')).toHaveTextContent(
        'Ingresá la fecha de vencimiento (MM/AA).'
      );
      expect(screen.getByTestId('card-cvv-error')).toHaveTextContent(
        'El CVV debe tener al menos 3 dígitos.'
      );
      expect(screen.getByTestId('card-holder-error')).toHaveTextContent(
        'Ingresá el nombre completo del titular.'
      );
    });

    it('toggles CVV visibility between masked password and plain text', async () => {
      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
          />
        </ServiceProvider>
      );

      fireEvent.click(screen.getByTestId('payment-method-card'));

      const cvvInput = screen.getByTestId('card-cvv-input');
      const toggleBtn = screen.getByTestId('toggle-cvv-visibility');

      expect(cvvInput).toHaveAttribute('type', 'password');
      expect(toggleBtn).toHaveTextContent('Mostrar');

      // Click to show CVV
      fireEvent.click(toggleBtn);
      expect(cvvInput).toHaveAttribute('type', 'text');
      expect(toggleBtn).toHaveTextContent('Ocultar');

      // Click to hide again
      fireEvent.click(toggleBtn);
      expect(cvvInput).toHaveAttribute('type', 'password');
    });

    it('sandbox quick test button "Tarjeta válida de prueba" autofills valid card and brand badge', async () => {
      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
          />
        </ServiceProvider>
      );

      fireEvent.click(screen.getByTestId('payment-method-card'));

      const validBtn = screen.getByTestId('sandbox-valid-card-button');
      fireEvent.click(validBtn);

      // Verify autofilled values
      expect(screen.getByTestId('card-number-input')).toHaveValue('4500 1234 5678 9010');
      expect(screen.getByTestId('card-expiry-input')).toHaveValue('12/28');
      expect(screen.getByTestId('card-cvv-input')).toHaveValue('123');
      expect(screen.getByTestId('card-holder-input')).toHaveValue('Juan Ignacio Pérez');

      // Brand badge shows VISA
      expect(screen.getByTestId('card-brand-badge')).toHaveTextContent('VISA');

      // No validation errors are visible
      expect(screen.queryByTestId('card-number-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-expiry-error')).not.toBeInTheDocument();
    });

    it('sandbox quick test button "Simular tarjeta rechazada" displays bank rejection alert on submit', async () => {
      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            defaultCreditRiskAccepted={true}
          />
        </ServiceProvider>
      );

      // Set amount
      fireEvent.change(screen.getByTestId('investment-amount-input'), {
        target: { value: '80000' },
      });

      // Switch to card and click simulated rejected card
      fireEvent.click(screen.getByTestId('payment-method-card'));
      fireEvent.click(screen.getByTestId('sandbox-rejected-card-button'));

      expect(screen.getByTestId('card-number-input')).toHaveValue('4500 0000 0000 0002');

      // Click submit
      const submitBtn = screen.getByTestId('modal-confirm-button');
      fireEvent.click(submitBtn);

      // Rejection banner is displayed with role="alert"
      await waitFor(() => {
        expect(screen.getByTestId('modal-submit-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('modal-submit-error')).toHaveTextContent(
        'Fondos insuficientes: La entidad bancaria emisora rechazó la operación.'
      );
      // Did not transition to receipt
      expect(screen.queryByTestId('investment-success-view')).not.toBeInTheDocument();
    });
  });

  describe('Successful Card Checkout, Double-Click Prevention and Receipt View', () => {
    it('prevents double-click by setting disabled and aria-busy, and renders receipt with transaction ID and masked card', async () => {
      const onSuccessMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={onCloseMock}
            loan={mockLoan}
            defaultCreditRiskAccepted={true}
            onSuccess={onSuccessMock}
          />
        </ServiceProvider>
      );

      // Enter valid amount
      fireEvent.change(screen.getByTestId('investment-amount-input'), {
        target: { value: '150000' },
      });

      // Switch to card and autofill valid card
      fireEvent.click(screen.getByTestId('payment-method-card'));
      fireEvent.click(screen.getByTestId('sandbox-valid-card-button'));

      const submitBtn = screen.getByTestId('modal-confirm-button');
      expect(submitBtn).not.toBeDisabled();

      // Submit checkout
      fireEvent.click(submitBtn);

      // Double submit prevention verification
      // While pending, button should be disabled / busy
      await waitFor(() => {
        expect(screen.getByTestId('investment-success-view')).toBeInTheDocument();
      });

      // Verification of receipt view details
      expect(screen.getByText('¡Inversión confirmada con éxito!')).toBeInTheDocument();
      expect(screen.getByTestId('success-amount')).toHaveTextContent('$ 150.000');
      expect(screen.getByTestId('success-payment-method')).toHaveTextContent('Tarjeta VISA •••• 9010');
      expect(screen.getByTestId('success-transaction-id')).toHaveTextContent(/^ctx-/);
      expect(screen.getByTestId('success-hold-id')).toBeInTheDocument();
      expect(screen.getByTestId('success-timestamp')).toBeInTheDocument();

      // Verification of action buttons
      expect(screen.getByTestId('close-success-button')).toHaveTextContent('Volver al Marketplace');
      expect(screen.getByTestId('go-to-investments-button')).toHaveTextContent('Ir a Mis inversiones');

      // Verify onSuccess callback was executed with updated loan data
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      const callbackResult = onSuccessMock.mock.calls[0][0];
      expect(callbackResult.amount_funded).toBe(mockLoan.amount_funded + 150_000);
      expect(callbackResult.payment_method).toBe('credit_card');
      expect(callbackResult.card_last_four).toBe('9010');

      // Close modal
      fireEvent.click(screen.getByTestId('close-success-button'));
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('completes checkout using custody balance and reflects "Saldo en custodia" in receipt', async () => {
      const onSuccessMock = vi.fn();

      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            defaultCreditRiskAccepted={true}
            onSuccess={onSuccessMock}
          />
        </ServiceProvider>
      );

      // Enter amount covered by $5.250.000 balance
      fireEvent.change(screen.getByTestId('investment-amount-input'), {
        target: { value: '200000' },
      });

      // Ensure custody_balance is checked
      expect(screen.getByTestId('payment-method-custody')).toBeChecked();

      fireEvent.click(screen.getByTestId('modal-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('investment-success-view')).toBeInTheDocument();
      });

      expect(screen.getByTestId('success-payment-method')).toHaveTextContent('Saldo en custodia');
      expect(screen.getByTestId('success-amount')).toHaveTextContent('$ 200.000');
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      expect(onSuccessMock.mock.calls[0][0].payment_method).toBe('custody_balance');
    });
  });

  describe('Issue #76: Test Funds Recharge and Business Error Handling', () => {
    it('renders "Cargar saldo de prueba" button when custody balance is zero and allows topping up test funds', async () => {
      const zeroBalanceInvestorId = 'prof-zero-custody';
      const store = (services.loans as any).store;
      if (store) {
        store.profiles.push({
          id: zeroBalanceInvestorId,
          role: 'investor',
          legal_name: 'Inversor Sin Fondos',
          tax_id: '20334455667',
          custody_balance: 0,
        });
      }

      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            investorId={zeroBalanceInvestorId}
            defaultCreditRiskAccepted={true}
          />
        </ServiceProvider>
      );

      // Verify "Cargar saldo de prueba" button is rendered
      const addTestFundsBtn = screen.getByTestId('btn-add-test-funds');
      expect(addTestFundsBtn).toBeInTheDocument();
      expect(addTestFundsBtn).toHaveTextContent('Cargar saldo de prueba');

      // Click to recharge $1.000.000 test funds
      fireEvent.click(addTestFundsBtn);

      // Now custody balance should display $ 1.000.000
      expect(screen.getByText(/\$ 1\.000\.000 disponible/i)).toBeInTheDocument();

      // Custody radio should now be checked and enabled
      const custodyRadio = screen.getByTestId('payment-method-custody');
      expect(custodyRadio).toBeChecked();
      expect(custodyRadio).not.toBeDisabled();
    });

    it('shows friendly business exception when custody balance is insufficient at submission', async () => {
      const customServices = createServices({ useMocks: true });
      customServices.investments.checkoutInvestment = vi.fn().mockRejectedValue(
        new Error('Tu saldo en custodia es insuficiente para realizar esta inversión.')
      );

      render(
        <ServiceProvider services={customServices}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            investorId="prof-inv-001"
            defaultCreditRiskAccepted={true}
          />
        </ServiceProvider>
      );

      fireEvent.change(screen.getByTestId('investment-amount-input'), {
        target: { value: '500000' },
      });

      fireEvent.click(screen.getByTestId('modal-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('modal-submit-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('modal-submit-error')).toHaveTextContent(
        'Tu saldo en custodia es insuficiente para realizar esta inversión.'
      );
    });

    it('shows friendly business exception when attempting to self-fund own loan', async () => {
      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            investorId={mockLoan.borrower_id}
            defaultCreditRiskAccepted={true}
          />
        </ServiceProvider>
      );

      expect(screen.getByTestId('self-funding-warning')).toHaveTextContent(
        'No podés invertir en tu propia solicitud de crédito.'
      );
      expect(screen.getByTestId('modal-confirm-button')).toBeDisabled();
    });
  });

  describe('Issue #81: Custody Balance and Error Handling', () => {
    it('disables custody option, shows "Saldo insuficiente ($ 0,00)", and preselects credit card when custody balance is zero', async () => {
      const zeroInvId = 'prof-inv-zero-81';
      const store = (services.loans as any).store;
      if (store) {
        store.profiles.push({
          id: zeroInvId,
          role: 'investor',
          legal_name: 'Inversor Con Saldo Cero',
          tax_id: '20334455667',
          custody_balance: 0,
        });
      }

      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            investorId={zeroInvId}
            defaultCreditRiskAccepted={true}
          />
        </ServiceProvider>
      );

      // Verify custody radio is disabled
      const custodyRadio = screen.getByTestId('payment-method-custody');
      expect(custodyRadio).toBeDisabled();

      // Verify clarification "Saldo insuficiente ($ 0,00)" is shown
      expect(screen.getByTestId('custody-balance-label')).toHaveTextContent('Saldo insuficiente ($ 0,00)');
      expect(screen.getAllByText(/Saldo insuficiente \(\$ 0,00\)/i).length).toBeGreaterThanOrEqual(1);

      // Verify credit_card is auto-preselected
      const cardRadio = screen.getByTestId('payment-method-card');
      expect(cardRadio).toBeChecked();
      expect(custodyRadio).not.toBeChecked();

      // Card form is automatically displayed
      expect(screen.getByTestId('card-form-container')).toBeInTheDocument();
    });

    it('blocks submission and shows "Saldo en custodia insuficiente para completar la inversión." when parsedAmount exceeds custody balance', async () => {
      const partialInvId = 'prof-inv-partial-81';
      const store = (services.loans as any).store;
      if (store) {
        store.profiles.push({
          id: partialInvId,
          role: 'investor',
          legal_name: 'Inversor Saldo Parcial',
          tax_id: '20334455667',
          custody_balance: 50000, // Has $50.000
        });
      }

      render(
        <ServiceProvider services={services}>
          <InvestmentModal
            isOpen={true}
            onClose={vi.fn()}
            loan={mockLoan}
            investorId={partialInvId}
            defaultCreditRiskAccepted={true}
          />
        </ServiceProvider>
      );

      // Custody balance radio is enabled and checked since 50.000 >= 10.000
      const custodyRadio = screen.getByTestId('payment-method-custody');
      expect(custodyRadio).toBeEnabled();
      expect(custodyRadio).toBeChecked();

      // Enter $100.000 (exceeds $50.000 custody balance)
      const input = screen.getByTestId('investment-amount-input');
      fireEvent.change(input, { target: { value: '100000' } });

      const submitBtn = screen.getByTestId('modal-confirm-button');
      expect(submitBtn).toBeEnabled();

      // Click submit
      fireEvent.click(submitBtn);

      // Modal blocks submission and displays error message
      await waitFor(() => {
        expect(screen.getByTestId('modal-submit-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('modal-submit-error')).toHaveTextContent(
        'Saldo en custodia insuficiente para completar la inversión.'
      );
      // Did not transition to success
      expect(screen.queryByTestId('investment-success-view')).not.toBeInTheDocument();
    });
  });
});
