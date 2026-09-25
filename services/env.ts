/**
 * Environment resolution for service implementations.
 * Inspects NEXT_PUBLIC_USE_MOCKS and NODE_ENV.
 */

/**
 * Determines whether the platform should resolve in-memory mock services or live services.
 *
 * Rules:
 * - If explicit parameter is provided, it takes precedence.
 * - If NEXT_PUBLIC_USE_MOCKS is 'true' (case-insensitive) -> returns true.
 * - If NEXT_PUBLIC_USE_MOCKS is 'false' (case-insensitive) -> returns false.
 * - If NEXT_PUBLIC_USE_MOCKS is unset or empty -> defaults to true in non-production (development/test), false in production.
 */
export function isUsingMocks(explicitFlag?: string | boolean): boolean {
  if (typeof explicitFlag === 'boolean') {
    return explicitFlag;
  }

  const rawValue = explicitFlag !== undefined ? explicitFlag : process.env.NEXT_PUBLIC_USE_MOCKS;

  if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
    const trimmed = String(rawValue).trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1') {
      return true;
    }
    if (trimmed === 'false' || trimmed === '0') {
      return false;
    }
  }

  // Unset or empty: defaults to mock if in development/test/non-production
  return process.env.NODE_ENV !== 'production';
}
