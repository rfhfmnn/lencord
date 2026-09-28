import crypto from 'node:crypto';

/**
 * Computes an HMAC SHA-256 signature for payload verification.
 */
export function computeHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Generates an HMAC-SHA256 signature with timestamp.
 */
export function generateSignedHeaders(
  payload: string,
  secret: string,
  timestamp?: number | string
): { timestamp: string; signature: string } {
  const ts = (timestamp !== undefined ? timestamp : Date.now()).toString();
  const signature = computeHmacSignature(`${ts}.${payload}`, secret);
  return { timestamp: ts, signature };
}

/**
 * Verifies whether a timestamp is within the acceptable time window (default 300 seconds / 5 minutes)
 * to prevent replay attacks.
 */
export function isTimestampValid(
  timestamp: number | string | null | undefined,
  maxAgeSeconds = 300
): boolean {
  if (timestamp === null || timestamp === undefined || timestamp === '') {
    return false;
  }

  const tsNum = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  if (isNaN(tsNum)) return false;

  // Support both milliseconds (e.g. 1700000000000) and seconds (e.g. 1700000000)
  const tsMs = tsNum > 1e11 ? tsNum : tsNum * 1000;
  const now = Date.now();
  const diffSeconds = (now - tsMs) / 1000;

  // Must not be older than maxAgeSeconds (with tolerance for execution jitter) and not more than 60 seconds in the future
  return diffSeconds >= -60 && Math.floor(diffSeconds) <= maxAgeSeconds;
}

/**
 * Verifies an incoming HMAC SHA-256 signature against expected payload and secret.
 * Checks both timestamped payload `${timestamp}.${payload}` (if timestamp is provided)
 * and plain payload for full backward compatibility.
 */
export function verifyWebhookSignature(
  payload: string,
  providedSignature: string | null | undefined,
  secret: string,
  timestamp?: string | null
): boolean {
  if (!providedSignature) return false;
  const cleanSig = providedSignature.replace(/^sha256=/, '').trim();

  // Try timestamped verification if timestamp is provided
  if (timestamp) {
    const expectedWithTs = computeHmacSignature(`${timestamp}.${payload}`, secret);
    try {
      if (
        crypto.timingSafeEqual(
          Buffer.from(cleanSig, 'hex'),
          Buffer.from(expectedWithTs, 'hex')
        )
      ) {
        return true;
      }
    } catch {
      // Fall through to plain verification
    }
  }

  // Fallback: check plain payload verification
  const expectedPlain = computeHmacSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cleanSig, 'hex'),
      Buffer.from(expectedPlain, 'hex')
    );
  } catch {
    return false;
  }
}
