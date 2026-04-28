import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, X, Check, DollarSign } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { crmApi } from "../api/crm";
import type { CrmDeal } from "../api/crm";
import { queryKeys } from "../lib/queryKeys";
import { CRM_DEAL_STAGES, CRM_DEAL_STAGE_LABELS } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "../components/PageSkeleton";

function formatCents(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  qualified: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  proposal: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "closed-won": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "closed-lost": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

type DealFormState = {
  title: string;
  valueDollars: string;
  currency: string;
  stage: string;
  contactId: string;
  expectedCloseDate: string;
  notes: string;
};

const EMPTY_FORM: DealFormState = {
  title: "",
  valueDollars: "",
  currency: "USD",
  stage: "lead",
  contactId: "",
  expectedCloseDate: "",
  notes: "",
};

function dealToForm(d: CrmDeal): DealFormState {
  return {
    title: d.title,
    valueDollars: d.valueCents != null ? String(d.valueCents / 100) : "",
    currency: d.currency,
    stage: d.stage,
    contactId: d.contactId ?? "",
    expectedCloseDate: d.expectedCloseDate
      ? new Date(d.expectedCloseDate).toISOString().slice(0, 10)
      : "",
    notes: d.notes ?? "",
  };
}

function formToApiData(form: DealFormState) {
  const dollars = parseFloat(form.valueDollars);
  return {
    title: form.title.trim(),
    valueCents: !isNaN(dollars) && form.valueDollars.trim() !== "" ? Math.round(dollars * 100) : null,
    currency: form.currency || "USD",
    stage: form.stage,
    contactId: form.contactId.trim() || null,
    expectedCloseDate: form.expectedCloseDate
      ? new Date(form.expectedCloseDate).toISOString()
      : null,
    notes: form.notes.trim() || null,
  };
}

export function CrmDeals() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DealFormState>(EMPTY_FORM);
  const [filterStage, setFilterStage] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board">("board");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "CRM", href: `/${selectedCompanyId}/crm` },
      { label: "Deals" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name, selectedCompanyId]);

  const listKey = queryKeys.crm.deals(selectedCompanyId!, filterStage ? { stage: filterStage } : undefined);

  const { data: deals, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => crmApi.listDeals(selectedCompanyId!, filterStage ? { stage: filterStage } : undefined),
    enabled: !!selectedCompanyId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.crm.deals(selectedCompanyId!) });
  };

  const createMutation = useMutation({
    mutationFn: () => crmApi.createDeal(selectedCompanyId!, formToApiData(form)),
    onSuccess: () => {
      pushToast({ title: "Deal created", tone: "success" });
      setForm(EMPTY_FORM);
      setShowForm(false);
      invalidate();
    },
    onError: () => pushToast({ title: "Failed to create deal", tone: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => crmApi.updateDeal(editingId!, formToApiData(form)),
    onSuccess: () => {
      pushToast({ title: "Deal updated", tone: "success" });
      setEditingId(null);
      invalidate();
    },
    onError: () => pushToast({ title: "Failed to update deal", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteDeal(id),
    onSuccess: () => {
      pushToast({ title: "Deal deleted", tone: "success" });
      invalidate();
    },
    onError: () => pushToast({ title: "Failed to delete deal", tone: "error" }),
  });

  function startEdit(d: CrmDeal) {
    setEditingId(d.id);
    setForm(dealToForm(d));
    setShowForm(false);
  }

  if (isLoading) return <PageSkeleton />;

  const list = deals ?? [];

  // Group by stage for board view
  const byStage = CRM_DEAL_STAGES.map((stage) => ({
    stage,
    label: CRM_DEAL_STAGE_LABELS[stage] ?? stage,
    deals: list.filter((d) => d.stage === stage),
    total: list.filter((d) => d.stage === stage).reduce((s, d) => s + (d.valueCents ?? 0), 0),
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Deals</h1>
          <p className="text-sm text-muted-foreground">{list.length} deal{list.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {(["board", "list"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <Button size="sm" className="gap-1" onClick={() => { setShowForm((v) => !v); setEditingId(null); }}>
            <Plus className="h-3.5 w-3.5" />
            New deal
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <DealForm
          form={form}
          setForm={setForm}
          onSubmit={() => createMutation.mutate()}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          isPending={createMutation.isPending}
          submitLabel="Create deal"
        />
      )}

      {/* Board view */}
      {viewMode === "board" && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {byStage.map(({ stage, label, deals: stageDeals, total }) => (
              <div key={stage} className="w-56 flex flex-col gap-2">
                {/* Column header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${STAGE_COLORS[stage]?.split(" ")[0]}`} />
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-xs text-muted-foreground">({stageDeals.length})</span>
                  </div>
                  {total > 0 && (
                    <span className="text-[10px] text-muted-foreground">{formatCents(total)}</span>
                  )}
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-1.5 min-h-[60px]">
                  {stageDeals.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-center">
                      <p className="text-[11px] text-muted-foreground">Empty</p>
                    </div>
                  ) : (
                    stageDeals.map((d) => (
                      editingId === d.id ? (
                        <Card key={d.id} className="p-3">
                          <DealForm
                            form={form}
                            setForm={setForm}
                            onSubmit={() => updateMutation.mutate()}
                            onCancel={() => setEditingId(null)}
                            isPending={updateMutation.isPending}
                            submitLabel="Save"
                            compact
                          />
                        </Card>
                      ) : (
                        <Card key={d.id} className="p-3 group hover:bg-accent/20 transition-colors">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-medium leading-snug flex-1">{d.title}</p>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                className="p-0.5 hover:text-foreground text-muted-foreground"
                                onClick={() => startEdit(d)}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                className="p-0.5 hover:text-destructive text-muted-foreground"
                                onClick={() => deleteMutation.mutate(d.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {d.valueCents != null && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{formatCents(d.valueCents, d.currency)}</span>
                            </div>
                          )}
                          {d.expectedCloseDate && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Due {new Date(d.expectedCloseDate).toLocaleDateString()}
                            </p>
                          )}
                        </Card>
                      )
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <>
          {/* Stage filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {["", ...CRM_DEAL_STAGES].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStage(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterStage === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "" ? "All" : CRM_DEAL_STAGE_LABELS[s] ?? s}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">No deals found.</p>
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl">
              {list.map((d) =>
                editingId === d.id ? (
                  <Card key={d.id} className="p-4">
                    <DealForm
                      form={form}
                      setForm={setForm}
                      onSubmit={() => updateMutation.mutate()}
                      onCancel={() => setEditingId(null)}
                      isPending={updateMutation.isPending}
                      submitLabel="Save"
                    />
                  </Card>
                ) : (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-accent/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.valueCents != null && `${formatCents(d.valueCents, d.currency)} · `}
                        {d.expectedCloseDate && `Close ${new Date(d.expectedCloseDate).toLocaleDateString()} · `}
                      </p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STAGE_COLORS[d.stage] ?? "bg-muted text-muted-foreground"}`}>
                      {CRM_DEAL_STAGE_LABELS[d.stage] ?? d.stage}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(d.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── DealForm ─────────────────────────────────────────────────────────────────

function DealForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
  compact = false,
}: {
  form: DealFormState;
  setForm: React.Dispatch<React.SetStateAction<DealFormState>>;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
  compact?: boolean;
}) {
  const set = (field: keyof DealFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (compact) {
    return (
      <div className="space-y-2">
        <Input value={form.title} onChange={set("title")} placeholder="Deal title" autoFocus className="text-xs h-7" />
        <div className="flex gap-1">
          <Input value={form.valueDollars} onChange={set("valueDollars")} placeholder="Value" type="number" min="0" className="text-xs h-7 w-24" />
          <select
            value={form.stage}
            onChange={set("stage")}
            className="flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            {CRM_DEAL_STAGES.map((s) => (
              <option key={s} value={s}>{CRM_DEAL_STAGE_LABELS[s] ?? s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 text-xs px-2">
            <X className="h-3 w-3 mr-0.5" /> Cancel
          </Button>
          <Button size="sm" disabled={!form.title.trim() || isPending} onClick={onSubmit} className="h-6 text-xs px-2">
            {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-0.5" /> : <Check className="h-3 w-3 mr-0.5" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Title *</label>
        <Input value={form.title} onChange={set("title")} placeholder="Enterprise deal with Acme" autoFocus />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Value</label>
          <Input value={form.valueDollars} onChange={set("valueDollars")} type="number" min="0" placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Currency</label>
          <Input value={form.currency} onChange={set("currency")} placeholder="USD" maxLength={10} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Stage</label>
          <select
            value={form.stage}
            onChange={set("stage")}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            {CRM_DEAL_STAGES.map((s) => (
              <option key={s} value={s}>{CRM_DEAL_STAGE_LABELS[s] ?? s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Expected close date</label>
        <Input value={form.expectedCloseDate} onChange={set("expectedCloseDate")} type="date" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <textarea
          value={form.notes}
          onChange={set("notes")}
          rows={2}
          placeholder="Any notes about this deal…"
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button size="sm" disabled={!form.title.trim() || isPending} onClick={onSubmit}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
