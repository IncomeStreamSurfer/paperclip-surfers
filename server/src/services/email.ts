import nodemailer from "nodemailer";
import { and, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers, userProfiles, issues, companies, companyMemberships } from "@paperclipai/db";
import { instanceSettingsService } from "./instance-settings.js";
import { renderEmailLayout } from "./email-layouts.js";
import type { EmailLayoutOptions } from "./email-layouts.js";

export function emailService(db: Db) {
  const settingsSvc = instanceSettingsService(db);

  async function createTransporter() {
    const notifications = await settingsSvc.getNotifications();

    // Mailgun SMTP relay — uses Mailgun's smtp.mailgun.org relay with
    // API key as the SMTP password (standard Mailgun SMTP auth pattern).
    if (notifications.emailProvider === "mailgun") {
      if (!notifications.mailgunDomain || !notifications.mailgunApiKey) {
        throw new Error("Mailgun domain and API key are required");
      }
      const smtpUser =
        notifications.smtpUser ||
        `postmaster@${notifications.mailgunDomain}`;
      return {
        transporter: nodemailer.createTransport({
          host: "smtp.mailgun.org",
          port: 587,
          secure: false,
          auth: { user: smtpUser, pass: notifications.mailgunApiKey },
        }),
        notifications,
      };
    }

    // SendGrid SMTP relay — username is literally "apikey"; password is the
    // SendGrid API key. Port 587 with STARTTLS.
    if (notifications.emailProvider === "sendgrid") {
      if (!notifications.sendgridApiKey) {
        throw new Error("SendGrid API key is required");
      }
      return {
        transporter: nodemailer.createTransport({
          host: "smtp.sendgrid.net",
          port: 587,
          secure: false,
          auth: { user: "apikey", pass: notifications.sendgridApiKey },
        }),
        notifications,
      };
    }

    // Default: plain SMTP
    if (!notifications.smtpHost) {
      throw new Error("SMTP host not configured");
    }
    const port = notifications.smtpPort ?? 587;
    // Port 465 always uses implicit TLS; other ports use the configured value
    // (default false = STARTTLS). This avoids "wrong version number" SSL errors
    // when the port and secure flag are mismatched.
    const secure = port === 465 ? true : (notifications.smtpSecure ?? false);
    return {
      transporter: nodemailer.createTransport({
        host: notifications.smtpHost,
        port,
        secure,
        auth:
          notifications.smtpUser
            ? { user: notifications.smtpUser, pass: notifications.smtpPassword ?? "" }
            : undefined,
        tls: {
          // Allow self-signed certificates common in self-hosted SMTP servers
          rejectUnauthorized: false,
        },
      }),
      notifications,
    };
  }

  /** Returns true when the instance has enough email config to send messages. */
  function isEmailConfigured(notifications: Awaited<ReturnType<typeof settingsSvc.getNotifications>>): boolean {
    if (notifications.emailProvider === "mailgun") {
      return !!(notifications.mailgunDomain && notifications.mailgunApiKey);
    }
    if (notifications.emailProvider === "sendgrid") {
      return !!notifications.sendgridApiKey;
    }
    return !!notifications.smtpHost;
  }

  /**
   * Wrap a raw HTML body string in the configured email layout template.
   * Falls back to "clean" template and empty appUrl when not configured.
   */
  function wrapHtml(
    body: string,
    notifications: Awaited<ReturnType<typeof settingsSvc.getNotifications>>,
    opts?: Partial<Pick<EmailLayoutOptions, "appName" | "previewText">>,
  ): string {
    const layoutOpts: EmailLayoutOptions = {
      body,
      appName: opts?.appName ?? "Paperclip",
      appUrl: notifications.emailAppUrl ?? "",
      primaryColor: "#5c5fff",
      template: notifications.emailTemplate ?? "clean",
      previewText: opts?.previewText,
    };
    return renderEmailLayout(layoutOpts);
  }

  /**
   * Return email addresses for users that have a specific boolean notification
   * preference opted in (=== true). Users with no profile or with the flag
   * absent/false are excluded (opt-in only).
   */
  async function getOptedInEmails(
    userIds: string[],
    pref: "emailOnBlocked" | "emailOnMention" | "emailOnAssigned",
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await db
      .select({ email: authUsers.email, preferences: userProfiles.preferences })
      .from(authUsers)
      .leftJoin(userProfiles, eq(userProfiles.userId, authUsers.id))
      .where(inArray(authUsers.id, userIds));
    return rows
      .filter((r) => r.preferences?.notifications?.[pref] === true)
      .map((r) => r.email);
  }

  return {
    async sendBlockedIssueNotification(issue: {
      id: string;
      identifier: string;
      title: string;
      assigneeUserId?: string | null;
      createdByUserId?: string | null;
    }): Promise<void> {
      const notifications = await settingsSvc.getNotifications();
      if (!notifications.enabled) return;
      if (!isEmailConfigured(notifications)) return;

      // Per-user recipients: assignee + reporter who opted in to emailOnBlocked
      const candidateIds = [...new Set(
        [issue.assigneeUserId, issue.createdByUserId].filter((id): id is string => !!id),
      )];
      const perUserEmails = await getOptedInEmails(candidateIds, "emailOnBlocked");

      // Always include the global notificationEmail if configured
      const allRecipients = [
        ...new Set([...perUserEmails, ...(notifications.notificationEmail ? [notifications.notificationEmail] : [])]),
      ];
      if (allRecipients.length === 0) return;

      const { transporter } = await createTransporter();
      // Use || not ?? so that an empty string smtpFrom falls through to the next fallback.
      // An empty From header is rejected by Gmail (RFC 5322 violation).
      const from = notifications.smtpFrom || notifications.smtpUser || "paperclip@localhost";

      await transporter.sendMail({
        from,
        to: allRecipients.join(", "),
        subject: `Issue blocked: ${issue.identifier} — ${issue.title}`,
        text: [
          `An issue has been marked as blocked and may need your attention.`,
          ``,
          `Issue: ${issue.identifier} — ${issue.title}`,
        ].join("\n"),
        html: wrapHtml(
          [
            `<h2>An issue has been blocked</h2>`,
            `<p><strong>${issue.identifier}</strong>: ${issue.title}</p>`,
            `<p>This issue has been marked as <strong>blocked</strong> and may need your attention.</p>`,
          ].join(""),
          notifications,
          { previewText: `Issue blocked: ${issue.identifier} — ${issue.title}` },
        ),
      });
    },

    async sendAssignedNotification(issue: {
      id: string;
      identifier: string;
      title: string;
      assigneeUserId: string;
    }): Promise<void> {
      const notifications = await settingsSvc.getNotifications();
      if (!notifications.enabled) return;
      if (!isEmailConfigured(notifications)) return;

      const recipients = await getOptedInEmails([issue.assigneeUserId], "emailOnAssigned");
      if (recipients.length === 0) return;

      const { transporter } = await createTransporter();
      const from = notifications.smtpFrom || notifications.smtpUser || "paperclip@localhost";

      await transporter.sendMail({
        from,
        to: recipients.join(", "),
        subject: `Issue assigned to you: ${issue.identifier} — ${issue.title}`,
        text: [
          `An issue has been assigned to you.`,
          ``,
          `Issue: ${issue.identifier} — ${issue.title}`,
        ].join("\n"),
        html: wrapHtml(
          [
            `<h2>Issue assigned to you</h2>`,
            `<p><strong>${issue.identifier}</strong>: ${issue.title}</p>`,
            `<p>This issue has been assigned to you.</p>`,
          ].join(""),
          notifications,
          { previewText: `You've been assigned: ${issue.identifier} — ${issue.title}` },
        ),
      });
    },

    async sendTestEmail(to: string): Promise<void> {
      const { transporter, notifications } = await createTransporter();
      const from = notifications.smtpFrom || notifications.smtpUser || "paperclip@localhost";

      await transporter.sendMail({
        from,
        to,
        subject: "Paperclip email notification test",
        text: "This is a test email from Paperclip. Email notifications are working correctly.",
        html: wrapHtml(
          `<h2>Email test</h2><p>This is a test email from <strong>Paperclip</strong>. Email notifications are working correctly.</p>`,
          notifications,
          { previewText: "Email notifications are working correctly." },
        ),
      });
    },

    async sendInviteEmail(invite: {
      email: string;
      role: string;
      companyName: string;
      acceptLink: string;
    }): Promise<void> {
      const notifications = await settingsSvc.getNotifications();
      if (!isEmailConfigured(notifications)) return; // Email not configured — silently skip
      const { transporter } = await createTransporter();
      const from = notifications.smtpFrom || notifications.smtpUser || "paperclip@localhost";

      const roleLabel =
        invite.role === "company_admin" ? "Admin"
        : invite.role === "manager" ? "Manager"
        : "Viewer";

      await transporter.sendMail({
        from,
        to: invite.email,
        subject: `You've been invited to ${invite.companyName} on Paperclip`,
        text: [
          `You've been invited to join ${invite.companyName} on Paperclip as ${roleLabel}.`,
          ``,
          `Accept your invitation here:`,
          invite.acceptLink,
          ``,
          `This invitation expires in 72 hours.`,
        ].join("\n"),
        html: wrapHtml(
          [
            `<h2>You've been invited</h2>`,
            `<p>You've been invited to join <strong>${invite.companyName}</strong> on Paperclip as <strong>${roleLabel}</strong>.</p>`,
            `<p><a href="${invite.acceptLink}" class="btn">Accept invitation</a></p>`,
            `<p style="color:#888;font-size:12px">This invitation expires in 72 hours.</p>`,
          ].join(""),
          notifications,
          { previewText: `You've been invited to join ${invite.companyName}` },
        ),
      });
    },

    /**
     * Send a digest email to a single user for all companies they belong to.
     * `digestType` is "daily" (last 24 h) or "weekly" (last 7 days).
     */
    async sendDigestEmail(userId: string, digestType: "daily" | "weekly"): Promise<void> {
      const notifications = await settingsSvc.getNotifications();
      if (!notifications.enabled) return;
      if (!isEmailConfigured(notifications)) return;

      // Find the user's email
      const userRow = await db
        .select({ email: authUsers.email })
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .then((rows) => rows[0] ?? null);
      if (!userRow) return;

      // Find all companies the user belongs to
      const membershipRows = await db
        .select({ companyId: companyMemberships.companyId })
        .from(companyMemberships)
        .where(and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
        ));
      const companyIds = membershipRows.map((r) => r.companyId);
      if (companyIds.length === 0) return;

      const windowHours = digestType === "daily" ? 24 : 7 * 24;
      const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

      // Collect issues created and completed within the window
      const issueRows = await db
        .select({
          id: issues.id,
          identifier: issues.identifier,
          title: issues.title,
          status: issues.status,
          companyId: issues.companyId,
          createdAt: issues.createdAt,
          completedAt: issues.completedAt,
        })
        .from(issues)
        .where(and(
          inArray(issues.companyId, companyIds),
          gte(issues.createdAt, since),
        ));

      const newIssues = issueRows.filter((i) => new Date(i.createdAt) >= since);
      const completedIssues = issueRows.filter(
        (i) => i.completedAt && new Date(i.completedAt) >= since,
      );
      const blockedIssues = issueRows.filter((i) => i.status === "blocked");

      // Fetch company names for context
      const companyRows = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(inArray(companies.id, companyIds));
      const companyNameMap = new Map(companyRows.map((c) => [c.id, c.name]));

      const period = digestType === "daily" ? "last 24 hours" : "last 7 days";
      const companyLabel = companyRows.length === 1
        ? (companyRows[0]?.name ?? "your company")
        : `${companyRows.length} companies`;

      const lines: string[] = [
        `Paperclip ${digestType === "daily" ? "Daily" : "Weekly"} Digest`,
        `Period: ${period}`,
        ``,
        `Summary for ${companyLabel}:`,
        `  • ${newIssues.length} new task(s) created`,
        `  • ${completedIssues.length} task(s) completed`,
        `  • ${blockedIssues.length} task(s) currently blocked`,
      ];

      if (blockedIssues.length > 0) {
        lines.push(``, `Blocked tasks:`);
        for (const i of blockedIssues.slice(0, 10)) {
          const co = companyNameMap.get(i.companyId) ?? "";
          lines.push(`  [${i.identifier ?? i.id.slice(0, 8)}] ${i.title}${co ? ` (${co})` : ""}`);
        }
      }

      const htmlLines: string[] = [
        `<h2>Paperclip ${digestType === "daily" ? "Daily" : "Weekly"} Digest</h2>`,
        `<p><em>Period: ${period}</em></p>`,
        `<ul>`,
        `  <li>${newIssues.length} new task(s) created</li>`,
        `  <li>${completedIssues.length} task(s) completed</li>`,
        `  <li>${blockedIssues.length} task(s) currently blocked</li>`,
        `</ul>`,
      ];
      if (blockedIssues.length > 0) {
        htmlLines.push(`<h3>Blocked Tasks</h3><ul>`);
        for (const i of blockedIssues.slice(0, 10)) {
          const co = companyNameMap.get(i.companyId) ?? "";
          htmlLines.push(
            `  <li><strong>${i.identifier ?? i.id.slice(0, 8)}</strong>: ${i.title}${co ? ` <em>(${co})</em>` : ""}</li>`,
          );
        }
        htmlLines.push(`</ul>`);
      }

      const { transporter, notifications: n } = await createTransporter();
      const from =
        n.smtpFrom ||
        (n.emailProvider === "mailgun" && n.mailgunDomain
          ? `noreply@${n.mailgunDomain}`
          : null) ||
        n.smtpUser ||
        "paperclip@localhost";

      await transporter.sendMail({
        from,
        to: userRow.email,
        subject: `Paperclip ${digestType === "daily" ? "Daily" : "Weekly"} Digest`,
        text: lines.join("\n"),
        html: wrapHtml(htmlLines.join(""), n, {
          previewText: `${digestType === "daily" ? "Daily" : "Weekly"} digest for ${companyLabel}`,
        }),
      });
    },

    async sendPasswordResetEmail(to: string, resetUrl: string, appName: string): Promise<void> {
      const notifications = await settingsSvc.getNotifications();
      if (!notifications.enabled || !isEmailConfigured(notifications)) return;
      const { transporter, notifications: n } = await createTransporter();
      const from =
        n.smtpFrom ||
        (n.emailProvider === "mailgun" && n.mailgunDomain
          ? `noreply@${n.mailgunDomain}`
          : null) ||
        n.smtpUser ||
        "paperclip@localhost";
      await transporter.sendMail({
        from,
        to,
        subject: `Reset your ${appName} password`,
        text: [
          `You requested a password reset for your ${appName} account.`,
          ``,
          `Click the link below to set a new password:`,
          resetUrl,
          ``,
          `This link expires in 1 hour. If you did not request this, you can safely ignore this email.`,
        ].join("\n"),
        html: wrapHtml(
          [
            `<h2>Reset your ${appName} password</h2>`,
            `<p>You requested a password reset for your <strong>${appName}</strong> account.</p>`,
            `<p><a href="${resetUrl}" class="btn">Reset password</a></p>`,
            `<p style="color:#666;font-size:12px;">Or copy this link: ${resetUrl}</p>`,
            `<p style="color:#666;font-size:12px;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>`,
          ].join(""),
          n,
          { appName, previewText: `Reset your ${appName} password` },
        ),
      });
    },
  };
}
