import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Plus, X, Globe, ChevronUp, ChevronDown } from "lucide-react";
import { authApi } from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";
import {
  useTimezones,
  getAllTimezones,
  searchTimezones,
  formatTzTime,
} from "@/hooks/useTimezones";

/** Ticking clock that re-renders every second. */
function useTick() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Format local time HH:MM:SS */
function formatLocal(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function HeaderClock() {
  const now = useTick();
  const { timezones, addTimezone, removeTimezone, moveTimezone } = useTimezones();

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const userName = session?.user?.name ?? session?.user?.email ?? null;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handler(e: MouseEvent) {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverOpen]);

  const allTz = getAllTimezones();
  const cityResults = search ? searchTimezones(search, 80) : null;
  const addedTzSet = new Set(timezones.map((t) => t.tz));

  return (
    <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-border/60">
      {/* Extra timezone pills — first 3 only */}
      {timezones.length > 0 && (
        <div className="hidden lg:flex items-center gap-2">
          {timezones.slice(0, 3).map((entry) => (
            <div
              key={entry.id}
              className="group relative flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-xs font-mono hover:bg-muted transition-colors"
              title={entry.tz}
            >
              <span className="text-muted-foreground text-[10px] font-sans font-medium mr-0.5">{entry.label}</span>
              <span className="tabular-nums">{formatTzTime(entry.tz, now)}</span>
              <button
                onClick={() => removeTimezone(entry.id)}
                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {timezones.length > 3 && (
            <span className="text-[10px] text-muted-foreground/60" title={`${timezones.length - 3} more in World Clock widget`}>
              +{timezones.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Local clock */}
      <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="tabular-nums">{formatLocal(now)}</span>
      </div>

      {/* Add timezone button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => { setPopoverOpen((v) => !v); setSearch(""); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1 py-0.5 hover:bg-muted/60"
          title="Manage Time Zones"
        >
          <Globe className="h-3.5 w-3.5" />
          <Plus className="h-3 w-3" />
        </button>

        {popoverOpen && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-popover shadow-lg text-sm"
          >
            <div className="p-3 border-b border-border">
              <p className="text-xs font-semibold mb-2">Add Time Zone</p>
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cities or regions…"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {timezones.length > 0 && (
              <div className="p-3 border-b border-border space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Active</p>
                {timezones.map((entry, idx) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex flex-col gap-px shrink-0">
                      <button
                        onClick={() => moveTimezone(entry.id, "up")}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default leading-none"
                        title="Move up"
                      >
                        <ChevronUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => moveTimezone(entry.id, "down")}
                        disabled={idx === timezones.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default leading-none"
                        title="Move down"
                      >
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <span className="font-medium flex-1">{entry.label}</span>
                    <span className="font-mono text-muted-foreground tabular-nums">{formatTzTime(entry.tz, now)}</span>
                    <button
                      onClick={() => removeTimezone(entry.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-h-56 overflow-y-auto">
              {cityResults !== null ? (
                // City-mapped search results (supports "Barcelona", "Milan", etc.)
                cityResults.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">No results</p>
                ) : (
                  cityResults.map((r) => {
                    const isAdded = addedTzSet.has(r.tz);
                    return (
                      <button
                        key={`${r.label}|${r.tz}`}
                        disabled={isAdded}
                        onClick={() => { addTimezone(r.tz, r.label); setSearch(""); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-40 disabled:cursor-default transition-colors text-left"
                      >
                        {r.flag && <span className="text-sm shrink-0">{r.flag}</span>}
                        <span className="flex-1 truncate">
                          <span className="font-medium">{r.label}</span>
                          {r.country && (
                            <span className="text-muted-foreground ml-1">{r.country}</span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-muted-foreground tabular-nums ml-2">
                          {formatTzTime(r.tz, now)}
                        </span>
                        {isAdded && <span className="text-[10px] text-muted-foreground shrink-0">added</span>}
                      </button>
                    );
                  })
                )
              ) : (
                // No query — show raw IANA zone list
                allTz.slice(0, 80).map((tz) => {
                  const isAdded = addedTzSet.has(tz);
                  return (
                    <button
                      key={tz}
                      disabled={isAdded}
                      onClick={() => { addTimezone(tz); setSearch(""); }}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-40 disabled:cursor-default transition-colors"
                    >
                      <span className="truncate text-left">{tz.replace(/_/g, " ")}</span>
                      <span className="shrink-0 font-mono text-muted-foreground tabular-nums ml-2">
                        {formatTzTime(tz, now)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Divider + logged-in user */}
      {userName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground hidden sm:flex">
          <span className="text-border/80">|</span>
          <span>
            Logged in as{" "}
            <span className="font-medium text-foreground">{userName}</span>
          </span>
        </div>
      )}
    </div>
  );
}
