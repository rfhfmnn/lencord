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

/**
 * Encrypts sensitive institutional credentials using AES-256-GCM.
 * Output format: <iv_hex>:<auth_tag_hex>:<cipher_text_hex>
 */
export function encryptCredential(plainText: string, masterKey: string): string {
  const key = crypto.createHash('sha256').update(masterKey).digest(); // 32 bytes key
  const iv = crypto.randomBytes(12); // 12 bytes IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts institutional credentials previously encrypted with encryptCredential.
 */
export function decryptCredential(cipherPackage: string, masterKey: string): string {
  const parts = cipherPackage.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format: expected iv:tag:data');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = crypto.createHash('sha256').update(masterKey).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

