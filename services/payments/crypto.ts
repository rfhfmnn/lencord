import crypto from 'node:crypto';

/**
 * Computes an HMAC SHA-256 signature for payload verification.
 */
export function computeHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies an incoming HMAC SHA-256 signature against expected payload and secret.
 */
export function verifyWebhookSignature(
  payload: string,
  providedSignature: string | null | undefined,
  secret: string
): boolean {
  if (!providedSignature) return false;
  const cleanSig = providedSignature.replace(/^sha256=/, '').trim();
  const expected = computeHmacSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cleanSig, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}
