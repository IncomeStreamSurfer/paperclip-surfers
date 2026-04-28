import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, BarChart2, CheckCircle, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { seoApi } from "../api/seo";
import { queryKeys } from "../lib/queryKeys";

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
    >
      <div className="rounded-md bg-muted p-2 shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}

export function SeoOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const prefix = selectedCompany?.issuePrefix ?? "";

  useEffect(() => {
    setBreadcrumbs([{ label: "SEO" }]);
  }, [setBreadcrumbs]);

  const { data: keywords = [], isLoading: loadingKeywords } = useQuery({
    queryKey: queryKeys.seo.keywords(selectedCompanyId!),
    queryFn: () => seoApi.listKeywords(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: pages = [], isLoading: loadingPages } = useQuery({
    queryKey: queryKeys.seo.pages(selectedCompanyId!),
    queryFn: () => seoApi.listPages(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const isLoading = loadingKeywords || loadingPages;
  if (!selectedCompanyId) return null;

  const published = pages.filter((p) => p.status === "published").length;
  const needsWork = pages.filter((p) => p.status === "needs-work").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">SEO</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track keywords, manage page optimisation, and monitor rankings
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Keywords"
              value={keywords.length}
              icon={Search}
              href={`/${prefix}/seo/keywords`}
            />
            <StatCard
              label="Pages"
              value={pages.length}
              icon={FileText}
              href={`/${prefix}/seo/pages`}
            />
            <StatCard
              label="Published"
              value={published}
              icon={CheckCircle}
              href={`/${prefix}/seo/pages`}
            />
            <StatCard
              label="Needs Work"
              value={needsWork}
              icon={AlertCircle}
              href={`/${prefix}/seo/pages`}
            />
          </div>

          {keywords.length === 0 && pages.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No SEO data yet. Add keywords or pages to get started.
              </p>
              <Link
                to={`/${prefix}/seo/keywords`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Add a keyword <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <Link
              to={`/${prefix}/seo/keywords`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Search className="h-3.5 w-3.5" /> Keywords
            </Link>
            <Link
              to={`/${prefix}/seo/pages`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <FileText className="h-3.5 w-3.5" /> Pages
            </Link>
            <Link
              to={`/${prefix}/seo/pages`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <BarChart2 className="h-3.5 w-3.5" /> Rankings
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
