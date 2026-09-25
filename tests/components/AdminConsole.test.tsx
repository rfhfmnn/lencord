import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Loan, Profile, SmeCreditProfile } from '@/types';
import { AdminConsole } from '@/components/admin/AdminConsole';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { defaultMockStateStore, MockStateStore } from '@/services/mock/mockState';

describe('AdminConsole Component (Task 15)', () => {
  const mockProfiles: Record<string, Profile> = {
    'sme-test-1': {
      id: 'sme-test-1',
      role: 'sme',
      tax_id: '30712345679',
      legal_name: 'Metalúrgica Quilmes S.R.L.',
      phone: '+54 11 4253-8899',
      kyc_status: 'approved',
      bank_cbu_cvu: '0720123488000012345678',
      created_at: '2026-01-15T10:00:00.000Z',
    },
    'sme-test-2': {
      id: 'sme-test-2',
      role: 'sme',
      tax_id: '30718901234',
      legal_name: 'Alimentos del Valle SAS',
      phone: '+54 261 498-1122',
      kyc_status: 'approved',
      bank_cbu_cvu: '0170054320000043210987',
      created_at: '2026-02-01T14:30:00.000Z',
    },
  };

  const mockCreditProfiles: Record<string, SmeCreditProfile> = {
    'sme-test-1': {
      id: 'cp-1',
      profile_id: 'sme-test-1',
      bcra_situation: 1,
      risk_tier: 'Tier A',
      balance_sheet_url: 'https://storage.lencord.ar/documents/balance.pdf',
      f931_url: 'https://storage.lencord.ar/documents/f931.pdf',
      scoring_notes: null,
      updated_at: '2026-09-01T10:00:00.000Z',
    },
  };

  const mockPendingLoans: Loan[] = [
    {
      id: 'loan-review-01',
      borrower_id: 'sme-test-1',
      amount_requested: 8_000_000,
      amount_funded: 0,
      term_months: 6,
      rate_type: 'TNA_FIXED',
      investor_rate: 0,
      platform_spread: 0,
      borrower_rate: 0,
      base_uva_value: null,
      category: 'working_capital',
      status: 'in_review',
      funding_deadline: '2026-11-01T23:59:59.000Z',
      created_at: '2026-09-24T18:00:00.000Z',
    },
    {
      id: 'loan-review-02',
      borrower_id: 'sme-test-2',
      amount_requested: 15_000_000,
      amount_funded: 0,
      term_months: 12,
      rate_type: 'CER_VARIABLE',
      investor_rate: 0,
      platform_spread: 0,
      borrower_rate: 0,
      base_uva_value: 1250,
      category: 'machinery',
      status: 'in_review',
      funding_deadline: '2026-11-15T23:59:59.000Z',
      created_at: '2026-09-25T10:00:00.000Z',
    },
  ];

  it('lists all loans currently in "in_review" status with borrower legal name, CUIT, requested amount, and category', () => {
    render(
      <AdminConsole
        initialLoans={mockPendingLoans}
        initialProfiles={mockProfiles}
        initialCreditProfiles={mockCreditProfiles}
      />
    );

    // List header and count
    expect(screen.getByTestId('pending-count-badge')).toHaveTextContent('2 pendientes');

    // Loan 1 item in list
    const item1 = screen.getByTestId('loan-item-loan-review-01');
    expect(item1).toHaveTextContent('Metalúrgica Quilmes S.R.L.');
    expect(item1).toHaveTextContent('30712345679');
    expect(item1).toHaveTextContent('$ 8.000.000');
    expect(item1).toHaveTextContent('Capital de trabajo');

    // Loan 2 item in list
    const item2 = screen.getByTestId('loan-item-loan-review-02');
    expect(item2).toHaveTextContent('Alimentos del Valle SAS');
    expect(item2).toHaveTextContent('30718901234');
    expect(item2).toHaveTextContent('$ 15.000.000');
    expect(item2).toHaveTextContent('Maquinaria y equipamiento');
  });

  it('displays company details, project description, and links to inspect uploaded documents in detail view', () => {
    render(
      <AdminConsole
        initialLoans={mockPendingLoans}
        initialProfiles={mockProfiles}
        initialCreditProfiles={mockCreditProfiles}
      />
    );

    const detailView = screen.getByTestId('loan-detail-view');
    expect(detailView).toBeInTheDocument();

    // Company info
    expect(screen.getByTestId('detail-cuit')).toHaveTextContent('30712345679');
    expect(screen.getByTestId('detail-amount')).toHaveTextContent('$ 8.000.000');
    expect(screen.getByTestId('detail-description')).toHaveTextContent('Financiamiento para Capital de trabajo');

    // Documents
    expect(screen.getByTestId('link-doc-afip')).toHaveAttribute('href', expect.stringContaining('.pdf'));
    expect(screen.getByTestId('link-doc-bank')).toHaveAttribute('href', expect.stringContaining('.pdf'));
    expect(screen.getByTestId('link-doc-balance')).toHaveAttribute('href', 'https://storage.lencord.ar/documents/balance.pdf');
    expect(screen.getByTestId('link-doc-f931')).toHaveAttribute('href', 'https://storage.lencord.ar/documents/f931.pdf');
  });

  it('automatically calculates borrower final rate (investor_rate + platform_spread)', () => {
    render(
      <AdminConsole
        initialLoans={mockPendingLoans}
        initialProfiles={mockProfiles}
        initialCreditProfiles={mockCreditProfiles}
      />
    );

    const investorRateInput = screen.getByTestId('input-investor-rate');
    const platformSpreadInput = screen.getByTestId('input-platform-spread');
    const finalRateDisplay = screen.getByTestId('borrower-final-rate');

    // Default: 45.0 + 2.5 = 47.50%
    expect(finalRateDisplay).toHaveTextContent('47.50%');

    // Change investor rate to 50
    fireEvent.change(investorRateInput, { target: { value: '50' } });
    expect(screen.getByTestId('borrower-final-rate')).toHaveTextContent('52.50%');

    // Change platform spread to 3.0
    fireEvent.change(platformSpreadInput, { target: { value: '3.0' } });
    expect(screen.getByTestId('borrower-final-rate')).toHaveTextContent('53.00%');
  });

  it('rejects negative spreads and past deadlines with clear validation feedback', async () => {
    render(
      <AdminConsole
        initialLoans={mockPendingLoans}
        initialProfiles={mockProfiles}
        initialCreditProfiles={mockCreditProfiles}
      />
    );

    const platformSpreadInput = screen.getByTestId('input-platform-spread');
    const deadlineInput = screen.getByTestId('input-funding-deadline');
    const submitBtn = screen.getByTestId('btn-approve-publish');

    // 1. Negative spread
    fireEvent.change(platformSpreadInput, { target: { value: '-1.5' } });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('form-error-alert')).toHaveTextContent(
      'El spread de plataforma no puede ser negativo.'
    );

    // 2. Past deadline
    fireEvent.change(platformSpreadInput, { target: { value: '2.5' } });
    fireEvent.change(deadlineInput, { target: { value: '2020-01-01T12:00' } });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('form-error-alert')).toHaveTextContent(
      'La fecha límite de subasta debe ser una fecha y hora futura.'
    );
  });

  it('invokes approveAndPublishLoan, changes status to funding, and publishes loan to marketplace', async () => {
    const customStore = new MockStateStore();
    customStore.loans = JSON.parse(JSON.stringify(mockPendingLoans));
    customStore.profiles = Object.values(mockProfiles);
    customStore.creditProfiles = Object.values(mockCreditProfiles);
    const services = createServices({ store: customStore, useMocks: true });

    render(
      <ServiceProvider services={services}>
        <AdminConsole
          initialLoans={customStore.loans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
        />
      </ServiceProvider>
    );

    const investorRateInput = screen.getByTestId('input-investor-rate');
    const platformSpreadInput = screen.getByTestId('input-platform-spread');
    const deadlineInput = screen.getByTestId('input-funding-deadline');
    const riskTierSelect = screen.getByTestId('select-risk-tier');
    const submitBtn = screen.getByTestId('btn-approve-publish');

    // Configure approval parameters
    fireEvent.change(riskTierSelect, { target: { value: 'Tier A' } });
    fireEvent.change(investorRateInput, { target: { value: '46.0' } });
    fireEvent.change(platformSpreadInput, { target: { value: '2.0' } });
    fireEvent.change(deadlineInput, { target: { value: '2026-11-20T18:00' } });

    // Submit approval
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('success-alert')).toBeInTheDocument();
    });

    expect(screen.getByTestId('success-alert')).toHaveTextContent('aprobado con éxito');

    // Verify status transition directly in LoanServiceInterface
    const approvedLoan = await services.loans.getLoanById('loan-review-01');
    expect(approvedLoan?.status).toBe('funding');
    expect(approvedLoan?.investor_rate).toBe(46.0);
    expect(approvedLoan?.platform_spread).toBe(2.0);
    expect(approvedLoan?.borrower_rate).toBe(48.0);

    // Verify that the loan immediately appears in active marketplace listings
    const activeMarketplaceLoans = await services.loans.listLoans({ status: 'funding' });
    const foundInMarketplace = activeMarketplaceLoans.find((l) => l.id === 'loan-review-01');
    expect(foundInMarketplace).toBeDefined();
    expect(foundInMarketplace?.status).toBe('funding');
  });

  it('loads in_review loans from mock services when no initial loans provided', async () => {
    const services = createServices({ store: defaultMockStateStore, useMocks: true });

    render(
      <ServiceProvider services={services}>
        <AdminConsole />
      </ServiceProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('admin-console-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('admin-console')).toBeInTheDocument();
    // seed loan-seed-006 is in_review
    expect(screen.getByTestId('pending-loans-list')).toBeInTheDocument();
  });
});
