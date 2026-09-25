/**
 * Service Registry and Factory for Lencord Dependency Injection.
 * Provides mock and live service resolution based on environment configuration.
 */

import type { Services } from './types';
import { isUsingMocks } from './env';
import {
  MockCreditScoringService,
  MockInvestmentService,
  MockLegalService,
  MockLoanService,
  MockPaymentGateway,
  MockStateStore,
  defaultMockPaymentGateway,
  defaultMockStateStore,
} from './mock';

export interface MockServiceOptions {
  store?: MockStateStore;
  paymentGateway?: MockPaymentGateway;
}

/**
 * Creates in-memory mock service implementations.
 * Can be provided custom state stores or payment gateways for test isolation.
 */
export function createMockServices(options?: MockServiceOptions): Services {
  const store = options?.store ?? defaultMockStateStore;
  const paymentGateway = options?.paymentGateway ?? defaultMockPaymentGateway;

  return {
    loans: new MockLoanService(store),
    investments: new MockInvestmentService(store, paymentGateway),
    creditScoring: new MockCreditScoringService(store),
    legal: new MockLegalService(store),
    payments: paymentGateway,
  };
}

let liveServiceRegistry: Partial<Services> = {};

/**
 * Registers live service implementations (utilized by live Supabase/BaaS integrations in #19 and #21).
 */
export function registerLiveServices(services: Partial<Services>): void {
  liveServiceRegistry = {
    ...liveServiceRegistry,
    ...services,
  };
}

/**
 * Returns current live services registered in the registry.
 */
export function getLiveServices(): Partial<Services> {
  return { ...liveServiceRegistry };
}

/**
 * Resets registered live services.
 */
export function clearLiveServices(): void {
  liveServiceRegistry = {};
}

/**
 * Resolves live service implementations.
 * Throws an informative error if live services are not yet configured.
 */
export function createLiveServices(): Services {
  const requiredKeys: (keyof Services)[] = [
    'loans',
    'investments',
    'creditScoring',
    'legal',
    'payments',
  ];

  const missing = requiredKeys.filter((key) => !liveServiceRegistry[key]);

  if (missing.length > 0) {
    throw new Error(
      `Live services are not yet configured or implemented. Missing services: [${missing.join(
        ', '
      )}]. Live Supabase services and BaaS payment gateway are scheduled for issues #19 and #21. Set NEXT_PUBLIC_USE_MOCKS="true" or use development mode to activate in-memory mocks.`
    );
  }

  return liveServiceRegistry as Services;
}

export interface ServiceFactoryOptions {
  useMocks?: boolean | string;
  store?: MockStateStore;
  paymentGateway?: MockPaymentGateway;
  overrides?: Partial<Services>;
}

/**
 * Factory function that resolves full service container based on environment or options.
 */
export function createServices(options?: ServiceFactoryOptions): Services {
  const useMocks =
    options?.useMocks !== undefined
      ? isUsingMocks(options.useMocks)
      : isUsingMocks();

  const baseServices = useMocks
    ? createMockServices({
        store: options?.store,
        paymentGateway: options?.paymentGateway,
      })
    : createLiveServices();

  if (options?.overrides) {
    return {
      ...baseServices,
      ...options.overrides,
    };
  }

  return baseServices;
}
