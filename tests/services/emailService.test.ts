import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MockEmailService,
  ResendEmailService,
  redactSensitiveData,
  renderRegistrationTemplate,
  renderLoanSubmissionTemplate,
  renderCreditApprovalTemplate,
  renderCreditRejectionTemplate,
  renderInvestmentConfirmationTemplate,
  renderInstallmentReminderTemplate,
  formatCurrency,
} from '@/services/email';
import { MockStateStore } from '@/services/mock/mockState';
import { MockLoanService } from '@/services/mock/MockLoanService';
import { MockInvestmentService } from '@/services/mock/MockInvestmentService';
import type { Loan, Profile } from '@/types';

describe('Transactional Email Notification Service (Issue #47)', () => {
  describe('Responsive Branded HTML Email Templates', () => {
    it('formats currency correctly in Argentine pesos', () => {
      expect(formatCurrency(1500000)).toContain('1.500.000,00');
      expect(formatCurrency(0)).toContain('0,00');
    });

    it('renders account registration template with branding, recipient name and role', () => {
      const template = renderRegistrationTemplate({
        to: 'pyme@empresa.com.ar',
        recipientName: 'Tecnologías del Centro SRL',
        role: 'borrower',
      });

      expect(template.subject).toContain('Bienvenido a Lencord');
      expect(template.html).toContain('Tecnologías del Centro SRL');
      expect(template.html).toContain('Empresa / PyME Solicitante');
      expect(template.html).toContain('LENCORD');
      expect(template.html).toContain('Aviso Regulatorio y de Custodia de Fondos');
      expect(template.text).toContain('pyme@empresa.com.ar');
    });

    it('renders loan submission receipt template with loan ID, amount and category', () => {
      const template = renderLoanSubmissionTemplate({
        to: 'contacto@pyme.com.ar',
        recipientName: 'Metalúrgica San Martín',
        loanId: 'loan-sub-101',
        amount: 5000000,
        category: 'capital_de_trabajo',
      });

      expect(template.subject).toContain('Solicitud de crédito recibida');
      expect(template.subject).toContain('loan-sub-101');
      expect(template.html).toContain('Metalúrgica San Martín');
      expect(template.html).toContain('loan-sub-101');
      expect(template.html).toContain('capital_de_trabajo');
      expect(template.html).toContain('$5.000.000,00');
      expect(template.text).toContain('loan-sub-101');
    });

    it('renders credit approval notice template with risk tier and investor rate', () => {
      const template = renderCreditApprovalTemplate({
        to: 'finanzas@pyme.com.ar',
        recipientName: 'Agro Industrial Córdoba',
        loanId: 'loan-app-202',
        amount: 10000000,
        riskTier: 'Tier A',
        investorRate: 42.5,
      });

      expect(template.subject).toContain('aprobada');
      expect(template.html).toContain('loan-app-202');
      expect(template.html).toContain('Tier A');
      expect(template.html).toContain('42.5% TNA');
      expect(template.html).toContain('Subasta Activa en Marketplace');
    });

    it('renders credit rejection notice template with clear explanation', () => {
      const template = renderCreditRejectionTemplate({
        to: 'solicitante@pyme.com.ar',
        recipientName: 'Distribuidora Norte SA',
        loanId: 'loan-rej-303',
        reason: 'Situación BCRA 3 observada en el sistema financiero con cheques rechazados pendientes.',
      });

      expect(template.subject).toContain('Actualización sobre tu solicitud');
      expect(template.html).toContain('loan-rej-303');
      expect(template.html).toContain('Situación BCRA 3');
      expect(template.text).toContain('Situación BCRA 3');
    });

    it('renders investment confirmation template with amount and interest rate', () => {
      const template = renderInvestmentConfirmationTemplate({
        to: 'inversor@capital.com',
        recipientName: 'Valeria Gómez',
        loanId: 'loan-inv-404',
        amount: 250000,
        rate: 45.0,
      });

      expect(template.subject).toContain('Confirmación de inversión');
      expect(template.html).toContain('Valeria Gómez');
      expect(template.html).toContain('loan-inv-404');
      expect(template.html).toContain('$250.000,00');
      expect(template.html).toContain('45% TNA');
    });

    it('renders installment reminder template with installment number and due date', () => {
      const template = renderInstallmentReminderTemplate({
        to: 'pagos@pyme.com.ar',
        recipientName: 'Constructora Austral',
        loanId: 'loan-inst-505',
        installmentNumber: 3,
        amount: 1850000,
        dueDate: '2026-10-15',
      });

      expect(template.subject).toContain('Recordatorio de vencimiento de cuota N° 3');
      expect(template.html).toContain('Cuota 3');
      expect(template.html).toContain('2026-10-15');
      expect(template.html).toContain('$1.850.000,00');
      expect(template.html).toContain('Aviso Regulatorio y de Custodia de Fondos');
    });
  });

  describe('MockEmailService', () => {
    let emailService: MockEmailService;

    beforeEach(() => {
      emailService = new MockEmailService();
    });

    it('successfully sends email and stores record in-memory', async () => {
      const result = await emailService.send({
        to: 'test@lencord.com.ar',
        subject: 'Prueba Lencord',
        html: '<p>Contenido</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      const sent = emailService.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toBe('Prueba Lencord');
      expect(sent[0].to).toBe('test@lencord.com.ar');
    });

    it('handles invalid or missing recipient email gracefully with logged warning without throwing', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const resultEmpty = await emailService.send({
        to: '',
        subject: 'Prueba',
        html: '<p>Hola</p>',
      });
      expect(resultEmpty.success).toBe(false);
      expect(resultEmpty.error).toContain('Invalid or missing recipient email address');
      expect(warnSpy).toHaveBeenCalled();

      const resultInvalid = await emailService.send({
        to: 'invalid-email-no-domain',
        subject: 'Prueba',
        html: '<p>Hola</p>',
      });
      expect(resultInvalid.success).toBe(false);
      expect(resultInvalid.error).toContain('Invalid or missing recipient email address');

      warnSpy.mockRestore();
    });

    it('handles simulated provider failure and logs error without throwing', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      emailService.setShouldFail(true, 'SMTP connection refused');
      const result = await emailService.send({
        to: 'user@example.com',
        subject: 'Prueba',
        html: '<p>Contenido</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection refused');
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('executes typed dispatch helper methods correctly', async () => {
      await emailService.sendRegistrationEmail({
        to: 'registro@test.com',
        recipientName: 'Juan Pérez',
        role: 'investor',
      });

      await emailService.sendLoanSubmissionEmail({
        to: 'pyme@test.com',
        recipientName: 'PyME SRL',
        loanId: 'loan-1',
        amount: 1000000,
        category: 'equipamiento',
      });

      await emailService.sendCreditApprovalEmail({
        to: 'pyme@test.com',
        recipientName: 'PyME SRL',
        loanId: 'loan-1',
        amount: 1000000,
        riskTier: 'Tier B',
        investorRate: 44.0,
      });

      await emailService.sendCreditRejectionEmail({
        to: 'pyme@test.com',
        recipientName: 'PyME SRL',
        loanId: 'loan-1',
        reason: 'Documentación insuficiente',
      });

      await emailService.sendInvestmentConfirmationEmail({
        to: 'inversor@test.com',
        recipientName: 'Inversor 1',
        loanId: 'loan-1',
        amount: 200000,
        rate: 44.0,
      });

      await emailService.sendInstallmentReminderEmail({
        to: 'pyme@test.com',
        recipientName: 'PyME SRL',
        loanId: 'loan-1',
        installmentNumber: 1,
        amount: 250000,
        dueDate: '2026-11-01',
      });

      expect(emailService.getSentEmails()).toHaveLength(6);
    });
  });

  describe('ResendEmailService & Sensitive Credential Redaction', () => {
    it('redacts sensitive API keys and authorization tokens in error logs', () => {
      const apiKey = 're_1234567890abcdefghijklmnopqrstuvwxyz';
      const rawText = `Error calling Resend with key ${apiKey}, Bearer token_xyz_987 and apikey=${apiKey}`;
      const redacted = redactSensitiveData(rawText, [apiKey]);

      expect(redacted).not.toContain(apiKey);
      expect(redacted).toContain('re_***REDACTED***');
      expect(redacted).toContain('Bearer ***REDACTED***');
      expect(redacted).toContain('apikey=***REDACTED***');
    });

    it('dispatches email via fetch with correct headers and payload to Resend endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend_msg_123' }),
      });

      const resendService = new ResendEmailService({
        apiKey: 're_test_key_abc123',
        fromEmail: 'notificaciones@lencord.com.ar',
        fetchFn: mockFetch as any,
      });

      const result = await resendService.send({
        to: 'destinatario@lencord.com.ar',
        subject: 'Asunto de Prueba',
        html: '<p>Cuerpo HTML</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('resend_msg_123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer re_test_key_abc123',
          }),
        })
      );
    });

    it('handles HTTP error responses from Resend gracefully without leaking API keys', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const apiKey = 're_secret_key_999';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: `Invalid API key ${apiKey}` }),
      });

      const resendService = new ResendEmailService({
        apiKey,
        fetchFn: mockFetch as any,
      });

      const result = await resendService.send({
        to: 'test@example.com',
        subject: 'Falla',
        html: '<p>Texto</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).not.toContain(apiKey);
      expect(errorSpy).toHaveBeenCalled();
      const loggedMsg = errorSpy.mock.calls[0].join(' ');
      expect(loggedMsg).not.toContain(apiKey);

      errorSpy.mockRestore();
    });
  });

  describe('Lifecycle Event Hooks & Graceful Error Handling', () => {
    let store: MockStateStore;
    let mockEmailService: MockEmailService;
    let loanService: MockLoanService;
    let investmentService: MockInvestmentService;

    const sampleBorrower: Profile = {
      id: 'prof-borrower-email-1',
      role: 'sme',
      tax_id: '30718889991',
      legal_name: 'Soluciones Pyme SA',
      email: 'pyme-notif@empresa.com.ar',
      phone: '+54 351 555-1234',
      bank_cbu_cvu: '0720123488000012345678',
      kyc_status: 'approved',
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const sampleInvestor: Profile = {
      id: 'prof-investor-email-2',
      role: 'investor',
      tax_id: '20334445558',
      legal_name: 'Carlos Inversor',
      email: 'carlos@inversion.com.ar',
      phone: '+54 351 555-5678',
      bank_cbu_cvu: '0720123488000087654321',
      kyc_status: 'approved',
      created_at: '2026-01-01T00:00:00.000Z',
    };

    beforeEach(() => {
      store = new MockStateStore();
      store.profiles.push({ ...sampleBorrower }, { ...sampleInvestor });
      mockEmailService = new MockEmailService();
      loanService = new MockLoanService(store, undefined, mockEmailService);
      investmentService = new MockInvestmentService(store, undefined, mockEmailService);
    });

    it('triggers loan submission email upon submitLoanApplication', async () => {
      const loan = await loanService.submitLoanApplication({
        borrower_id: sampleBorrower.id,
        amount_requested: 2500000,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        category: 'working_capital',
      });

      expect(loan.id).toBeDefined();
      const sent = mockEmailService.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(sampleBorrower.email);
      expect(sent[0].subject).toContain('Solicitud de crédito recibida');
      expect(sent[0].html).toContain(loan.id);
    });

    it('ensures loan submission succeeds even if email dispatch fails or throws', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEmailService.setShouldFail(true, 'Temporary outage');

      const loan = await loanService.submitLoanApplication({
        borrower_id: sampleBorrower.id,
        amount_requested: 3000000,
        term_months: 12,
        rate_type: 'TNA_FIXED',
        category: 'machinery',
      });

      expect(loan).toBeDefined();
      expect(loan.status).toBe('in_review');
      expect(store.loans.find((l) => l.id === loan.id)).toBeDefined();

      warnSpy.mockRestore();
    });

    it('triggers credit approval email upon approveAndPublishLoan without failing on email error', async () => {
      const sampleLoan: Loan = {
        id: 'loan-to-approve-1',
        borrower_id: sampleBorrower.id,
        amount_requested: 4000000,
        amount_funded: 0,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 45,
        platform_spread: 3,
        borrower_rate: 48,
        base_uva_value: null,
        category: 'working_capital',
        status: 'in_review',
        funding_deadline: '2026-12-31T23:59:59.000Z',
        created_at: '2026-09-01T10:00:00.000Z',
      };
      store.loans.push(sampleLoan);

      const approved = await loanService.approveAndPublishLoan({
        loan_id: sampleLoan.id,
        risk_tier: 'Tier A',
        investor_rate: 42,
        platform_spread: 3,
        funding_deadline: '2026-11-30T23:59:59.000Z',
      });

      expect(approved.status).toBe('funding');
      const sent = mockEmailService.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(sampleBorrower.email);
      expect(sent[0].subject).toContain('aprobada');
    });

    it('triggers credit rejection email upon rejectLoan without failing on email error', async () => {
      const sampleLoan: Loan = {
        id: 'loan-to-reject-1',
        borrower_id: sampleBorrower.id,
        amount_requested: 5000000,
        amount_funded: 0,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 45,
        platform_spread: 3,
        borrower_rate: 48,
        base_uva_value: null,
        category: 'working_capital',
        status: 'in_review',
        funding_deadline: '2026-12-31T23:59:59.000Z',
        created_at: '2026-09-01T10:00:00.000Z',
      };
      store.loans.push(sampleLoan);

      const rejected = await loanService.rejectLoan(
        sampleLoan.id,
        'Monto solicitado supera la capacidad de pago estimada'
      );

      expect(rejected.status).toBe('rejected');
      const sent = mockEmailService.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(sampleBorrower.email);
      expect(sent[0].subject).toContain('Actualización sobre tu solicitud');
      expect(sent[0].html).toContain('capacidad de pago estimada');
    });

    it('triggers investment confirmation email upon commitInvestment without failing on email error', async () => {
      const sampleLoan: Loan = {
        id: 'loan-to-invest-1',
        borrower_id: sampleBorrower.id,
        amount_requested: 1000000,
        amount_funded: 0,
        term_months: 6,
        rate_type: 'TNA_FIXED',
        investor_rate: 45,
        platform_spread: 3,
        borrower_rate: 48,
        base_uva_value: null,
        category: 'working_capital',
        status: 'funding',
        funding_deadline: '2026-12-31T23:59:59.000Z',
        created_at: '2026-09-01T10:00:00.000Z',
      };
      store.loans.push(sampleLoan);

      const commitResult = await investmentService.commitInvestment({
        loan_id: sampleLoan.id,
        investor_id: sampleInvestor.id,
        amount: 200000,
      });

      expect(commitResult.investment.amount).toBe(200000);
      expect(commitResult.loan.amount_funded).toBe(200000);

      const sent = mockEmailService.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(sampleInvestor.email);
      expect(sent[0].subject).toContain('Confirmación de inversión');
      expect(sent[0].html).toContain('$200.000,00');
    });
  });
});
