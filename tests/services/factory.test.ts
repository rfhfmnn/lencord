import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('next/font/google', () => ({
  Plus_Jakarta_Sans: () => ({ className: 'font-sans', variable: '--font-sans' }),
  JetBrains_Mono: () => ({ className: 'font-mono', variable: '--font-mono' }),
}));
import {
  createServices,
  createMockServices,
  createLiveServices,
  registerLiveServices,
  clearLiveServices,
  getLiveServices,
} from '@/services/factory';
import {
  MockLoanService,
  MockInvestmentService,
  MockLegalService,
  MockCreditScoringService,
  MockPaymentGateway,
} from '@/services/mock';
import {
  SupabaseLoanService,
  SupabaseInvestmentService,
  SupabaseLegalService,
} from '@/services/supabase';
import { BcraCreditScoringService } from '@/services/bcra';
import { BaaSPaymentGateway } from '@/services/payments';
import type {
  LoanServiceInterface,
  InvestmentServiceInterface,
  LegalServiceInterface,
  CreditScoringInterface,
  PaymentGatewayInterface,
} from '@/types';
import RootLayout from '@/app/layout';
import { useServices } from '@/context';

describe('Service Layer Factory and Supabase Activation (Issue #32)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
    clearLiveServices();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllEnvs();
    clearLiveServices();
  });

  describe('Live Supabase Service Instantiation', () => {
    it('instantiates and returns SupabaseLoanService, SupabaseInvestmentService, and SupabaseLegalService when live mode is active', () => {
      const services = createLiveServices();

      expect(services.loans).toBeInstanceOf(SupabaseLoanService);
      expect(services.investments).toBeInstanceOf(SupabaseInvestmentService);
      expect(services.legal).toBeInstanceOf(SupabaseLegalService);
      expect(services.creditScoring).toBeInstanceOf(BcraCreditScoringService);
      expect(services.payments).toBeInstanceOf(BaaSPaymentGateway);
    });

    it('createServices({ useMocks: false }) activates live Supabase implementations', () => {
      const services = createServices({ useMocks: false });

      expect(services.loans).toBeInstanceOf(SupabaseLoanService);
      expect(services.investments).toBeInstanceOf(SupabaseInvestmentService);
      expect(services.legal).toBeInstanceOf(SupabaseLegalService);
    });

    it('passes custom clientProvider and paymentGateway to live services', () => {
      const customClient = {} as any;
      const customGateway = new MockPaymentGateway();

      const services = createLiveServices({
        clientProvider: customClient,
        paymentGateway: customGateway,
      });

      expect(services.payments).toBe(customGateway);
      expect(services.loans).toBeInstanceOf(SupabaseLoanService);
      expect(services.investments).toBeInstanceOf(SupabaseInvestmentService);
      expect(services.legal).toBeInstanceOf(SupabaseLegalService);
    });
  });

  describe('Environment Variable Switching (NEXT_PUBLIC_USE_MOCKS)', () => {
    it('instantiates MockServices when NEXT_PUBLIC_USE_MOCKS is "true"', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');

      const services = createServices();
      expect(services.loans).toBeInstanceOf(MockLoanService);
      expect(services.investments).toBeInstanceOf(MockInvestmentService);
      expect(services.legal).toBeInstanceOf(MockLegalService);
      expect(services.creditScoring).toBeInstanceOf(MockCreditScoringService);
      expect(services.payments).toBeInstanceOf(MockPaymentGateway);
    });

    it('instantiates SupabaseServices when NEXT_PUBLIC_USE_MOCKS is "false"', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');

      const services = createServices();
      expect(services.loans).toBeInstanceOf(SupabaseLoanService);
      expect(services.investments).toBeInstanceOf(SupabaseInvestmentService);
      expect(services.legal).toBeInstanceOf(SupabaseLegalService);
      expect(services.creditScoring).toBeInstanceOf(BcraCreditScoringService);
      expect(services.payments).toBeInstanceOf(BaaSPaymentGateway);
    });
  });

  describe('Contract Layer Compatibility', () => {
    it('ensures live and mock services strictly conform to service interface signatures', () => {
      const live = createLiveServices();
      const mock = createMockServices();

      // LoanServiceInterface checks
      const verifyLoanService = (service: LoanServiceInterface) => {
        expect(typeof service.getLoanById).toBe('function');
        expect(typeof service.listLoans).toBe('function');
        expect(typeof service.submitLoanApplication).toBe('function');
        expect(typeof service.approveAndPublishLoan).toBe('function');
        expect(typeof service.finalizeLoanFunding).toBe('function');
        expect(typeof service.cancelLoan).toBe('function');
        expect(typeof service.getInstallmentsByLoan).toBe('function');
      };
      verifyLoanService(live.loans);
      verifyLoanService(mock.loans);

      // InvestmentServiceInterface checks
      const verifyInvestmentService = (service: InvestmentServiceInterface) => {
        expect(typeof service.commitInvestment).toBe('function');
        expect(typeof service.getInvestmentsByLoan).toBe('function');
        expect(typeof service.getInvestmentsByInvestor).toBe('function');
        expect(typeof service.getInvestmentById).toBe('function');
        expect(typeof service.refundInvestmentsByLoan).toBe('function');
      };
      verifyInvestmentService(live.investments);
      verifyInvestmentService(mock.investments);

      // LegalServiceInterface checks
      const verifyLegalService = (service: LegalServiceInterface) => {
        expect(typeof service.generatePromissoryNote).toBe('function');
        expect(typeof service.generateMutualAgreement).toBe('function');
        expect(typeof service.signContract).toBe('function');
        expect(typeof service.getContractsByLoan).toBe('function');
        expect(typeof service.getContractById).toBe('function');
      };
      verifyLegalService(live.legal);
      verifyLegalService(mock.legal);
    });
  });

  describe('RootLayout and ServiceProvider Context Integration', () => {
    function ConsumerComponent() {
      const services = useServices();
      return React.createElement(
        'div',
        null,
        React.createElement(
          'span',
          { 'data-testid': 'loans-service' },
          services.loans ? 'available' : 'missing'
        ),
        React.createElement(
          'span',
          { 'data-testid': 'investments-service' },
          services.investments ? 'available' : 'missing'
        ),
        React.createElement(
          'span',
          { 'data-testid': 'legal-service' },
          services.legal ? 'available' : 'missing'
        )
      );
    }

    it('RootLayout wraps children in ServiceProvider so children access context services', () => {
      render(
        React.createElement(
          RootLayout,
          null,
          React.createElement(ConsumerComponent)
        )
      );

      expect(screen.getByTestId('loans-service').textContent).toBe('available');
      expect(screen.getByTestId('investments-service').textContent).toBe('available');
      expect(screen.getByTestId('legal-service').textContent).toBe('available');
    });
  });
});
