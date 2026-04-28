import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, companies, costEvents, heartbeatRuns, issues } from "@paperclipai/db";
import { projects } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";
export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
      };
    },

    tokenUsageByAgent: async (companyId: string, days = 30) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const rows = await db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .innerJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, since),
        ))
        .groupBy(costEvents.agentId, agents.name)
        .orderBy(sql`sum(${costEvents.costCents}) desc`);

      const byAgent = rows.map((r) => ({
        agentId: r.agentId,
        agentName: r.agentName,
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
        totalTokens: Number(r.inputTokens) + Number(r.outputTokens),
        costCents: Number(r.costCents),
      }));

      return {
        days,
        totalInputTokens: byAgent.reduce((s, r) => s + r.inputTokens, 0),
        totalOutputTokens: byAgent.reduce((s, r) => s + r.outputTokens, 0),
        totalCostCents: byAgent.reduce((s, r) => s + r.costCents, 0),
        byAgent,
      };
    },

    agentTimeWorked: async (companyId: string, days = 30) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const rows = await db
        .select({
          agentId: heartbeatRuns.agentId,
          agentName: agents.name,
          avatarUrl: agents.avatarUrl,
          runCount: sql<number>`count(*)::int`,
          totalSeconds: sql<number>`coalesce(sum(extract(epoch from (${heartbeatRuns.finishedAt} - ${heartbeatRuns.startedAt}))), 0)::int`,
          avgSeconds: sql<number>`coalesce(avg(extract(epoch from (${heartbeatRuns.finishedAt} - ${heartbeatRuns.startedAt}))), 0)::int`,
        })
        .from(heartbeatRuns)
        .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
        .where(and(
          eq(heartbeatRuns.companyId, companyId),
          isNotNull(heartbeatRuns.finishedAt),
          isNotNull(heartbeatRuns.startedAt),
          gte(heartbeatRuns.createdAt, since),
        ))
        .groupBy(heartbeatRuns.agentId, agents.name, agents.avatarUrl)
        .orderBy(sql`sum(extract(epoch from (${heartbeatRuns.finishedAt} - ${heartbeatRuns.startedAt}))) desc nulls last`);

      return {
        days,
        byAgent: rows.map((r) => ({
          agentId: r.agentId,
          agentName: r.agentName,
          avatarUrl: r.avatarUrl,
          runCount: Number(r.runCount),
          totalSeconds: Number(r.totalSeconds),
          avgSeconds: Number(r.avgSeconds),
        })),
      };
    },

     tasksByAgent: async (companyId: string, days = 30) => {
       const since = new Date();
       since.setDate(since.getDate() - days);
       const rows = await db
         .select({
           agentId: issues.assigneeAgentId,
           agentName: agents.name,
           avatarUrl: agents.avatarUrl,
           openCount: sql<number>`count(*) filter (where ${issues.status} not in ('done', 'cancelled'))::int`,
           inProgressCount: sql<number>`count(*) filter (where ${issues.status} = 'in_progress')::int`,
           doneCount: sql<number>`count(*) filter (where ${issues.status} = 'done')::int`,
           totalCount: sql<number>`count(*)::int`,
         })
         .from(issues)
         .innerJoin(agents, eq(issues.assigneeAgentId, agents.id))
         .where(and(
           eq(issues.companyId, companyId),
           isNotNull(issues.assigneeAgentId),
           gte(issues.createdAt, since),
         ))
         .groupBy(issues.assigneeAgentId, agents.name, agents.avatarUrl)
         .orderBy(sql`count(*) desc`);

       return {
         byAgent: rows.map((r) => ({
           agentId: r.agentId as string,
           agentName: r.agentName,
           avatarUrl: r.avatarUrl,
           openCount: Number(r.openCount),
           inProgressCount: Number(r.inProgressCount),
           doneCount: Number(r.doneCount),
           totalCount: Number(r.totalCount),
         })),
       };
     },

    burndown: async (companyId: string, days = 30) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const openedRows = await db
        .select({
          day: sql<string>`(${issues.createdAt})::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(and(
          eq(issues.companyId, companyId),
          gte(issues.createdAt, since),
        ))
        .groupBy(sql`(${issues.createdAt})::date`);

      const closedRows = await db
        .select({
          day: sql<string>`(${issues.completedAt})::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(and(
          eq(issues.companyId, companyId),
          isNotNull(issues.completedAt),
          gte(issues.completedAt, since),
        ))
        .groupBy(sql`(${issues.completedAt})::date`);

      const allDays = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        return d.toISOString().slice(0, 10);
      });

      const openedMap = new Map(openedRows.map((r) => [r.day, Number(r.count)]));
      const closedMap = new Map(closedRows.map((r) => [r.day, Number(r.count)]));

      return {
        days,
        data: allDays.map((date) => ({
          date,
          opened: openedMap.get(date) ?? 0,
          closed: closedMap.get(date) ?? 0,
        })),
      };
    },

    issuesByProject: async (companyId: string, days = 30) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const rows = await db
        .select({
          projectId: issues.projectId,
          projectName: projects.name,
          openCount: sql<number>`count(*) filter (where ${issues.status} not in ('done','cancelled'))::int`,
          inProgressCount: sql<number>`count(*) filter (where ${issues.status} = 'in_progress')::int`,
          doneCount: sql<number>`count(*) filter (where ${issues.status} = 'done')::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(issues)
        .innerJoin(projects, eq(issues.projectId, projects.id))
        .where(and(
          eq(issues.companyId, companyId),
          isNotNull(issues.projectId),
          gte(issues.createdAt, since),
        ))
        .groupBy(issues.projectId, projects.name)
        .orderBy(sql`count(*) desc`);

      return {
        days,
        byProject: rows.map((r) => ({
          projectId: r.projectId as string,
          projectName: r.projectName,
          openCount: Number(r.openCount),
          inProgressCount: Number(r.inProgressCount),
          doneCount: Number(r.doneCount),
          totalCount: Number(r.totalCount),
        })),
      };
    },

    cycleTime: async (companyId: string, days = 30) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const rows = await db
        .select({
          avgSeconds: sql<number>`coalesce(avg(extract(epoch from (${issues.completedAt} - ${issues.createdAt}))), 0)::int`,
          medianSeconds: sql<number>`coalesce(percentile_cont(0.5) within group (order by extract(epoch from (${issues.completedAt} - ${issues.createdAt}))), 0)::int`,
          totalClosed: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(and(
          eq(issues.companyId, companyId),
          isNotNull(issues.completedAt),
          gte(issues.completedAt, since),
        ));

      const row = rows[0];
      const totalClosed = Number(row?.totalClosed ?? 0);

      return {
        days,
        avgCycleSeconds: totalClosed > 0 ? Number(row?.avgSeconds ?? 0) : null,
        medianCycleSeconds: totalClosed > 0 ? Number(row?.medianSeconds ?? 0) : null,
        totalClosed,
      };
    },

    costTrend: async (companyId: string, days = 30) => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const rows = await db
        .select({
          day: sql<string>`(${costEvents.occurredAt})::date::text`,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, since),
        ))
        .groupBy(sql`(${costEvents.occurredAt})::date`)
        .orderBy(sql`(${costEvents.occurredAt})::date`);

      const allDays = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        return d.toISOString().slice(0, 10);
      });

      const costMap = new Map(rows.map((r) => [r.day, Number(r.costCents)]));
      const data = allDays.map((date) => ({ date, costCents: costMap.get(date) ?? 0 }));

      return {
        days,
        data,
        totalCostCents: data.reduce((s, r) => s + r.costCents, 0),
      };
    },

     projectHealth: async (companyId: string, days = 30) => {
       const today = new Date().toISOString().slice(0, 10);
       const since = new Date();
       since.setDate(since.getDate() - days);

       // Fetch all active projects for the company
       const projectRows = await db
         .select({
           id: projects.id,
           name: projects.name,
           status: projects.status,
           targetDate: projects.targetDate,
         })
         .from(projects)
         .where(eq(projects.companyId, companyId));

       if (projectRows.length === 0) return { projects: [] };

       const projectIds = projectRows.map((p) => p.id);

       // Aggregate issue counts per project within the time window
       const issueAgg = await db
         .select({
           projectId: issues.projectId,
           totalCount: sql<number>`count(*)::int`,
           doneCount: sql<number>`count(*) filter (where ${issues.status} = 'done')::int`,
           inProgressCount: sql<number>`count(*) filter (where ${issues.status} = 'in_progress')::int`,
           blockedCount: sql<number>`count(*) filter (where ${issues.status} = 'blocked')::int`,
           openCount: sql<number>`count(*) filter (where ${issues.status} not in ('done','cancelled'))::int`,
         })
         .from(issues)
         .where(and(
           eq(issues.companyId, companyId),
           isNotNull(issues.projectId),
           gte(issues.createdAt, since),
         ))
         .groupBy(issues.projectId);

      const aggMap = new Map(issueAgg.map((r) => [r.projectId as string, r]));

      const result = projectRows.map((p) => {
        const agg = aggMap.get(p.id);
        const total = Number(agg?.totalCount ?? 0);
        const done = Number(agg?.doneCount ?? 0);
        const inProgress = Number(agg?.inProgressCount ?? 0);
        const blocked = Number(agg?.blockedCount ?? 0);
        const open = Number(agg?.openCount ?? 0);
        const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;
        const isOverdue =
          !!p.targetDate &&
          p.targetDate < today &&
          !["done", "cancelled", "archived"].includes(p.status);

        return {
          projectId: p.id,
          projectName: p.name,
          status: p.status,
          targetDate: p.targetDate ?? null,
          isOverdue,
          completionPercent,
          openIssueCount: open,
          inProgressIssueCount: inProgress,
          blockedIssueCount: blocked,
          doneIssueCount: done,
          totalIssueCount: total,
        };
      });

      // Sort: overdue first, then by blocked count desc, then by name
      result.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        if (b.blockedIssueCount !== a.blockedIssueCount) return b.blockedIssueCount - a.blockedIssueCount;
        return a.projectName.localeCompare(b.projectName);
      });

      return { projects: result };
    },
  };
}
