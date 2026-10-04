import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
      first_name: 'Esteban',
      last_name: 'Quito',
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
      afip_url: '/documents/constancia-afip.pdf',
      bank_statements_url: '/documents/extractos-bancarios.pdf',
      balance_sheet_url: '/documents/balance.pdf',
      f931_url: '/documents/f931.pdf',
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
    expect(screen.getByTestId('detail-representative')).toHaveTextContent('Esteban Quito');
    expect(screen.getByTestId('detail-phone')).toHaveTextContent('+54 11 4253-8899');
    expect(screen.getByTestId('detail-description')).toHaveTextContent('Financiamiento para Capital de trabajo');

    // Documents
    expect(screen.getByTestId('link-doc-afip')).toHaveAttribute('href', expect.stringContaining('.pdf'));
    expect(screen.getByTestId('link-doc-bank')).toHaveAttribute('href', expect.stringContaining('.pdf'));
    expect(screen.getByTestId('link-doc-balance')).toHaveAttribute('href', '/documents/balance.pdf');
    expect(screen.getByTestId('link-doc-f931')).toHaveAttribute('href', '/documents/f931.pdf');
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

    // Submit approval (opens confirmation modal)
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('approval-confirmation-modal')).toBeInTheDocument();
    const confirmBtn = screen.getByTestId('btn-confirm-approve');
    fireEvent.click(confirmBtn);

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

  it('allows cancelling the approval confirmation modal without making changes', async () => {
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

    const submitBtn = screen.getByTestId('btn-approve-publish');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('approval-confirmation-modal')).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('btn-cancel-approve');
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('approval-confirmation-modal')).not.toBeInTheDocument();
    const loan = await services.loans.getLoanById('loan-review-01');
    expect(loan?.status).toBe('in_review');
  });

  it('enforces non-empty rejection reason and updates loan status to rejected on confirmation', async () => {
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

    const rejectBtn = screen.getByTestId('btn-reject-loan');
    fireEvent.click(rejectBtn);

    expect(screen.getByTestId('rejection-modal')).toBeInTheDocument();

    // 1. Try to confirm with empty reason -> validation error
    const confirmRejectBtn = screen.getByTestId('btn-confirm-reject');
    fireEvent.click(confirmRejectBtn);

    expect(screen.getByTestId('rejection-error-alert')).toHaveTextContent(
      'Debes ingresar un motivo de rechazo no vacío.'
    );

    // 2. Try to cancel rejection modal
    const cancelRejectBtn = screen.getByTestId('btn-cancel-reject');
    fireEvent.click(cancelRejectBtn);
    expect(screen.queryByTestId('rejection-modal')).not.toBeInTheDocument();

    // 3. Open again, provide reason and confirm
    fireEvent.click(rejectBtn);
    const reasonInput = screen.getByTestId('input-rejection-reason');
    fireEvent.change(reasonInput, {
      target: { value: 'Capacidad de repago insuficiente según balances contables.' },
    });

    fireEvent.click(screen.getByTestId('btn-confirm-reject'));

    await waitFor(() => {
      expect(screen.getByTestId('success-alert')).toBeInTheDocument();
    });

    expect(screen.getByTestId('success-alert')).toHaveTextContent('rechazada correctamente');

    const rejectedLoan = await services.loans.getLoanById('loan-review-01');
    expect(rejectedLoan?.status).toBe('rejected');
    expect(rejectedLoan?.rejection_reason).toBe(
      'Capacidad de repago insuficiente según balances contables.'
    );
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

  describe('Real-Time Application Queue (Issue #35)', () => {
    it('renders empty state with "No hay solicitudes pendientes de revisión" when queue has no pending loans', () => {
      render(
        <AdminConsole
          initialLoans={[]}
          initialProfiles={{}}
          initialCreditProfiles={{}}
        />
      );

      const emptyNotice = screen.getByTestId('no-pending-loans');
      expect(emptyNotice).toBeInTheDocument();
      expect(emptyNotice).toHaveTextContent('No hay solicitudes pendientes de revisión');
      expect(screen.getByTestId('pending-count-badge')).toHaveTextContent('0 pendientes');
    });

    it('orders applications list chronologically by submission date (newest first)', () => {
      const chronLoans: Loan[] = [
        {
          id: 'loan-oldest',
          borrower_id: 'sme-test-1',
          amount_requested: 5_000_000,
          amount_funded: 0,
          term_months: 3,
          rate_type: 'TNA_FIXED',
          investor_rate: 0,
          platform_spread: 0,
          borrower_rate: 0,
          base_uva_value: null,
          category: 'working_capital',
          status: 'in_review',
          funding_deadline: '2026-11-01T23:59:59.000Z',
          created_at: '2026-09-01T10:00:00.000Z',
        },
        {
          id: 'loan-newest',
          borrower_id: 'sme-test-2',
          amount_requested: 12_000_000,
          amount_funded: 0,
          term_months: 12,
          rate_type: 'CER_VARIABLE',
          investor_rate: 0,
          platform_spread: 0,
          borrower_rate: 0,
          base_uva_value: null,
          category: 'expansion',
          status: 'in_review',
          funding_deadline: '2026-11-20T23:59:59.000Z',
          created_at: '2026-09-27T15:30:00.000Z',
        },
        {
          id: 'loan-middle',
          borrower_id: 'sme-test-1',
          amount_requested: 7_500_000,
          amount_funded: 0,
          term_months: 6,
          rate_type: 'TNA_FIXED',
          investor_rate: 0,
          platform_spread: 0,
          borrower_rate: 0,
          base_uva_value: null,
          category: 'machinery',
          status: 'in_review',
          funding_deadline: '2026-11-10T23:59:59.000Z',
          created_at: '2026-09-15T12:00:00.000Z',
        },
      ];

      render(
        <AdminConsole
          initialLoans={chronLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
        />
      );

      const items = screen.getAllByTestId(/^loan-item-/);
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveAttribute('data-testid', 'loan-item-loan-newest');
      expect(items[1]).toHaveAttribute('data-testid', 'loan-item-loan-middle');
      expect(items[2]).toHaveAttribute('data-testid', 'loan-item-loan-oldest');
    });

    it('renders company legal name, CUIT, requested amount, term, rate preference, and submission timestamp in table/list items', () => {
      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
        />
      );

      const item1 = screen.getByTestId('loan-item-loan-review-01');
      expect(item1).toHaveTextContent('Metalúrgica Quilmes S.R.L.');
      expect(item1).toHaveTextContent('30712345679');
      expect(item1).toHaveTextContent('$ 8.000.000');
      expect(screen.getByTestId('loan-term-loan-review-01')).toHaveTextContent('Plazo: 6 meses');
      expect(screen.getByTestId('loan-rate-loan-review-01')).toHaveTextContent('TNA Fija');
      expect(screen.getByTestId('loan-timestamp-loan-review-01')).toBeInTheDocument();

      const item2 = screen.getByTestId('loan-item-loan-review-02');
      expect(item2).toHaveTextContent('Alimentos del Valle SAS');
      expect(item2).toHaveTextContent('30718901234');
      expect(item2).toHaveTextContent('$ 15.000.000');
      expect(screen.getByTestId('loan-term-loan-review-02')).toHaveTextContent('Plazo: 12 meses');
      expect(screen.getByTestId('loan-rate-loan-review-02')).toHaveTextContent('CER + Spread');
      expect(screen.getByTestId('loan-timestamp-loan-review-02')).toBeInTheDocument();
    });

    it('reflects newly submitted applications without manual page reload via polling updates', async () => {
      const store = new MockStateStore();
      store.loans = [];
      store.profiles = Object.values(mockProfiles);
      store.creditProfiles = Object.values(mockCreditProfiles);
      const services = createServices({ store, useMocks: true });

      render(
        <ServiceProvider services={services}>
          <AdminConsole initialProfiles={mockProfiles} pollIntervalMs={50} />
        </ServiceProvider>
      );

      // Initially empty
      await waitFor(() => {
        expect(screen.getByTestId('no-pending-loans')).toBeInTheDocument();
      });

      // Submit new loan into the service layer in the background
      await services.loans.submitLoanApplication({
        borrower_id: 'sme-test-1',
        amount_requested: 4_500_000,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        category: 'working_capital',
      });

      // Wait for real-time polling to pick up the newly submitted loan
      await waitFor(() => {
        expect(screen.queryByTestId('no-pending-loans')).not.toBeInTheDocument();
        expect(screen.getByTestId('pending-loans-list')).toBeInTheDocument();
      });

      const list = screen.getByTestId('pending-loans-list');
      expect(within(list).getByText('Metalúrgica Quilmes S.R.L.')).toBeInTheDocument();
      expect(within(list).getByText('$ 4.500.000')).toBeInTheDocument();
    });
  });

  describe('Admin Console Document Viewer with Signed URLs (Issue #36)', () => {
    it('generates short-lived signed URLs with 15-minute expiration (900 seconds) via Supabase Storage client', async () => {
      const mockCreateSignedDocumentUrl = vi.fn().mockImplementation((path: string, expiresIn: number) => {
        return Promise.resolve({
          signedUrl: `https://storage.supabase.co/signed/${path}?token=token_15m_${expiresIn}`,
          error: null,
        });
      });

      const mockStorageService = {
        createSignedDocumentUrl: mockCreateSignedDocumentUrl,
        uploadLoanDocument: vi.fn(),
        downloadLoanDocument: vi.fn(),
      } as any;

      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
          storageService={mockStorageService}
        />
      );

      // Verify createSignedDocumentUrl was called with 900 seconds (15-minute expiration)
      await waitFor(() => {
        expect(mockCreateSignedDocumentUrl).toHaveBeenCalledWith(
          expect.stringContaining('balance.pdf'),
          900
        );
      });

      const balanceLink = screen.getByTestId('link-doc-balance');
      expect(balanceLink).toHaveAttribute(
        'href',
        expect.stringContaining('token_15m_900')
      );

      const f931Link = screen.getByTestId('link-doc-f931');
      expect(f931Link).toHaveAttribute(
        'href',
        expect.stringContaining('token_15m_900')
      );
    });

    it('distinguishes provided vs omitted documents with visual badges and explicit "Documento no presentado" notice', () => {
      const profilesWithoutBalance: Record<string, SmeCreditProfile> = {
        'sme-test-1': {
          id: 'cp-no-balance',
          profile_id: 'sme-test-1',
          bcra_situation: 1,
          risk_tier: 'Tier B',
          balance_sheet_url: null, // Omitted
          f931_url: '/documents/f931.pdf',
          afip_url: '/documents/constancia-afip.pdf',
          bank_statements_url: null, // Omitted
          scoring_notes: null,
          updated_at: '2026-09-01T10:00:00.000Z',
        },
      };

      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={profilesWithoutBalance}
        />
      );

      // Omitted balance sheet verification (badge neutral No presentado, disabled, no interactive links)
      const missingBadge = screen.getByTestId('badge-balance-omitted');
      expect(missingBadge).toHaveTextContent('No presentado');

      const missingNotice = screen.getByTestId('doc-balance-missing');
      expect(missingNotice).toHaveAttribute('aria-disabled', 'true');
      expect(screen.queryByTestId('link-doc-balance')).not.toBeInTheDocument();

      // Omitted bank statements verification (badge neutral No presentado, disabled)
      const missingBankBadge = screen.getByTestId('badge-bank-omitted');
      expect(missingBankBadge).toHaveTextContent('No presentado');
      const missingBankNotice = screen.getByTestId('doc-bank-missing');
      expect(missingBankNotice).toHaveAttribute('aria-disabled', 'true');
      expect(screen.queryByTestId('link-doc-bank')).not.toBeInTheDocument();

      // Provided F931 and AFIP verification
      expect(screen.getByTestId('badge-f931-provided')).toHaveTextContent('Presentado');
      expect(screen.getByTestId('link-doc-f931')).toBeInTheDocument();
      expect(screen.getByTestId('badge-afip-provided')).toHaveTextContent('Presentado');
      expect(screen.getByTestId('link-doc-afip')).toBeInTheDocument();
    });

    it('renders Preview and Download buttons with secure sandboxed tab and download attributes', () => {
      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
        />
      );

      // Preview buttons open in a new tab with rel="noopener noreferrer" for security
      const previewBtnBalance = screen.getByTestId('btn-preview-balance');
      expect(previewBtnBalance).toHaveAttribute('target', '_blank');
      expect(previewBtnBalance).toHaveAttribute('rel', 'noopener noreferrer');
      expect(previewBtnBalance).toHaveAttribute('href', '/documents/balance.pdf');

      // Download button has download attribute and points to file
      const downloadBtnBalance = screen.getByTestId('btn-download-balance');
      expect(downloadBtnBalance).toHaveAttribute('download');
      expect(downloadBtnBalance).toHaveAttribute('href', '/documents/balance.pdf');
    });

    it('fails gracefully with informative error messages when signed URL token request is expired or unauthorized', async () => {
      const mockStorageService = {
        createSignedDocumentUrl: vi.fn().mockResolvedValue({
          signedUrl: null,
          error: new Error('Token expirado o acceso no autorizado'),
        }),
        uploadLoanDocument: vi.fn(),
        downloadLoanDocument: vi.fn(),
      } as any;

      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
          storageService={mockStorageService}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('doc-error-balance')).toBeInTheDocument();
      });

      expect(screen.getByTestId('doc-error-balance')).toHaveTextContent(
        'Token expirado o acceso no autorizado'
      );
      expect(screen.getByTestId('doc-error-f931')).toHaveTextContent(
        'Token expirado o acceso no autorizado'
      );
    });
  });

  describe('Live BCRA Central de Deudores Credit Risk Scoring Integration (Issue #37)', () => {
    it('displays borrower credit history with debt amounts, reporting banks/entities, and BCRA classification situation', async () => {
      const store = new MockStateStore();
      store.loans = JSON.parse(JSON.stringify(mockPendingLoans));
      store.profiles = Object.values(mockProfiles);
      store.creditProfiles = Object.values(mockCreditProfiles);

      const mockGetBcraReport = vi.fn().mockResolvedValue({
        cuit: '30712345679',
        worstSituation: 1,
        totalDebt: 3_000_000,
        entities: [
          {
            entityName: 'BANCO SANTANDER ARGENTINA S.A.',
            situation: 1,
            amount: 2_000_000,
            daysPastDue: 0,
          },
          {
            entityName: 'BANCO GALICIA',
            situation: 1,
            amount: 1_000_000,
            daysPastDue: 0,
          },
        ],
        isClean: true,
        statusDescription: 'Situación 1 - Normal / Sin atrasos',
      });

      const services = createServices({
        store,
        useMocks: true,
        overrides: {
          creditScoring: {
            getBcraReport: mockGetBcraReport,
            evaluateCreditRisk: vi.fn(),
            getCreditProfileByProfileId: vi.fn().mockResolvedValue(mockCreditProfiles['sme-test-1']),
          },
        },
      });

      render(
        <ServiceProvider services={services}>
          <AdminConsole
            initialLoans={mockPendingLoans}
            initialProfiles={mockProfiles}
            initialCreditProfiles={mockCreditProfiles}
          />
        </ServiceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('bcra-total-debt')).toBeInTheDocument();
      });

      expect(mockGetBcraReport).toHaveBeenCalledWith('30712345679');
      expect(screen.getByTestId('bcra-total-debt')).toHaveTextContent('$ 3.000.000');
      expect(screen.getByTestId('bcra-entity-name-0')).toHaveTextContent('BANCO SANTANDER ARGENTINA S.A.');
      expect(screen.getByTestId('bcra-entity-amount-0')).toHaveTextContent('$ 2.000.000');
      expect(screen.getByTestId('bcra-entity-situation-0')).toHaveTextContent('Situación 1');
      expect(screen.getByTestId('bcra-entity-name-1')).toHaveTextContent('BANCO GALICIA');
      expect(screen.getByTestId('bcra-entity-amount-1')).toHaveTextContent('$ 1.000.000');
    });

    it('prominently highlights worst-case classification situation when multiple entities report debts', async () => {
      const store = new MockStateStore();
      store.loans = JSON.parse(JSON.stringify(mockPendingLoans));
      store.profiles = Object.values(mockProfiles);
      store.creditProfiles = Object.values(mockCreditProfiles);

      const mockGetBcraReport = vi.fn().mockResolvedValue({
        cuit: '30712345679',
        worstSituation: 3,
        totalDebt: 4_500_000,
        entities: [
          {
            entityName: 'BANCO SANTANDER ARGENTINA S.A.',
            situation: 1,
            amount: 1_000_000,
            daysPastDue: 0,
          },
          {
            entityName: 'BANCO MACRO S.A.',
            situation: 3,
            amount: 3_500_000,
            daysPastDue: 95,
          },
        ],
        isClean: false,
        statusDescription: 'Situación 3 - Con problemas (atraso 91-180 días)',
      });

      const services = createServices({
        store,
        useMocks: true,
        overrides: {
          creditScoring: {
            getBcraReport: mockGetBcraReport,
            evaluateCreditRisk: vi.fn(),
            getCreditProfileByProfileId: vi.fn().mockResolvedValue(mockCreditProfiles['sme-test-1']),
          },
        },
      });

      render(
        <ServiceProvider services={services}>
          <AdminConsole
            initialLoans={mockPendingLoans}
            initialProfiles={mockProfiles}
            initialCreditProfiles={mockCreditProfiles}
          />
        </ServiceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('bcra-worst-situation')).toBeInTheDocument();
      });

      const worstAlert = screen.getByTestId('bcra-worst-situation');
      expect(worstAlert).toHaveTextContent('Máximo Riesgo Detectado: Situación 3');
      expect(worstAlert).toHaveTextContent('Situación 3 - Con problemas (atraso 91-180 días)');

      // Verify the approval form auto-selects situation 3
      const situationSelect = screen.getByTestId('select-bcra-situation') as HTMLSelectElement;
      expect(situationSelect.value).toBe('3');
    });

    it('parses HTTP 404 or empty responses gracefully as "Sin deuda bancaria registrada / Situación 1"', async () => {
      const store = new MockStateStore();
      store.loans = JSON.parse(JSON.stringify(mockPendingLoans));
      store.profiles = Object.values(mockProfiles);
      store.creditProfiles = Object.values(mockCreditProfiles);

      const mockGetBcraReport = vi.fn().mockResolvedValue({
        cuit: '30712345679',
        worstSituation: null,
        totalDebt: 0,
        entities: [],
        isClean: true,
        statusDescription: 'Sin deuda bancaria registrada / Sin calificación previa',
      });

      const services = createServices({
        store,
        useMocks: true,
        overrides: {
          creditScoring: {
            getBcraReport: mockGetBcraReport,
            evaluateCreditRisk: vi.fn(),
            getCreditProfileByProfileId: vi.fn().mockResolvedValue(mockCreditProfiles['sme-test-1']),
          },
        },
      });

      render(
        <ServiceProvider services={services}>
          <AdminConsole
            initialLoans={mockPendingLoans}
            initialProfiles={mockProfiles}
            initialCreditProfiles={mockCreditProfiles}
          />
        </ServiceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('bcra-clean-status')).toBeInTheDocument();
      });

      expect(screen.getByTestId('bcra-clean-status')).toHaveTextContent(
        'Sin deuda bancaria registrada / Situación 1'
      );
      expect(screen.queryByTestId('bcra-debts-table')).not.toBeInTheDocument();
    });

    it('shows informative fallback messages on network errors or timeouts without crashing the console', async () => {
      const store = new MockStateStore();
      store.loans = JSON.parse(JSON.stringify(mockPendingLoans));
      store.profiles = Object.values(mockProfiles);
      store.creditProfiles = Object.values(mockCreditProfiles);

      const mockGetBcraReport = vi.fn().mockRejectedValue(
        new Error('Tiempo de espera agotado con BCRA (timeout 5s)')
      );

      const services = createServices({
        store,
        useMocks: true,
        overrides: {
          creditScoring: {
            getBcraReport: mockGetBcraReport,
            evaluateCreditRisk: vi.fn(),
            getCreditProfileByProfileId: vi.fn().mockResolvedValue(mockCreditProfiles['sme-test-1']),
          },
        },
      });

      render(
        <ServiceProvider services={services}>
          <AdminConsole
            initialLoans={mockPendingLoans}
            initialProfiles={mockProfiles}
            initialCreditProfiles={mockCreditProfiles}
          />
        </ServiceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('bcra-fallback-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('bcra-fallback-message')).toHaveTextContent(
        'Tiempo de espera agotado con BCRA (timeout 5s)'
      );

      // Verify detail view and scoring form are still present and operable
      expect(screen.getByTestId('detail-cuit')).toHaveTextContent('30712345679');
      expect(screen.getByTestId('scoring-form')).toBeInTheDocument();
    });
  });

  describe('Issue #75: Mesa de Crédito Profile Mapping, Documents and Readonly Deadline', () => {
    it('displays "No registrado" fallback instead of "N/A" for missing phone and CBU/CVU', () => {
      const incompleteProfiles: Record<string, Profile> = {
        'sme-test-1': {
          id: 'sme-test-1',
          role: 'borrower',
          legal_name: 'PyME Sin Datos Bancarios S.A.',
          tax_id: '30712345679',
          email: 'contacto@sindatos.com',
          kyc_status: 'approved',
          phone: '' as unknown as string,
          bank_cbu_cvu: '' as unknown as string,
          created_at: '2026-02-01T14:30:00.000Z',
        },
      };

      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={incompleteProfiles}
          initialCreditProfiles={mockCreditProfiles}
        />
      );

      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
      expect(screen.getAllByText('No registrado').length).toBeGreaterThanOrEqual(2);
    });

    it('renders funding deadline input as readOnly reflecting borrower request', () => {
      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
        />
      );

      const deadlineInput = screen.getByTestId('input-funding-deadline');
      expect(deadlineInput).toHaveAttribute('readonly');
      expect(deadlineInput).toHaveValue('2026-11-01T23:59');
    });

    it('renders "Sin fecha límite (subasta abierta)" when borrower requested open auction without deadline', async () => {
      const openLoan: Loan = {
        id: 'loan-open-01',
        borrower_id: 'sme-test-1',
        amount_requested: 5_000_000,
        amount_funded: 0,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 0,
        platform_spread: 0,
        borrower_rate: 0,
        base_uva_value: null,
        category: 'working_capital',
        status: 'in_review',
        funding_deadline: null,
        created_at: '2026-09-24T18:00:00.000Z',
      };

      const customStore = new MockStateStore();
      customStore.loans = [openLoan];
      customStore.profiles = Object.values(mockProfiles);
      customStore.creditProfiles = Object.values(mockCreditProfiles);
      const services = createServices({ store: customStore, useMocks: true });

      render(
        <ServiceProvider services={services}>
          <AdminConsole
            initialLoans={[openLoan]}
            initialProfiles={mockProfiles}
            initialCreditProfiles={mockCreditProfiles}
          />
        </ServiceProvider>
      );

      const deadlineInput = screen.getByTestId('input-funding-deadline');
      expect(deadlineInput).toHaveAttribute('readonly');
      expect(deadlineInput).toHaveValue('Sin fecha límite (subasta abierta)');
      expect(screen.getByTestId('detail-funding-deadline')).toHaveTextContent('Sin fecha límite (abierta)');

      // Admin can approve the open loan without validation error
      const submitBtn = screen.getByTestId('btn-approve-publish');
      fireEvent.click(submitBtn);

      expect(screen.getByTestId('approval-confirmation-modal')).toBeInTheDocument();
      expect(screen.getByText('Sin fecha límite (subasta abierta)')).toBeInTheDocument();

      const confirmBtn = screen.getByTestId('btn-confirm-approve');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByTestId('success-alert')).toBeInTheDocument();
      });
    });

    it('renders standardized secure PDF links for AFIP and Bank statements', () => {
      render(
        <AdminConsole
          initialLoans={mockPendingLoans}
          initialProfiles={mockProfiles}
          initialCreditProfiles={mockCreditProfiles}
        />
      );

      const afipLink = screen.getByTestId('link-doc-afip');
      expect(afipLink).toHaveAttribute('target', '_blank');
      expect(afipLink).toHaveAttribute('rel', 'noopener noreferrer');

      const bankLink = screen.getByTestId('link-doc-bank');
      expect(bankLink).toHaveAttribute('target', '_blank');
      expect(bankLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    describe('Issue #79: Subsanación de URLs de Documentación y Estado de Archivos en Admin', () => {
      it('renders individual cards for all 4 documents with explicit Presentado or No presentado badges', () => {
        const testCreditProfiles: Record<string, SmeCreditProfile> = {
          'sme-test-1': {
            id: 'cp-79',
            profile_id: 'sme-test-1',
            bcra_situation: 1,
            risk_tier: 'Tier A',
            afip_url: '/documents/sme-001/constancia-afip.pdf',
            bank_statements_url: null, // PyME chose not to attach bank statements
            balance_sheet_url: '/documents/sme-001/balance-2025.pdf',
            f931_url: null, // PyME has no payroll
            scoring_notes: null,
            updated_at: '2026-09-01T10:00:00.000Z',
          },
        };

        render(
          <AdminConsole
            initialLoans={mockPendingLoans}
            initialProfiles={mockProfiles}
            initialCreditProfiles={testCreditProfiles}
          />
        );

        // 1. Constancia AFIP: Presentado
        expect(screen.getByTestId('doc-card-afip')).toBeInTheDocument();
        expect(screen.getByTestId('badge-afip-provided')).toHaveTextContent('Presentado');
        const afipLink = screen.getByTestId('link-doc-afip');
        expect(afipLink).toHaveAttribute('target', '_blank');
        expect(afipLink).toHaveAttribute('rel', 'noopener noreferrer');
        expect(afipLink.getAttribute('href')).not.toContain('storage.lencord.ar');

        // 2. Extractos bancarios: No presentado (disabled)
        expect(screen.getByTestId('doc-bank-missing')).toBeInTheDocument();
        expect(screen.getByTestId('doc-bank-missing')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByTestId('badge-bank-omitted')).toHaveTextContent('No presentado');
        expect(screen.queryByTestId('link-doc-bank')).not.toBeInTheDocument();

        // 3. Balance contable: Presentado
        expect(screen.getByTestId('doc-card-balance')).toBeInTheDocument();
        expect(screen.getByTestId('badge-balance-provided')).toHaveTextContent('Presentado');
        const balanceLink = screen.getByTestId('link-doc-balance');
        expect(balanceLink).toHaveAttribute('target', '_blank');
        expect(balanceLink).toHaveAttribute('rel', 'noopener noreferrer');
        expect(balanceLink.getAttribute('href')).not.toContain('storage.lencord.ar');

        // 4. Formulario 931: No presentado (disabled)
        expect(screen.getByTestId('doc-f931-missing')).toBeInTheDocument();
        expect(screen.getByTestId('doc-f931-missing')).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByTestId('badge-f931-omitted')).toHaveTextContent('No presentado');
        expect(screen.queryByTestId('link-doc-f931')).not.toBeInTheDocument();
      });

      it('resolves signed URLs via storageService without any storage.lencord.ar domain', async () => {
        const mockStorage = {
          createSignedDocumentUrl: vi.fn().mockImplementation(async (path: string) => ({
            signedUrl: `https://valid-supabase.co/storage/v1/object/sign/loan-documents/${path}?token=valid_token`,
            error: null,
          })),
        } as any;

        const testCreditProfiles: Record<string, SmeCreditProfile> = {
          'sme-test-1': {
            id: 'cp-79-signed',
            profile_id: 'sme-test-1',
            bcra_situation: 1,
            risk_tier: 'Tier A',
            afip_url: 'sme-test-1/afip.pdf',
            bank_statements_url: 'sme-test-1/bank.pdf',
            balance_sheet_url: 'sme-test-1/balance.pdf',
            f931_url: 'sme-test-1/f931.pdf',
            scoring_notes: null,
            updated_at: '2026-09-01T10:00:00.000Z',
          },
        };

        render(
          <AdminConsole
            initialLoans={mockPendingLoans}
            initialProfiles={mockProfiles}
            initialCreditProfiles={testCreditProfiles}
            storageService={mockStorage}
          />
        );

        await waitFor(() => {
          expect(mockStorage.createSignedDocumentUrl).toHaveBeenCalled();
        });

        const afipLink = screen.getByTestId('link-doc-afip');
        expect(afipLink.getAttribute('href')).toContain('valid_token');
        expect(afipLink.getAttribute('href')).not.toContain('storage.lencord.ar');
      });
    });
  });
});



