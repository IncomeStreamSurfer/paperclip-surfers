import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { mspApi, type MspClient } from "../api/msp";
import { queryKeys } from "../lib/queryKeys";
import { Building2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";

const CLIENT_STATUSES = ["active", "inactive", "churned"] as const;
const CLIENT_TIERS = ["standard", "premium", "enterprise"] as const;

const TIER_COLORS: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  premium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

function ClientRow({ client, companyId }: { client: MspClient; companyId: string }) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [domain, setDomain] = useState(client.domain ?? "");
  const [status, setStatus] = useState(client.status);
  const [tier, setTier] = useState(client.tier);
  const [contactName, setContactName] = useState(client.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(client.contactEmail ?? "");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.msp.clients(companyId) });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof mspApi.updateClient>[2]) =>
      mspApi.updateClient(companyId, client.id, data),
    onSuccess: () => { invalidate(); setEditing(false); },
    onError: () => pushToast({ title: "Failed to update client", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => mspApi.deleteClient(companyId, client.id),
    onSuccess: invalidate,
    onError: () => pushToast({ title: "Failed to delete client", tone: "error" }),
  });

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Client name"
          />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Domain (e.g. acme.com)"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none"
          >
            {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none"
          >
            {CLIENT_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Contact name"
          />
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Contact email"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                name: name.trim(),
                domain: domain.trim() || null,
                status,
                tier,
                contactName: contactName.trim() || null,
                contactEmail: contactEmail.trim() || null,
              })
            }
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{client.name}</p>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${TIER_COLORS[client.tier] ?? "bg-muted text-muted-foreground"}`}>
            {client.tier}
          </span>
          <span className="text-[11px] text-muted-foreground">{client.status}</span>
        </div>
        {(client.domain || client.contactName) && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {[client.domain, client.contactName, client.contactEmail].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setEditing(true)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          onClick={() => { if (confirm(`Delete client "${client.name}"?`)) deleteMutation.mutate(); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MspClients() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newTier, setNewTier] = useState<string>("standard");

  useEffect(() => {
    setBreadcrumbs([
      { label: "MSP", href: "/msp" },
      { label: "Clients" },
    ]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.msp.clients(selectedCompanyId!),
    queryFn: () => mspApi.listClients(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      mspApi.createClient(selectedCompanyId!, {
        name: newName.trim(),
        domain: newDomain.trim() || null,
        tier: newTier,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.msp.clients(selectedCompanyId!) });
      setNewName("");
      setNewDomain("");
      setNewTier("standard");
      setShowCreate(false);
    },
    onError: () => pushToast({ title: "Failed to create client", tone: "error" }),
  });

  if (!selectedCompanyId) return null;
  if (isLoading) return <PageSkeleton variant="list" />;

  const clients = data?.clients ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">MSP Clients</h2>
          <p className="text-sm text-muted-foreground">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> New Client
        </Button>
      </div>

      {showCreate && (
        <form
          className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card"
          onSubmit={(e) => { e.preventDefault(); if (!newName.trim()) return; createMutation.mutate(); }}
        >
          <h3 className="text-sm font-medium">New Client</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Client name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              required
            />
            <input
              type="text"
              placeholder="Domain (optional)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <select
            value={newTier}
            onChange={(e) => setNewTier(e.target.value)}
            className="text-sm px-3 py-1.5 border border-border rounded bg-background focus:outline-none"
          >
            {CLIENT_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!newName.trim() || createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      )}

      {clients.length === 0 && !showCreate ? (
        <EmptyState icon={Building2} message="No MSP clients yet. Add one to get started." />
      ) : (
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} companyId={selectedCompanyId} />
          ))}
        </div>
      )}
    </div>
  );
}
