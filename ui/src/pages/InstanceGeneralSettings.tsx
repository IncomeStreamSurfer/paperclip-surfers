import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast, type ToastPosition } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

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

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">General</h1>
        </div>
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
    </div>
  );
}
