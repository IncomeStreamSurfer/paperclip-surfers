import type { Request, RequestHandler } from "express";
import { logger } from "./logger.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

function parseOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function trustedOriginsForRequest(req: Request) {
  const origins = new Set(DEFAULT_DEV_ORIGINS.map((value) => value.toLowerCase()));

  // Use the forwarded host when behind a reverse proxy so the allowed origins
  // match what the browser sees, not the internal upstream host.
  const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || req.header("host")?.trim();

  if (host) {
    const httpOrigin = `http://${host}`.toLowerCase();
    const httpsOrigin = `https://${host}`.toLowerCase();
    origins.add(httpOrigin);
    origins.add(httpsOrigin);

    // When we have a forwarded proto, prefer it for the matching origin.
    // Still keep both http/https as fallbacks.
    if (forwardedProto === "https") {
      origins.add(httpsOrigin);
    } else if (forwardedProto === "http") {
      origins.add(httpOrigin);
    }
  }
  return origins;
}

function isTrustedBoardMutationRequest(req: Request) {
  const allowedOrigins = trustedOriginsForRequest(req);
  const origin = parseOrigin(req.header("origin"));
  if (origin && allowedOrigins.has(origin)) return true;

  const refererOrigin = parseOrigin(req.header("referer"));
  if (refererOrigin && allowedOrigins.has(refererOrigin)) return true;

  return false;
}

export function boardMutationGuard(): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    if (req.actor.type !== "board") {
      next();
      return;
    }

    // Local-trusted mode and board bearer keys are not browser-session requests.
    // In these modes, origin/referer headers can be absent; do not block those mutations.
    if (req.actor.source === "local_implicit" || req.actor.source === "board_key") {
      next();
      return;
    }

    if (!isTrustedBoardMutationRequest(req)) {
      const origin = req.header("origin");
      const referer = req.header("referer");
      const host = req.header("host");
      const forwardedHost = req.header("x-forwarded-host");
      logger.warn(
        { method: req.method, path: req.path, origin, referer, host, forwardedHost, actorSource: req.actor.source },
        "boardMutationGuard: rejected untrusted origin",
      );
      res.status(403).json({ error: "Board mutation requires trusted browser origin" });
      return;
    }

    next();
  };
}
