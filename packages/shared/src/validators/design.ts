import { z } from "zod";

export const DESIGN_ASSET_STYLES = [
  "realistic",
  "cartoon",
  "anime",
  "oil-painting",
  "watercolor",
  "pixel-art",
  "3d-render",
  "sketch",
] as const;

export type DesignAssetStyle = (typeof DESIGN_ASSET_STYLES)[number];

export const DESIGN_ASSET_STYLE_LABELS: Record<DesignAssetStyle, string> = {
  realistic: "Realistic",
  cartoon: "Cartoon",
  anime: "Anime",
  "oil-painting": "Oil Painting",
  watercolor: "Watercolor",
  "pixel-art": "Pixel Art",
  "3d-render": "3D Render",
  sketch: "Sketch",
};

export const DESIGN_ASPECT_RATIOS = [
  { label: "Square (1:1)", value: "1:1", width: 512, height: 512 },
  { label: "Landscape (16:9)", value: "16:9", width: 912, height: 512 },
  { label: "Portrait (9:16)", value: "9:16", width: 512, height: 912 },
  { label: "Banner (3:1)", value: "3:1", width: 912, height: 304 },
  { label: "Social Card (4:3)", value: "4:3", width: 680, height: 512 },
] as const;

export const DESIGN_ASSET_STATUSES = ["pending", "generating", "done", "failed"] as const;

export const generateDesignAssetSchema = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(2000),
  style: z.enum(DESIGN_ASSET_STYLES).default("realistic"),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "3:1", "4:3"]).default("1:1"),
  seed: z.number().int().min(0).optional(),
  temperature: z.number().min(1).max(10).default(5),
  expandPrompt: z.boolean().default(false),
});

export type GenerateDesignAsset = z.infer<typeof generateDesignAssetSchema>;

export const updateDesignAssetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export type UpdateDesignAsset = z.infer<typeof updateDesignAssetSchema>;

export const listDesignAssetsSchema = z.object({
  status: z.enum(DESIGN_ASSET_STATUSES).optional(),
  style: z.enum(DESIGN_ASSET_STYLES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListDesignAssetsQuery = z.infer<typeof listDesignAssetsSchema>;
