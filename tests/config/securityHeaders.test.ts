import { describe, it, expect } from 'vitest';
import nextConfig from '@/next.config';

describe('Security Headers Configuration (Issue #93 / SEC-08)', () => {
  it('defines headers function in next.config.ts', () => {
    expect(nextConfig.headers).toBeDefined();
    expect(typeof nextConfig.headers).toBe('function');
  });

  it('applies essential HTTP security headers to all paths (/(.*))', async () => {
    const headerConfigs = await nextConfig.headers!();
    expect(headerConfigs).toBeInstanceOf(Array);
    expect(headerConfigs.length).toBeGreaterThanOrEqual(1);

    const rootConfig = headerConfigs.find((c) => c.source === '/(.*)');
    expect(rootConfig).toBeDefined();

    const headersMap = new Map<string, string>();
    rootConfig!.headers.forEach((h: { key: string; value: string }) => {
      headersMap.set(h.key.toLowerCase(), h.value);
    });

    // 1. Anti-Clickjacking: X-Frame-Options DENY
    expect(headersMap.get('x-frame-options')).toBe('DENY');

    // 2. MIME sniffing prevention: X-Content-Type-Options nosniff
    expect(headersMap.get('x-content-type-options')).toBe('nosniff');

    // 3. Strict-Transport-Security (HSTS)
    expect(headersMap.get('strict-transport-security')).toContain('max-age=63072000');
    expect(headersMap.get('strict-transport-security')).toContain('includeSubDomains');

    // 4. Referrer-Policy
    expect(headersMap.get('referrer-policy')).toBe('strict-origin-when-cross-origin');

    // 5. XSS Protection
    expect(headersMap.get('x-xss-protection')).toBe('1; mode=block');
  });
});
