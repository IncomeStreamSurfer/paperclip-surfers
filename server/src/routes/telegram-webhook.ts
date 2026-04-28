import { Router, type Request, type Response } from "express";
import type { Db } from "@paperclipai/db";
import { messagingProviders, issues, heartbeatRuns, agents } from "@paperclipai/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    from?: { id: number; username?: string };
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

export function telegramWebhookRoutes(db: Db) {
  const router = Router();

  router.post("/webhooks/telegram/:companyId", async (req: Request, res: Response) => {
    const companyId = req.params.companyId as string;
    const update = req.body as TelegramUpdate;

    // Acknowledge quickly so Telegram doesn't retry
    res.status(200).json({ ok: true });

    const messageText = update.message?.text ?? update.callback_query?.data;
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (!messageText || chatId === undefined) return;

    // Verify the chat ID matches the company's configured Telegram provider
    const providerRow = await db
      .select()
      .from(messagingProviders)
      .where(and(eq(messagingProviders.companyId, companyId), eq(messagingProviders.provider, "telegram")))
      .then((rows) => rows[0] ?? null);
    if (!providerRow?.enabled) return;

    const config = providerRow.config as { botToken?: string; chatId?: string };
    if (!config.chatId || String(chatId) !== config.chatId) return;

    const command = messageText.trim().toLowerCase();

    try {
      if (command === "/status" || command === "/status@paperclipbot") {
        await handleStatusCommand(db, companyId, chatId, config.botToken!);
      } else if (command === "/issues" || command === "/issues@paperclipbot") {
        await handleIssuesCommand(db, companyId, chatId, config.botToken!);
      } else if (command.startsWith("/complete ") || command.startsWith("/complete@paperclipbot ")) {
        const issueId = command.split(" ")[1];
        await handleCompleteCommand(db, companyId, chatId, config.botToken!, issueId);
      } else if (command === "/help" || command === "/help@paperclipbot") {
        await sendTelegramMessage(config.botToken!, chatId, buildHelpText());
      }
    } catch (err) {
      logger.warn({ err, companyId, command }, "telegram webhook command failed");
      await sendTelegramMessage(config.botToken!, chatId, "❌ Sorry, something went wrong processing that command.").catch(() => {});
    }
  });

  return router;
}

async function handleStatusCommand(db: Db, companyId: string, chatId: number, botToken: string) {
  const openIssues = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.status, "open")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const inProgressIssues = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.status, "in_progress")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const blockedIssues = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.status, "blocked")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const activeRuns = await db
    .select({ count: sql<number>`count(*)` })
    .from(heartbeatRuns)
    .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
    .where(and(eq(agents.companyId, companyId), eq(heartbeatRuns.status, "running")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const text = `📊 *Company Status*\\n\\n🟡 Open: ${openIssues}\\n🔵 In Progress: ${inProgressIssues}\\n🚫 Blocked: ${blockedIssues}\\n🤖 Active Runs: ${activeRuns}`;
  await sendTelegramMessage(botToken, chatId, text);
}

async function handleIssuesCommand(db: Db, companyId: string, chatId: number, botToken: string) {
  const recentIssues = await db
    .select({
      id: issues.id,
      identifier: issues.identifier,
      title: issues.title,
      status: issues.status,
      priority: issues.priority,
    })
    .from(issues)
    .where(eq(issues.companyId, companyId))
    .orderBy(desc(issues.createdAt))
    .limit(10);

  if (recentIssues.length === 0) {
    await sendTelegramMessage(botToken, chatId, "📭 No issues found for this company.");
    return;
  }

  const lines = recentIssues.map((issue) => {
    const statusEmoji = issue.status === "done" ? "✅" : issue.status === "blocked" ? "🚫" : issue.status === "in_progress" ? "🔵" : "🟡";
    return `${statusEmoji} *${escapeMarkdown(issue.title)}*\\nID: \`${issue.identifier ?? issue.id.slice(0, 8)}\` | Priority: ${issue.priority}`;
  });

  const text = `📋 *Recent Issues*\\n\\n${lines.join("\\n\\n")}`;
  await sendTelegramMessage(botToken, chatId, text);
}

async function handleCompleteCommand(db: Db, companyId: string, chatId: number, botToken: string, issueIdentifier: string) {
  if (!issueIdentifier) {
    await sendTelegramMessage(botToken, chatId, "⚠️ Please provide an issue ID or identifier. Example: `/complete PROJ-42`");
    return;
  }

  const issue = await db
    .select()
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.identifier, issueIdentifier)))
    .then((rows) => rows[0] ?? null);

  if (!issue) {
    await sendTelegramMessage(botToken, chatId, `❌ Issue \`${escapeMarkdown(issueIdentifier)}\` not found.`);
    return;
  }

  if (issue.status === "done") {
    await sendTelegramMessage(botToken, chatId, `✅ Issue \`${escapeMarkdown(issueIdentifier)}\` is already completed.`);
    return;
  }

  await db
    .update(issues)
    .set({ status: "done", completedAt: new Date() })
    .where(eq(issues.id, issue.id));

  await sendTelegramMessage(botToken, chatId, `✅ Issue \`${escapeMarkdown(issueIdentifier)}\` has been marked as completed.`);
}

function buildHelpText(): string {
  return (
    `🤖 *Paperclip Bot Commands*\\n\\n` +
    `/status — Show company dashboard stats\\n` +
    `/issues — List recent issues\\n` +
    `/complete <issue-id> — Mark an issue as done\\n` +
    `/help — Show this message\\n\\n` +
    `Issue IDs can be either the human-readable identifier (e.g. PROJ-42) or the short UUID.`
  );
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "MarkdownV2",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}
