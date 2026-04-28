import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { PriorityIcon } from "../components/PriorityIcon";
import { cn } from "../lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, GripHorizontal, Loader2, X } from "lucide-react";
import { Link } from "@/lib/router";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PanelEntry {
  id: string;       // unique panel id (allows same issue open twice, edge case)
  issueId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface FloatingIssuePanelsContextValue {
  openPanel: (issueId: string) => void;
}

const FloatingIssuePanelsContext =
  createContext<FloatingIssuePanelsContextValue | null>(null);

// ─── Single panel ─────────────────────────────────────────────────────────────

const MIN_W = 320;
const MIN_H = 280;
const DEFAULT_W = 500;
const DEFAULT_H = 500;

function FloatingIssuePanel({
  panel,
  onClose,
  onFocus,
  onUpdateGeometry,
}: {
  panel: PanelEntry;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onUpdateGeometry: (id: string, patch: Partial<Pick<PanelEntry, "x" | "y" | "width" | "height">>) => void;
}) {
  const issueQuery = useQuery({
    queryKey: queryKeys.issues.detail(panel.issueId),
    queryFn: () => issuesApi.get(panel.issueId),
  });

  const issue = issueQuery.data;
  const identifier = issue?.identifier ?? panel.issueId.slice(0, 8);

  // ── drag ──────────────────────────────────────────────────────────────────
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPanelX: number;
    startPanelY: number;
  } | null>(null);

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("a,button")) return;
      e.preventDefault();
      onFocus(panel.id);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanelX: panel.x,
        startPanelY: panel.y,
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const nx = dragRef.current.startPanelX + ev.clientX - dragRef.current.startX;
        const ny = dragRef.current.startPanelY + ev.clientY - dragRef.current.startY;
        onUpdateGeometry(panel.id, {
          x: Math.max(0, Math.min(nx, window.innerWidth - 60)),
          y: Math.max(0, Math.min(ny, window.innerHeight - 40)),
        });
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panel.id, panel.x, panel.y, onFocus, onUpdateGeometry],
  );

  // ── resize ────────────────────────────────────────────────────────────────
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus(panel.id);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: panel.width,
        startH: panel.height,
      };

      const onMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const nw = Math.max(MIN_W, resizeRef.current.startW + ev.clientX - resizeRef.current.startX);
        const nh = Math.max(MIN_H, resizeRef.current.startH + ev.clientY - resizeRef.current.startY);
        onUpdateGeometry(panel.id, { width: nw, height: nh });
      };

      const onUp = () => {
        resizeRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panel.id, panel.width, panel.height, onFocus, onUpdateGeometry],
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed flex flex-col rounded-lg border border-border bg-background shadow-xl overflow-hidden"
      style={{
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: panel.height,
        zIndex: panel.zIndex,
      }}
      onMouseDown={() => onFocus(panel.id)}
    >
      {/* Header / drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 cursor-grab active:cursor-grabbing select-none shrink-0"
        onMouseDown={onHeaderMouseDown}
      >
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <span className="font-mono text-xs text-muted-foreground shrink-0">{identifier}</span>
        <span className="text-sm font-medium truncate flex-1 min-w-0">
          {issue?.title ?? (issueQuery.isLoading ? "Loading…" : "Issue")}
        </span>
        {issue && (
          <Link
            to={`/issues/${issue.identifier ?? issue.id}`}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Open full detail"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
        <button
          type="button"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onClose(panel.id)}
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {issueQuery.isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {issueQuery.isError && (
          <p className="text-xs text-destructive py-4 text-center">Failed to load issue.</p>
        )}

        {issue && (
          <>
            {/* Status + priority row */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={issue.status} />
              <PriorityIcon priority={issue.priority} showLabel />
            </div>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {issue.labels.map((label) => (
                  <Badge
                    key={label.id}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                    style={{ backgroundColor: `${label.color}22`, color: label.color }}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {issue.description ? (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-border pt-3">
                {issue.description}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic border-t border-border pt-3">
                No description
              </p>
            )}
          </>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={onResizeMouseDown}
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%)",
        }}
      />
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let _panelSeq = 0;

const BASE_Z = 9000;
const CASCADE_OFFSET = 24;

export function FloatingIssuePanelsProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const maxZ = useRef(BASE_Z);

  const openPanel = useCallback((issueId: string) => {
    // If already open, just bring to front
    setPanels((prev) => {
      const existing = prev.find((p) => p.issueId === issueId);
      if (existing) {
        maxZ.current += 1;
        return prev.map((p) =>
          p.issueId === issueId ? { ...p, zIndex: maxZ.current } : p,
        );
      }
      const idx = prev.length;
      const offset = (idx % 8) * CASCADE_OFFSET;
      maxZ.current += 1;
      return [
        ...prev,
        {
          id: `panel-${++_panelSeq}`,
          issueId,
          x: 80 + offset,
          y: 80 + offset,
          width: DEFAULT_W,
          height: DEFAULT_H,
          zIndex: maxZ.current,
        },
      ];
    });
  }, []);

  const closePanel = useCallback((id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const focusPanel = useCallback((id: string) => {
    setPanels((prev) => {
      const panel = prev.find((p) => p.id === id);
      if (!panel || panel.zIndex === maxZ.current) return prev;
      maxZ.current += 1;
      return prev.map((p) => (p.id === id ? { ...p, zIndex: maxZ.current } : p));
    });
  }, []);

  const updateGeometry = useCallback(
    (id: string, patch: Partial<Pick<PanelEntry, "x" | "y" | "width" | "height">>) => {
      setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [],
  );

  return (
    <FloatingIssuePanelsContext.Provider value={{ openPanel }}>
      {children}
      {panels.length > 0 &&
        createPortal(
          <>
            {panels.map((panel) => (
              <FloatingIssuePanel
                key={panel.id}
                panel={panel}
                onClose={closePanel}
                onFocus={focusPanel}
                onUpdateGeometry={updateGeometry}
              />
            ))}
          </>,
          document.body,
        )}
    </FloatingIssuePanelsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFloatingIssuePanels() {
  const ctx = useContext(FloatingIssuePanelsContext);
  if (!ctx) throw new Error("useFloatingIssuePanels must be used within FloatingIssuePanelsProvider");
  return ctx;
}
