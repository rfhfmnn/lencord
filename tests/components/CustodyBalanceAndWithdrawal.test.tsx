import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvestorDashboard } from '@/components/dashboard/InvestorDashboard';
import { WithdrawalModal } from '@/components/dashboard/WithdrawalModal';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { MockStateStore } from '@/services/mock';

describe('Custody Balance, Movements History and CBU Withdrawal (Issue #70)', () => {
  let mockStore: MockStateStore;
  let services: ReturnType<typeof createServices>;

  beforeEach(() => {
    mockStore = new MockStateStore();
    services = createServices({ useMocks: true, store: mockStore });
  });

  it('renders available custody balance and withdrawal button on InvestorDashboard', async () => {
    render(
      <ServiceProvider value={services}>
        <InvestorDashboard investorId="prof-inv-001" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('custody-balance-card')).toBeInTheDocument();
    });

    const balanceCard = screen.getByTestId('available-custody-balance');
    expect(balanceCard).toHaveTextContent('Saldo disponible en custodia:');
    expect(balanceCard).toHaveTextContent('$ 5.250.000');

    const withdrawBtn = screen.getByTestId('btn-withdraw-funds');
    expect(withdrawBtn).toBeInTheDocument();
    expect(withdrawBtn).toHaveTextContent('Retirar fondos a mi CBU');
  });

  it('renders auditable movements history table with credits and debits', async () => {
    render(
      <ServiceProvider value={services}>
        <InvestorDashboard investorId="prof-inv-001" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('custody-transactions-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('custody-transactions-table')).toBeInTheDocument();
    expect(screen.getByTestId('custody-tx-row-ctx-seed-001')).toBeInTheDocument();
    expect(screen.getByTestId('custody-tx-row-ctx-seed-002')).toBeInTheDocument();
    expect(screen.getByTestId('custody-tx-row-ctx-seed-003')).toBeInTheDocument();

    // Verify positive and negative formatting
    const depositAmount = screen.getByTestId('custody-tx-amount-ctx-seed-001');
    expect(depositAmount).toHaveTextContent('+ $ 5.000.000');

    const holdAmount = screen.getByTestId('custody-tx-amount-ctx-seed-002');
    expect(holdAmount).toHaveTextContent('- $ 500.000');

    const payoutAmount = screen.getByTestId('custody-tx-amount-ctx-seed-003');
    expect(payoutAmount).toHaveTextContent('+ $ 750.000');
  });

  it('renders friendly empty state when investor has no transaction movements', async () => {
    // Clear transactions for this test
    mockStore.custodyTransactions = [];

    render(
      <ServiceProvider value={services}>
        <InvestorDashboard investorId="prof-inv-empty" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('custody-transactions-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('no-transactions-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No registrás movimientos en tu cuenta')).toBeInTheDocument();
    expect(screen.getByTestId('explore-marketplace-from-empty-transactions')).toBeInTheDocument();
  });

  it('validates withdrawal modal amount inputs and quick autofill', async () => {
    render(
      <ServiceProvider value={services}>
        <InvestorDashboard investorId="prof-inv-001" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-withdraw-funds')).toBeInTheDocument();
    });

    // Open withdrawal modal
    fireEvent.click(screen.getByTestId('btn-withdraw-funds'));

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-modal')).toBeInTheDocument();
    });

    // Verify destination CBU display
    expect(screen.getByTestId('modal-cbu-display')).toHaveTextContent('0070123430000055667788');
    expect(screen.getByTestId('modal-available-balance')).toHaveTextContent('$ 5.250.000');

    const amountInput = screen.getByTestId('withdrawal-amount-input');
    const submitBtn = screen.getByTestId('btn-confirm-withdrawal');

    // 1. Error when amount <= 0
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-error')).toHaveTextContent('El importe a retirar debe ser mayor a cero.');
    });

    // 2. Error when amount exceeds available balance
    fireEvent.change(amountInput, { target: { value: '9000000' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-error')).toHaveTextContent('El monto supera tu saldo disponible en custodia.');
    });

    // 3. Quick autofill sets max available balance
    const autofillBtn = screen.getByTestId('btn-withdraw-all');
    fireEvent.click(autofillBtn);

    expect(amountInput).toHaveValue(5250000);
  });

  it('shows missing bank account alert and disables withdrawal when investor has no CBU', () => {
    render(
      <ServiceProvider value={services}>
        <WithdrawalModal
          isOpen={true}
          onClose={() => {}}
          investorId="prof-inv-no-cbu"
          availableBalance={100000}
          bankCbuCvu={null}
        />
      </ServiceProvider>
    );

    expect(screen.getByTestId('missing-bank-account-alert')).toBeInTheDocument();
    expect(screen.getByText(/No tenés una cuenta bancaria configurada/i)).toBeInTheDocument();
    expect(screen.getByTestId('btn-confirm-withdrawal')).toBeDisabled();
  });

  it('completes withdrawal, shows receipt and reactively updates custody balance and movements', async () => {
    render(
      <ServiceProvider value={services}>
        <InvestorDashboard investorId="prof-inv-001" />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('available-custody-balance')).toHaveTextContent('$ 5.250.000');
    });

    // Open modal
    fireEvent.click(screen.getByTestId('btn-withdraw-funds'));

    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-modal')).toBeInTheDocument();
    });

    // Enter valid withdrawal amount
    const amountInput = screen.getByTestId('withdrawal-amount-input');
    fireEvent.change(amountInput, { target: { value: '500000' } });

    // Submit
    fireEvent.click(screen.getByTestId('btn-confirm-withdrawal'));

    // Verify receipt appears
    await waitFor(() => {
      expect(screen.getByTestId('withdrawal-receipt')).toBeInTheDocument();
    });

    expect(screen.getByTestId('withdrawal-receipt')).toHaveTextContent(
      'Solicitud de retiro registrada: La transferencia a tu CBU está en proceso'
    );
    expect(screen.getByTestId('withdrawal-receipt')).toHaveTextContent('$ 500.000');

    // Close receipt
    fireEvent.click(screen.getByTestId('btn-close-receipt'));

    await waitFor(() => {
      expect(screen.queryByTestId('withdrawal-modal')).not.toBeInTheDocument();
    });

    // Verify balance reactively decreased from 5,250,000 to 4,750,000
    await waitFor(() => {
      expect(screen.getByTestId('available-custody-balance')).toHaveTextContent('$ 4.750.000');
    });

    // Verify withdrawal movement is in table with negative format
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(3);
    expect(screen.getByText('Retiro')).toBeInTheDocument();
    const negativeAmounts = screen.getAllByText('- $ 500.000');
    expect(negativeAmounts.length).toBeGreaterThanOrEqual(2);
  });
});
