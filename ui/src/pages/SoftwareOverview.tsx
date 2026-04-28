import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { FolderKanban, CircleDot, Bot, ArrowRight, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";

export function SoftwareOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Software" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const issuesQuery = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (projectsQuery.isLoading || issuesQuery.isLoading || agentsQuery.isLoading) {
    return <PageSkeleton />;
  }

  const projects = projectsQuery.data ?? [];
  const issues = issuesQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  const activeProjects = projects.filter((p) => p.status === "in_progress").length;
  const openIssues = issues.filter(
    (i) => i.status !== "done" && i.status !== "cancelled",
  ).length;
  const activeAgents = agents.filter((a) => a.status === "active").length;

  async function handleDownloadSprintReport() {
    if (!selectedCompanyId) return;
    setDownloading(true);
    try {
      const res = await projectsApi.downloadSprintReport(selectedCompanyId);
      if (!res.ok) throw new Error("Failed to download sprint report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "sprint-report.md";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Software Factory</h1>
          <p className="text-sm text-muted-foreground">Projects, issues, and agent workforce overview</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadSprintReport}
          disabled={downloading || !selectedCompanyId}
        >
          <Download className="h-4 w-4 mr-1.5" />
          {downloading ? "Generating…" : "Sprint Report"}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="../projects">
          <Card className="p-4 space-y-1 hover:bg-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">Projects</span>
              <FolderKanban className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold">{projects.length}</p>
            <p className="text-xs text-muted-foreground">{activeProjects} in progress</p>
          </Card>
        </Link>
        <Link to="../issues">
          <Card className="p-4 space-y-1 hover:bg-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">Issues</span>
              <CircleDot className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold">{issues.length}</p>
            <p className="text-xs text-muted-foreground">{openIssues} open</p>
          </Card>
        </Link>
        <Link to="../agents/all">
          <Card className="p-4 space-y-1 hover:bg-accent/20 transition-colors cursor-pointer">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">Agents</span>
              <Bot className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold">{agents.length}</p>
            <p className="text-xs text-muted-foreground">{activeAgents} active</p>
          </Card>
        </Link>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="../projects">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" /> All Projects
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="../issues">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <CircleDot className="h-4 w-4" /> All Issues
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="../agents/all">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" /> Agents
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Recent projects */}
      {recentProjects.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Projects</h2>
            <Link to="../projects" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentProjects.map((p) => (
              <Link key={p.id} to={`../projects/${p.urlKey}`}>
                <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-accent/20 transition-colors">
                  <span
                    className="h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: p.color ?? "#6366f1" }}
                  />
                  <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground capitalize shrink-0">
                    {p.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
