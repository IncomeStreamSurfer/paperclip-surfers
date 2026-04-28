import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, X, Check } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { crmApi } from "../api/crm";
import type { CrmContact } from "../api/crm";
import { queryKeys } from "../lib/queryKeys";
import { CRM_CONTACT_STATUSES } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "../components/PageSkeleton";

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  prospect: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  customer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  churned: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  archived: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
  churned: "Churned",
  archived: "Archived",
};

type ContactFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  organization: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: ContactFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  organization: "",
  status: "lead",
  notes: "",
};

function contactToForm(c: CrmContact): ContactFormState {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email ?? "",
    phone: c.phone ?? "",
    jobTitle: c.jobTitle ?? "",
    organization: c.organization ?? "",
    status: c.status,
    notes: c.notes ?? "",
  };
}

export function CrmContacts() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "CRM", href: `/${selectedCompanyId}/crm` },
      { label: "Contacts" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name, selectedCompanyId]);

  const listKey = queryKeys.crm.contacts(selectedCompanyId!, filterStatus ? { status: filterStatus } : undefined);

  const { data: contacts, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => crmApi.listContacts(selectedCompanyId!, filterStatus ? { status: filterStatus } : undefined),
    enabled: !!selectedCompanyId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.crm.contacts(selectedCompanyId!) });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      crmApi.createContact(selectedCompanyId!, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        organization: form.organization.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      }),
    onSuccess: () => {
      pushToast({ title: "Contact created", tone: "success" });
      setForm(EMPTY_FORM);
      setShowForm(false);
      invalidate();
    },
    onError: () => pushToast({ title: "Failed to create contact", tone: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      crmApi.updateContact(editingId!, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        organization: form.organization.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      }),
    onSuccess: () => {
      pushToast({ title: "Contact updated", tone: "success" });
      setEditingId(null);
      invalidate();
    },
    onError: () => pushToast({ title: "Failed to update contact", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteContact(id),
    onSuccess: () => {
      pushToast({ title: "Contact deleted", tone: "success" });
      invalidate();
    },
    onError: () => pushToast({ title: "Failed to delete contact", tone: "error" }),
  });

  function startEdit(c: CrmContact) {
    setEditingId(c.id);
    setForm(contactToForm(c));
    setShowForm(false);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  if (isLoading) return <PageSkeleton />;

  const list = contacts ?? [];

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{list.length} contact{list.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setShowForm((v) => !v); setEditingId(null); }}>
          <Plus className="h-3.5 w-3.5" />
          New contact
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {["", ...CRM_CONTACT_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "" ? "All" : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <ContactForm
          form={form}
          setForm={setForm}
          onSubmit={() => createMutation.mutate()}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          isPending={createMutation.isPending}
          submitLabel="Create contact"
        />
      )}

      {/* Contact list */}
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No contacts found.</p>
          {filterStatus && (
            <button
              className="mt-2 text-xs text-primary hover:underline"
              onClick={() => setFilterStatus("")}
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            editingId === c.id ? (
              <Card key={c.id} className="p-4">
                <ContactForm
                  form={form}
                  setForm={setForm}
                  onSubmit={() => updateMutation.mutate()}
                  onCancel={cancelEdit}
                  isPending={updateMutation.isPending}
                  submitLabel="Save"
                />
              </Card>
            ) : (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-accent/20 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                  {c.firstName[0]}{c.lastName[0] ?? ""}
                </div>
                <Link to={c.id} className="flex-1 min-w-0 hover:underline">
                  <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.jobTitle, c.organization].filter(Boolean).join(" · ") || c.email || "—"}
                  </p>
                </Link>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => startEdit(c)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ContactForm ──────────────────────────────────────────────────────────────

function ContactForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  form: ContactFormState;
  setForm: React.Dispatch<React.SetStateAction<ContactFormState>>;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const set = (field: keyof ContactFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">First name *</label>
          <Input value={form.firstName} onChange={set("firstName")} placeholder="Jane" autoFocus />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Last name</label>
          <Input value={form.lastName} onChange={set("lastName")} placeholder="Smith" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <Input type="email" value={form.email} onChange={set("email")} placeholder="jane@acme.com" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Phone</label>
          <Input value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Job title</label>
          <Input value={form.jobTitle} onChange={set("jobTitle")} placeholder="VP of Engineering" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Organization</label>
          <Input value={form.organization} onChange={set("organization")} placeholder="Acme Corp" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <select
          value={form.status}
          onChange={set("status")}
          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        >
          {CRM_CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <textarea
          value={form.notes}
          onChange={set("notes")}
          rows={2}
          placeholder="Any notes about this contact…"
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          disabled={!form.firstName.trim() || isPending}
          onClick={onSubmit}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
