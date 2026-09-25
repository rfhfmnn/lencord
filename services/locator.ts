/**
 * Server-side Service Locator for Lencord.
 * Resolves singleton or customized service containers for Server Actions, Route Handlers, and SSR.
 */

import type { Services } from './types';
import { createServices, type ServiceFactoryOptions } from './factory';

let cachedServerServices: Services | null = null;

export interface ServerServiceLocatorOptions extends ServiceFactoryOptions {
  /**
   * If true, bypasses the cached singleton and constructs a fresh service instance container.
   */
  fresh?: boolean;
}

/**
 * Resolves service instances for server actions, route handlers, and server-side utilities.
 * Uses a cached singleton by default for performance, unless fresh: true or specific options are supplied.
 */
export function getServerServices(options?: ServerServiceLocatorOptions): Services {
  if (options?.fresh) {
    return createServices(options);
  }

  // If specific options (such as custom mocks or overrides) are provided, return a tailored container
  if (options && (options.useMocks !== undefined || options.overrides || options.store || options.paymentGateway)) {
    return createServices(options);
  }

  if (!cachedServerServices) {
    cachedServerServices = createServices();
  }

  return cachedServerServices;
}

/**
 * Universal alias for getServerServices.
 */
export const getServices = getServerServices;

/**
 * Injects a custom service container for testing or runtime mocking.
 */
export function setServerServices(services: Services | null): void {
  cachedServerServices = services;
}

/**
 * Clears the cached server service instance.
 */
export function resetServerServices(): void {
  cachedServerServices = null;
}
