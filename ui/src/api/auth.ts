export type AuthSession = {
  session: { id: string; userId: string };
  user: { id: string; email: string | null; name: string | null; image: string | null; twoFactorEnabled?: boolean };
};

function toSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const sessionValue = record.session;
  const userValue = record.user;
  if (!sessionValue || typeof sessionValue !== "object") return null;
  if (!userValue || typeof userValue !== "object") return null;
  const session = sessionValue as Record<string, unknown>;
  const user = userValue as Record<string, unknown>;
  if (typeof session.id !== "string" || typeof session.userId !== "string") return null;
  if (typeof user.id !== "string") return null;
    return {
      session: { id: session.id, userId: session.userId },
      user: {
        id: user.id,
        email: typeof user.email === "string" ? user.email : null,
        name: typeof user.name === "string" ? user.name : null,
        image: typeof user.image === "string" ? user.image : null,
      },
    };
}

async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (payload as { error?: { message?: string } | string } | null)?.error &&
      typeof (payload as { error?: { message?: string } | string }).error === "object"
        ? ((payload as { error?: { message?: string } }).error?.message ?? `Request failed: ${res.status}`)
        : (payload as { error?: string } | null)?.error ?? `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return payload;
}

export const authApi = {
  getSession: async (): Promise<AuthSession | null> => {
    const res = await fetch("/api/auth/get-session", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) return null;
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Failed to load session (${res.status})`);
    }
    const direct = toSession(payload);
    if (direct) return direct;
    const nested = payload && typeof payload === "object" ? toSession((payload as Record<string, unknown>).data) : null;
    return nested;
  },

  signInEmail: async (input: { email: string; password: string }): Promise<{ twoFactorRedirect?: boolean }> => {
    const result = await authPost("/sign-in/email", input) as { twoFactorRedirect?: boolean } | null;
    return result ?? {};
  },

  signUpEmail: async (input: { name: string; email: string; password: string }) => {
    await authPost("/sign-up/email", input);
  },

  signOut: async () => {
    await authPost("/sign-out", {});
  },

  updateUser: async (data: { name?: string; image?: string | null }) => {
    await authPost("/update-user", data);
  },

  changePassword: async (data: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) => {
    await authPost("/change-password", data);
  },

  forgetPassword: async (email: string) => {
    // better-auth always returns 200 regardless of whether the email exists (prevents enumeration)
    await authPost("/request-password-reset", { email, redirectTo: "/auth" });
  },

  resetPassword: async (newPassword: string, token: string) => {
    await authPost("/reset-password", { newPassword, token });
  },

  /** 2FA — Enable: returns TOTP URI + backup codes */
  twoFactorEnable: async (password: string): Promise<{ totpURI: string; backupCodes: string[] }> => {
    return authPost("/two-factor/enable", { password }) as Promise<{ totpURI: string; backupCodes: string[] }>;
  },

  /** 2FA — Verify TOTP code to confirm setup (first call after enable) */
  twoFactorVerifyTotp: async (code: string): Promise<void> => {
    await authPost("/two-factor/verify-totp", { code, trustDevice: false });
  },

  /** 2FA — Disable */
  twoFactorDisable: async (password: string): Promise<void> => {
    await authPost("/two-factor/disable", { password });
  },

  /** 2FA — Get backup codes */
  twoFactorGetBackupCodes: async (password: string): Promise<{ backupCodes: string[] }> => {
    return authPost("/two-factor/get-backup-codes", { password }) as Promise<{ backupCodes: string[] }>;
  },
};
