/**
 * Service Container Types for Lencord Dependency Injection.
 * Groups all domain services into a cohesive interface conforming to @/types contracts.
 */

import type {
  CreditScoringInterface,
  EmailServiceInterface,
  InvestmentServiceInterface,
  LegalServiceInterface,
  LoanServiceInterface,
  NotificationServiceInterface,
  PaymentGatewayInterface,
} from '@/types';

export interface Services {
  loans: LoanServiceInterface;
  investments: InvestmentServiceInterface;
  creditScoring: CreditScoringInterface;
  legal: LegalServiceInterface;
  payments: PaymentGatewayInterface;
  notifications?: NotificationServiceInterface;
  email?: EmailServiceInterface;
  multiChannelNotifications?: import('./notifications/channels').MultiChannelNotificationServiceInterface;
}

export type ServiceName = keyof Services;
