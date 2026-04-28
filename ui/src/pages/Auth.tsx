import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { PixiAIAnimation } from "@/components/PixiAIAnimation";
import { Sparkles } from "lucide-react";

type AuthMode = "sign_in" | "sign_up" | "forgot" | "two_factor";

const inputCls =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { data: branding } = useQuery({
    queryKey: queryKeys.instance.branding,
    queryFn: () => instanceSettingsApi.getBranding(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const appName = branding?.siteTitle ?? "Paperclip";

  // When a reset token is present in the URL, show the set-new-password form
  const resetToken = searchParams.get("token") ?? null;
  const isResetMode = !!resetToken;

  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  // ── Sign in / sign up ───────────────────────────────────────────────────
  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        const result = await authApi.signInEmail({ email: email.trim(), password });
        if (result.twoFactorRedirect) return "two_factor" as const;
        return "done" as const;
      } else {
        await authApi.signUpEmail({ name: name.trim(), email: email.trim(), password });
        return "done" as const;
      }
    },
    onSuccess: async (result) => {
      setError(null);
      if (result === "two_factor") {
        setMode("two_factor");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Authentication failed");
    },
  });

  // ── 2FA verification ────────────────────────────────────────────────────
  const twoFactorMutation = useMutation({
    mutationFn: () => authApi.twoFactorVerifyTotp(totpCode.trim()),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Invalid code");
    },
  });

  // ── Forgot password ─────────────────────────────────────────────────────
  const forgotMutation = useMutation({
    mutationFn: () => authApi.forgetPassword(email.trim()),
    onSuccess: () => {
      setError(null);
      setInfo("If that email is registered, you'll receive a reset link shortly.");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    },
  });

  // ── Reset password ──────────────────────────────────────────────────────
  const resetMutation = useMutation({
    mutationFn: () => {
      if (!resetToken) throw new Error("Missing reset token");
      return authApi.resetPassword(password, resetToken);
    },
    onSuccess: () => {
      setError(null);
      setInfo("Password updated. You can now sign in.");
      // Clear token from URL so user can sign in normally
      navigate("/auth", { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    },
  });

  const canSubmitAuth =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === "sign_in" || (name.trim().length > 0 && password.trim().length >= 8));

  const canSubmitForgot = email.trim().length > 0;

  const canSubmitReset =
    password.trim().length >= 8 && password === confirmPassword;

  function switchMode(next: AuthMode) {
    setError(null);
    setInfo(null);
    setMode(next);
  }

  if (isSessionLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // ── Logo / app name header (reused in all modes) ─────────────────────────
  const logoHeader = (
    <div className="flex items-center gap-2 mb-8">
      {branding?.appIconUrl ? (
        <img src={branding.appIconUrl} alt={appName} className="h-5 w-5 rounded object-contain" />
      ) : (
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-sm font-medium">{appName}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Left half — form */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">

          {/* ── Reset password (token in URL) ────────────────────────── */}
          {isResetMode && (
            <>
              {logoHeader}
              <h1 className="text-xl font-semibold">Set a new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter a new password for your account.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (resetMutation.isPending) return;
                  if (!canSubmitReset) {
                    setError(password.length < 8 ? "Password must be at least 8 characters." : "Passwords do not match.");
                    return;
                  }
                  resetMutation.mutate();
                }}
              >
                <div>
                  <label htmlFor="new-password" className="text-xs text-muted-foreground mb-1 block">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    className={inputCls}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    minLength={8}
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="text-xs text-muted-foreground mb-1 block">Confirm password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className={inputCls}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                {info && <p className="text-xs text-green-600 dark:text-green-400">{info}</p>}
                <Button
                  type="submit"
                  disabled={resetMutation.isPending}
                  className={`w-full ${!canSubmitReset && !resetMutation.isPending ? "opacity-50" : ""}`}
                >
                  {resetMutation.isPending ? "Updating…" : "Update password"}
                </Button>
              </form>
              <div className="mt-5 text-sm text-muted-foreground">
                Remember it?{" "}
                <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => navigate("/auth", { replace: true })}>
                  Sign in
                </button>
              </div>
            </>
          )}

          {/* ── 2FA challenge ────────────────────────────────────────── */}
          {!isResetMode && mode === "two_factor" && (
            <>
              {logoHeader}
              <h1 className="text-xl font-semibold">Two-factor authentication</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (twoFactorMutation.isPending) return;
                  twoFactorMutation.mutate();
                }}
              >
                <div>
                  <label htmlFor="totp-code" className="text-xs text-muted-foreground mb-1 block">Authenticator code</label>
                  <input
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className={inputCls}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="000000"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  type="submit"
                  disabled={twoFactorMutation.isPending || totpCode.length !== 6}
                  className="w-full"
                >
                  {twoFactorMutation.isPending ? "Verifying…" : "Verify"}
                </Button>
              </form>
              <div className="mt-5 text-sm text-muted-foreground">
                <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => switchMode("sign_in")}>
                  Back to sign in
                </button>
              </div>
            </>
          )}

          {/* ── Forgot password ──────────────────────────────────────── */}
          {!isResetMode && mode === "forgot" && (
            <>
              {logoHeader}
              <h1 className="text-xl font-semibold">Reset your password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link if the account exists.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (forgotMutation.isPending) return;
                  forgotMutation.mutate();
                }}
              >
                <div>
                  <label htmlFor="forgot-email" className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    className={inputCls}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                {info && <p className="text-xs text-green-600 dark:text-green-400">{info}</p>}
                <Button
                  type="submit"
                  disabled={forgotMutation.isPending}
                  className={`w-full ${!canSubmitForgot && !forgotMutation.isPending ? "opacity-50" : ""}`}
                >
                  {forgotMutation.isPending ? "Sending…" : "Send reset link"}
                </Button>
              </form>
              <div className="mt-5 text-sm text-muted-foreground">
                Remembered it?{" "}
                <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => switchMode("sign_in")}>
                  Sign in
                </button>
              </div>
            </>
          )}

          {/* ── Sign in / Sign up ─────────────────────────────────────── */}
          {!isResetMode && mode !== "forgot" && mode !== "two_factor" && (
            <>
              {logoHeader}
              <h1 className="text-xl font-semibold">
                {mode === "sign_in" ? `Sign in to ${appName}` : `Create your ${appName} account`}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "sign_in"
                  ? "Use your email and password to access this instance."
                  : "Create an account for this instance. Email confirmation is not required in v1."}
              </p>

              <form
                className="mt-6 space-y-4"
                method="post"
                action={mode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (authMutation.isPending) return;
                  if (!canSubmitAuth) {
                    setError("Please fill in all required fields.");
                    return;
                  }
                  authMutation.mutate();
                }}
              >
                {mode === "sign_up" && (
                  <div>
                    <label htmlFor="name" className="text-xs text-muted-foreground mb-1 block">Name</label>
                    <input
                      id="name"
                      name="name"
                      className={inputCls}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      autoFocus
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <input
                    id="email"
                    name="email"
                    className={inputCls}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    autoFocus={mode === "sign_in"}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="text-xs text-muted-foreground">Password</label>
                    {mode === "sign_in" && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        onClick={() => switchMode("forgot")}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    name="password"
                    className={inputCls}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  type="submit"
                  disabled={authMutation.isPending}
                  aria-disabled={!canSubmitAuth || authMutation.isPending}
                  className={`w-full ${!canSubmitAuth && !authMutation.isPending ? "opacity-50" : ""}`}
                >
                  {authMutation.isPending
                    ? "Working…"
                    : mode === "sign_in"
                      ? "Sign In"
                      : "Create Account"}
                </Button>
              </form>

              <div className="mt-5 text-sm text-muted-foreground">
                {mode === "sign_in" ? "Need an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-2"
                  onClick={() => switchMode(mode === "sign_in" ? "sign_up" : "sign_in")}
                >
                  {mode === "sign_in" ? "Create one" : "Sign in"}
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Right half — branded panel (hidden on mobile) */}
      <div className="hidden md:flex w-1/2 overflow-hidden flex-col items-center justify-center relative"
           style={{ background: "linear-gradient(135deg, #05091a 0%, #0d1a3a 100%)" }}>
        {/* Pixi animation fills the panel */}
        <PixiAIAnimation />
        {/* Overlay: icon + name if branded, otherwise nothing extra */}
        {branding?.appIconUrl && (
          <div className="relative z-10 flex flex-col items-center gap-4 pointer-events-none">
            <img
              src={branding.appIconUrl}
              alt={appName}
              className="h-24 w-24 rounded-2xl object-contain shadow-lg"
            />
            <span className="text-2xl font-semibold text-white drop-shadow">{appName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
