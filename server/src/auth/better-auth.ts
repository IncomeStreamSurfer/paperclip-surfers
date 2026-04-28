import type { Request, RequestHandler } from "express";
import type { IncomingHttpHeaders } from "node:http";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { toNodeHandler } from "better-auth/node";
import { twoFactor } from "better-auth/plugins/two-factor";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  twoFactor as twoFactorTable,
  instanceUserRoles,
} from "@paperclipai/db";
import type { Config } from "../config.js";
import { emailService, instanceSettingsService } from "../services/index.js";

export type BetterAuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export type BetterAuthSessionResult = {
  session: { id: string; userId: string } | null;
  user: BetterAuthSessionUser | null;
};

type BetterAuthInstance = ReturnType<typeof betterAuth>;

function headersFromNodeHeaders(rawHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, raw] of Object.entries(rawHeaders)) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) headers.append(key, value);
      continue;
    }
    headers.set(key, raw);
  }
  return headers;
}

function headersFromExpressRequest(req: Request): Headers {
  return headersFromNodeHeaders(req.headers);
}

function addLoopbackEquivalents(origins: Set<string>): void {
  const toAdd: string[] = [];
  for (const origin of origins) {
    try {
      const u = new URL(origin);
      if (u.hostname === "localhost") {
        u.hostname = "127.0.0.1";
        toAdd.push(u.origin);
      } else if (u.hostname === "127.0.0.1") {
        u.hostname = "localhost";
        toAdd.push(u.origin);
      }
    } catch {
      // ignore unparseable origins
    }
  }
  for (const o of toAdd) origins.add(o);
}

export function deriveAuthTrustedOrigins(config: Config): string[] {
  const baseUrl = config.authBaseUrlMode === "explicit" ? config.authPublicBaseUrl : undefined;
  const trustedOrigins = new Set<string>();

  if (baseUrl) {
    try {
      trustedOrigins.add(new URL(baseUrl).origin);
    } catch {
      // Better Auth will surface invalid base URL separately.
    }
  }
  if (config.deploymentMode === "authenticated") {
    for (const hostname of config.allowedHostnames) {
      const trimmed = hostname.trim().toLowerCase();
      if (!trimmed) continue;
      trustedOrigins.add(`https://${trimmed}`);
      trustedOrigins.add(`http://${trimmed}`);
    }
  }

  // Always trust loopback equivalents so that accessing via 127.0.0.1
  // works when the public URL is configured with localhost (and vice versa).
  addLoopbackEquivalents(trustedOrigins);

  return Array.from(trustedOrigins);
}

export function createBetterAuthInstance(db: Db, config: Config, trustedOrigins?: string[]): BetterAuthInstance {
  const baseUrl = config.authBaseUrlMode === "explicit" ? config.authPublicBaseUrl : undefined;
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.PAPERCLIP_AGENT_JWT_SECRET ?? "paperclip-dev-secret";
  const effectiveTrustedOrigins = trustedOrigins ?? deriveAuthTrustedOrigins(config);

  const publicUrl = process.env.PAPERCLIP_PUBLIC_URL ?? baseUrl;
  const isHttpOnly = publicUrl ? publicUrl.startsWith("http://") : false;

  const authConfig = {
    baseURL: baseUrl,
    secret,
    trustedOrigins: effectiveTrustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        twoFactor: twoFactorTable,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: config.authDisableSignUp,
      sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
        try {
          const emails = emailService(db);
          const general = await instanceSettingsService(db).getGeneral();
          const appName = general.siteTitle ?? "Paperclip";
          await emails.sendPasswordResetEmail(user.email, url, appName);
        } catch {
          // Non-fatal — if email isn't configured the reset link appears in server logs only
        }
      },
    },
    ...(isHttpOnly ? { advanced: { useSecureCookies: false } } : {}),
    plugins: [
      twoFactor({
        issuer: "Paperclip",
        totpOptions: { digits: 6, period: 30 },
      }),
    ],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        try {
          // Extract email from the request body
          const bodyEmail =
            typeof ctx.body === "object" &&
            ctx.body !== null &&
            "email" in ctx.body &&
            typeof (ctx.body as Record<string, unknown>).email === "string"
              ? ((ctx.body as Record<string, unknown>).email as string)
              : null;
          if (!bodyEmail) return;

          // Find the newly created user by email
          const user = await db
            .select({ id: authUsers.id, email: authUsers.email })
            .from(authUsers)
            .where(eq(authUsers.email, bodyEmail.toLowerCase()))
            .then((rows) => rows[0] ?? null);
          if (!user) return;

          // Promote if this is the first user or matches PAPERCLIP_SUPER_ADMIN_EMAIL
          const totalUsers = await db
            .select({ id: authUsers.id })
            .from(authUsers)
            .then((rows) => rows.length);

          const superAdminEmail = process.env.PAPERCLIP_SUPER_ADMIN_EMAIL;
          const shouldPromote =
            totalUsers === 1 ||
            (superAdminEmail &&
              user.email.toLowerCase() === superAdminEmail.toLowerCase());

          if (!shouldPromote) return;

          const existing = await db
            .select({ id: instanceUserRoles.id })
            .from(instanceUserRoles)
            .where(
              and(
                eq(instanceUserRoles.userId, user.id),
                eq(instanceUserRoles.role, "instance_admin"),
              ),
            )
            .then((rows) => rows[0] ?? null);

          if (!existing) {
            await db.insert(instanceUserRoles).values({
              userId: user.id,
              role: "instance_admin",
            });
          }
        } catch {
          // Non-fatal — manual admin promotion is always available
        }
      }),
    },
  };

  if (!baseUrl) {
    delete (authConfig as { baseURL?: string }).baseURL;
  }

  return betterAuth(authConfig);
}

export function createBetterAuthHandler(auth: BetterAuthInstance): RequestHandler {
  const handler = toNodeHandler(auth);
  return (req, res, next) => {
    void Promise.resolve(handler(req, res)).catch(next);
  };
}

export async function resolveBetterAuthSessionFromHeaders(
  auth: BetterAuthInstance,
  headers: Headers,
): Promise<BetterAuthSessionResult | null> {
  const api = (auth as unknown as { api?: { getSession?: (input: unknown) => Promise<unknown> } }).api;
  if (!api?.getSession) return null;

  const sessionValue = await api.getSession({
    headers,
  });
  if (!sessionValue || typeof sessionValue !== "object") return null;

  const value = sessionValue as {
    session?: { id?: string; userId?: string } | null;
    user?: { id?: string; email?: string | null; name?: string | null } | null;
  };
  const session = value.session?.id && value.session.userId
    ? { id: value.session.id, userId: value.session.userId }
    : null;
  const user = value.user?.id
    ? {
        id: value.user.id,
        email: value.user.email ?? null,
        name: value.user.name ?? null,
      }
    : null;

  if (!session || !user) return null;
  return { session, user };
}

export async function resolveBetterAuthSession(
  auth: BetterAuthInstance,
  req: Request,
): Promise<BetterAuthSessionResult | null> {
  return resolveBetterAuthSessionFromHeaders(auth, headersFromExpressRequest(req));
}
