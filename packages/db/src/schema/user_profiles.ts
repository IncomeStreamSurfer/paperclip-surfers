import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { authUsers } from "./auth.js";

export interface UserPreferences {
  timezone?: string;
  language?: string;
  notifications?: {
    emailOnBlocked?: boolean;
    emailOnMention?: boolean;
    emailOnAssigned?: boolean;
    emailDigest?: "none" | "daily" | "weekly";
  };
  security?: {
    /** Idle session timeout in minutes. null / undefined = no timeout (use server default). */
    loginTimeoutMinutes?: number | null;
  };
}

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  bio: text("bio"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  location: text("location"),
  preferences: jsonb("preferences").$type<UserPreferences>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
