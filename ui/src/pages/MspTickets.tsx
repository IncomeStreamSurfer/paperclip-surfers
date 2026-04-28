import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { mspApi, type MspTicket } from "../api/msp";
import { queryKeys } from "../lib/queryKeys";
import { Ticket, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";

const TICKET_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  open: "text-blue-600",
  in_progress: "text-purple-600",
  waiting: "text-yellow-600",
  resolved: "text-green-600",
  closed: "text-muted-foreground",
};

function TicketRow({
  ticket,
  companyId,
  clientName,
}: {
  ticket: MspTicket;
  companyId: string;
  clientName: string;
}) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ticket.title);
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [description, setDescription] = useState(ticket.description ?? "");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.msp.tickets(companyId) });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof mspApi.updateTicket>[2]) =>
      mspApi.updateTicket(companyId, ticket.id, data),
    onSuccess: () => { invalidate(); setEditing(false); },
    onError: () => pushToast({ title: "Failed to update ticket", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => mspApi.deleteTicket(companyId, ticket.id),
    onSuccess: invalidate,
    onError: () => pushToast({ title: "Failed to delete ticket", tone: "error" }),
  });

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-sm font-medium px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Ticket title"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none"
          >
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none"
          >
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          placeholder="Description (optional)"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={!title.trim() || updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({ title: title.trim(), status, priority, description: description.trim() || null })
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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{ticket.title}</p>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority] ?? "bg-muted text-muted-foreground"}`}>
            {ticket.priority}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {clientName}
          {" · "}
          <span className={STATUS_COLORS[ticket.status] ?? ""}>{ticket.status.replace("_", " ")}</span>
          {" · "}
          {new Date(ticket.createdAt).toLocaleDateString()}
        </p>
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
          onClick={() => { if (confirm(`Delete ticket "${ticket.title}"?`)) deleteMutation.mutate(); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MspTickets() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newPriority, setNewPriority] = useState<string>("medium");

  useEffect(() => {
    setBreadcrumbs([
      { label: "MSP", href: "/msp" },
      { label: "Tickets" },
    ]);
  }, [setBreadcrumbs]);

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: queryKeys.msp.tickets(selectedCompanyId!),
    queryFn: () => mspApi.listTickets(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: clientsData } = useQuery({
    queryKey: queryKeys.msp.clients(selectedCompanyId!),
    queryFn: () => mspApi.listClients(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const clients = clientsData?.clients ?? [];
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const createMutation = useMutation({
    mutationFn: () =>
      mspApi.createTicket(selectedCompanyId!, {
        title: newTitle.trim(),
        clientId: newClientId || null,
        priority: newPriority,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.msp.tickets(selectedCompanyId!) });
      setNewTitle("");
      setNewClientId("");
      setNewPriority("medium");
      setShowCreate(false);
    },
    onError: () => pushToast({ title: "Failed to create ticket", tone: "error" }),
  });

  if (!selectedCompanyId) return null;
  if (ticketsLoading) return <PageSkeleton variant="list" />;

  const tickets = ticketsData?.tickets ?? [];
  const openTickets = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");
  const closedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed");

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">MSP Tickets</h2>
          <p className="text-sm text-muted-foreground">
            {openTickets.length} open · {closedTickets.length} resolved
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> New Ticket
        </Button>
      </div>

      {showCreate && (
        <form
          className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card"
          onSubmit={(e) => { e.preventDefault(); if (!newTitle.trim()) return; createMutation.mutate(); }}
        >
          <h3 className="text-sm font-medium">New Ticket</h3>
          <input
            type="text"
            placeholder="Ticket title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              className="text-sm px-3 py-1.5 border border-border rounded bg-background focus:outline-none"
            >
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="text-sm px-3 py-1.5 border border-border rounded bg-background focus:outline-none"
            >
              {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!newTitle.trim() || createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      )}

      {tickets.length === 0 && !showCreate ? (
        <EmptyState icon={Ticket} message="No tickets yet. Create one to start tracking support requests." />
      ) : (
        <div className="flex flex-col gap-4">
          {openTickets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open</p>
              {openTickets.map((t) => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  companyId={selectedCompanyId}
                  clientName={t.clientId ? clientMap[t.clientId] ?? "Unknown" : "No client"}
                />
              ))}
            </div>
          )}
          {closedTickets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resolved / Closed</p>
              {closedTickets.map((t) => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  companyId={selectedCompanyId}
                  clientName={t.clientId ? clientMap[t.clientId] ?? "Unknown" : "No client"}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
