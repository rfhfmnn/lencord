/**
 * Argentine CUIT / CUIL validation and formatting utilities (Modulo 11 algorithm).
 * Conforms to AFIP (ARCA) official check-digit specification.
 */

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const VALID_PREFIXES = ['20', '23', '24', '27', '30', '33', '34'];

/**
 * Strips formatting (hyphens, spaces) and returns only digits.
 */
export function cleanCuit(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats a clean 11-digit CUIT into standard XX-XXXXXXXX-X format.
 */
export function formatCuit(value: string): string {
  const digits = cleanCuit(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`;
}

/**
 * Validates an Argentine CUIT using the Modulo 11 check-digit algorithm.
 * Accepts formatted (XX-XXXXXXXX-X) or clean (11 digits) string.
 */
export function validateCuit(cuit: string): boolean {
  const cleaned = cleanCuit(cuit);

  if (cleaned.length !== 11) {
    return false;
  }

  const prefix = cleaned.substring(0, 2);
  if (!VALID_PREFIXES.includes(prefix)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i], 10) * CUIT_WEIGHTS[i];
  }

  const remainder = sum % 11;
  let expectedCheckDigit: number;

  if (remainder === 0) {
    expectedCheckDigit = 0;
  } else if (remainder === 1) {
    // When 11 - (sum % 11) = 10, AFIP assigns 9 (or 4 for females under old rules)
    expectedCheckDigit = 9;
  } else {
    expectedCheckDigit = 11 - remainder;
  }

  const actualCheckDigit = parseInt(cleaned[10], 10);
  return actualCheckDigit === expectedCheckDigit;
}
