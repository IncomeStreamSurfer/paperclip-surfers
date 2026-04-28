import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { designApi } from "../api/design";
import { queryKeys } from "../lib/queryKeys";
import { Image, Sparkles, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";
import { cn } from "../lib/utils";
import { DESIGN_ASSET_STYLE_LABELS, type DesignAssetStyle } from "@paperclipai/shared";

export function DesignOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Design Studio" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const statsQuery = useQuery({
    queryKey: queryKeys.design.stats(selectedCompanyId!),
    queryFn: () => designApi.getStats(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const assetsQuery = useQuery({
    queryKey: queryKeys.design.assets(selectedCompanyId!, { status: "done" }),
    queryFn: () => designApi.listAssets(selectedCompanyId!, { status: "done", limit: 12 }),
    enabled: !!selectedCompanyId,
  });

  if (statsQuery.isLoading || assetsQuery.isLoading) return <PageSkeleton />;

  const stats = statsQuery.data ?? { pending: 0, generating: 0, done: 0, failed: 0 };
  const recentAssets = assetsQuery.data ?? [];

  const totalGenerated = stats.done ?? 0;
  const inProgress = (stats.generating ?? 0) + (stats.pending ?? 0);
  const failed = stats.failed ?? 0;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Design Studio</h1>
          <p className="text-sm text-muted-foreground">AI-generated images and marketing assets</p>
        </div>
        <Link to="assets">
          <Button size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Image
          </Button>
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Images Generated",
            value: totalGenerated,
            icon: <Image className="h-4 w-4 text-primary" />,
            color: "text-primary",
          },
          {
            label: "In Progress",
            value: inProgress,
            icon: <Loader2 className="h-4 w-4 text-blue-500" />,
            color: "text-blue-500",
          },
          {
            label: "Ready",
            value: totalGenerated,
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
            color: "text-green-500",
          },
          {
            label: "Failed",
            value: failed,
            icon: <AlertCircle className="h-4 w-4 text-destructive" />,
            color: "text-destructive",
          },
        ].map((card) => (
          <Card key={card.label} className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              {card.icon}
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", card.color)}>{card.value}</p>
          </Card>
        ))}
      </div>

      {/* Recent gallery */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Generations</h2>
          <Link
            to="assets"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentAssets.length === 0 ? (
          <Card className="p-10 flex flex-col items-center gap-3 text-center">
            <Image className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">No images yet</p>
              <p className="text-xs text-muted-foreground">
                Generate your first image to get started.
              </p>
            </div>
            <Link to="assets">
              <Button size="sm" variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Open Studio
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {recentAssets.map((asset) => (
              <div
                key={asset.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-muted aspect-square"
              >
                {asset.imageUrl ? (
                  <img
                    src={asset.imageUrl}
                    alt={asset.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white font-medium truncate">{asset.title}</p>
                  <p className="text-[10px] text-white/70">
                    {DESIGN_ASSET_STYLE_LABELS[asset.style as DesignAssetStyle] ?? asset.style}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              to: "assets",
              label: "Image Generator",
              description: "Create marketing images, social media graphics, illustrations",
              icon: <Sparkles className="h-5 w-5 text-primary" />,
            },
            {
              to: "assets?style=realistic",
              label: "Product Shots",
              description: "Realistic product photography-style renders",
              icon: <Image className="h-5 w-5 text-blue-500" />,
            },
          ].map((action) => (
            <Link key={action.to} to={action.to}>
              <Card className="p-4 hover:bg-accent/40 transition-colors cursor-pointer h-full">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{action.icon}</div>
                  <div>
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
