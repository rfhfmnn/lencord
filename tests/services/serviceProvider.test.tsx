import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, render, screen } from '@testing-library/react';
import React from 'react';
import type { LoanServiceInterface } from '@/types';
import {
  clearLiveServices,
  createLiveServices,
  createMockServices,
  createServices,
  getServerServices,
  getServices,
  isUsingMocks,
  registerLiveServices,
  resetServerServices,
  setServerServices,
  type Services,
} from '@/services';
import {
  ServiceProvider,
  useCreditScoring,
  useInvestments,
  useLegal,
  useLoans,
  usePayments,
  useServices,
} from '@/context';
import {
  MockCreditScoringService,
  MockInvestmentService,
  MockLegalService,
  MockLoanService,
  MockPaymentGateway,
  MockStateStore,
} from '@/services/mock';

describe('Service Provider, Factory, and Environment Switching', () => {
  const originalEnv = { ...process.env };

  const createDummyServices = (): Services => ({
    loans: {
      getLoanById: vi.fn(),
      listLoans: vi.fn().mockResolvedValue([]),
      submitLoanApplication: vi.fn(),
      approveAndPublishLoan: vi.fn(),
      finalizeLoanFunding: vi.fn(),
      cancelLoan: vi.fn(),
      getInstallmentsByLoan: vi.fn(),
    },
    investments: {
      commitInvestment: vi.fn(),
      getInvestmentsByLoan: vi.fn(),
      getInvestmentsByInvestor: vi.fn(),
      getInvestmentById: vi.fn(),
      refundInvestmentsByLoan: vi.fn(),
    },
    creditScoring: {
      getBcraReport: vi.fn(),
      evaluateCreditRisk: vi.fn(),
      getCreditProfileByProfileId: vi.fn(),
    },
    legal: {
      generatePromissoryNote: vi.fn(),
      generateMutualAgreement: vi.fn(),
      signContract: vi.fn(),
      getContractsByLoan: vi.fn(),
      getContractById: vi.fn(),
    },
    payments: {
      holdFunds: vi.fn(),
      releaseFunds: vi.fn(),
      disburseLoan: vi.fn(),
      collectInstallment: vi.fn(),
    },
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
    resetServerServices();
    clearLiveServices();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllEnvs();
    resetServerServices();
    clearLiveServices();
  });

  describe('isUsingMocks Environment Resolver', () => {
    it('returns true when NEXT_PUBLIC_USE_MOCKS is explicitly "true"', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
      expect(isUsingMocks()).toBe(true);
    });

    it('returns false when NEXT_PUBLIC_USE_MOCKS is explicitly "false"', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
      expect(isUsingMocks()).toBe(false);
    });

    it('handles case-insensitivity and "1" / "0" values', () => {
      expect(isUsingMocks('TRUE')).toBe(true);
      expect(isUsingMocks('1')).toBe(true);
      expect(isUsingMocks('FALSE')).toBe(false);
      expect(isUsingMocks('0')).toBe(false);
      expect(isUsingMocks(true)).toBe(true);
      expect(isUsingMocks(false)).toBe(false);
    });

    it('defaults to true when unset in development or test environment', () => {
      delete process.env.NEXT_PUBLIC_USE_MOCKS;
      vi.stubEnv('NODE_ENV', 'development');
      expect(isUsingMocks()).toBe(true);

      vi.stubEnv('NODE_ENV', 'test');
      expect(isUsingMocks()).toBe(true);
    });

    it('defaults to false when unset in production environment', () => {
      delete process.env.NEXT_PUBLIC_USE_MOCKS;
      vi.stubEnv('NODE_ENV', 'production');
      expect(isUsingMocks()).toBe(false);
    });
  });

  describe('Service Factory (createServices / createMockServices / createLiveServices)', () => {
    it('creates mock services conforming to contracts when useMocks is active', () => {
      const services = createServices({ useMocks: true });

      expect(services.loans).toBeInstanceOf(MockLoanService);
      expect(services.investments).toBeInstanceOf(MockInvestmentService);
      expect(services.creditScoring).toBeInstanceOf(MockCreditScoringService);
      expect(services.legal).toBeInstanceOf(MockLegalService);
      expect(services.payments).toBeInstanceOf(MockPaymentGateway);
    });

    it('supports custom isolated MockStateStore and MockPaymentGateway', async () => {
      const customStore = new MockStateStore();
      const customGateway = new MockPaymentGateway();
      const services = createMockServices({
        store: customStore,
        paymentGateway: customGateway,
      });

      const loans = await services.loans.listLoans();
      expect(loans.length).toBeGreaterThan(0);
      expect(services.payments).toBe(customGateway);
    });

    it('supports custom service overrides in factory', () => {
      const dummyMockLoanService: LoanServiceInterface = {
        getLoanById: vi.fn(),
        listLoans: vi.fn(),
        submitLoanApplication: vi.fn(),
        approveAndPublishLoan: vi.fn(),
        finalizeLoanFunding: vi.fn(),
        cancelLoan: vi.fn(),
        getInstallmentsByLoan: vi.fn(),
      };

      const services = createServices({
        useMocks: true,
        overrides: { loans: dummyMockLoanService },
      });

      expect(services.loans).toBe(dummyMockLoanService);
      expect(services.investments).toBeInstanceOf(MockInvestmentService);
    });

    it('throws an informative error when live services are requested but not configured', () => {
      expect(() => createServices({ useMocks: false })).toThrowError(
        /Live services are not yet configured or implemented/i
      );

      expect(() => createLiveServices()).toThrowError(
        /Missing services: \[loans, investments, creditScoring, legal, payments\]/i
      );
    });

    it('resolves registered live services when configured', () => {
      const mockLiveServices = createDummyServices();

      registerLiveServices(mockLiveServices);

      const resolved = createServices({ useMocks: false });
      expect(resolved).toEqual(mockLiveServices);
    });
  });

  describe('Server-Side Service Locator (getServerServices / getServices)', () => {
    it('returns a cached singleton service container by default', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
      const instance1 = getServerServices();
      const instance2 = getServerServices();

      expect(instance1).toBe(instance2);
      expect(instance1.loans).toBeInstanceOf(MockLoanService);
    });

    it('returns alias getServices matching getServerServices', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
      const instance1 = getServerServices();
      const instance2 = getServices();

      expect(instance1).toBe(instance2);
    });

    it('creates a fresh instance when fresh: true is supplied', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
      const singleton = getServerServices();
      const fresh = getServerServices({ fresh: true });

      expect(singleton).not.toBe(fresh);
      expect(fresh.loans).toBeInstanceOf(MockLoanService);
    });

    it('supports setServerServices and resetServerServices for test isolation', () => {
      const customServices = createDummyServices();

      setServerServices(customServices);
      expect(getServerServices()).toBe(customServices);

      resetServerServices();
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
      expect(getServerServices()).not.toBe(customServices);
    });
  });

  describe('React ServiceProvider and useServices Hook', () => {
    it('exposes all services to client components inside ServiceProvider', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceProvider useMocks={true}>{children}</ServiceProvider>
      );

      const { result } = renderHook(() => useServices(), { wrapper });

      expect(result.current.loans).toBeDefined();
      expect(result.current.investments).toBeDefined();
      expect(result.current.creditScoring).toBeDefined();
      expect(result.current.legal).toBeDefined();
      expect(result.current.payments).toBeDefined();

      // Test interaction through the resolved service
      const loans = await result.current.loans.listLoans();
      expect(loans.length).toBeGreaterThan(0);
    });

    it('individual convenience hooks resolve expected services', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceProvider useMocks={true}>{children}</ServiceProvider>
      );

      const { result: loansHook } = renderHook(() => useLoans(), { wrapper });
      const { result: investmentsHook } = renderHook(() => useInvestments(), { wrapper });
      const { result: creditScoringHook } = renderHook(() => useCreditScoring(), { wrapper });
      const { result: legalHook } = renderHook(() => useLegal(), { wrapper });
      const { result: paymentsHook } = renderHook(() => usePayments(), { wrapper });

      expect(loansHook.current).toBeInstanceOf(MockLoanService);
      expect(investmentsHook.current).toBeInstanceOf(MockInvestmentService);
      expect(creditScoringHook.current).toBeInstanceOf(MockCreditScoringService);
      expect(legalHook.current).toBeInstanceOf(MockLegalService);
      expect(paymentsHook.current).toBeInstanceOf(MockPaymentGateway);
    });

    it('accepts explicitly provided services container in ServiceProvider', () => {
      const customContainer = createDummyServices();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceProvider services={customContainer}>{children}</ServiceProvider>
      );

      const { result } = renderHook(() => useServices(), { wrapper });
      expect(result.current).toBe(customContainer);
    });

    it('handles missing context gracefully by throwing an informative error', () => {
      expect(() => renderHook(() => useServices())).toThrowError(
        /useServices must be used within a ServiceProvider/i
      );
    });

    it('handles missing context with fallback: true by resolving default service locator', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
      const { result } = renderHook(() => useServices({ fallback: true }));

      expect(result.current).toBeDefined();
      expect(result.current.loans).toBeInstanceOf(MockLoanService);
    });

    it('renders child components cleanly within ServiceProvider', () => {
      function TestComponent() {
        const services = useServices();
        return <div>Services Ready: {services.loans ? 'YES' : 'NO'}</div>;
      }

      render(
        <ServiceProvider useMocks={true}>
          <TestComponent />
        </ServiceProvider>
      );

      expect(screen.getByText('Services Ready: YES')).toBeInTheDocument();
    });
  });
});
