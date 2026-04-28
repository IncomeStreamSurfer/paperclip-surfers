import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Camera, Loader2, ShieldCheck, ShieldOff, MonitorSmartphone, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { authApi } from "../api/auth";
import { userProfileApi, type UserPreferences, type UserSessionInfo } from "../api/userProfile";
import { queryKeys } from "../lib/queryKeys";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EmailDigest = "none" | "daily" | "weekly";
type TwoFaStep = "idle" | "password_prompt" | "qr" | "backup_codes" | "disable_prompt";

// Common IANA timezone list (curated subset)
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Honolulu",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Mexico_City",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Fiji",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "nl", label: "Nederlands" },
  { value: "ru", label: "Русский" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "ar", label: "العربية" },
  { value: "hi", label: "हिन्दी" },
  { value: "tr", label: "Türkçe" },
  { value: "pl", label: "Polski" },
  { value: "sv", label: "Svenska" },
];

const LOGIN_TIMEOUT_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Never", value: null },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "4 hours", value: 240 },
  { label: "8 hours", value: 480 },
  { label: "24 hours", value: 1440 },
];

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatUA(ua: string | null) {
  if (!ua) return "Unknown device";
  // Simple extraction of browser + OS from UA string
  const browser = /Chrome\/[\d.]+/.test(ua) ? "Chrome" :
    /Firefox\/[\d.]+/.test(ua) ? "Firefox" :
    /Safari\/[\d.]+/.test(ua) ? "Safari" :
    /Edg\/[\d.]+/.test(ua) ? "Edge" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" : "Unknown OS";
  return `${browser} on ${os}`;
}

export function ProfilePage() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Profile" }]);
  }, [setBreadcrumbs]);

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
    staleTime: 30_000,
  });

  const user = sessionQuery.data?.user ?? null;

  // --- Display name ---
  const [name, setName] = useState("");
  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const updateNameMutation = useMutation({
    mutationFn: () => authApi.updateUser({ name: name.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      pushToast({ title: "Name updated", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  // --- Avatar ---
  const updateAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await authApi.updateUser({ image: dataUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      pushToast({ title: "Avatar updated", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => authApi.updateUser({ image: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      pushToast({ title: "Avatar removed", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  // --- Change password ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      pushToast({ title: "Password changed", tone: "success" });
    },
    onError: (err: Error) => {
      setPasswordError(err.message);
    },
  });

  function handleChangePassword() {
    setPasswordError(null);
    if (!currentPassword) { setPasswordError("Current password is required"); return; }
    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); return; }
    changePasswordMutation.mutate();
  }

  // --- Extended profile (bio, phone, job title, location) ---
  const profileQuery = useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: () => userProfileApi.get(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setBio(profileQuery.data.bio ?? "");
      setPhone(profileQuery.data.phone ?? "");
      setJobTitle(profileQuery.data.jobTitle ?? "");
      setLocation(profileQuery.data.location ?? "");
    }
  }, [profileQuery.data]);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      userProfileApi.update({
        bio: bio.trim() || null,
        phone: phone.trim() || null,
        jobTitle: jobTitle.trim() || null,
        location: location.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
      pushToast({ title: "Profile updated", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  // --- Preferences (timezone, language, clock format, notification opt-outs) ---
  const [timezone, setTimezone] = useState("UTC");
  const [language, setLanguage] = useState("en");
  const [clock24h, setClock24h] = useState(true);
  const [notifEmailOnBlocked, setNotifEmailOnBlocked] = useState(true);
  const [notifEmailOnMention, setNotifEmailOnMention] = useState(true);
  const [notifEmailOnAssigned, setNotifEmailOnAssigned] = useState(true);
  const [notifEmailDigest, setNotifEmailDigest] = useState<EmailDigest>("none");

  useEffect(() => {
    const p = profileQuery.data?.preferences;
    if (!p) return;
    setTimezone(p.timezone ?? "UTC");
    setLanguage(p.language ?? "en");
    setClock24h(p.clock24h ?? true);
    const n = p.notifications;
    if (n) {
      setNotifEmailOnBlocked(n.emailOnBlocked ?? true);
      setNotifEmailOnMention(n.emailOnMention ?? true);
      setNotifEmailOnAssigned(n.emailOnAssigned ?? true);
      setNotifEmailDigest((n.emailDigest ?? "none") as EmailDigest);
    }
  }, [profileQuery.data]);

  const updatePreferencesMutation = useMutation({
    mutationFn: () => {
      const prefs: UserPreferences = {
        timezone,
        language,
        clock24h,
        notifications: {
          emailOnBlocked: notifEmailOnBlocked,
          emailOnMention: notifEmailOnMention,
          emailOnAssigned: notifEmailOnAssigned,
          emailDigest: notifEmailDigest,
        },
      };
      return userProfileApi.update({ preferences: prefs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
      pushToast({ title: "Preferences saved", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  // --- Security: login timeout ---
  const [loginTimeout, setLoginTimeout] = useState<number | null>(null);

  useEffect(() => {
    const s = profileQuery.data?.preferences?.security;
    if (!s) return;
    setLoginTimeout(s.loginTimeoutMinutes ?? null);
  }, [profileQuery.data]);

  const saveTimeoutMutation = useMutation({
    mutationFn: () =>
      userProfileApi.update({
        preferences: {
          timezone,
          language,
          notifications: {
            emailOnBlocked: notifEmailOnBlocked,
            emailOnMention: notifEmailOnMention,
            emailOnAssigned: notifEmailOnAssigned,
            emailDigest: notifEmailDigest,
          },
          security: { loginTimeoutMinutes: loginTimeout },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
      pushToast({ title: "Login timeout saved", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  // --- Security: 2FA ---
  const [twoFaStep, setTwoFaStep] = useState<TwoFaStep>("idle");
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaQrUrl, setTwoFaQrUrl] = useState<string | null>(null);
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([]);
  const [twoFaError, setTwoFaError] = useState<string | null>(null);

  const twoFaEnabled = user?.twoFactorEnabled ?? false;

  const twoFaEnableMutation = useMutation({
    mutationFn: () => authApi.twoFactorEnable(twoFaPassword),
    onSuccess: async (data) => {
      setTwoFaError(null);
      setTwoFaBackupCodes(data.backupCodes);
      try {
        const qrUrl = await QRCode.toDataURL(data.totpURI, { width: 200, margin: 1 });
        setTwoFaQrUrl(qrUrl);
      } catch {
        setTwoFaQrUrl(null);
      }
      setTwoFaPassword("");
      setTwoFaStep("qr");
    },
    onError: (err: Error) => setTwoFaError(err.message),
  });

  const twoFaVerifyMutation = useMutation({
    mutationFn: () => authApi.twoFactorVerifyTotp(twoFaCode.trim()),
    onSuccess: () => {
      setTwoFaError(null);
      setTwoFaCode("");
      setTwoFaStep("backup_codes");
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
    },
    onError: (err: Error) => setTwoFaError(err.message),
  });

  const twoFaDisableMutation = useMutation({
    mutationFn: () => authApi.twoFactorDisable(twoFaPassword),
    onSuccess: () => {
      setTwoFaError(null);
      setTwoFaPassword("");
      setTwoFaStep("idle");
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      pushToast({ title: "Two-factor authentication disabled", tone: "success" });
    },
    onError: (err: Error) => setTwoFaError(err.message),
  });

  function resetTwoFa() {
    setTwoFaStep("idle");
    setTwoFaPassword("");
    setTwoFaCode("");
    setTwoFaQrUrl(null);
    setTwoFaBackupCodes([]);
    setTwoFaError(null);
  }

  // --- Security: sessions ---
  const sessionsQuery = useQuery({
    queryKey: queryKeys.userSessions,
    queryFn: () => userProfileApi.listSessions(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => userProfileApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userSessions });
      pushToast({ title: "Session revoked", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  if (sessionQuery.isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="max-w-lg py-10">
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Profile management is only available in authenticated mode.
        </div>
      </div>
    );
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const currentSessionId = sessionQuery.data?.session.id;
  const sessions: UserSessionInfo[] = sessionsQuery.data?.sessions ?? [];

  return (
    <div className="max-w-lg space-y-8 py-4">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Avatar */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Avatar</h2>
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updateAvatarMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <button
              className="h-16 w-16 rounded-full overflow-hidden relative border border-border"
              onClick={() => avatarInputRef.current?.click()}
              title="Change avatar"
              disabled={updateAvatarMutation.isPending}
            >
              {updateAvatarMutation.isPending ? (
                <span className="flex h-full w-full items-center justify-center bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </span>
              ) : user.image ? (
                <img src={user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-muted text-lg font-semibold text-muted-foreground">
                  {initials || <User className="h-6 w-6" />}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <Camera className="h-4 w-4 text-white" />
              </span>
            </button>
          </div>
          <div className="space-y-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => avatarInputRef.current?.click()}
              disabled={updateAvatarMutation.isPending}
            >
              Upload photo
            </Button>
            {user.image && (
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive text-xs h-7"
                  onClick={() => removeAvatarMutation.mutate()}
                  disabled={removeAvatarMutation.isPending}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Display name */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Display name</h2>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") updateNameMutation.mutate(); }}
          />
          <Button
            size="sm"
            onClick={() => updateNameMutation.mutate()}
            disabled={updateNameMutation.isPending || !name.trim() || name.trim() === user.name}
          >
            {updateNameMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </section>

      {/* Email (read-only) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Email</h2>
        <Input value={user.email ?? ""} readOnly className="text-muted-foreground" />
      </section>

      {/* Change password */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Change password</h2>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {passwordError && (
            <p className="text-xs text-destructive">{passwordError}</p>
          )}
          <Button
            size="sm"
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Change password
          </Button>
        </div>
      </section>

      {/* Bio & contact */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Bio &amp; contact</h2>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Job title</label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Engineer"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Location</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, CA"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio about yourself…"
              maxLength={500}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{bio.length}/500</p>
          </div>
          <Button
            size="sm"
            onClick={() => updateProfileMutation.mutate()}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Save profile
          </Button>
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Preferences</h2>
        <div className="space-y-4">
          {/* Timezone */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={selectCls}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={selectCls}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Clock format */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={clock24h}
                onChange={(e) => setClock24h(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">24-hour clock</span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">
              Uncheck to show AM/PM format in the header clock.
            </p>
          </div>

          {/* Email notification opt-outs */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Email notifications</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifEmailOnBlocked}
                  onChange={(e) => setNotifEmailOnBlocked(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm">Issue blocked</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifEmailOnMention}
                  onChange={(e) => setNotifEmailOnMention(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm">Mentioned in a comment</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifEmailOnAssigned}
                  onChange={(e) => setNotifEmailOnAssigned(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm">Issue assigned to me</span>
              </label>
            </div>
          </div>

          {/* Summary digest */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Summary digest</label>
            <select
              value={notifEmailDigest}
              onChange={(e) => setNotifEmailDigest(e.target.value as EmailDigest)}
              className={selectCls}
            >
              <option value="none">No digest</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <Button
            size="sm"
            onClick={() => updatePreferencesMutation.mutate()}
            disabled={updatePreferencesMutation.isPending}
          >
            {updatePreferencesMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Save preferences
          </Button>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <h2 className="text-sm font-semibold">Security</h2>

        {/* Login timeout */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground block">Session timeout</label>
          <p className="text-xs text-muted-foreground">
            Automatically sign out after this period of inactivity.
          </p>
          <div className="flex gap-2 items-center">
            <select
              value={loginTimeout === null ? "null" : String(loginTimeout)}
              onChange={(e) => {
                const v = e.target.value;
                setLoginTimeout(v === "null" ? null : Number(v));
              }}
              className={selectCls + " max-w-[200px]"}
            >
              {LOGIN_TIMEOUT_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value === null ? "null" : String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => saveTimeoutMutation.mutate()}
              disabled={saveTimeoutMutation.isPending}
            >
              {saveTimeoutMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        {/* Two-factor authentication */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {twoFaEnabled
                ? <ShieldCheck className="h-4 w-4 text-green-500" />
                : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm font-medium">Two-factor authentication</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${twoFaEnabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
              {twoFaEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {twoFaEnabled
              ? "Your account is protected with a time-based one-time password."
              : "Add an extra layer of security by requiring a code from your authenticator app on sign-in."}
          </p>

          {/* Idle state */}
          {twoFaStep === "idle" && (
            <Button
              size="sm"
              variant={twoFaEnabled ? "outline" : "default"}
              onClick={() => { setTwoFaError(null); setTwoFaStep("password_prompt"); }}
            >
              {twoFaEnabled ? "Disable 2FA" : "Enable 2FA"}
            </Button>
          )}

          {/* Password prompt (enable or disable) */}
          {twoFaStep === "password_prompt" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {twoFaEnabled ? "Enter your password to disable 2FA." : "Enter your password to begin setup."}
              </p>
              <Input
                type="password"
                placeholder="Your current password"
                value={twoFaPassword}
                onChange={(e) => setTwoFaPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
              />
              {twoFaError && <p className="text-xs text-destructive">{twoFaError}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setTwoFaError(null);
                    if (twoFaEnabled) {
                      twoFaDisableMutation.mutate();
                    } else {
                      twoFaEnableMutation.mutate();
                    }
                  }}
                  disabled={!twoFaPassword || twoFaEnableMutation.isPending || twoFaDisableMutation.isPending}
                >
                  {(twoFaEnableMutation.isPending || twoFaDisableMutation.isPending)
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : twoFaEnabled ? "Disable" : "Continue"}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetTwoFa}>Cancel</Button>
              </div>
            </div>
          )}

          {/* QR code + TOTP verify step */}
          {twoFaStep === "qr" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy), then enter the 6-digit code to confirm.
              </p>
              {twoFaQrUrl && (
                <div className="w-fit rounded-lg border border-border p-2 bg-white">
                  <img src={twoFaQrUrl} alt="TOTP QR code" className="w-48 h-48" />
                </div>
              )}
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
                className="max-w-[140px]"
              />
              {twoFaError && <p className="text-xs text-destructive">{twoFaError}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { setTwoFaError(null); twoFaVerifyMutation.mutate(); }}
                  disabled={twoFaCode.length !== 6 || twoFaVerifyMutation.isPending}
                >
                  {twoFaVerifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify & activate"}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetTwoFa}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Backup codes */}
          {twoFaStep === "backup_codes" && (
            <div className="space-y-3">
              <p className="text-xs font-medium">2FA enabled! Save your backup codes.</p>
              <p className="text-xs text-muted-foreground">
                Store these codes somewhere safe. Each can be used once to sign in if you lose access to your authenticator.
              </p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-xs bg-muted rounded-md p-3">
                {twoFaBackupCodes.map((c) => (
                  <span key={c} className="tracking-wider">{c}</span>
                ))}
              </div>
              <Button size="sm" onClick={resetTwoFa}>Done</Button>
            </div>
          )}
        </div>

        {/* Active sessions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Active sessions</label>
            {sessionsQuery.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          {sessions.length === 0 && !sessionsQuery.isFetching && (
            <p className="text-xs text-muted-foreground">No active sessions found.</p>
          )}
          <div className="space-y-2">
            {sessions.map((s) => {
              const isCurrent = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <MonitorSmartphone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{formatUA(s.userAgent)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.ipAddress && <span>{s.ipAddress} · </span>}
                        Started {formatSessionDate(s.createdAt)}
                        {" · "}Expires {formatSessionDate(s.expiresAt)}
                      </p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                      Current
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-7 px-2 shrink-0"
                      onClick={() => revokeSessionMutation.mutate(s.id)}
                      disabled={revokeSessionMutation.isPending}
                      title="Revoke session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
