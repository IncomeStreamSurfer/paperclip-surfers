import { pgTable, uuid, text, timestamp, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const messagingProviders = pgTable(
  "messaging_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'telegram' | 'whatsapp'
    enabled: boolean("enabled").notNull().default(false),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderIdx: uniqueIndex("messaging_providers_company_provider_idx").on(table.companyId, table.provider),
  }),
);

export const messagingSubscriptions = pgTable(
  "messaging_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'telegram' | 'whatsapp'
    messageType: text("message_type").notNull(), // 'new_issue' | 'issue_blocked' | 'issue_completed' | 'run_hang' | 'daily_digest' | 'weekly_report'
    enabled: boolean("enabled").notNull().default(false),
    includeImage: boolean("include_image").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderTypeIdx: uniqueIndex("messaging_subscriptions_company_provider_type_idx").on(table.companyId, table.provider, table.messageType),
  }),
);

export const messagingDeliveries = pgTable(
  "messaging_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    messageType: text("message_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    externalMessageId: text("external_message_id"),
    status: text("status").notNull(), // 'pending' | 'sent' | 'delivered' | 'failed'
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);
