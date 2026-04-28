import { randomBytes } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/** Paths exempt from CSRF token validation (webhooks, public triggers, auth callbacks). */
const EXEMPT_PATTERNS = [
  /^\/webhooks\//,
  /^\/plugins\/[^/]+\/webhooks\//,
  /^\/routine-triggers\/public\//,
  /^\/health/,
  /^\/auth\//,
];

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function setCsrfCookie(res: Response, token: string) {
  const isSecure =
    process.env.NODE_ENV === "production" ||
    (process.env.PAPERCLIP_PUBLIC_URL ?? "").startsWith("https://");

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name && rest.length > 0) {
      cookies[decodeURIComponent(name.trim())] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

/**
 * Middleware that sets (or refreshes) the CSRF token cookie on every request.
 * The frontend should read this cookie and send it back as `X-CSRF-Token`.
 */
export function csrfSetCookie(): RequestHandler {
  return (_req, res, next) => {
    const token = generateToken();
    setCsrfCookie(res, token);
    next();
  };
}

/**
 * Middleware that validates the CSRF token for state-changing requests.
 * Skips safe methods (GET, HEAD, OPTIONS), exempt paths, and non-session actors.
 */
export function csrfProtection(): RequestHandler {
  return (req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      next();
      return;
    }

    const path = req.path.replace(/^\/api/, "");
    for (const pattern of EXEMPT_PATTERNS) {
      if (pattern.test(path)) {
        next();
        return;
      }
    }

    // Only enforce CSRF for browser-session board users.
    // Agent keys, local implicit, and board bearer tokens are not susceptible
    // to browser-driven CSRF in the same way.
    if (req.actor.source !== "session") {
      next();
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      res.status(403).json({ error: "CSRF token mismatch" });
      return;
    }

    next();
  };
}
