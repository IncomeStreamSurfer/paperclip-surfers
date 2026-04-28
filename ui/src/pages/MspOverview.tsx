import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { mspApi } from "../api/msp";
import { queryKeys } from "../lib/queryKeys";
import { Building2, Ticket, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-500",
  medium: "text-yellow-600",
  low: "text-muted-foreground",
};

export function MspOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "MSP" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const clientsQuery = useQuery({
    queryKey: queryKeys.msp.clients(selectedCompanyId!),
    queryFn: () => mspApi.listClients(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const ticketsQuery = useQuery({
    queryKey: queryKeys.msp.tickets(selectedCompanyId!),
    queryFn: () => mspApi.listTickets(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (clientsQuery.isLoading || ticketsQuery.isLoading) return <PageSkeleton />;

  const clients = clientsQuery.data?.clients ?? [];
  const tickets = ticketsQuery.data?.tickets ?? [];

  const activeClients = clients.filter((c) => c.status === "active").length;
  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
  const criticalTickets = tickets.filter(
    (t) => t.priority === "critical" && t.status !== "resolved" && t.status !== "closed",
  ).length;
  const resolvedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  const recentTickets = [...tickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">MSP Dashboard</h1>
          <p className="text-sm text-muted-foreground">Managed service provider — clients and tickets</p>
        </div>
        <div className="flex gap-2">
          <Link to="clients">
            <Button size="sm" variant="outline" className="gap-1">
              <Building2 className="h-3.5 w-3.5" /> Clients
            </Button>
          </Link>
          <Link to="tickets">
            <Button size="sm" className="gap-1">
              <Ticket className="h-3.5 w-3.5" /> Tickets
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Clients", value: clients.length, icon: Building2, sub: `${activeClients} active` },
          { label: "Open Tickets", value: openTickets, icon: Ticket, sub: `${criticalTickets} critical` },
          { label: "Resolved", value: resolvedTickets, icon: CheckCircle, sub: "closed tickets" },
          { label: "Critical", value: criticalTickets, icon: AlertCircle, sub: "need attention", warn: criticalTickets > 0 },
        ].map((kpi) => (
          <Card key={kpi.label} className={`p-4 space-y-1 ${kpi.warn ? "border-red-300 dark:border-red-800" : ""}`}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">{kpi.label}</span>
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.warn ? "text-red-500" : ""}`} />
            </div>
            <p className={`text-2xl font-bold ${kpi.warn ? "text-red-600" : ""}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="clients">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> All Clients
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="tickets">
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Ticket className="h-4 w-4" /> All Tickets
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Recent tickets */}
      {recentTickets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Tickets</h2>
            <Link to="tickets" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentTickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.clientId ? clientMap[t.clientId] ?? "Unknown client" : "No client"}
                    {" · "}
                    <span className={PRIORITY_COLORS[t.priority] ?? ""}>{t.priority}</span>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 capitalize">{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
