/**
 * Service Registry and Factory for Lencord Dependency Injection.
 * Provides mock and live service resolution based on environment configuration.
 */

import type { PaymentGatewayInterface } from '@/types';
import type { Services } from './types';
import { isUsingMocks } from './env';
import {
  MockCreditScoringService,
  MockInvestmentService,
  MockLegalService,
  MockLoanService,
  MockNotificationService,
  MockPaymentGateway,
  MockStateStore,
  defaultMockPaymentGateway,
  defaultMockStateStore,
} from './mock';
import {
  SupabaseLoanService,
  SupabaseInvestmentService,
  SupabaseLegalService,
  SupabaseNotificationService,
  type SupabaseClientProvider,
} from './supabase';
import { BcraCreditScoringService } from './bcra';
import { BaaSPaymentGateway } from './payments';
import {
  MockEmailService,
  ResendEmailService,
  defaultMockEmailService,
} from './email';
import type { EmailServiceInterface } from '@/types';

export interface MockServiceOptions {
  store?: MockStateStore;
  paymentGateway?: MockPaymentGateway;
  email?: EmailServiceInterface;
}

/**
 * Creates in-memory mock service implementations.
 * Can be provided custom state stores or payment gateways for test isolation.
 */
export function createMockServices(options?: MockServiceOptions): Services {
  const store = options?.store ?? defaultMockStateStore;
  const paymentGateway = options?.paymentGateway ?? defaultMockPaymentGateway;
  const emailService = options?.email ?? defaultMockEmailService;

  return {
    loans: new MockLoanService(store, paymentGateway, emailService),
    investments: new MockInvestmentService(store, paymentGateway, emailService),
    creditScoring: new MockCreditScoringService(store),
    legal: new MockLegalService(store),
    payments: paymentGateway,
    notifications: new MockNotificationService(store),
    email: emailService,
  };
}

let liveServiceRegistry: Partial<Services> = {};

/**
 * Registers live service implementations (utilized by live Supabase/BaaS integrations).
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

export interface LiveServiceOptions {
  clientProvider?: SupabaseClientProvider;
  paymentGateway?: PaymentGatewayInterface;
  email?: EmailServiceInterface;
}

/**
 * Resolves live service implementations.
 * Instantiates and returns SupabaseLoanService, SupabaseInvestmentService, and SupabaseLegalService.
 */
export function createLiveServices(options?: LiveServiceOptions): Services {
  const clientProvider = options?.clientProvider;
  const paymentGateway =
    options?.paymentGateway ??
    liveServiceRegistry.payments ??
    new BaaSPaymentGateway();
  const emailService =
    options?.email ??
    liveServiceRegistry.email ??
    new ResendEmailService();

  const services: Services = {
    loans:
      liveServiceRegistry.loans ??
      new SupabaseLoanService(clientProvider, paymentGateway, emailService),
    investments:
      liveServiceRegistry.investments ??
      new SupabaseInvestmentService(clientProvider, paymentGateway, emailService),
    creditScoring:
      liveServiceRegistry.creditScoring ??
      new BcraCreditScoringService(),
    legal:
      liveServiceRegistry.legal ??
      new SupabaseLegalService(clientProvider),
    payments: paymentGateway,
  };

  if (liveServiceRegistry.email) {
    services.email = liveServiceRegistry.email;
  } else if (options?.email) {
    services.email = options.email;
  } else if (Object.keys(liveServiceRegistry).length === 0) {
    services.email = emailService;
  }

  if (liveServiceRegistry.notifications) {
    services.notifications = liveServiceRegistry.notifications;
  } else if (Object.keys(liveServiceRegistry).length === 0) {
    services.notifications = new SupabaseNotificationService(clientProvider);
  }

  return services;
}

export interface ServiceFactoryOptions {
  useMocks?: boolean | string;
  store?: MockStateStore;
  paymentGateway?: MockPaymentGateway;
  clientProvider?: SupabaseClientProvider;
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
    : createLiveServices({
        clientProvider: options?.clientProvider,
        paymentGateway: options?.paymentGateway,
      });

  if (options?.overrides) {
    return {
      ...baseServices,
      ...options.overrides,
    };
  }

  return baseServices;
}

