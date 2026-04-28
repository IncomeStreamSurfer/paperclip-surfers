import { pgTable, text, uuid, timestamp, integer, real } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { assets } from "./assets.js";

export const DESIGN_ASSET_STATUSES = [
  "pending",
  "generating",
  "done",
  "failed",
] as const;

export const designAssets = pgTable("design_assets", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  expandedPrompt: text("expanded_prompt"),
  style: text("style").notNull().default("realistic"),
  checkpointUsed: text("checkpoint_used"),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  width: integer("width").notNull().default(512),
  height: integer("height").notNull().default(512),
  steps: integer("steps").notNull().default(20),
  cfg: real("cfg").notNull().default(7),
  seed: integer("seed"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
