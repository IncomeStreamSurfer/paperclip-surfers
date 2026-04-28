import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messagingApi } from "@/api/messaging";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import { Send, MessageSquare, Image, Check, X, Loader2, Copy, RefreshCw } from "lucide-react";
import type { MessagingMessageType, MessagingProvider } from "@paperclipai/shared";
import { useCompany } from "@/context/CompanyContext";

const MESSAGE_TYPES: { value: MessagingMessageType; label: string }[] = [
  { value: "new_issue", label: "New Issues" },
  { value: "issue_blocked", label: "Blocked Issues" },
  { value: "issue_completed", label: "Completed Issues" },
  { value: "run_hang", label: "Run Hang Alerts" },
  { value: "daily_digest", label: "Daily Digest" },
  { value: "weekly_report", label: "Weekly Report" },
];

function ProviderSection({
  provider,
  companyId,
}: {
  provider: MessagingProvider;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const providersQuery = useQuery({
    queryKey: queryKeys.messaging.providers(companyId),
    queryFn: () => messagingApi.listProviders(companyId),
  });

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.messaging.subscriptions(companyId),
    queryFn: () => messagingApi.listSubscriptions(companyId),
  });

  const upsertProvider = useMutation({
    mutationFn: (data: { enabled: boolean; config: Record<string, unknown> }) =>
      messagingApi.upsertProvider(companyId, { provider, enabled: data.enabled, config: data.config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.providers(companyId) });
      pushToast({ title: `${provider} settings saved`, tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Save failed", tone: "error" }),
  });

  const upsertSubscription = useMutation({
    mutationFn: (data: { messageType: MessagingMessageType; enabled: boolean; includeImage: boolean }) =>
      messagingApi.upsertSubscription(companyId, { provider, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.subscriptions(companyId) });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Save failed", tone: "error" }),
  });

  const providerRow = providersQuery.data?.find((p) => p.provider === provider);
  const isEnabled = providerRow?.enabled ?? false;
  const existingConfig = (providerRow?.config ?? {}) as Record<string, string>;

  const [botToken, setBotToken] = useState(existingConfig.botToken ?? "");
  const [chatId, setChatId] = useState(existingConfig.chatId ?? "");

  useEffect(() => {
    setBotToken(existingConfig.botToken ?? "");
    setChatId(existingConfig.chatId ?? "");
  }, [existingConfig.botToken, existingConfig.chatId]);

  const isTelegram = provider === "telegram";
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/telegram/${companyId}`
    : "";
  const webhookSecret = existingConfig.webhookSecret ?? "";

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast({ title: `${label} copied`, tone: "success" });
    } catch {
      pushToast({ title: "Copy failed", tone: "error" });
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold capitalize">{provider}</h2>
        </div>
        <button
          type="button"
          data-slot="toggle"
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            isEnabled ? "bg-green-600" : "bg-muted",
          )}
          onClick={() =>
            upsertProvider.mutate({
              enabled: !isEnabled,
              config: providerRow?.config ?? {},
            })
          }
          disabled={upsertProvider.isPending}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
              isEnabled ? "translate-x-4.5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {isEnabled && (
        <div className="space-y-4">
          {isTelegram && (
            <div className="space-y-3">
              {webhookUrl && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Webhook URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={webhookUrl}
                      readOnly
                      className="flex-1 rounded-md border border-input bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                      className="rounded-md border border-input p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Set this URL in Telegram via {" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">setWebhook</code>.
                  </p>
                </div>
              )}
              {webhookSecret && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Webhook Secret</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={webhookSecret}
                      readOnly
                      className="flex-1 rounded-md border border-input bg-muted px-3 py-1.5 text-sm text-muted-foreground font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(webhookSecret, "Webhook secret")}
                      className="rounded-md border border-input p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        upsertProvider.mutate({
                          enabled: true,
                          config: { ...existingConfig, botToken, chatId, webhookSecret: "" },
                        })
                      }
                      disabled={upsertProvider.isPending}
                      className="rounded-md border border-input p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", upsertProvider.isPending && "animate-spin")} />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pass this as {" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">secret_token</code> in {" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">setWebhook</code>.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Bot Token</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Chat ID</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="button"
                disabled={upsertProvider.isPending || !botToken || !chatId}
                onClick={() =>
                  upsertProvider.mutate({
                    enabled: true,
                    config: { botToken, chatId },
                  })
                }
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {upsertProvider.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Save & Verify
              </button>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notifications
            </h3>
            <div className="space-y-1">
              {MESSAGE_TYPES.map((mt) => {
                const sub = subscriptionsQuery.data?.find(
                  (s) => s.provider === provider && s.messageType === mt.value,
                );
                const subEnabled = sub?.enabled ?? false;
                const includeImage = sub?.includeImage ?? true;

                return (
                  <div
                    key={mt.value}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm">{mt.label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Include image"
                        className={cn(
                          "rounded p-1 transition-colors",
                          includeImage ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() =>
                          upsertSubscription.mutate({
                            messageType: mt.value,
                            enabled: subEnabled,
                            includeImage: !includeImage,
                          })
                        }
                      >
                        <Image className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-slot="toggle"
                        className={cn(
                          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
                          subEnabled ? "bg-green-600" : "bg-muted",
                        )}
                        onClick={() =>
                          upsertSubscription.mutate({
                            messageType: mt.value,
                            enabled: !subEnabled,
                            includeImage,
                          })
                        }
                      >
                        <span
                          className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform",
                            subEnabled ? "translate-x-3.5" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function MessagingSettings() {
  const { selectedCompanyId: companyId } = useCompany();

  if (!companyId) {
    return <div className="text-sm text-muted-foreground">Select a company to configure messaging.</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Messaging Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Configure Telegram and WhatsApp notifications for your team.
        </p>
      </div>

      <ProviderSection provider="telegram" companyId={companyId} />
      {/* WhatsApp section can be added here when implemented */}
    </div>
  );
}
