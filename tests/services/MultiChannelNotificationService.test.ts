import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultiChannelNotificationService,
} from '@/services/notifications/channels/MultiChannelNotificationService';
import { MockChannelAdapter } from '@/services/notifications/channels/MockChannelAdapter';
import { MockEmailService } from '@/services/email/MockEmailService';
import { MockNotificationService } from '@/services/mock/MockNotificationService';
import { MockStateStore } from '@/services/mock/mockState';
import { createMockServices } from '@/services/factory';
import type { Installment, Investment, Loan, Profile } from '@/types';

describe('MultiChannelNotificationService - Bidirectional Lifecycle Notifications (Issue #82)', () => {
  let store: MockStateStore;
  let adapter: MockChannelAdapter;
  let emailService: MockEmailService;
  let notificationService: MockNotificationService;
  let service: MultiChannelNotificationService;

  const mockBorrower: Profile = {
    id: 'sme-test-01',
    role: 'sme',
    tax_id: '30-71234567-8',
    legal_name: 'Metalúrgica Quilmes S.A.',
    phone: '+5491140001111',
    kyc_status: 'approved',
    bank_cbu_cvu: '0720123488000012345678',
    email: 'contacto@metalurgicaquilmes.com.ar',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  const mockInvestor1: Profile = {
    id: 'inv-test-01',
    role: 'investor',
    tax_id: '20-33444555-9',
    legal_name: 'Esteban Inversor',
    phone: '+5491140002222',
    kyc_status: 'approved',
    bank_cbu_cvu: '0070123488000012345678',
    email: 'esteban@inversor.com.ar',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  const mockInvestor2: Profile = {
    id: 'inv-test-02',
    role: 'investor',
    tax_id: '27-44555666-3',
    legal_name: 'Mariana Inversora',
    phone: '+5491140003333',
    kyc_status: 'approved',
    bank_cbu_cvu: '0140123488000012345678',
    email: 'mariana@inversora.com.ar',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  const mockLoan: Loan = {
    id: 'loan-test-82',
    borrower_id: mockBorrower.id,
    amount_requested: 10_000_000,
    amount_funded: 4_000_000,
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 45.0,
    platform_spread: 2.0,
    borrower_rate: 47.0,
    base_uva_value: null,
    category: 'working_capital',
    status: 'funding',
    funding_deadline: '2026-10-31T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  };

  beforeEach(() => {
    store = new MockStateStore();
    adapter = new MockChannelAdapter();
    emailService = new MockEmailService();
    notificationService = new MockNotificationService(store);
    service = new MultiChannelNotificationService(
      adapter,
      notificationService,
      emailService
    );
  });

  // -------------------------------------------------------------------------
  // Evento 1: Nueva Inversión en Subasta (PyME)
  // -------------------------------------------------------------------------
  it('Event 1: notifies borrower in-app and via email when new investment is received', async () => {
    const investment: Investment = {
      id: 'inv-82-01',
      loan_id: mockLoan.id,
      investor_id: mockInvestor1.id,
      amount: 4_000_000,
      status: 'committed',
      created_at: new Date().toISOString(),
      external_payment_id: null,
    };

    await service.notifyNewInvestmentReceived({
      loan: mockLoan,
      investment,
      borrower: mockBorrower,
      investor: mockInvestor1,
    });

    // 1. Verify In-App Notification
    const notifs = await notificationService.getNotifications(mockBorrower.id);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user_id).toBe(mockBorrower.id);
    expect(notifs[0].type).toBe('info');
    expect(notifs[0].title).toBe('Nuevo aporte de inversión recibido');
    expect(notifs[0].action_url).toBe('/dashboard/pyme');
    expect(notifs[0].message).toContain('4.000.000');
    expect(notifs[0].message).toContain('40.0%');

    // 2. Verify Transactional Email
    const emails = emailService.getSentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(mockBorrower.email);
    expect(emails[0].subject).toContain('Nuevo aporte de inversión recibido');
    expect(emails[0].html).toContain('Metalúrgica Quilmes S.A.');
    expect(emails[0].html).toContain('$4.000.000,00');
  });

  // -------------------------------------------------------------------------
  // Evento 2: Subasta 100% financiada (PyME e Inversores)
  // -------------------------------------------------------------------------
  it('Event 2: notifies borrower and deduplicated investors when loan reaches 100% funding', async () => {
    const fullyFundedLoan: Loan = {
      ...mockLoan,
      amount_funded: 10_000_000,
      status: 'funded',
    };

    // Including duplicate entry for investor 1 to test deduplication
    const investors = [
      { profile: mockInvestor1, amount: 6_000_000 },
      { profile: mockInvestor1, amount: 2_000_000 }, // duplicate
      { profile: mockInvestor2, amount: 2_000_000 },
    ];

    await service.notifyLoanFundingCompleted({
      loan: fullyFundedLoan,
      borrower: mockBorrower,
      investors,
    });

    // 1. Borrower In-App Notification
    const borrowerNotifs = await notificationService.getNotifications(mockBorrower.id);
    expect(borrowerNotifs).toHaveLength(1);
    expect(borrowerNotifs[0].type).toBe('success');
    expect(borrowerNotifs[0].title).toBe('¡Subasta 100% financiada! Pagaré listo para firma');
    expect(borrowerNotifs[0].action_url).toBe('/dashboard/pyme');

    // 2. Investor 1 In-App Notification (exactly 1 notification despite 2 contributions)
    const inv1Notifs = await notificationService.getNotifications(mockInvestor1.id);
    expect(inv1Notifs).toHaveLength(1);
    expect(inv1Notifs[0].type).toBe('success');
    expect(inv1Notifs[0].title).toBe('Subasta finalizada con éxito');
    expect(inv1Notifs[0].action_url).toBe('/dashboard/inversor');

    // 3. Investor 2 In-App Notification
    const inv2Notifs = await notificationService.getNotifications(mockInvestor2.id);
    expect(inv2Notifs).toHaveLength(1);
    expect(inv2Notifs[0].type).toBe('success');
    expect(inv2Notifs[0].title).toBe('Subasta finalizada con éxito');

    // 4. Emails: 1 to borrower + 2 to unique investors = 3 total
    const emails = emailService.getSentEmails();
    expect(emails).toHaveLength(3);

    const borrowerEmail = emails.find((e) => e.to === mockBorrower.email);
    expect(borrowerEmail).toBeDefined();
    expect(borrowerEmail?.subject).toContain('¡Subasta 100% financiada! Pagaré listo para tu firma digital');

    const inv1Email = emails.find((e) => e.to === mockInvestor1.email);
    expect(inv1Email).toBeDefined();
    expect(inv1Email?.subject).toContain('Subasta finalizada con éxito');

    const inv2Email = emails.find((e) => e.to === mockInvestor2.email);
    expect(inv2Email).toBeDefined();
    expect(inv2Email?.subject).toContain('Subasta finalizada con éxito');
  });

  // -------------------------------------------------------------------------
  // Evento 3: Pagaré firmado y crédito activado (Inversores)
  // -------------------------------------------------------------------------
  it('Event 3: notifies participating investors when promissory note is signed and loan is activated', async () => {
    const activeLoan: Loan = {
      ...mockLoan,
      amount_funded: 10_000_000,
      status: 'active',
    };

    const investors = [
      { profile: mockInvestor1, amount: 6_000_000 },
      { profile: mockInvestor2, amount: 4_000_000 },
    ];

    await service.notifyPromissoryNoteSignedAndActivated({
      loan: activeLoan,
      borrower: mockBorrower,
      investors,
    });

    // 1. In-App Notifications for borrower and investors
    const borrowerNotifs = await notificationService.getNotifications(mockBorrower.id);
    expect(borrowerNotifs).toHaveLength(1);
    expect(borrowerNotifs[0].type).toBe('success');
    expect(borrowerNotifs[0].title).toBe('Pagaré firmado: fondos desembolsados');
    expect(borrowerNotifs[0].action_url).toBe('/dashboard/pyme');

    const inv1Notifs = await notificationService.getNotifications(mockInvestor1.id);
    expect(inv1Notifs).toHaveLength(1);
    expect(inv1Notifs[0].type).toBe('success');
    expect(inv1Notifs[0].title).toBe('Pagaré firmado: fondos desembolsados');
    expect(inv1Notifs[0].action_url).toBe('/dashboard/inversor');
    expect(inv1Notifs[0].message).toContain('Metalúrgica Quilmes S.A.');

    const inv2Notifs = await notificationService.getNotifications(mockInvestor2.id);
    expect(inv2Notifs).toHaveLength(1);
    expect(inv2Notifs[0].type).toBe('success');
    expect(inv2Notifs[0].title).toBe('Pagaré firmado: fondos desembolsados');

    // 2. Emails to investors
    const emails = emailService.getSentEmails();
    expect(emails).toHaveLength(2);
    expect(emails[0].subject).toContain('Pagaré firmado y crédito activado');
    expect(emails[0].html).toContain('Consultar pagaré firmado');
  });

  // -------------------------------------------------------------------------
  // Evento 4: Cobro y acreditación de cuota mensual (Inversores)
  // -------------------------------------------------------------------------
  it('Event 4: notifies beneficiary investors when installment repayment is credited', async () => {
    const installment: Installment = {
      id: 'inst-test-01',
      loan_id: mockLoan.id,
      installment_number: 1,
      due_date: '2026-11-15',
      principal_amount: 1_666_666.67,
      interest_borrower: 391_666.67,
      interest_investors: 375_000.00,
      interest_lencord: 16_666.67,
      uva_value_applied: null,
      status: 'paid',
      paid_at: new Date().toISOString(),
    };

    const payouts = [
      {
        investor: mockInvestor1,
        principalShare: 1_000_000.00,
        interestShare: 225_000.00,
        totalShare: 1_225_000.00,
      },
      {
        investor: mockInvestor2,
        principalShare: 666_666.67,
        interestShare: 150_000.00,
        totalShare: 816_666.67,
      },
    ];

    await service.notifyInstallmentPayoutCredited({
      loan: mockLoan,
      installment,
      borrower: mockBorrower,
      payouts,
    });

    // 1. In-App Notifications
    const inv1Notifs = await notificationService.getNotifications(mockInvestor1.id);
    expect(inv1Notifs).toHaveLength(1);
    expect(inv1Notifs[0].type).toBe('success');
    expect(inv1Notifs[0].title).toBe('Acreditación de cuota recibida');
    expect(inv1Notifs[0].message).toContain('1.225.000');
    expect(inv1Notifs[0].action_url).toBe('/dashboard/inversor');

    const inv2Notifs = await notificationService.getNotifications(mockInvestor2.id);
    expect(inv2Notifs).toHaveLength(1);
    expect(inv2Notifs[0].message).toContain('816.666');

    // 2. Emails with financial breakdown
    const emails = emailService.getSentEmails();
    expect(emails).toHaveLength(2);
    expect(emails[0].to).toBe(mockInvestor1.email);
    expect(emails[0].subject).toContain('Acreditación de cuota #1 recibida');
    expect(emails[0].html).toContain('$1.000.000,00');
    expect(emails[0].html).toContain('$225.000,00');
    expect(emails[0].html).toContain('$1.225.000,00');
  });

  // -------------------------------------------------------------------------
  // Evento 5: Alerta de vencimiento próximo de cuota (PyME)
  // -------------------------------------------------------------------------
  it('Event 5: notifies borrower in-app and via email 3 days before installment due date', async () => {
    const installment: Installment = {
      id: 'inst-test-02',
      loan_id: mockLoan.id,
      installment_number: 2,
      due_date: '2026-12-15',
      principal_amount: 1_666_666.67,
      interest_borrower: 391_666.67,
      interest_investors: 375_000.00,
      interest_lencord: 16_666.67,
      uva_value_applied: null,
      status: 'pending',
      paid_at: null,
    };

    await service.notifyUpcomingInstallmentReminder({
      loan: mockLoan,
      installment,
      borrower: mockBorrower,
      daysRemaining: 3,
    });

    // 1. In-App Notification
    const borrowerNotifs = await notificationService.getNotifications(mockBorrower.id);
    expect(borrowerNotifs).toHaveLength(1);
    expect(borrowerNotifs[0].type).toBe('warning');
    expect(borrowerNotifs[0].title).toBe('Próximo vencimiento de cuota');
    expect(borrowerNotifs[0].action_url).toBe('/dashboard/pyme');
    expect(borrowerNotifs[0].message).toContain('cuota #2');
    expect(borrowerNotifs[0].message).toContain('2026-12-15');

    // 2. Email Reminder
    const emails = emailService.getSentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(mockBorrower.email);
    expect(emails[0].subject).toContain('Recordatorio de vencimiento de cuota N° 2');
    expect(emails[0].html).toContain('2026-12-15');
  });

  // -------------------------------------------------------------------------
  // Tolerancia a fallos: Error en email no interrumpe in-app ni arroja excepción
  // -------------------------------------------------------------------------
  it('gracefully handles email provider outage without throwing or interrupting in-app notifications', async () => {
    emailService.setShouldFail(true, 'Resend API network timeout');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const investment: Investment = {
      id: 'inv-fail-01',
      loan_id: mockLoan.id,
      investor_id: mockInvestor1.id,
      amount: 1_000_000,
      status: 'committed',
      created_at: new Date().toISOString(),
      external_payment_id: null,
    };

    // Should complete cleanly without throwing
    await expect(
      service.notifyNewInvestmentReceived({
        loan: mockLoan,
        investment,
        borrower: mockBorrower,
      })
    ).resolves.not.toThrow();

    // In-app notification was still successfully recorded
    const notifs = await notificationService.getNotifications(mockBorrower.id);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe('Nuevo aporte de inversión recibido');

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Integración completa en el flujo de préstamos e inversiones
  // -------------------------------------------------------------------------
  it('triggers end-to-end notifications across the lifecycle in mock services', async () => {
    const services = createMockServices({ store, email: emailService });

    // Seed profiles
    store.profiles.push(mockBorrower, mockInvestor1, mockInvestor2);

    // Seed loan
    const testLoan: Loan = {
      ...mockLoan,
      id: 'loan-flow-test',
      status: 'funding',
      amount_funded: 0,
    };
    store.loans.push(testLoan);

    // 1. Investor 1 commits $5,000,000 (50%) -> triggers Event 1
    await services.investments.commitInvestment({
      loan_id: testLoan.id,
      investor_id: mockInvestor1.id,
      amount: 5_000_000,
    });

    const pymeNotifs1 = await services.notifications!.getNotifications(mockBorrower.id);
    expect(pymeNotifs1.some((n) => n.title === 'Nuevo aporte de inversión recibido')).toBe(true);

    // 2. Investor 2 commits $5,000,000 (reaching 100%) -> triggers Event 2
    await services.investments.commitInvestment({
      loan_id: testLoan.id,
      investor_id: mockInvestor2.id,
      amount: 5_000_000,
    });

    const pymeNotifs2 = await services.notifications!.getNotifications(mockBorrower.id);
    expect(pymeNotifs2.some((n) => n.title === '¡Subasta 100% financiada! Pagaré listo para firma')).toBe(true);

    const inv1Notifs2 = await services.notifications!.getNotifications(mockInvestor1.id);
    expect(inv1Notifs2.some((n) => n.title === 'Subasta finalizada con éxito')).toBe(true);

    // 3. PyME signs note and activates loan -> triggers Event 3
    await services.loans.activateLoan!(testLoan.id);

    const inv1Notifs3 = await services.notifications!.getNotifications(mockInvestor1.id);
    expect(inv1Notifs3.some((n) => n.title === 'Pagaré firmado: fondos desembolsados')).toBe(true);

    // 4. PyME repays first installment -> triggers Event 4
    const firstInst = store.installments.find((i) => i.loan_id === testLoan.id);
    expect(firstInst).toBeDefined();

    await services.loans.repayInstallment!({
      installment_id: firstInst!.id,
      payer_id: mockBorrower.id,
    });

    const inv1Notifs4 = await services.notifications!.getNotifications(mockInvestor1.id);
    expect(inv1Notifs4.some((n) => n.title === 'Acreditación de cuota recibida')).toBe(true);
  });
});
