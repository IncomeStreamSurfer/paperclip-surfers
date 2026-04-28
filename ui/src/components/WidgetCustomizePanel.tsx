import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, PanelRightClose, PanelRightOpen, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { WIDGET_REGISTRY } from "@/lib/dashboard-widgets";
import type { DashboardSection } from "@/hooks/useDashboardConfig";
import { cn } from "@/lib/utils";

// ── Section row (rename / delete) ───────────────────────────────────────────

function SectionRow({
  section,
  onRename,
  onDelete,
}: {
  section: DashboardSection;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(section.label);

  // Keep value in sync if label changes externally
  useEffect(() => { setValue(section.label); }, [section.label]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== section.label) onRename(section.id, trimmed);
    else setValue(section.label);
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1.5">
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setValue(section.label); setEditing(false); }
          }}
          className="flex-1 text-xs bg-transparent border-b border-primary outline-none min-w-0"
        />
      ) : (
        <span
          className="flex-1 text-xs text-muted-foreground truncate cursor-pointer"
          onDoubleClick={() => setEditing(true)}
          title="Double-click to rename"
        >
          {section.label}
        </span>
      )}
      {!editing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Rename section"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(section.id)}
            className="rounded p-0.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete section (widgets become ungrouped)"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sortable widget row ──────────────────────────────────────────────────────

interface WidgetRowProps {
  id: string;
  title: string;
  description: string;
  visible: boolean;
  sections: DashboardSection[];
  currentSectionId: string | undefined;
  onToggle: (id: string) => void;
  onAssignSection: (widgetId: string, sectionId: string | null) => void;
}

function WidgetRow({
  id,
  title,
  description,
  visible,
  sections,
  currentSectionId,
  onToggle,
  onAssignSection,
  animationDelay,
}: WidgetRowProps & { animationDelay?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? transition : transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    animationDelay: animationDelay != null ? `${animationDelay}ms` : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/row flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 select-none",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200 fill-mode-both",
        "transition-all hover:shadow-md hover:-translate-y-px hover:border-border/60",
        isDragging && "shadow-lg scale-[1.02]",
        !visible && "opacity-60",
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing shrink-0 text-muted-foreground/40 hover:text-muted-foreground touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>

      {/* Section assignment */}
      {sections.length > 0 && (
        <select
          value={currentSectionId ?? ""}
          onChange={(e) => onAssignSection(id, e.target.value || null)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-[10px] rounded border border-border bg-background text-muted-foreground px-1 py-0.5 outline-none cursor-pointer max-w-[90px] truncate"
          title="Assign to section"
        >
          <option value="">Ungrouped</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      )}

      {/* Visibility toggle */}
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={cn(
          "shrink-0 rounded p-1 transition-colors",
          visible
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50",
        )}
        aria-label={visible ? "Hide widget" : "Show widget"}
        title={visible ? "Hide" : "Show"}
      >
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

interface WidgetCustomizePanelProps {
  open: boolean;
  onClose: () => void;
  order: string[];
  disabled: Set<string>;
  sections: DashboardSection[];
  widgetSections: Record<string, string>;
  onReorder: (newOrder: string[]) => void;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  onReset: () => void;
  onAddSection: (label: string) => void;
  onDeleteSection: (id: string) => void;
  onRenameSection: (id: string, label: string) => void;
  onAssignWidgetToSection: (widgetId: string, sectionId: string | null) => void;
}

export function WidgetCustomizePanel({
  open,
  onClose,
  order,
  disabled,
  sections,
  widgetSections,
  onReorder,
  onEnable,
  onDisable,
  onReset,
  onAddSection,
  onDeleteSection,
  onRenameSection,
  onAssignWidgetToSection,
}: WidgetCustomizePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [newSectionLabel, setNewSectionLabel] = useState("");

  // Reset collapsed state whenever the panel is closed
  useEffect(() => {
    if (!open) { setCollapsed(false); setNewSectionLabel(""); }
  }, [open]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = order.indexOf(String(active.id));
      const newIdx = order.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return;
      const next = [...order];
      next.splice(oldIdx, 1);
      next.splice(newIdx, 0, String(active.id));
      onReorder(next);
    },
    [order, onReorder],
  );

  const handleToggle = useCallback(
    (id: string) => {
      if (disabled.has(id)) onEnable(id);
      else onDisable(id);
    },
    [disabled, onEnable, onDisable],
  );

  const handleAddSection = () => {
    const trimmed = newSectionLabel.trim();
    if (!trimmed) return;
    onAddSection(trimmed);
    setNewSectionLabel("");
  };

  const visibleCount = order.filter((id) => !disabled.has(id)).length;

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex h-full",
        "w-[340px] sm:w-[400px]",
        "bg-background border-l border-border shadow-xl",
        "transition-transform duration-200 ease-in-out",
        collapsed
          ? "[transform:translateX(calc(100%-2.25rem))]"
          : "translate-x-0",
      )}
      aria-label="Customize Dashboard panel"
      aria-expanded={!collapsed}
    >
      {/* ── Collapsed tab strip ── */}
      <div
        className={cn(
          "w-9 shrink-0 flex flex-col items-center gap-3 py-4",
          "border-r border-border bg-muted/40",
          collapsed ? "pointer-events-auto" : "pointer-events-none opacity-0",
          "transition-opacity duration-150",
        )}
        aria-hidden={!collapsed}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Expand panel"
          aria-label="Expand customize panel"
          tabIndex={collapsed ? 0 : -1}
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <span
          className="text-[10px] text-muted-foreground font-medium tracking-widest select-none"
          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
        >
          Customize
        </span>
      </div>

      {/* ── Main panel ── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden",
          collapsed ? "pointer-events-none" : "pointer-events-auto",
        )}
        aria-hidden={collapsed}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0">
          <span className="text-sm font-semibold">Customize Dashboard</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50 transition-colors"
              title="Reset to defaults"
              tabIndex={collapsed ? -1 : 0}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Collapse panel"
              tabIndex={collapsed ? -1 : 0}
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close"
              tabIndex={collapsed ? -1 : 0}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-header */}
        <div className="px-4 py-2 border-b border-border bg-muted/30 shrink-0">
          <p className="text-xs text-muted-foreground">
            {visibleCount} of {order.length} widgets visible · drag to reorder
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Sections management ── */}
          <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sections
            </p>

            {sections.length > 0 && (
              <div className="space-y-1">
                {sections.map((s) => (
                  <SectionRow
                    key={s.id}
                    section={s}
                    onRename={onRenameSection}
                    onDelete={onDeleteSection}
                  />
                ))}
              </div>
            )}

            {/* Add section */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newSectionLabel}
                onChange={(e) => setNewSectionLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); }}
                placeholder="New section name…"
                className="flex-1 text-xs rounded border border-border bg-background px-2 py-1.5 outline-none focus:border-primary/60 placeholder:text-muted-foreground/50 min-w-0"
                tabIndex={collapsed ? -1 : 0}
              />
              <button
                type="button"
                onClick={handleAddSection}
                disabled={!newSectionLabel.trim()}
                className="shrink-0 flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
                tabIndex={collapsed ? -1 : 0}
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>

            {sections.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50">
                Add sections to group and collapse widgets on the dashboard.
              </p>
            )}
          </div>

          {/* ── Widget list ── */}
          <div className="px-3 py-3 space-y-1.5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                {order.map((id) => {
                  const def = WIDGET_REGISTRY.find((w) => w.id === id);
                  if (!def) return null;
                  return (
                    <WidgetRow
                      key={id}
                      id={id}
                      title={def.title}
                      description={def.description}
                      visible={!disabled.has(id)}
                      sections={sections}
                      currentSectionId={widgetSections[id]}
                      onToggle={handleToggle}
                      onAssignSection={onAssignWidgetToSection}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}
