import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ArrowLeft, Send } from "lucide-react";
import { Link } from "@/lib/router";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import type { InstanceNotificationSettings } from "@paperclipai/shared";
import { EMAIL_TEMPLATE_IDS } from "@paperclipai/shared";

const TEMPLATE_LABELS: Record<string, string> = {
  clean:     "Clean",
  branded:   "Branded",
  dark:      "Dark",
  card:      "Card",
  corporate: "Corporate",
};

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  clean:     "Minimal white layout with a simple accent header line.",
  branded:   "Full-color header banner matching your brand color.",
  dark:      "Dark header/footer with a light card body.",
  card:      "Floating centered card on a soft background.",
  corporate: "Two-tone header with a structured footer.",
};

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      data-slot="toggle"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-green-600" : "bg-muted",
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="space-y-0.5 min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-56 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
    />
  );
}

export function InstanceNotificationsSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  // Local draft state
  const [draft, setDraft] = useState<Partial<InstanceNotificationSettings>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Settings" },
      { label: "Notifications" },
    ]);
  }, [setBreadcrumbs]);

  const query = useQuery({
    queryKey: queryKeys.instance.notificationSettings,
    queryFn: () => instanceSettingsApi.getNotifications(),
  });

  // Seed draft when data loads (only once)
  useEffect(() => {
    if (query.data && !dirty) {
      setDraft({
        enabled: query.data.enabled,
        notificationEmail: query.data.notificationEmail ?? "",
        emailProvider: query.data.emailProvider ?? "smtp",
        smtpHost: query.data.smtpHost ?? "",
        smtpPort: query.data.smtpPort ?? 587,
        smtpSecure: query.data.smtpSecure ?? false,
        smtpUser: query.data.smtpUser ?? "",
        smtpFrom: query.data.smtpFrom ?? "",
        // Never populate password from server (masked)
        smtpPassword: "",
        mailgunDomain: query.data.mailgunDomain ?? "",
        mailgunApiKey: "",
        sendgridApiKey: "",
        emailTemplate: query.data.emailTemplate ?? "clean",
        emailAppUrl: query.data.emailAppUrl ?? "",
      });
    }
  }, [query.data, dirty]);

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<InstanceNotificationSettings>) =>
      instanceSettingsApi.updateNotifications(patch),
    onSuccess: async () => {
      setSaveError(null);
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.notificationSettings });
    },
    onError: (err) => setSaveError(err instanceof Error ? err.message : "Failed to save"),
  });

  const testMutation = useMutation({
    mutationFn: (to: string) => instanceSettingsApi.testNotification(to),
    onSuccess: () => {
      setTestSuccess(true);
      setTestError(null);
      setTimeout(() => setTestSuccess(false), 3000);
    },
    onError: (err) => setTestError(err instanceof Error ? err.message : "Test failed"),
  });

  function set<K extends keyof InstanceNotificationSettings>(
    key: K,
    value: InstanceNotificationSettings[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    const patch: Partial<InstanceNotificationSettings> = { ...draft };
    // Only send secrets if user typed something
    if (!patch.smtpPassword) delete patch.smtpPassword;
    if (!patch.mailgunApiKey) delete patch.mailgunApiKey;
    if (!patch.sendgridApiKey) delete patch.sendgridApiKey;
    saveMutation.mutate(patch);
  }

  if (query.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading notification settings…</div>;
  }
  if (query.error) {
    return (
      <div className="text-sm text-destructive">
        {query.error instanceof Error ? query.error.message : "Failed to load notification settings."}
      </div>
    );
  }

  const enabled = draft.enabled ?? false;
  const provider = (draft.emailProvider as string) ?? "smtp";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Notifications</h1>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Business
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Configure email notifications for important events such as issues being blocked.
          Paperclip sends email via SMTP — you supply the credentials.
        </p>
      </div>

      {saveError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* Enable / disable */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <Field
          label="Enable email notifications"
          description="Master switch — no emails are sent while this is off."
        >
          <Toggle
            checked={enabled}
            onChange={(v) => set("enabled", v)}
            label="Toggle email notifications"
          />
        </Field>
      </section>

      {/* Recipient */}
      <section className={cn("rounded-xl border border-border bg-card p-5 space-y-4", !enabled && "opacity-50 pointer-events-none")}>
        <h2 className="text-sm font-semibold">Recipient</h2>
        <Field label="Notification email" description="Address that receives blocked-issue alerts.">
          <TextInput
            value={(draft.notificationEmail as string) ?? ""}
            onChange={(v) => set("notificationEmail", v)}
            placeholder="ops@example.com"
          />
        </Field>
      </section>

      {/* Email Provider */}
      <section className={cn("rounded-xl border border-border bg-card p-5 space-y-4", !enabled && "opacity-50 pointer-events-none")}>
        <h2 className="text-sm font-semibold">Email Provider</h2>
        <Field label="Provider" description="Choose how Paperclip sends emails.">
          <select
            value={provider}
            onChange={(e) => set("emailProvider", e.target.value as "smtp" | "mailgun" | "sendgrid")}
            className="w-40 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="smtp">Custom SMTP</option>
            <option value="mailgun">Mailgun</option>
            <option value="sendgrid">SendGrid</option>
          </select>
        </Field>
      </section>

      {/* Mailgun config */}
      {provider === "mailgun" && (
        <section className={cn("rounded-xl border border-border bg-card p-5 space-y-4", !enabled && "opacity-50 pointer-events-none")}>
          <h2 className="text-sm font-semibold">Mailgun</h2>
          <p className="text-xs text-muted-foreground">
            Sends via <code className="font-mono">smtp.mailgun.org:587</code>. Username defaults to <code className="font-mono">postmaster@&#123;domain&#125;</code>.
          </p>
          <Field label="Mailgun domain" description="Your Mailgun sending domain (e.g. mg.example.com).">
            <TextInput
              value={(draft.mailgunDomain as string) ?? ""}
              onChange={(v) => set("mailgunDomain", v)}
              placeholder="mg.example.com"
            />
          </Field>
          <Field label="API key" description="Mailgun API key (used as SMTP password). Leave blank to keep existing.">
            <TextInput
              type="password"
              value={(draft.mailgunApiKey as string) ?? ""}
              onChange={(v) => set("mailgunApiKey", v)}
              placeholder="key-••••••••"
            />
          </Field>
          <Field label="SMTP username override" description="Optional. Defaults to postmaster@domain.">
            <TextInput
              value={(draft.smtpUser as string) ?? ""}
              onChange={(v) => set("smtpUser", v)}
              placeholder="postmaster@mg.example.com"
            />
          </Field>
          <Field label="From address" description="Optional display address.">
            <TextInput
              value={(draft.smtpFrom as string) ?? ""}
              onChange={(v) => set("smtpFrom", v)}
              placeholder="Paperclip <noreply@mg.example.com>"
            />
          </Field>
        </section>
      )}

      {/* SendGrid config */}
      {provider === "sendgrid" && (
        <section className={cn("rounded-xl border border-border bg-card p-5 space-y-4", !enabled && "opacity-50 pointer-events-none")}>
          <h2 className="text-sm font-semibold">SendGrid</h2>
          <p className="text-xs text-muted-foreground">
            Sends via <code className="font-mono">smtp.sendgrid.net:587</code>. Username is always <code className="font-mono">apikey</code>.
          </p>
          <Field label="API key" description="SendGrid API key. Leave blank to keep existing.">
            <TextInput
              type="password"
              value={(draft.sendgridApiKey as string) ?? ""}
              onChange={(v) => set("sendgridApiKey", v)}
              placeholder="SG.••••••••"
            />
          </Field>
          <Field label="From address" description="Verified sender address or domain in SendGrid.">
            <TextInput
              value={(draft.smtpFrom as string) ?? ""}
              onChange={(v) => set("smtpFrom", v)}
              placeholder="Paperclip <noreply@example.com>"
            />
          </Field>
        </section>
      )}

      {/* SMTP config */}
      {provider === "smtp" && (
        <section className={cn("rounded-xl border border-border bg-card p-5 space-y-4", !enabled && "opacity-50 pointer-events-none")}>
          <h2 className="text-sm font-semibold">SMTP</h2>

        <Field label="Host" description="SMTP server hostname.">
          <TextInput
            value={(draft.smtpHost as string) ?? ""}
            onChange={(v) => set("smtpHost", v)}
            placeholder="smtp.example.com"
          />
        </Field>

        <Field label="Port" description="Default 587 (STARTTLS) or 465 (SSL).">
          <input
            type="number"
            value={(draft.smtpPort as number) ?? 587}
            onChange={(e) => set("smtpPort", Number(e.target.value))}
            min={1}
            max={65535}
            className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>

        <Field label="Secure (SSL/TLS)" description="Use TLS from the start (port 465). Off = STARTTLS.">
          <Toggle
            checked={(draft.smtpSecure as boolean) ?? false}
            onChange={(v) => set("smtpSecure", v)}
            label="Toggle SMTP secure"
          />
        </Field>

        <Field label="Username" description="SMTP auth username (often the sending address).">
          <TextInput
            value={(draft.smtpUser as string) ?? ""}
            onChange={(v) => set("smtpUser", v)}
            placeholder="noreply@example.com"
          />
        </Field>

        <Field label="Password" description="Leave blank to keep the existing password.">
          <TextInput
            type="password"
            value={(draft.smtpPassword as string) ?? ""}
            onChange={(v) => set("smtpPassword", v)}
            placeholder="••••••••"
          />
        </Field>

        <Field label="From address" description="Optional display address, defaults to username.">
          <TextInput
            value={(draft.smtpFrom as string) ?? ""}
            onChange={(v) => set("smtpFrom", v)}
            placeholder="Paperclip <noreply@example.com>"
          />
        </Field>
      </section>
      )}

      {/* Email Appearance */}
      <section className={cn("rounded-xl border border-border bg-card p-5 space-y-4", !enabled && "opacity-50 pointer-events-none")}>
        <h2 className="text-sm font-semibold">Email Appearance</h2>
        <p className="text-xs text-muted-foreground">
          Choose the HTML layout template used for all outgoing system emails.
        </p>

        <Field label="App URL" description="Public URL shown in email headers and footers (e.g. https://app.example.com).">
          <TextInput
            value={(draft.emailAppUrl as string) ?? ""}
            onChange={(v) => set("emailAppUrl", v || null)}
            placeholder="https://app.example.com"
          />
        </Field>

        <div>
          <p className="text-sm font-medium mb-2">Template</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EMAIL_TEMPLATE_IDS.map((id) => {
              const selected = (draft.emailTemplate ?? "clean") === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("emailTemplate", id)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-accent/30",
                  )}
                >
                  <span className="text-xs font-semibold">{TEMPLATE_LABELS[id]}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{TEMPLATE_DESCRIPTIONS[id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saveMutation.isPending}
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </button>
        {!dirty && !saveMutation.isPending && (
          <span className="text-xs text-muted-foreground">All changes saved</span>
        )}
      </div>

      {/* Test email */}
      <section className={cn("rounded-xl border border-border bg-card p-5 space-y-4", !enabled && "opacity-50 pointer-events-none")}>
        <h2 className="text-sm font-semibold">Send a test email</h2>
        <p className="text-sm text-muted-foreground">
          Verify your SMTP configuration by sending a test message. Save your SMTP settings first.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-56 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            disabled={!testEmail || testMutation.isPending}
            onClick={() => { setTestError(null); setTestSuccess(false); testMutation.mutate(testEmail); }}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
            {testMutation.isPending ? "Sending…" : "Send test"}
          </button>
          {testSuccess && <span className="text-xs text-green-600 dark:text-green-400">Email sent!</span>}
          {testError && <span className="text-xs text-destructive">{testError}</span>}
        </div>
      </section>
    </div>
  );
}
