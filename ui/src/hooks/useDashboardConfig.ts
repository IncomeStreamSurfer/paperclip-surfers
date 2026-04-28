import { useState, useCallback, useEffect } from "react";
import { DEFAULT_WIDGET_ORDER, WIDGET_REGISTRY } from "../lib/dashboard-widgets";

const storageKey = (companyId: string) => `paperclip_dashboard_config_v2_${companyId}`;

export interface DashboardSection {
  id: string;
  label: string;
  collapsed: boolean;
}

interface DashboardConfig {
  order: string[];
  disabled: string[];
  sections: DashboardSection[];
  widgetSections: Record<string, string>; // widgetId → sectionId
}

function shouldBeEnabledByDefault(widgetId: string, businessType: string | null | undefined): boolean {
  const def = WIDGET_REGISTRY.find((w) => w.id === widgetId);
  if (!def) return false;
  if (def.defaultEnabled) return true;
  if (businessType && def.defaultEnabledBusinessTypes?.includes(businessType)) return true;
  return false;
}

function loadConfig(companyId: string, businessType?: string | null): DashboardConfig {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) {
      const disabled = WIDGET_REGISTRY
        .filter((w) => !shouldBeEnabledByDefault(w.id, businessType))
        .map((w) => w.id);
      return { order: DEFAULT_WIDGET_ORDER, disabled, sections: [], widgetSections: {} };
    }
    const parsed = JSON.parse(raw) as Partial<DashboardConfig>;
    const knownIds = new Set(WIDGET_REGISTRY.map((w) => w.id));
    const savedOrder = (parsed.order ?? []).filter((id) => knownIds.has(id));
    const missing = DEFAULT_WIDGET_ORDER.filter((id) => !savedOrder.includes(id));
    const order = [...savedOrder, ...missing];
    const savedDisabled = new Set((parsed.disabled ?? []).filter((id) => knownIds.has(id)));
    for (const id of missing) {
      if (!shouldBeEnabledByDefault(id, businessType)) {
        savedDisabled.add(id);
      }
    }
    // Load sections — validate shape
    const sections: DashboardSection[] = (parsed.sections ?? []).filter(
      (s): s is DashboardSection =>
        s !== null &&
        typeof s === "object" &&
        typeof (s as DashboardSection).id === "string" &&
        typeof (s as DashboardSection).label === "string",
    ).map((s) => ({ id: s.id, label: s.label, collapsed: !!s.collapsed }));

    const sectionIds = new Set(sections.map((s) => s.id));

    // Load widgetSections — filter to valid widget ids + known section ids
    const widgetSections: Record<string, string> = {};
    for (const [wId, sId] of Object.entries(parsed.widgetSections ?? {})) {
      if (knownIds.has(wId) && sectionIds.has(sId)) {
        widgetSections[wId] = sId;
      }
    }

    return { order, disabled: Array.from(savedDisabled), sections, widgetSections };
  } catch {
    return { order: DEFAULT_WIDGET_ORDER, disabled: [], sections: [], widgetSections: {} };
  }
}

function saveConfig(companyId: string, config: DashboardConfig) {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(config));
  } catch {
    // storage unavailable
  }
}

export interface UseDashboardConfigReturn {
  order: string[];
  disabled: Set<string>;
  sections: DashboardSection[];
  widgetSections: Record<string, string>;
  enableWidget: (id: string) => void;
  disableWidget: (id: string) => void;
  reorder: (newOrder: string[]) => void;
  reset: () => void;
  addSection: (label: string) => string;
  deleteSection: (id: string) => void;
  renameSection: (id: string, label: string) => void;
  toggleSection: (id: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  assignWidgetToSection: (widgetId: string, sectionId: string | null) => void;
}

export function useDashboardConfig(
  companyId: string | null,
  businessType?: string | null,
): UseDashboardConfigReturn {
  const [config, setConfig] = useState<DashboardConfig>(() =>
    companyId
      ? loadConfig(companyId, businessType)
      : { order: DEFAULT_WIDGET_ORDER, disabled: [], sections: [], widgetSections: {} },
  );

  // Reload when the active company changes
  useEffect(() => {
    if (companyId) setConfig(loadConfig(companyId, businessType));
    // businessType intentionally omitted: only reload on company switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (companyId) saveConfig(companyId, config);
  }, [companyId, config]);

  const enableWidget = useCallback((id: string) => {
    setConfig((prev) => ({ ...prev, disabled: prev.disabled.filter((d) => d !== id) }));
  }, []);

  const disableWidget = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      disabled: prev.disabled.includes(id) ? prev.disabled : [...prev.disabled, id],
    }));
  }, []);

  const reorder = useCallback((newOrder: string[]) => {
    setConfig((prev) => ({ ...prev, order: newOrder }));
  }, []);

  const reset = useCallback(() => {
    const disabled = WIDGET_REGISTRY
      .filter((w) => !shouldBeEnabledByDefault(w.id, businessType))
      .map((w) => w.id);
    const fresh: DashboardConfig = {
      order: DEFAULT_WIDGET_ORDER,
      disabled,
      sections: [],
      widgetSections: {},
    };
    setConfig(fresh);
    if (companyId) saveConfig(companyId, fresh);
  }, [companyId, businessType]);

  const addSection = useCallback((label: string): string => {
    const id = crypto.randomUUID();
    setConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, { id, label, collapsed: false }],
    }));
    return id;
  }, []);

  const deleteSection = useCallback((sectionId: string) => {
    setConfig((prev) => {
      const newWidgetSections = { ...prev.widgetSections };
      for (const [wId, sId] of Object.entries(newWidgetSections)) {
        if (sId === sectionId) delete newWidgetSections[wId];
      }
      return {
        ...prev,
        sections: prev.sections.filter((s) => s.id !== sectionId),
        widgetSections: newWidgetSections,
      };
    });
  }, []);

  const renameSection = useCallback((sectionId: string, label: string) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, label } : s,
      ),
    }));
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s,
      ),
    }));
  }, []);

  const collapseAll = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({ ...s, collapsed: true })),
    }));
  }, []);

  const expandAll = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({ ...s, collapsed: false })),
    }));
  }, []);

  const assignWidgetToSection = useCallback(
    (widgetId: string, sectionId: string | null) => {
      setConfig((prev) => {
        const newWidgetSections = { ...prev.widgetSections };
        if (sectionId === null) {
          delete newWidgetSections[widgetId];
        } else {
          newWidgetSections[widgetId] = sectionId;
        }
        return { ...prev, widgetSections: newWidgetSections };
      });
    },
    [],
  );

  return {
    order: config.order,
    disabled: new Set(config.disabled),
    sections: config.sections,
    widgetSections: config.widgetSections,
    enableWidget,
    disableWidget,
    reorder,
    reset,
    addSection,
    deleteSection,
    renameSection,
    toggleSection,
    collapseAll,
    expandAll,
    assignWidgetToSection,
  };
}
