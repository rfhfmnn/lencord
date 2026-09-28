/**
 * Argentine Banking CBU (Clave Bancaria Uniforme) & CVU (Clave Virtual Uniforme)
 * Checksum Verification and COELSA / Interbanking Verification Helpers.
 * Conforms to BCRA (Banco Central de la República Argentina) standards.
 */

export interface CbuVerificationResult {
  valid: boolean;
  cbu: string;
  accountHolder?: string;
  taxId?: string; // CUIT / CUIL
  bankName?: string;
  accountType?: 'checking' | 'savings' | 'virtual_wallet';
  status: 'active' | 'inactive' | 'invalid';
  errorMessage?: string;
}

export const ARGENTINE_BANK_CODES: Record<string, string> = {
  '007': 'Banco Galicia',
  '011': 'Banco de la Nación Argentina',
  '014': 'Banco de la Provincia de Buenos Aires',
  '017': 'BBVA Argentina',
  '020': 'Banco de la Provincia de Córdoba (BANCOR)',
  '029': 'Banco Ciudad de Buenos Aires',
  '034': 'Banco Patagonia',
  '072': 'Banco Santander Argentina',
  '150': 'Banco del Sol',
  '260': 'Banco BIND (Banco Industrial)',
  '386': 'Banco Voii',
  '453': 'Pomelo PSP',
};

/**
 * Validates the mathematical checksum of a 22-digit Argentine CBU or CVU
 * according to the official BCRA algorithm.
 */
export function validateCbuChecksum(cbu: string): boolean {
  if (!cbu || typeof cbu !== 'string') return false;
  const clean = cbu.trim();
  if (clean.length !== 22 || !/^\d{22}$/.test(clean)) return false;
  if (/^(\d)\1{21}$/.test(clean)) return false;

  // Block 1: 8 digits (EEEESSSD)
  // Check digit is at index 7. Calculated using indices 0..6
  const weightsBlock1 = [7, 1, 3, 9, 7, 1, 3];
  let sum1 = 0;
  for (let i = 0; i < 7; i++) {
    sum1 += parseInt(clean[i], 10) * weightsBlock1[i];
  }
  const diff1 = 10 - (sum1 % 10);
  const expectedDigit1 = diff1 === 10 ? 0 : diff1;
  if (parseInt(clean[7], 10) !== expectedDigit1) {
    return false;
  }

  // Block 2: 14 digits (CCCCCCCCCCCCCD)
  // Check digit is at index 21. Calculated using indices 8..20
  const weightsBlock2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += parseInt(clean[8 + i], 10) * weightsBlock2[i];
  }
  const diff2 = 10 - (sum2 % 10);
  const expectedDigit2 = diff2 === 10 ? 0 : diff2;
  if (parseInt(clean[21], 10) !== expectedDigit2) {
    return false;
  }

  return true;
}

/**
 * Resolves bank or PSP name from CBU / CVU bank prefix.
 */
export function resolveBankOrPspName(cbu: string): string {
  if (!cbu || cbu.length < 3) return 'Entidad Financiera no identificada';
  const prefix3 = cbu.substring(0, 3);
  if (ARGENTINE_BANK_CODES[prefix3]) {
    return ARGENTINE_BANK_CODES[prefix3];
  }
  if (cbu.startsWith('000000')) {
    return 'Proveedor de Servicios de Pago (CVU FinTech)';
  }
  return `Entidad Bancaria (${prefix3})`;
}
