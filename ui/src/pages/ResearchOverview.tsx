import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { researchApi } from "../api/research";
import { queryKeys } from "../lib/queryKeys";
import { FlaskConical, FileText, BookOpen, ArrowRight, StickyNote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-600",
  completed: "text-blue-600",
  paused: "text-yellow-600",
  archived: "text-muted-foreground",
};

export function ResearchOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Research" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.research.projects(selectedCompanyId!),
    queryFn: () => researchApi.listProjects(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const notesQuery = useQuery({
    queryKey: queryKeys.research.notes(selectedCompanyId!),
    queryFn: () => researchApi.listNotes(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const litQuery = useQuery({
    queryKey: queryKeys.research.literature(selectedCompanyId!),
    queryFn: () => researchApi.listLiterature(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (projectsQuery.isLoading || notesQuery.isLoading || litQuery.isLoading) {
    return <PageSkeleton />;
  }

  const projects = projectsQuery.data?.projects ?? [];
  const notes = notesQuery.data?.notes ?? [];
  const literature = litQuery.data?.literature ?? [];

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Research Hub</h1>
        <p className="text-sm text-muted-foreground">Research projects, notes, and literature</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="projects">
          <Card className="p-4 space-y-1 hover:bg-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">Research Projects</span>
              <FlaskConical className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold">{projects.length}</p>
            <p className="text-xs text-muted-foreground">{activeProjects} active</p>
          </Card>
        </Link>
        <Link to="notes">
          <Card className="p-4 space-y-1 hover:bg-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">Notes</span>
              <FileText className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold">{notes.length}</p>
            <p className="text-xs text-muted-foreground">Research notes</p>
          </Card>
        </Link>
        <Link to="literature">
          <Card className="p-4 space-y-1 hover:bg-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">Literature</span>
              <BookOpen className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold">{literature.length}</p>
            <p className="text-xs text-muted-foreground">Papers & articles</p>
          </Card>
        </Link>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="projects">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Research Projects
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="notes">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" /> Notes
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="literature">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Literature
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Recent projects */}
      {recentProjects.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Research Projects</h2>
            <Link to="projects" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
              >
                <FlaskConical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  {p.domain && <p className="text-xs text-muted-foreground">{p.domain}</p>}
                </div>
                <span className={`text-xs font-medium shrink-0 ${STATUS_COLORS[p.status] ?? "text-muted-foreground"}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent literature */}
      {literature.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Literature</h2>
            <Link to="literature" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="space-y-1.5">
            {literature.slice(0, 4).map((l) => (
              <div
                key={l.id}
                className="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
              >
                <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[l.authors, l.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
