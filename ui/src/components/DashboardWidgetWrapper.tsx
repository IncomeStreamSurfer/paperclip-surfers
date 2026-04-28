import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetSize } from "@/lib/dashboard-widgets";

interface DashboardWidgetWrapperProps {
  id: string;
  title: string;
  subtitle?: string;
  size: WidgetSize;
  editMode: boolean;
  index?: number;
  onRemove: (id: string) => void;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-1 lg:col-span-2",
  lg: "col-span-1 lg:col-span-4",
};

export function DashboardWidgetWrapper({
  id,
  title,
  subtitle,
  size,
  editMode,
  index = 0,
  onRemove,
  children,
}: DashboardWidgetWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
    "--widget-idx": index,
  } as CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(SIZE_CLASSES[size], "group widget-enter")}
    >
      <div
        className={cn(
          "border border-border rounded-lg p-4 space-y-3 h-full transition-shadow duration-200",
          editMode && "ring-1 ring-primary/30 border-primary/40",
          isDragging && "shadow-xl",
          !editMode && "hover:shadow-md",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 min-h-[1.5rem]">
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-medium text-muted-foreground truncate">{title}</h3>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground/60">{subtitle}</span>
            )}
          </div>

          {editMode && (
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Drag handle */}
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 touch-none"
                aria-label="Drag to reorder"
                tabIndex={-1}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              {/* Remove button */}
              <button
                onClick={() => onRemove(id)}
                className="rounded p-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                aria-label="Remove widget"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
