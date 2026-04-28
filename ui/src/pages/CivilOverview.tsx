import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { civilApi } from "../api/civil";
import { queryKeys } from "../lib/queryKeys";
import { HardHat, Ruler, FileText, ArrowRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";

const PROJECT_STATUS_COLORS: Record<string, string> = {
  planning: "text-blue-600",
  design: "text-purple-600",
  approval: "text-yellow-600",
  construction: "text-orange-600",
  complete: "text-green-600",
  on_hold: "text-muted-foreground",
};

export function CivilOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Civil / Architecture" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.civil.projects(selectedCompanyId!),
    queryFn: () => civilApi.listProjects(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const drawingsQuery = useQuery({
    queryKey: queryKeys.civil.drawings(selectedCompanyId!),
    queryFn: () => civilApi.listDrawings(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (projectsQuery.isLoading || drawingsQuery.isLoading) return <PageSkeleton />;

  const projects = projectsQuery.data?.projects ?? [];
  const drawings = drawingsQuery.data?.drawings ?? [];

  const activeProjects = projects.filter((p) => p.status !== "complete" && p.status !== "on_hold").length;
  const approvedDrawings = drawings.filter((d) => d.status === "approved").length;
  const draftDrawings = drawings.filter((d) => d.status === "draft").length;
  const reviewDrawings = drawings.filter((d) => d.status === "in_review").length;

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Civil / Architecture Dashboard</h1>
          <p className="text-sm text-muted-foreground">Projects, drawings, and specifications</p>
        </div>
        <div className="flex gap-2">
          <Link to="projects">
            <Button size="sm" variant="outline" className="gap-1">
              <HardHat className="h-3.5 w-3.5" /> Projects
            </Button>
          </Link>
          <Link to="drawings">
            <Button size="sm" className="gap-1">
              <Ruler className="h-3.5 w-3.5" /> Drawings
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: projects.length, icon: HardHat, sub: `${activeProjects} active` },
          { label: "Total Drawings", value: drawings.length, icon: Ruler, sub: `${approvedDrawings} approved` },
          { label: "In Review", value: reviewDrawings, icon: Clock, sub: "drawings awaiting review" },
          { label: "Drafts", value: draftDrawings, icon: AlertCircle, sub: "drawings in progress" },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">{kpi.label}</span>
              <kpi.icon className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { to: "projects", label: "All Projects", icon: HardHat },
          { to: "drawings", label: "Drawing Register", icon: Ruler },
          { to: "specs", label: "Specifications", icon: FileText },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" /> {label}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ))}
      </div>

      {/* Recent projects */}
      {recentProjects.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Projects</h2>
            <Link to="projects" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentProjects.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.projectType}
                    {p.location ? ` · ${p.location}` : ""}
                    {p.clientName ? ` · ${p.clientName}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-medium shrink-0 capitalize ${PROJECT_STATUS_COLORS[p.status] ?? ""}`}>
                  {p.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
