import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import { Identity } from "./Identity";
import { Plus } from "lucide-react";
import type { Issue } from "@paperclipai/shared";

const boardStatuses = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Status-specific colors for column headers and accents
const STATUS_COLORS: Record<string, {
  header: string;
  badge: string;
  strip: string;
  hover: string;
}> = {
  backlog:     { header: "border-slate-400/30 bg-slate-500/8",    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400",  strip: "bg-slate-400",   hover: "bg-slate-500/12" },
  todo:        { header: "border-blue-400/30 bg-blue-500/8",      badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400",     strip: "bg-blue-500",    hover: "bg-blue-500/12" },
  in_progress: { header: "border-violet-400/30 bg-violet-500/8",  badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400", strip: "bg-violet-500", hover: "bg-violet-500/12" },
  in_review:   { header: "border-amber-400/30 bg-amber-500/8",    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",  strip: "bg-amber-500",   hover: "bg-amber-500/12" },
  blocked:     { header: "border-red-400/30 bg-red-500/8",        badge: "bg-red-500/15 text-red-600 dark:text-red-400",        strip: "bg-red-500",     hover: "bg-red-500/12" },
  done:        { header: "border-emerald-400/30 bg-emerald-500/8", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", strip: "bg-emerald-500", hover: "bg-emerald-500/12" },
  cancelled:   { header: "border-zinc-400/30 bg-zinc-500/8",      badge: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400",    strip: "bg-zinc-400",    hover: "bg-zinc-500/12" },
};

const DEFAULT_COLOR = { header: "border-border bg-muted/20", badge: "bg-muted text-muted-foreground", strip: "bg-muted-foreground", hover: "bg-accent/40" };

interface Agent {
  id: string;
  name: string;
}

interface KanbanBoardProps {
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  onUpdateIssue: (id: string, data: Record<string, unknown>) => void;
  onCreateIssue?: (status: string) => void;
}

/* ── Droppable Column ── */

function KanbanColumn({
  status,
  issues,
  agents,
  liveIssueIds,
  onCreateIssue,
}: {
  status: string;
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  onCreateIssue?: (status: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colors = STATUS_COLORS[status] ?? DEFAULT_COLOR;

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2 mb-1.5 rounded-lg border ${colors.header}`}>
        <StatusIcon status={status} />
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80 flex-1">
          {statusLabel(status)}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${colors.badge}`}>
          {issues.length}
        </span>
        {onCreateIssue && (
          <button
            type="button"
            onClick={() => onCreateIssue(status)}
            className="ml-1 p-0.5 rounded hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground"
            title={`Add ${statusLabel(status)} issue`}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-lg p-1.5 space-y-1.5 transition-colors ${
          isOver ? colors.hover : "bg-muted/10"
        }`}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              agents={agents}
              isLive={liveIssueIds?.has(issue.id)}
              statusStrip={colors.strip}
            />
          ))}
        </SortableContext>

        {/* Inline "add card" at bottom */}
        {onCreateIssue && issues.length > 0 && (
          <button
            type="button"
            onClick={() => onCreateIssue(status)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add card
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Draggable Card ── */

function KanbanCard({
  issue,
  agents,
  isLive,
  isOverlay,
  statusStrip,
}: {
  issue: Issue;
  agents?: Agent[];
  isLive?: boolean;
  isOverlay?: boolean;
  statusStrip?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, data: { issue } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative rounded-md border bg-card overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging && !isOverlay ? "opacity-30" : ""
      } ${isOverlay ? "shadow-lg ring-1 ring-primary/20" : "hover:shadow-sm"}`}
    >
      {/* Status color strip on left edge */}
      {statusStrip && !isOverlay && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${statusStrip}`} />
      )}

      <div className="pl-3 pr-2.5 py-2.5">
        <Link
          to={`/issues/${issue.identifier ?? issue.id}`}
          className="block no-underline text-inherit"
          onClick={(e) => {
            if (isDragging) e.preventDefault();
          }}
        >
          <div className="flex items-start gap-1.5 mb-1.5">
            <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-px">
              {issue.identifier ?? issue.id.slice(0, 8)}
            </span>
            {isLive && (
              <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
          </div>
          <p className="text-sm leading-snug line-clamp-2 mb-2">{issue.title}</p>
          <div className="flex items-center gap-2">
            <PriorityIcon priority={issue.priority} />
            {issue.assigneeAgentId && (() => {
              const name = agentName(issue.assigneeAgentId);
              return name ? (
                <Identity name={name} size="xs" />
              ) : (
                <span className="text-xs text-muted-foreground font-mono">
                  {issue.assigneeAgentId.slice(0, 8)}
                </span>
              );
            })()}
          </div>
        </Link>
      </div>
    </div>
  );
}

/* ── Main Board ── */

export function KanbanBoard({
  issues,
  agents,
  liveIssueIds,
  onUpdateIssue,
  onCreateIssue,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnIssues = useMemo(() => {
    const grouped: Record<string, Issue[]> = {};
    for (const status of boardStatuses) {
      grouped[status] = [];
    }
    for (const issue of issues) {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    }
    return grouped;
  }, [issues]);

  const activeIssue = useMemo(
    () => (activeId ? issues.find((i) => i.id === activeId) : null),
    [activeId, issues]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    let targetStatus: string | null = null;

    if (boardStatuses.includes(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      const targetIssue = issues.find((i) => i.id === over.id);
      if (targetIssue) {
        targetStatus = targetIssue.status;
      }
    }

    if (targetStatus && targetStatus !== issue.status) {
      onUpdateIssue(issueId, { status: targetStatus });
    }
  }

  function handleDragOver(_event: DragOverEvent) {}

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {boardStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={columnIssues[status] ?? []}
            agents={agents}
            liveIssueIds={liveIssueIds}
            onCreateIssue={onCreateIssue}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <KanbanCard issue={activeIssue} agents={agents} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
