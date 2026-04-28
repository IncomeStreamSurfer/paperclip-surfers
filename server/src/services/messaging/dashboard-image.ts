import type { Db } from "@paperclipai/db";
import { issues, heartbeatRuns, agents } from "@paperclipai/db";
import { eq, and, sql } from "drizzle-orm";
import sharp from "sharp";

export async function renderDashboardPng(db: Db, companyId: string): Promise<Buffer> {
  const openCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.status, "open")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const inProgressCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.status, "in_progress")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const blockedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.status, "blocked")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const doneCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.status, "done")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const activeRuns = await db
    .select({ count: sql<number>`count(*)` })
    .from(heartbeatRuns)
    .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
    .where(and(eq(agents.companyId, companyId), eq(heartbeatRuns.status, "running")))
    .then((rows) => Number(rows[0]?.count ?? 0));

  const total = openCount + inProgressCount + blockedCount + doneCount;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="600" height="340" rx="12" fill="url(#bg)"/>
  <text x="300" y="36" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#f8fafc">Dashboard</text>

  <g transform="translate(24, 64)">
    <rect width="258" height="96" rx="8" fill="#1e293b" filter="url(#shadow)"/>
    <text x="20" y="30" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Open Issues</text>
    <text x="20" y="66" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#fbbf24">${openCount}</text>
  </g>

  <g transform="translate(318, 64)">
    <rect width="258" height="96" rx="8" fill="#1e293b" filter="url(#shadow)"/>
    <text x="20" y="30" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">In Progress</text>
    <text x="20" y="66" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#38bdf8">${inProgressCount}</text>
  </g>

  <g transform="translate(24, 176)">
    <rect width="168" height="80" rx="8" fill="#1e293b" filter="url(#shadow)"/>
    <text x="16" y="26" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Blocked</text>
    <text x="16" y="56" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="#f87171">${blockedCount}</text>
  </g>

  <g transform="translate(216, 176)">
    <rect width="168" height="80" rx="8" fill="#1e293b" filter="url(#shadow)"/>
    <text x="16" y="26" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Completed</text>
    <text x="16" y="56" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="#34d399">${doneCount}</text>
  </g>

  <g transform="translate(408, 176)">
    <rect width="168" height="80" rx="8" fill="#1e293b" filter="url(#shadow)"/>
    <text x="16" y="26" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Active Runs</text>
    <text x="16" y="56" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="#a78bfa">${activeRuns}</text>
  </g>

  <g transform="translate(24, 276)">
    <rect width="552" height="40" rx="8" fill="#1e293b" filter="url(#shadow)"/>
    <text x="20" y="25" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="#cbd5e1">Total Issues: ${total}</text>
  </g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
