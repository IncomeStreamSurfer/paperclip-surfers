/**
 * SSRF-safe fetch wrapper.
 *
 * Blocks requests to link-local addresses (169.254.x.x), loopback (127.x,
 * ::1), and RFC 1918 private ranges (10.x, 172.16-31.x, 192.168.x) before
 * any network I/O, preventing server-side request forgery via user-supplied
 * URLs (webhooks, MCP fetch, custom integrations).
 */

import { lookup } from "node:dns/promises";

const BLOCKED_PATTERNS = [
  // Loopback
  /^127\./,
  // Link-local (AWS/GCP metadata)
  /^169\.254\./,
  // RFC 1918 Class A
  /^10\./,
  // RFC 1918 Class B (172.16.0.0 – 172.31.255.255)
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  // RFC 1918 Class C
  /^192\.168\./,
  // IPv6 loopback
  /^::1$/,
  // IPv6 link-local
  /^fe80:/i,
  // IPv4-mapped IPv6 private ranges (::ffff:10.x, ::ffff:192.168.x, etc.)
  /^::ffff:(127\.|10\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/i,
];

export class SsrfBlockedError extends Error {
  constructor(url: string, resolvedIp?: string) {
    super(
      resolvedIp
        ? `SSRF blocked: ${url} resolves to private address ${resolvedIp}`
        : `SSRF blocked: ${url} targets a private address`,
    );
    this.name = "SsrfBlockedError";
  }
}

function isPrivateIp(ip: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(ip));
}

async function assertSafeUrl(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new SsrfBlockedError(urlString);
  }

  const hostname = parsed.hostname;

  // Reject bare IPs that are private without a DNS round-trip
  if (isPrivateIp(hostname)) {
    throw new SsrfBlockedError(urlString, hostname);
  }

  // Resolve hostname and check all returned addresses
  try {
    const result = await lookup(hostname, { all: true });
    for (const { address } of result) {
      if (isPrivateIp(address)) {
        throw new SsrfBlockedError(urlString, address);
      }
    }
  } catch (err) {
    if (err instanceof SsrfBlockedError) throw err;
    // DNS failures are treated as blocked — we can't verify safety
    throw new SsrfBlockedError(urlString);
  }
}

/**
 * Fetch a user-supplied URL after verifying it does not point to a private
 * or link-local address. Throws `SsrfBlockedError` for blocked destinations.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  await assertSafeUrl(url);
  return fetch(url, init);
}
