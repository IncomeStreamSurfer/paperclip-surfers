import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  PenLine,
  FileText,
  CheckCircle,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { copywritingApi } from "../api/copywriting";
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

export function CopywritingOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const prefix = selectedCompany?.issuePrefix ?? "";

  useEffect(() => {
    setBreadcrumbs([{ label: "Copywriting" }]);
  }, [setBreadcrumbs]);

  const { data: briefs = [], isLoading } = useQuery({
    queryKey: queryKeys.copywriting.briefs(selectedCompanyId!),
    queryFn: () => copywritingApi.listBriefs(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) return null;

  const inProgress = briefs.filter((b) => b.status === "in-progress").length;
  const review = briefs.filter((b) => b.status === "review").length;
  const published = briefs.filter((b) => b.status === "published").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <PenLine className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Copywriting</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage content briefs, track writing progress, and publish copy
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
              label="Total Briefs"
              value={briefs.length}
              icon={FileText}
              href={`/${prefix}/copywriting/briefs`}
            />
            <StatCard
              label="In Progress"
              value={inProgress}
              icon={Clock}
              href={`/${prefix}/copywriting/briefs`}
            />
            <StatCard
              label="In Review"
              value={review}
              icon={CheckCircle}
              href={`/${prefix}/copywriting/briefs`}
            />
            <StatCard
              label="Published"
              value={published}
              icon={PenLine}
              href={`/${prefix}/copywriting/briefs`}
            />
          </div>

          {briefs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <PenLine className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No briefs yet. Create your first content brief to get started.
              </p>
              <Link
                to={`/${prefix}/copywriting/briefs`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Create a brief <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <Link
              to={`/${prefix}/copywriting/briefs`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <FileText className="h-3.5 w-3.5" /> Briefs
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
