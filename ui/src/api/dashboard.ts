import type {
  DashboardSummary,
  TokenUsageSummary,
  BurndownSummary,
  TasksByAgentSummary,
  AgentTimeSummary,
  IssuesByProjectSummary,
  CycleTimeSummary,
  CostTrendSummary,
  ProjectHealthSummary,
} from "@paperclipai/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
  tokenUsage: (companyId: string, days = 30) =>
    api.get<TokenUsageSummary>(`/companies/${companyId}/dashboard/token-usage?days=${days}`),
  burndown: (companyId: string, days = 30) =>
    api.get<BurndownSummary>(`/companies/${companyId}/dashboard/burndown?days=${days}`),
  tasksByAgent: (companyId: string, days = 30) =>
    api.get<TasksByAgentSummary>(`/companies/${companyId}/dashboard/tasks-by-agent?days=${days}`),
  agentTime: (companyId: string, days = 30) =>
    api.get<AgentTimeSummary>(`/companies/${companyId}/dashboard/agent-time?days=${days}`),
  issuesByProject: (companyId: string, days = 30) =>
    api.get<IssuesByProjectSummary>(`/companies/${companyId}/dashboard/issues-by-project?days=${days}`),
  cycleTime: (companyId: string, days = 30) =>
    api.get<CycleTimeSummary>(`/companies/${companyId}/dashboard/cycle-time?days=${days}`),
  costTrend: (companyId: string, days = 30) =>
    api.get<CostTrendSummary>(`/companies/${companyId}/dashboard/cost-trend?days=${days}`),
  projectHealth: (companyId: string, days = 30) =>
    api.get<ProjectHealthSummary>(`/companies/${companyId}/dashboard/project-health?days=${days}`),
};
