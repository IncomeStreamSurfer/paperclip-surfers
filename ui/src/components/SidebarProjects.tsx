import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Star } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { authApi } from "../api/auth";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { cn, projectRouteRef } from "../lib/utils";
import { useProjectOrder } from "../hooks/useProjectOrder";
import { BudgetSidebarMarker } from "./BudgetSidebarMarker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PluginSlotMount, usePluginSlots } from "@/plugins/slots";
import type { Project } from "@paperclipai/shared";

type ProjectSidebarSlot = ReturnType<typeof usePluginSlots>["slots"][number];

function SortableProjectItem({
  activeProjectRef,
  companyId,
  companyPrefix,
  isMobile,
  isFav,
  onToggleFav,
  project,
  projectSidebarSlots,
  setSidebarOpen,
}: {
  activeProjectRef: string | null;
  companyId: string | null;
  companyPrefix: string | null;
  isMobile: boolean;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  project: Project;
  projectSidebarSlots: ProjectSidebarSlot[];
  setSidebarOpen: (open: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const routeRef = projectRouteRef(project);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={cn(isDragging && "opacity-80")}
      {...attributes}
      {...listeners}
    >
      <div className="flex flex-col gap-0.5">
        <div className="group relative">
          <NavLink
            to={`/projects/${routeRef}/issues`}
            onClick={() => {
              if (isMobile) setSidebarOpen(false);
            }}
            className={cn(
              "flex items-center gap-2.5 px-3 py-1.5 pr-7 text-[13px] font-medium transition-colors",
              activeProjectRef === routeRef || activeProjectRef === project.id
                ? "bg-accent text-foreground"
                : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <span
              className="shrink-0 h-3.5 w-3.5 rounded-sm"
              style={{ backgroundColor: project.color ?? "#6366f1" }}
            />
            <span className="flex-1 truncate">{project.name}</span>
            {project.pauseReason === "budget" ? <BudgetSidebarMarker title="Project paused by budget" /> : null}
          </NavLink>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(project.id); }}
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity",
              isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
            title={isFav ? "Remove from favourites" : "Add to favourites"}
          >
            <Star className={cn("h-3 w-3", isFav ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground hover:text-yellow-500")} />
          </button>
        </div>
        {projectSidebarSlots.length > 0 && (
          <div className="ml-5 flex flex-col gap-0.5">
            {projectSidebarSlots.map((slot) => (
              <PluginSlotMount
                key={`${project.id}:${slot.pluginKey}:${slot.id}`}
                slot={slot}
                context={{
                  companyId,
                  companyPrefix,
                  projectId: project.id,
                  projectRef: routeRef,
                  entityId: project.id,
                  entityType: "project",
                }}
                missingBehavior="placeholder"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SidebarProjects() {
  const [open, setOpen] = useState(true);
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { isMobile, setSidebarOpen, forcedSectionState, favoriteProjectIds, toggleFavoriteProject, isFavoriteProject } = useSidebar();
  const location = useLocation();

  useEffect(() => {
    if (forcedSectionState !== null) {
      setOpen(forcedSectionState.expanded);
    }
  }, [forcedSectionState]);

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const { slots: projectSidebarSlots } = usePluginSlots({
    slotTypes: ["projectSidebarItem"],
    entityType: "project",
    companyId: selectedCompanyId,
    enabled: !!selectedCompanyId,
  });

  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;

  const visibleProjects = useMemo(
    () => (projects ?? []).filter((project: Project) => !project.archivedAt),
    [projects],
  );
  const { orderedProjects, persistOrder } = useProjectOrder({
    projects: visibleProjects,
    companyId: selectedCompanyId,
    userId: currentUserId,
  });

  // Starred projects float to the top, preserving relative order within each group
  const displayProjects = useMemo(() => [
    ...orderedProjects.filter((p) => isFavoriteProject(p.id)),
    ...orderedProjects.filter((p) => !isFavoriteProject(p.id)),
  ], [orderedProjects, isFavoriteProject, favoriteProjectIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectMatch = location.pathname.match(/^\/(?:[^/]+\/)?projects\/([^/]+)/);
  const activeProjectRef = projectMatch?.[1] ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = orderedProjects.map((project) => project.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      persistOrder(arrayMove(ids, oldIndex, newIndex));
    },
    [orderedProjects, persistOrder],
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group">
        <div className="flex items-center px-3 py-1.5">
          <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform opacity-0 group-hover:opacity-100",
                open && "rotate-90"
              )}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground">
              Projects
            </span>
          </CollapsibleTrigger>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openNewProject();
            }}
            className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="New project"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      <CollapsibleContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayProjects.map((project) => project.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-0.5 mt-0.5">
              {displayProjects.map((project: Project) => (
                <SortableProjectItem
                  key={project.id}
                  activeProjectRef={activeProjectRef}
                  companyId={selectedCompanyId}
                  companyPrefix={selectedCompany?.issuePrefix ?? null}
                  isMobile={isMobile}
                  isFav={isFavoriteProject(project.id)}
                  onToggleFav={toggleFavoriteProject}
                  project={project}
                  projectSidebarSlots={projectSidebarSlots}
                  setSidebarOpen={setSidebarOpen}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  );
}
