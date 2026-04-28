import type { CompanyStatus, PauseReason, BusinessType } from "../constants.js";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  status: CompanyStatus;
  pauseReason: PauseReason | null;
  pausedAt: Date | null;
  issuePrefix: string;
  issueCounter: number;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  requireBoardApprovalForNewAgents: boolean;
  brandColor: string | null;
  brandPrimaryForeground: string | null;
  logoAssetId: string | null;
  logoUrl: string | null;
  businessType: BusinessType | null;
  createdAt: Date;
  updatedAt: Date;
}
