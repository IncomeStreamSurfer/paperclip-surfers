import type { Db } from "@paperclipai/db";
import { messagingProviders, messagingSubscriptions, messagingDeliveries, issues, agents, companies } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import type { MessagingMessageType, MessagingProvider } from "@paperclipai/shared";
import { sendTelegramMessage, sendTelegramPhoto, type TelegramConfig } from "./telegram.js";

function sha256(text: string): string {
  const crypto = require("node:crypto");
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function shouldSend(
  db: Db,
  companyId: string,
  provider: MessagingProvider,
  messageType: MessagingMessageType,
): Promise<boolean> {
  const providerRow = await db
    .select()
    .from(messagingProviders)
    .where(and(eq(messagingProviders.companyId, companyId), eq(messagingProviders.provider, provider)))
    .then((rows) => rows[0] ?? null);
  if (!providerRow?.enabled) return false;

  const sub = await db
    .select()
    .from(messagingSubscriptions)
    .where(
      and(
        eq(messagingSubscriptions.companyId, companyId),
        eq(messagingSubscriptions.provider, provider),
        eq(messagingSubscriptions.messageType, messageType),
      ),
    )
    .then((rows) => rows[0] ?? null);
  return sub?.enabled ?? false;
}

async function recordDelivery(
  db: Db,
  companyId: string,
  provider: string,
  messageType: string,
  payload: string,
  externalMessageId: string | null,
  status: "pending" | "sent" | "delivered" | "failed",
  error?: string,
) {
  await db.insert(messagingDeliveries).values({
    companyId,
    provider,
    messageType,
    payloadHash: sha256(payload),
    externalMessageId,
    status,
    error: error ?? null,
    sentAt: status === "sent" || status === "delivered" ? new Date() : null,
  });
}

export function messagingDispatchService(db: Db) {
  return {
    async notifyNewIssue(issueId: string) {
      const issue = await db.select().from(issues).where(eq(issues.id, issueId)).then((rows) => rows[0] ?? null);
      if (!issue) return;

      const company = await db.select().from(companies).where(eq(companies.id, issue.companyId)).then((rows) => rows[0] ?? null);
      if (!company) return;

      for (const provider of ["telegram", "whatsapp"] as MessagingProvider[]) {
        if (!(await shouldSend(db, issue.companyId, provider, "new_issue"))) continue;

        const text = `🆕 *New Issue*\\n\\n*${this.escapeMarkdown(issue.title)}*\\nID: ${issue.identifier ?? issue.id.slice(0, 8)}\\nPriority: ${issue.priority}\\nStatus: ${issue.status}`;

        if (provider === "telegram") {
          const config = await this.getTelegramConfig(db, issue.companyId);
          if (!config) continue;
          const result = await sendTelegramMessage(config, text);
          await recordDelivery(db, issue.companyId, provider, "new_issue", text, result.messageId ?? null, result.ok ? "sent" : "failed", result.error);
        }
      }
    },

    async notifyIssueBlocked(issueId: string) {
      const issue = await db.select().from(issues).where(eq(issues.id, issueId)).then((rows) => rows[0] ?? null);
      if (!issue) return;

      for (const provider of ["telegram", "whatsapp"] as MessagingProvider[]) {
        if (!(await shouldSend(db, issue.companyId, provider, "issue_blocked"))) continue;

        const text = `🚫 *Issue Blocked*\\n\\n*${this.escapeMarkdown(issue.title)}*\\nID: ${issue.identifier ?? issue.id.slice(0, 8)}\\nThis issue has been marked as blocked and needs attention.`;

        if (provider === "telegram") {
          const config = await this.getTelegramConfig(db, issue.companyId);
          if (!config) continue;
          const result = await sendTelegramMessage(config, text);
          await recordDelivery(db, issue.companyId, provider, "issue_blocked", text, result.messageId ?? null, result.ok ? "sent" : "failed", result.error);
        }
      }
    },

    async notifyIssueCompleted(issueId: string) {
      const issue = await db.select().from(issues).where(eq(issues.id, issueId)).then((rows) => rows[0] ?? null);
      if (!issue) return;

      const assignee = issue.assigneeAgentId
        ? await db.select().from(agents).where(eq(agents.id, issue.assigneeAgentId)).then((rows) => rows[0] ?? null)
        : null;

      for (const provider of ["telegram", "whatsapp"] as MessagingProvider[]) {
        if (!(await shouldSend(db, issue.companyId, provider, "issue_completed"))) continue;

        const text = `✅ *Issue Completed*\\n\\n*${this.escapeMarkdown(issue.title)}*\\nID: ${issue.identifier ?? issue.id.slice(0, 8)}${assignee ? `\\nCompleted by: ${this.escapeMarkdown(assignee.name)}` : ""}`;

        if (provider === "telegram") {
          const config = await this.getTelegramConfig(db, issue.companyId);
          if (!config) continue;
          const result = await sendTelegramMessage(config, text);
          await recordDelivery(db, issue.companyId, provider, "issue_completed", text, result.messageId ?? null, result.ok ? "sent" : "failed", result.error);
        }
      }
    },

    async notifyRunHang(agentId: string, runId: string, durationMinutes: number) {
      const agent = await db.select().from(agents).where(eq(agents.id, agentId)).then((rows) => rows[0] ?? null);
      if (!agent) return;

      for (const provider of ["telegram", "whatsapp"] as MessagingProvider[]) {
        if (!(await shouldSend(db, agent.companyId, provider, "run_hang"))) continue;

        const text = `⏰ *Run Hang Detected*\\n\\nAgent: *${this.escapeMarkdown(agent.name)}*\\nRun ID: ${runId.slice(0, 8)}\\nDuration: ${durationMinutes} min\\nThe run has exceeded the expected time and may be stuck.`;

        if (provider === "telegram") {
          const config = await this.getTelegramConfig(db, agent.companyId);
          if (!config) continue;
          const result = await sendTelegramMessage(config, text);
          await recordDelivery(db, agent.companyId, provider, "run_hang", text, result.messageId ?? null, result.ok ? "sent" : "failed", result.error);
        }
      }
    },

    async getTelegramConfig(db: Db, companyId: string): Promise<TelegramConfig | null> {
      const row = await db
        .select()
        .from(messagingProviders)
        .where(and(eq(messagingProviders.companyId, companyId), eq(messagingProviders.provider, "telegram")))
        .then((rows) => rows[0] ?? null);
      if (!row?.enabled) return null;
      const config = row.config as Partial<TelegramConfig>;
      if (!config.botToken || !config.chatId) return null;
      return { botToken: config.botToken, chatId: config.chatId };
    },

    escapeMarkdown(text: string): string {
      // Escape characters that have special meaning in MarkdownV2
      return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, "\\$&");
    },
  };
}

export type MessagingDispatchService = ReturnType<typeof messagingDispatchService>;
