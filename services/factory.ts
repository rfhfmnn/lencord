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
import {
  MultiChannelNotificationService,
  MockChannelAdapter,
  TwilioChannelAdapter,
  defaultMockChannelAdapter,
  type MultiChannelNotificationServiceInterface,
} from './notifications/channels';

export interface MockServiceOptions {
  store?: MockStateStore;
  paymentGateway?: MockPaymentGateway;
  email?: EmailServiceInterface;
  multiChannelNotifications?: MultiChannelNotificationServiceInterface;
}

/**
 * Creates in-memory mock service implementations.
 * Can be provided custom state stores or payment gateways for test isolation.
 */
export function createMockServices(options?: MockServiceOptions): Services {
  const store = options?.store ?? defaultMockStateStore;
  const paymentGateway = options?.paymentGateway ?? defaultMockPaymentGateway;
  const emailService = options?.email ?? defaultMockEmailService;
  const notificationsService = new MockNotificationService(store);
  const multiChannelNotifications =
    options?.multiChannelNotifications ??
    new MultiChannelNotificationService(
      defaultMockChannelAdapter,
      notificationsService,
      emailService
    );

  return {
    loans: new MockLoanService(
      store,
      paymentGateway,
      emailService,
      multiChannelNotifications
    ),
    investments: new MockInvestmentService(
      store,
      paymentGateway,
      emailService,
      multiChannelNotifications
    ),
    creditScoring: new MockCreditScoringService(store),
    legal: new MockLegalService(store),
    payments: paymentGateway,
    notifications: notificationsService,
    email: emailService,
    multiChannelNotifications,
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

  const notificationsService =
    liveServiceRegistry.notifications ??
    new SupabaseNotificationService(clientProvider);

  const multiChannelNotifications =
    liveServiceRegistry.multiChannelNotifications ??
    new MultiChannelNotificationService(
      new TwilioChannelAdapter(),
      notificationsService,
      emailService
    );

  const services: Services = {
    loans:
      liveServiceRegistry.loans ??
      new SupabaseLoanService(clientProvider, paymentGateway, emailService, multiChannelNotifications),
    investments:
      liveServiceRegistry.investments ??
      new SupabaseInvestmentService(clientProvider, paymentGateway, emailService, multiChannelNotifications),
    creditScoring:
      liveServiceRegistry.creditScoring ??
      new BcraCreditScoringService({ clientProvider }),
    legal:
      liveServiceRegistry.legal ??
      new SupabaseLegalService(clientProvider),
    payments: paymentGateway,
    notifications: notificationsService,
    email: emailService,
    multiChannelNotifications,
  };

  if (liveServiceRegistry.email) {
    services.email = liveServiceRegistry.email;
  } else if (options?.email) {
    services.email = options.email;
  }

  if (liveServiceRegistry.notifications) {
    services.notifications = liveServiceRegistry.notifications;
  }

  if (liveServiceRegistry.multiChannelNotifications) {
    services.multiChannelNotifications = liveServiceRegistry.multiChannelNotifications;
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

