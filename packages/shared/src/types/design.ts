export type DesignAssetStatus = "pending" | "generating" | "done" | "failed";

export interface DesignAsset {
  id: string;
  companyId: string;
  title: string;
  prompt: string;
  expandedPrompt: string | null;
  style: string;
  checkpointUsed: string | null;
  assetId: string | null;
  imageUrl: string | null;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number | null;
  status: DesignAssetStatus;
  errorMessage: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
