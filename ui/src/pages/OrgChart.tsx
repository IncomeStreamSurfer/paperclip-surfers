import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { departmentsApi, type DepartmentWithAgents } from "../api/departments";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { agentUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentIcon } from "../components/AgentIconPicker";
import { Download, Network, RotateCcw, Upload } from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@paperclipai/shared";

// Layout constants
const CARD_W = 200;
const CARD_H = 100;
const GAP_X = 32;
const GAP_Y = 80;
const PADDING = 60;
const DRAG_THRESHOLD = 4; // px before a card mousedown becomes a drag

// ── Persistent node offsets (manual position overrides) ─────────────────

type NodeOffset = { dx: number; dy: number };
type OffsetMap = Map<string, NodeOffset>;

const offsetStorageKey = (companyId: string) => `paperclip_org_positions_v1_${companyId}`;

function loadOffsets(companyId: string): OffsetMap {
  try {
    const raw = localStorage.getItem(offsetStorageKey(companyId));
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, NodeOffset>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveOffsets(companyId: string, offsets: OffsetMap) {
  try {
    localStorage.setItem(
      offsetStorageKey(companyId),
      JSON.stringify(Object.fromEntries(offsets)),
    );
  } catch {
    // storage unavailable
  }
}

// ── Tree layout types ───────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  name: string;
  role: string;
  status: string;
  x: number;
  y: number;
  children: LayoutNode[];
}

// ── Layout algorithm ────────────────────────────────────────────────────

/** Compute the width each subtree needs. */
function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(CARD_W, childrenW + gaps);
}

/** Recursively assign x,y positions. */
function layoutTree(node: OrgNode, x: number, y: number): LayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + CARD_H + GAP_Y));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    status: node.status,
    x: x + (totalW - CARD_W) / 2,
    y,
    children: layoutChildren,
  };
}

/** Layout all root nodes side by side. */
function layoutForest(roots: OrgNode[]): LayoutNode[] {
  if (roots.length === 0) return [];

  const totalW = roots.reduce((sum, r) => sum + subtreeWidth(r), 0);
  const gaps = (roots.length - 1) * GAP_X;
  let x = PADDING;
  const y = PADDING;

  const result: LayoutNode[] = [];
  for (const root of roots) {
    const w = subtreeWidth(root);
    result.push(layoutTree(root, x, y));
    x += w + GAP_X;
  }

  void gaps; // used in subtreeWidth, unused here
  return result;
}

/** Flatten layout tree to list of nodes. */
function flattenLayout(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

/** Collect all parent→child edges. */
function collectEdges(nodes: LayoutNode[]): Array<{ parent: LayoutNode; child: LayoutNode }> {
  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

// ── Status dot colors (raw hex for SVG) ─────────────────────────────────

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  gemini_local: "Gemini",
  opencode_local: "OpenCode",
  cursor: "Cursor",
  hermes_local: "Hermes",
  openclaw_gateway: "OpenClaw Gateway",
  process: "Process",
  http: "HTTP",
};

const statusDotColor: Record<string, string> = {
  running: "#22d3ee",
  active: "#4ade80",
  paused: "#facc15",
  idle: "#facc15",
  error: "#f87171",
  terminated: "#a3a3a3",
};
const defaultDotColor = "#a3a3a3";

// ── Main component ──────────────────────────────────────────────────────

export function OrgChart() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  const { data: orgTree, isLoading } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  const { data: deptsData } = useQuery({
    queryKey: [...queryKeys.departments.list(selectedCompanyId!), "withAgents"],
    queryFn: () => departmentsApi.list(selectedCompanyId!, true),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Org Chart" }]);
  }, [setBreadcrumbs]);

  // ── Node offsets (manual position overrides) ─────────────────────────

  const [nodeOffsets, setNodeOffsets] = useState<OffsetMap>(() =>
    selectedCompanyId ? loadOffsets(selectedCompanyId) : new Map(),
  );

  // Reload offsets when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      setNodeOffsets(loadOffsets(selectedCompanyId));
    }
  }, [selectedCompanyId]);

  // ── Base layout ──────────────────────────────────────────────────────

  const layout = useMemo(() => layoutForest(orgTree ?? []), [orgTree]);
  const baseNodes = useMemo(() => flattenLayout(layout), [layout]);

  // Apply offsets on top of computed positions
  const allNodes = useMemo(() => {
    return baseNodes.map((node) => {
      const off = nodeOffsets.get(node.id);
      if (!off) return node;
      return { ...node, x: node.x + off.dx, y: node.y + off.dy };
    });
  }, [baseNodes, nodeOffsets]);

  // Edges use the offset-adjusted positions so they always follow their cards
  const edges = useMemo(() => collectEdges(layout).map(({ parent, child }) => {
    const p = allNodes.find((n) => n.id === parent.id) ?? parent;
    const c = allNodes.find((n) => n.id === child.id) ?? child;
    return { parent: p, child: c };
  }), [layout, allNodes]);

  const PADDING_DEPT = 20;
  const deptBoxes = useMemo(() => {
    const deps = (deptsData?.departments ?? []) as DepartmentWithAgents[];
    if (!allNodes.length) return [];
    const nodeById = new Map(allNodes.map((n) => [n.id, n]));

    return deps
      .map((dept) => {
        const members = dept.agents
          .map((a) => nodeById.get(a.agentId))
          .filter((n): n is typeof allNodes[0] => n !== undefined);

        if (members.length === 0) return null;

        const minX = Math.min(...members.map((n) => n.x)) - PADDING_DEPT;
        const minY = Math.min(...members.map((n) => n.y)) - PADDING_DEPT - 20;
        const maxX = Math.max(...members.map((n) => n.x + CARD_W)) + PADDING_DEPT;
        const maxY = Math.max(...members.map((n) => n.y + CARD_H)) + PADDING_DEPT;

        return {
          id: dept.id,
          name: dept.name,
          color: dept.color ?? "#6366f1",
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [allNodes, deptsData]);

  // Compute SVG bounds (based on offset-adjusted positions)
  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0, maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + CARD_W);
      maxY = Math.max(maxY, n.y + CARD_H);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes]);

  // ── Pan & zoom state ─────────────────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [canvasDragging, setCanvasDragging] = useState(false);
  const canvasDragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // ── Card drag state ──────────────────────────────────────────────────

  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const cardDragStart = useRef<{
    mouseX: number;
    mouseY: number;
    origDx: number;
    origDy: number;
  } | null>(null);
  // Track whether pointer moved enough to count as a drag (vs click-to-navigate)
  const cardDragMoved = useRef(false);

  // Center the chart on first load
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current || allNodes.length === 0 || !containerRef.current) return;
    hasInitialized.current = true;

    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const scaleX = (containerW - 40) / bounds.width;
    const scaleY = (containerH - 40) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);

    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;

    setZoom(fitZoom);
    setPan({
      x: (containerW - chartW) / 2,
      y: (containerH - chartH) / 2,
    });
  }, [allNodes, bounds]);

  // ── Event handlers ───────────────────────────────────────────────────

  // Canvas mousedown — only starts pan if not on a card (cards use stopPropagation)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setCanvasDragging(true);
      canvasDragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan],
  );

  // Card mousedown — start card drag, stop propagation to avoid triggering canvas pan
  const handleCardMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      cardDragMoved.current = false;
      cardDragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        origDx: nodeOffsets.get(nodeId)?.dx ?? 0,
        origDy: nodeOffsets.get(nodeId)?.dy ?? 0,
      };
      setDraggingCardId(nodeId);
    },
    [nodeOffsets],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Card dragging takes priority
      if (draggingCardId && cardDragStart.current) {
        const rawDx = e.clientX - cardDragStart.current.mouseX;
        const rawDy = e.clientY - cardDragStart.current.mouseY;
        if (Math.abs(rawDx) > DRAG_THRESHOLD || Math.abs(rawDy) > DRAG_THRESHOLD) {
          cardDragMoved.current = true;
        }
        if (cardDragMoved.current) {
          // Convert mouse delta to canvas space (account for zoom)
          const dx = rawDx / zoom + cardDragStart.current.origDx;
          const dy = rawDy / zoom + cardDragStart.current.origDy;
          setNodeOffsets((prev) => {
            const next = new Map(prev);
            next.set(draggingCardId, { dx, dy });
            return next;
          });
        }
        return;
      }

      // Canvas panning
      if (!canvasDragging) return;
      const dx = e.clientX - canvasDragStart.current.x;
      const dy = e.clientY - canvasDragStart.current.y;
      setPan({ x: canvasDragStart.current.panX + dx, y: canvasDragStart.current.panY + dy });
    },
    [draggingCardId, canvasDragging, zoom],
  );

  const handleMouseUp = useCallback(() => {
    if (draggingCardId) {
      // Persist positions to localStorage
      if (selectedCompanyId && cardDragMoved.current) {
        setNodeOffsets((prev) => {
          saveOffsets(selectedCompanyId, prev);
          return prev;
        });
      }
      setDraggingCardId(null);
      cardDragStart.current = null;
      return;
    }
    setCanvasDragging(false);
  }, [draggingCardId, selectedCompanyId]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);

      const scale = newZoom / zoom;
      setPan({
        x: mouseX - scale * (mouseX - pan.x),
        y: mouseY - scale * (mouseY - pan.y),
      });
      setZoom(newZoom);
    },
    [zoom, pan],
  );

  const handleResetLayout = useCallback(() => {
    setNodeOffsets(new Map());
    if (selectedCompanyId) {
      saveOffsets(selectedCompanyId, new Map());
    }
    // Also re-fit the view
    hasInitialized.current = false;
  }, [selectedCompanyId]);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    const scaleX = (cW - 40) / bounds.width;
    const scaleY = (cH - 40) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;
    setZoom(fitZoom);
    setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
  }, [bounds]);

  // ── Early returns ────────────────────────────────────────────────────

  if (!selectedCompanyId) {
    return <EmptyState icon={Network} message="Select a company to view the org chart." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="org-chart" />;
  }

  if (orgTree && orgTree.length === 0) {
    return <EmptyState icon={Network} message="No organizational hierarchy defined." />;
  }

  const hasCustomLayout = nodeOffsets.size > 0;
  const cursorStyle = draggingCardId
    ? "crosshair"
    : canvasDragging
      ? "grabbing"
      : "grab";

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex items-center justify-start gap-2 shrink-0">
        <Link to="/company/import">
          <Button variant="outline" size="sm">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import company
          </Button>
        </Link>
        <Link to="/company/export">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export company
          </Button>
        </Link>
        {hasCustomLayout && (
          <Button variant="ghost" size="sm" onClick={handleResetLayout} title="Reset agent positions to default">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset layout
          </Button>
        )}
      </div>
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-0 overflow-hidden relative bg-muted/20 border border-border rounded-lg"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Drag hint */}
        <div className="absolute bottom-3 left-3 z-10 text-[10px] text-muted-foreground/50 select-none pointer-events-none">
          Drag agents to reposition · Drag background to pan · Scroll to zoom
        </div>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <button
            className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
            onClick={() => {
              const newZoom = Math.min(zoom * 1.2, 2);
              const container = containerRef.current;
              if (container) {
                const cx = container.clientWidth / 2;
                const cy = container.clientHeight / 2;
                const scale = newZoom / zoom;
                setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
              }
              setZoom(newZoom);
            }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
            onClick={() => {
              const newZoom = Math.max(zoom * 0.8, 0.2);
              const container = containerRef.current;
              if (container) {
                const cx = container.clientWidth / 2;
                const cy = container.clientHeight / 2;
                const scale = newZoom / zoom;
                setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
              }
              setZoom(newZoom);
            }}
            aria-label="Zoom out"
          >
            &minus;
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-[10px] hover:bg-accent transition-colors"
            onClick={fitToScreen}
            title="Fit to screen"
            aria-label="Fit chart to screen"
          >
            Fit
          </button>
        </div>

        {/* SVG layer for edges — always follows offset-adjusted node positions */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {edges.map(({ parent, child }) => {
              const x1 = parent.x + CARD_W / 2;
              const y1 = parent.y + CARD_H;
              const x2 = child.x + CARD_W / 2;
              const y2 = child.y;
              const midY = (y1 + y2) / 2;

              return (
                <path
                  key={`${parent.id}-${child.id}`}
                  d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        </svg>

        {/* Card layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Department grouping boxes — rendered behind agent cards */}
          {deptBoxes.map((box) => (
            <div
              key={box.id}
              className="absolute rounded-lg pointer-events-none"
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                border: 0,
                outline: `5px dashed ${box.color}`,
                outlineOffset: "15px",
                borderRadius: "8px",
                backgroundColor: `${box.color}14`,
              }}
            >
              <span
                className="absolute text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: box.color, top: -36, left: 0 }}
              >
                {box.name}
              </span>
            </div>
          ))}

          {allNodes.map((node) => {
            const agent = agentMap.get(node.id);
            const dotColor = statusDotColor[node.status] ?? defaultDotColor;
            const isBeingDragged = draggingCardId === node.id;

            return (
              <div
                key={node.id}
                data-org-card
                className="absolute bg-card border border-border rounded-lg shadow-sm transition-[box-shadow,border-color,opacity] duration-150 select-none"
                style={{
                  left: node.x,
                  top: node.y,
                  width: CARD_W,
                  minHeight: CARD_H,
                  cursor: isBeingDragged ? "grabbing" : "grab",
                  boxShadow: isBeingDragged
                    ? "0 8px 24px rgba(0,0,0,0.18)"
                    : undefined,
                  opacity: isBeingDragged ? 0.9 : 1,
                  zIndex: isBeingDragged ? 100 : undefined,
                  // Disable transitions on the active dragged card for responsiveness
                  transition: isBeingDragged ? "none" : undefined,
                }}
                onMouseDown={(e) => handleCardMouseDown(e, node.id)}
                onClick={(e) => {
                  // Suppress navigation if the pointer moved enough to be a drag
                  if (cardDragMoved.current) {
                    e.preventDefault();
                    cardDragMoved.current = false;
                    return;
                  }
                  navigate(agent ? agentUrl(agent) : `/agents/${node.id}`);
                }}
              >
                <div className="flex items-center px-4 py-3 gap-3">
                  {/* Agent icon + status dot */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      <AgentIcon icon={agent?.icon} avatarUrl={agent?.avatarUrl} className="h-4.5 w-4.5 text-foreground/70" />
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                      style={{ backgroundColor: dotColor }}
                    />
                  </div>
                  {/* Name + role + adapter type */}
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="text-sm font-semibold text-foreground leading-tight">
                      {node.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {agent?.title ?? roleLabel(node.role)}
                    </span>
                    {agent && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono leading-tight mt-1">
                        {adapterLabels[agent.adapterType] ?? agent.adapterType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const roleLabels: Record<string, string> = AGENT_ROLE_LABELS;

function roleLabel(role: string): string {
  return roleLabels[role] ?? role;
}
