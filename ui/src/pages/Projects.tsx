import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { departmentsApi } from "../api/departments";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";
import { Hexagon, Plus, Layers, Archive } from "lucide-react";

export function Projects() {
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [groupByDept, setGroupByDept] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Projects" }]);
  }, [setBreadcrumbs]);

  const { data: allProjects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: deptData } = useQuery({
    queryKey: queryKeys.departments.list(selectedCompanyId!),
    queryFn: () => departmentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && groupByDept,
  });

  const projects = useMemo(
    () => (allProjects ?? []).filter((p) => !p.archivedAt),
    [allProjects],
  );

  const archivedCount = useMemo(
    () => (allProjects ?? []).filter((p) => !!p.archivedAt).length,
    [allProjects],
  );

  const departments = useMemo(
    () => (deptData?.departments ?? []) as Array<{ id: string; name: string; color: string | null }>,
    [deptData],
  );

  // Group projects: keyed by departmentId, with a null bucket for unassigned
  const grouped = useMemo(() => {
    if (!groupByDept) return null;
    const map = new Map<string | null, typeof projects>();
    for (const p of projects) {
      const key = p.departmentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sort: named departments first (alphabetically), then unassigned
    const entries: Array<{ id: string | null; name: string; color: string | null; projects: typeof projects }> = [];
    for (const dept of departments) {
      const list = map.get(dept.id) ?? [];
      entries.push({ id: dept.id, name: dept.name, color: dept.color, projects: list });
    }
    // Any departmentId that wasn't in departments list (stale FK)
    for (const [key, list] of map) {
      if (key !== null && !departments.find((d) => d.id === key)) {
        entries.push({ id: key, name: "Unknown Department", color: null, projects: list });
      }
    }
    // Unassigned bucket last
    const unassigned = map.get(null) ?? [];
    if (unassigned.length > 0) {
      entries.push({ id: null, name: "Unassigned", color: null, projects: unassigned });
    }
    return entries;
  }, [groupByDept, projects, departments]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant={groupByDept ? "default" : "outline"}
          onClick={() => setGroupByDept((v) => !v)}
        >
          <Layers className="h-4 w-4 mr-1" />
          Group by Department
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/projects/archived">
            <Archive className="h-4 w-4 mr-1" />
            Archived
            {archivedCount > 0 && (
              <span className="ml-1 tabular-nums text-muted-foreground">({archivedCount})</span>
            )}
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={openNewProject}>
          <Plus className="h-4 w-4 mr-1" />
          Add Project
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && projects.length === 0 && (
        <EmptyState
          icon={Hexagon}
          message="No projects yet."
          action="Add Project"
          onAction={openNewProject}
        />
      )}

      {/* Flat list */}
      {projects.length > 0 && !groupByDept && (
        <div className="border border-border">
          {projects.map((project) => (
            <EntityRow
              key={project.id}
              title={project.name}
              subtitle={project.description ?? undefined}
              to={projectUrl(project)}
              trailing={
                <div className="flex items-center gap-3">
                  {project.targetDate && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(project.targetDate)}
                    </span>
                  )}
                  <StatusBadge status={project.status} />
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* Grouped by department */}
      {projects.length > 0 && groupByDept && grouped && (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.id ?? "__unassigned"} className="space-y-1">
              {/* Group header */}
              <div className="flex items-center gap-2 px-1 pb-1">
                {group.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </span>
                <span className="text-xs text-muted-foreground">({group.projects.length})</span>
              </div>
              {group.projects.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-4">No projects</p>
              ) : (
                <div className="border border-border">
                  {group.projects.map((project) => (
                    <EntityRow
                      key={project.id}
                      title={project.name}
                      subtitle={project.description ?? undefined}
                      to={projectUrl(project)}
                      trailing={
                        <div className="flex items-center gap-3">
                          {project.targetDate && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(project.targetDate)}
                            </span>
                          )}
                          <StatusBadge status={project.status} />
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
