'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type {
  CreditScoringInterface,
  InvestmentServiceInterface,
  LegalServiceInterface,
  LoanServiceInterface,
  PaymentGatewayInterface,
} from '@/types';
import type { Services } from '@/services';
import { createServices, getServices } from '@/services';

export const ServiceContext = createContext<Services | null>(null);

export interface ServiceProviderProps {
  children: React.ReactNode;
  services?: Services;
  useMocks?: boolean | string;
}

/**
 * React Context Provider exposing the Lencord service container to all client components.
 */
export function ServiceProvider({
  children,
  services,
  useMocks,
}: ServiceProviderProps) {
  const resolvedServices = useMemo(() => {
    if (services) {
      return services;
    }
    return createServices({ useMocks });
  }, [services, useMocks]);

  return (
    <ServiceContext.Provider value={resolvedServices}>
      {children}
    </ServiceContext.Provider>
  );
}

export interface UseServicesOptions {
  /**
   * If true, gracefully falls back to the default service locator resolution
   * instead of throwing an error when called outside of a ServiceProvider.
   */
  fallback?: boolean;
}

/**
 * Accesses the services container from the nearest ServiceProvider.
 * Throws an informative error if used outside of a ServiceProvider unless fallback is specified.
 */
export function useServices(options?: UseServicesOptions): Services {
  const context = useContext(ServiceContext);

  if (!context) {
    if (options?.fallback) {
      return getServices();
    }
    throw new Error(
      'useServices must be used within a ServiceProvider. ' +
        'Wrap your component hierarchy in <ServiceProvider> to supply backend services.'
    );
  }

  return context;
}

/**
 * Direct accessor hook for LoanServiceInterface.
 */
export function useLoans(): LoanServiceInterface {
  return useServices().loans;
}

/**
 * Direct accessor hook for InvestmentServiceInterface.
 */
export function useInvestments(): InvestmentServiceInterface {
  return useServices().investments;
}

/**
 * Direct accessor hook for CreditScoringInterface.
 */
export function useCreditScoring(): CreditScoringInterface {
  return useServices().creditScoring;
}

/**
 * Direct accessor hook for LegalServiceInterface.
 */
export function useLegal(): LegalServiceInterface {
  return useServices().legal;
}

/**
 * Direct accessor hook for PaymentGatewayInterface.
 */
export function usePayments(): PaymentGatewayInterface {
  return useServices().payments;
}
