export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
}

export interface TokenUsageAgentRow {
  agentId: string;
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
}

export interface TokenUsageSummary {
  days: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  byAgent: TokenUsageAgentRow[];
}

export interface AgentTimeRow {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
  runCount: number;
  totalSeconds: number;
  avgSeconds: number;
}

export interface AgentTimeSummary {
  days: number;
  byAgent: AgentTimeRow[];
}

export interface TasksByAgentRow {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  totalCount: number;
}

export interface TasksByAgentSummary {
  byAgent: TasksByAgentRow[];
}

export interface BurndownDay {
  date: string;
  opened: number;
  closed: number;
}

export interface BurndownSummary {
  days: number;
  data: BurndownDay[];
}

// --- Issues by Project ---
export interface IssuesByProjectRow {
  projectId: string;
  projectName: string;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  totalCount: number;
}
export interface IssuesByProjectSummary {
  days: number;
  byProject: IssuesByProjectRow[];
}

// --- Cycle Time ---
export interface CycleTimeSummary {
  days: number;
  avgCycleSeconds: number | null;
  medianCycleSeconds: number | null;
  totalClosed: number;
}

// --- Cost Trend ---
export interface CostTrendDay {
  date: string;
  costCents: number;
}
export interface CostTrendSummary {
  days: number;
  data: CostTrendDay[];
  totalCostCents: number;
}

// --- Project Health ---
export interface ProjectHealthRow {
  projectId: string;
  projectName: string;
  status: string;
  targetDate: string | null;
  isOverdue: boolean;
  completionPercent: number;
  openIssueCount: number;
  inProgressIssueCount: number;
  blockedIssueCount: number;
  doneIssueCount: number;
  totalIssueCount: number;
}
export interface ProjectHealthSummary {
  projects: ProjectHealthRow[];
}
