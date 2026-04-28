import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const companyAllowedModels = pgTable(
  "company_allowed_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    provider: text("provider").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    allowedAt: timestamp("allowed_at", { withTimezone: true }).notNull().defaultNow(),
    allowedByUserId: uuid("allowed_by_user_id"),
  },
  (table) => [
    uniqueIndex("company_allowed_models_company_model_uniq").on(table.companyId, table.modelId),
    index("company_allowed_models_company_id_idx").on(table.companyId),
    index("company_allowed_models_provider_idx").on(table.provider),
  ],
);