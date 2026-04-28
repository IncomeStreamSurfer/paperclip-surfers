import type { GoalLevel, GoalStatus } from "../constants.js";

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  status: GoalStatus;
  parentId: string | null;
  ownerAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalMetrics {
  total: number;
  byStatus: { planned: number; active: number; achieved: number; cancelled: number };
  byLevel: { company: number; team: number; agent: number; task: number };
  /** Achieved / (total − cancelled) × 100, rounded */
  completionRate: number;
}
