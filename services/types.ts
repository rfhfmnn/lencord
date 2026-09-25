/**
 * Service Container Types for Lencord Dependency Injection.
 * Groups all domain services into a cohesive interface conforming to @/types contracts.
 */

import type {
  CreditScoringInterface,
  InvestmentServiceInterface,
  LegalServiceInterface,
  LoanServiceInterface,
  PaymentGatewayInterface,
} from '@/types';

export interface Services {
  loans: LoanServiceInterface;
  investments: InvestmentServiceInterface;
  creditScoring: CreditScoringInterface;
  legal: LegalServiceInterface;
  payments: PaymentGatewayInterface;
}

export type ServiceName = keyof Services;
