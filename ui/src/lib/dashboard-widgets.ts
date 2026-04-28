/** Widget size in grid columns (out of 4). */
export type WidgetSize = "sm" | "md" | "lg";
// sm = 1 col, md = 2 col, lg = 4 col

export interface WidgetDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  /** Default grid column span */
  size: WidgetSize;
  defaultEnabled: boolean;
  /**
   * If set, this widget is automatically enabled for companies whose businessType
   * is in this list — even if `defaultEnabled` is false globally.
   */
  defaultEnabledBusinessTypes?: string[];
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: "run-activity",
    title: "Run Activity",
    subtitle: "Heartbeat outcomes per day",
    description: "Heartbeat run outcomes per day",
    size: "sm",
    defaultEnabled: true,
  },
  {
    id: "priority-chart",
    title: "Issues by Priority",
    subtitle: "By priority level",
    description: "Breakdown of issues by priority level",
    size: "sm",
    defaultEnabled: true,
  },
  {
    id: "status-chart",
    title: "Issues by Status",
    subtitle: "By status",
    description: "Distribution of issues across status categories",
    size: "sm",
    defaultEnabled: true,
  },
  {
    id: "success-rate",
    title: "Success Rate",
    subtitle: "Heartbeat run outcomes",
    description: "Ratio of succeeded to failed heartbeat runs",
    size: "sm",
    defaultEnabled: true,
  },
  {
    id: "token-usage",
    title: "Token Usage by Agent",
    subtitle: "Input + output tokens",
    description: "Input + output token consumption per agent",
    size: "md",
    defaultEnabled: true,
  },
  {
    id: "burndown",
    title: "Issue Burndown",
    subtitle: "Opened vs closed",
    description: "Daily opened vs closed issue trend",
    size: "md",
    defaultEnabled: true,
  },
  {
    id: "tasks-by-agent",
    title: "Tasks by Agent",
    subtitle: "Open / in-progress / done",
    description: "Issue status breakdown per agent",
    size: "md",
    defaultEnabled: true,
  },
  {
    id: "agent-time",
    title: "Agent Time Worked",
    subtitle: "Wall-clock time per agent",
    description: "Total wall-clock time for completed runs per agent",
    size: "md",
    defaultEnabled: true,
  },
  {
    id: "issues-by-project",
    title: "Issues by Project",
    subtitle: "By project",
    description: "Open, in-progress, and done issues grouped by project",
    size: "md",
    defaultEnabled: true,
  },
  {
    id: "cycle-time",
    title: "Cycle Time",
    subtitle: "Open → closed",
    description: "Average and median time from open to closed",
    size: "sm",
    defaultEnabled: true,
  },
  {
    id: "cost-trend",
    title: "Cost Trend",
    subtitle: "Daily AI spend",
    description: "Daily AI spend over the selected period",
    size: "sm",
    defaultEnabled: true,
  },
  {
    id: "agent-status",
    title: "Agent Status",
    subtitle: "Current",
    description: "Donut chart of agent states: running, idle, paused, error",
    size: "sm",
    defaultEnabled: true,
  },
  {
    id: "blocked-issues",
    title: "Blocked Issues",
    subtitle: "Current",
    description: "Issues currently in blocked status",
    size: "sm",
    defaultEnabled: false,
  },
  {
    id: "project-health",
    title: "Project Health",
    subtitle: "All projects",
    description: "Completion progress, overdue status, and blocked counts per project",
    size: "md",
    defaultEnabled: true,
  },
  {
    id: "sprint-overview",
    title: "Sprint Overview",
    subtitle: "Active sprints",
    description: "Active and planning sprints with completion status",
    size: "md",
    defaultEnabled: false,
    defaultEnabledBusinessTypes: ["software_agency"],
  },
  {
    id: "world-clock",
    title: "World Clock",
    subtitle: "Saved Time Zones",
    description: "Live clocks for your saved world time zones — add cities from the widget",
    size: "md",
    defaultEnabled: true,
  },
];

export const DEFAULT_WIDGET_ORDER = WIDGET_REGISTRY.map((w) => w.id);
