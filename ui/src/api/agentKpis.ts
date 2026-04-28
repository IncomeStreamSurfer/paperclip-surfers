import { api } from "./client";

export interface AgentKpi {
  id: string;
  agentId: string;
  companyId: string;
  projectId: string | null;
  runId: string | null;
  taskCompleted: boolean | null;
  selfAssessmentScore: number | null;
  tokensUsed: number | null;
  costCents: number | null;
  durationSeconds: number | null;
  errorsEncountered: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface KpiTrend {
  totalRuns: number;
  completionRate: number;
  avgCostCents: number;
  avgDurationSeconds: number;
  avgTokensUsed: number;
  trend: "improving" | "declining" | "stable";
}

export interface KpiObservation {
  id: string;
  companyId: string;
  observerType: "ceo_agent" | "board_human";
  observerAgentId: string | null;
  observerUserId: string | null;
  observation: string;
  agentIds: string[];
  actionTaken: boolean;
  actionNotes: string | null;
  createdAt: string;
}

export interface AgentExperiment {
  id: string;
  agentId: string;
  companyId: string;
  hypothesis: string;
  approachA: string;
  approachB: string;
  taskType: string | null;
  status: "running" | "concluded";
  winningApproach: string | null;
  runsA: number;
  runsB: number;
  kpiResultsA: Record<string, unknown>;
  kpiResultsB: Record<string, unknown>;
  changeNotes: string | null;
  createdAt: string;
  concludedAt: string | null;
}

export interface CompanyAnalytics {
  companyId: string;
  agentCount: number;
  agents: Array<{
    agentId: string;
    agentName: string;
    totalRuns: number;
    completionRate: number | null;
    avgCostCents: number | null;
    totalCostCents: number;
    avgDurationSeconds: number | null;
    avgErrors: number | null;
    avgSelfAssessment: number | null;
  }>;
}

export interface ExperimentCreateRequest {
  hypothesis: string;
  approachA: string;
  approachB: string;
  taskType?: string;
}

export interface ExperimentUpdateRequest {
  status?: "running" | "concluded";
  winningApproach?: string;
  changeNotes?: string;
}

export interface ObservationCreateRequest {
  observerType: "ceo_agent" | "board_human";
  observation: string;
  agentIds?: string[];
  actionTaken?: boolean;
  actionNotes?: string;
}

export const agentKpisApi = {
  list: (agentId: string, params?: { limit?: number }) => {
    let path = `/agents/${encodeURIComponent(agentId)}/kpis`;
    if (params?.limit) path += `?limit=${params.limit}`;
    return api.get<AgentKpi[]>(path);
  },
  trends: (agentId: string) =>
    api.get<KpiTrend>(`/agents/${encodeURIComponent(agentId)}/kpis/trends`),
};

export const analyticsApi = {
  getCompanyAnalytics: (companyId: string) =>
    api.get<CompanyAnalytics>(`/companies/${encodeURIComponent(companyId)}/analytics`),
  listObservations: (companyId: string) =>
    api.get<KpiObservation[]>(
      `/companies/${encodeURIComponent(companyId)}/analytics/observations`,
    ),
  createObservation: (companyId: string, data: ObservationCreateRequest) =>
    api.post<KpiObservation>(
      `/companies/${encodeURIComponent(companyId)}/analytics/observations`,
      data,
    ),
  deleteObservation: (companyId: string, observationId: string) =>
    api.delete<{ success: true }>(
      `/companies/${encodeURIComponent(companyId)}/analytics/observations/${encodeURIComponent(observationId)}`,
    ),
};

export const experimentsApi = {
  list: (agentId: string) =>
    api.get<AgentExperiment[]>(`/agents/${encodeURIComponent(agentId)}/experiments`),
  create: (agentId: string, data: ExperimentCreateRequest) =>
    api.post<AgentExperiment>(
      `/agents/${encodeURIComponent(agentId)}/experiments`,
      data,
    ),
  update: (agentId: string, experimentId: string, data: ExperimentUpdateRequest) =>
    api.patch<AgentExperiment>(
      `/agents/${encodeURIComponent(agentId)}/experiments/${encodeURIComponent(experimentId)}`,
      data,
    ),
  delete: (agentId: string, experimentId: string) =>
    api.delete<{ success: true }>(
      `/agents/${encodeURIComponent(agentId)}/experiments/${encodeURIComponent(experimentId)}`,
    ),
};
