import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { crmApi } from "../api/crm";
import { queryKeys } from "../lib/queryKeys";
import { CRM_DEAL_STAGES, CRM_DEAL_STAGE_LABELS } from "@paperclipai/shared";
import { Users, Briefcase, TrendingUp, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function CrmOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "CRM" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const contactsQuery = useQuery({
    queryKey: queryKeys.crm.contacts(selectedCompanyId!),
    queryFn: () => crmApi.listContacts(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const dealsQuery = useQuery({
    queryKey: queryKeys.crm.deals(selectedCompanyId!),
    queryFn: () => crmApi.listDeals(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (contactsQuery.isLoading || dealsQuery.isLoading) return <PageSkeleton />;

  const contacts = contactsQuery.data ?? [];
  const deals = dealsQuery.data ?? [];

  const customers = contacts.filter((c) => c.status === "customer").length;
  const leads = contacts.filter((c) => c.status === "lead" || c.status === "prospect").length;
  const openDeals = deals.filter(
    (d) => d.stage !== "closed-won" && d.stage !== "closed-lost",
  );
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.valueCents ?? 0), 0);
  const wonDeals = deals.filter((d) => d.stage === "closed-won");
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.valueCents ?? 0), 0);

  const dealsByStage = CRM_DEAL_STAGES.map((stage) => ({
    stage,
    label: CRM_DEAL_STAGE_LABELS[stage] ?? stage,
    deals: deals.filter((d) => d.stage === stage),
    value: deals
      .filter((d) => d.stage === stage)
      .reduce((sum, d) => sum + (d.valueCents ?? 0), 0),
  }));

  const recentContacts = contacts.slice(0, 5);
  const recentDeals = deals.slice(0, 5);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">CRM Overview</h1>
          <p className="text-sm text-muted-foreground">Contacts, leads, and deals pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="contacts">
            <Button size="sm" variant="outline" className="gap-1">
              <Users className="h-3.5 w-3.5" /> Contacts
            </Button>
          </Link>
          <Link to="deals">
            <Button size="sm" className="gap-1">
              <Briefcase className="h-3.5 w-3.5" /> Deals
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Contacts", value: contacts.length, icon: Users, sub: `${customers} customers` },
          { label: "Active Leads", value: leads, icon: TrendingUp, sub: `${contacts.length - customers} non-customers` },
          { label: "Pipeline Value", value: formatCents(pipelineValue), icon: DollarSign, sub: `${openDeals.length} open deals` },
          { label: "Closed Won", value: formatCents(wonValue), icon: Briefcase, sub: `${wonDeals.length} deals` },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">{kpi.label}</span>
              <kpi.icon className="h-3.5 w-3.5" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {/* Pipeline by stage */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {dealsByStage.map(({ stage, label, deals: stageDeals, value }) => (
            <Card key={stage} className="p-3 space-y-1 text-center">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-xl font-bold">{stageDeals.length}</p>
              {value > 0 && (
                <p className="text-[11px] text-muted-foreground">{formatCents(value)}</p>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Two-column: recent contacts + recent deals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent contacts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Contacts</h2>
            <Link to="contacts" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {recentContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentContacts.map((c) => (
                <Link key={c.id} to={`contacts/${c.id}`}>
                  <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-accent/20 transition-colors">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                      {c.firstName[0]}{c.lastName[0] ?? ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.organization ?? c.email ?? "—"}</p>
                    </div>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">
                      {c.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent deals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Deals</h2>
            <Link to="deals" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {recentDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentDeals.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {CRM_DEAL_STAGE_LABELS[d.stage] ?? d.stage}
                      {d.valueCents != null && ` · ${formatCents(d.valueCents, d.currency)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
