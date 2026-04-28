import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Trash2, Hexagon } from "lucide-react";
import { useToast } from "../context/ToastContext";

export function ArchivedProjects() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Projects", href: "/projects" },
      { label: "Archived" },
    ]);
  }, [setBreadcrumbs]);

  const { data: allProjects, isLoading } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const archived = (allProjects ?? [])
    .filter((p) => !!p.archivedAt)
    .sort((a, b) => new Date(b.archivedAt!).getTime() - new Date(a.archivedAt!).getTime());

  const unarchive = useMutation({
    mutationFn: (id: string) =>
      projectsApi.update(id, { archivedAt: null }, selectedCompanyId ?? undefined),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId!) });
      pushToast({ tone: "success", title: `"${project.name}" restored`, body: "Project is active again." });
    },
    onError: (err) => {
      pushToast({ tone: "error", title: "Restore failed", body: err instanceof Error ? err.message : "Failed to restore project." });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id, selectedCompanyId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId!) });
      setConfirmDeleteId(null);
      pushToast({ tone: "success", title: "Project deleted", body: "Permanently removed." });
    },
    onError: (err) => {
      pushToast({ tone: "error", title: "Delete failed", body: err instanceof Error ? err.message : "Failed to delete project." });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Hexagon} message="Select a company to view archived projects." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-medium text-muted-foreground">
          Archived Projects
          {archived.length > 0 && (
            <span className="ml-2 tabular-nums">({archived.length})</span>
          )}
        </h1>
      </div>

      {archived.length === 0 && (
        <EmptyState
          icon={Archive}
          message="No archived projects."
        />
      )}

      {archived.length > 0 && (
        <div className="border border-border divide-y divide-border">
          {archived.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* Left: name + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {project.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                      {project.description}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    Archived {formatDate(project.archivedAt!.toString())}
                  </span>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 shrink-0">
                {confirmDeleteId === project.id ? (
                  <>
                    <span className="text-xs text-destructive">Delete permanently?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(project.id)}
                    >
                      {remove.isPending ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={unarchive.isPending && unarchive.variables === project.id}
                      onClick={() => unarchive.mutate(project.id)}
                    >
                      <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDeleteId(project.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
