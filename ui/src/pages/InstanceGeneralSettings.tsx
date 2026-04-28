import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, ArrowLeft, Upload, Loader2, Image } from "lucide-react";
import { Link } from "@/lib/router";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { assetsApi } from "@/api/assets";
import { healthApi } from "@/api/health";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast, type ToastPosition } from "../context/ToastContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { ColorSchemaPicker } from "../components/ColorSchemaPicker";

const TOAST_POSITIONS: { value: ToastPosition; label: string; gridClass: string; dotClass: string }[] = [
  { value: "bottom-left",  label: "Bottom Left",  gridClass: "items-end justify-start",   dotClass: "" },
  { value: "bottom-right", label: "Bottom Right", gridClass: "items-end justify-end",     dotClass: "" },
  { value: "top-right",    label: "Top Right",    gridClass: "items-start justify-end",   dotClass: "" },
  { value: "center",       label: "Center",       gridClass: "items-center justify-center", dotClass: "" },
];

export function InstanceGeneralSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { toastPosition, setToastPosition, pushToast } = useToast();
  const { selectedCompanyId } = useCompany();

  const faviconInputRef = useRef<HTMLInputElement>(null);
  const appIconInputRef = useRef<HTMLInputElement>(null);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [appIconUploading, setAppIconUploading] = useState(false);
  const [siteTitle, setSiteTitle] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Settings" },
      { label: "General" },
    ]);
  }, [setBreadcrumbs]);

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });

  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    staleTime: 60_000,
  });

  // Sync siteTitle local state with server value once loaded
  useEffect(() => {
    if (generalQuery.data?.siteTitle != null) {
      setSiteTitle(generalQuery.data.siteTitle);
    }
  }, [generalQuery.data?.siteTitle]);

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      instanceSettingsApi.updateGeneral({ censorUsernameInLogs: enabled }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to update general settings.");
    },
  });

  const siteTitleMutation = useMutation({
    mutationFn: (title: string) => instanceSettingsApi.updateGeneral({ siteTitle: title }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.branding });
      pushToast({ title: "Site title saved", tone: "success" });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to save site title.");
    },
  });

  async function handleFaviconUpload(file: File) {
    if (!selectedCompanyId) {
      setActionError("No company selected — please select a company first.");
      return;
    }
    setFaviconUploading(true);
    try {
      const asset = await assetsApi.uploadImage(selectedCompanyId, file, "branding/icons");
      await instanceSettingsApi.updateGeneral({ faviconAssetId: asset.assetId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.branding });
      pushToast({ title: "Favicon updated", tone: "success" });
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload favicon.");
    } finally {
      setFaviconUploading(false);
    }
  }

  async function handleAppIconUpload(file: File) {
    if (!selectedCompanyId) {
      setActionError("No company selected — please select a company first.");
      return;
    }
    setAppIconUploading(true);
    try {
      const asset = await assetsApi.uploadImage(selectedCompanyId, file, "branding/icons");
      await instanceSettingsApi.updateGeneral({ appIconAssetId: asset.assetId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.branding });
      pushToast({ title: "App icon updated", tone: "success" });
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload app icon.");
    } finally {
      setAppIconUploading(false);
    }
  }

  if (generalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading general settings...</div>;
  }

  if (generalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {generalQuery.error instanceof Error
          ? generalQuery.error.message
          : "Failed to load general settings."}
      </div>
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;
  const savedSiteTitle = generalQuery.data?.siteTitle ?? "";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">General</h1>
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
          Configure instance-wide defaults that affect how operator-visible logs are displayed.
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">Censor username in logs</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Hide the username segment in home-directory paths and similar operator-visible log output. Standalone
              username mentions outside of paths are not yet masked in the live transcript view. This is off by
              default.
            </p>
          </div>
          <button
            type="button"
            data-slot="toggle"
            aria-label="Toggle username log censoring"
            disabled={toggleMutation.isPending}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              censorUsernameInLogs ? "bg-green-600" : "bg-muted",
            )}
            onClick={() => toggleMutation.mutate(!censorUsernameInLogs)}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                censorUsernameInLogs ? "translate-x-4.5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Site title</h2>
          <p className="text-sm text-muted-foreground">
            The browser tab title and app name shown throughout the interface.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={siteTitle}
            onChange={(e) => setSiteTitle(e.target.value)}
            placeholder="Paperclip"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            disabled={siteTitleMutation.isPending || siteTitle === savedSiteTitle}
            onClick={() => siteTitleMutation.mutate(siteTitle)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {siteTitleMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">App icons</h2>
          <p className="text-sm text-muted-foreground">
            Upload a favicon (browser tab icon) and home-screen app icon. PNG or ICO recommended.
            {!selectedCompanyId && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">Select a company to enable upload.</span>
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Favicon */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Favicon</span>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
                {generalQuery.data?.faviconAssetId ? (
                  <img
                    src={`/api/assets/${generalQuery.data.faviconAssetId}/content`}
                    alt="Current favicon"
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <Image className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFaviconUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={faviconUploading || !selectedCompanyId}
                onClick={() => faviconInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {faviconUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {faviconUploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          {/* App icon */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">App icon</span>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
                {generalQuery.data?.appIconAssetId ? (
                  <img
                    src={`/api/assets/${generalQuery.data.appIconAssetId}/content`}
                    alt="Current app icon"
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <Image className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <input
                ref={appIconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAppIconUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={appIconUploading || !selectedCompanyId}
                onClick={() => appIconInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {appIconUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {appIconUploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Color schema</h2>
          <p className="text-sm text-muted-foreground">
            Choose a color theme for the interface. Saved locally in this browser.
          </p>
        </div>
        <ColorSchemaPicker />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Notification position</h2>
          <p className="text-sm text-muted-foreground">
            Choose where toast notifications appear on screen. Saved locally in this browser.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TOAST_POSITIONS.map(({ value, label, gridClass }) => (
            <button
              key={value}
              type="button"
              aria-label={`Set notification position to ${label}`}
              onClick={() => {
                setToastPosition(value);
                pushToast({ title: `Notifications moved to ${label.toLowerCase()}`, tone: "info" });
              }}
              className={cn(
                "group relative flex h-20 w-full flex-col rounded-lg border-2 p-1.5 transition-colors",
                toastPosition === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40",
              )}
            >
              <div className={cn("flex flex-1 w-full", gridClass)}>
                <span
                  className={cn(
                    "h-3 w-8 rounded-sm",
                    toastPosition === value ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50",
                  )}
                />
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-none text-center w-full mt-1",
                toastPosition === value ? "text-primary" : "text-muted-foreground",
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {healthQuery.data?.version && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Version</span>
            <span className="font-mono text-sm text-muted-foreground">
              v{healthQuery.data.version}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
