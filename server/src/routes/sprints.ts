import { Router } from "express";
import { and, eq, desc, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { sprints as sprintsTable, issues as issuesTable } from "@paperclipai/db";
import {
  createSprintSchema,
  updateSprintSchema,
  type SprintAiReport,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { notFound } from "../errors.js";

const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://192.168.68.230:11434").replace(/\/$/, "");
const SPRINT_MODEL =
  process.env.DEFAULT_MODEL ?? "dagbs/deepseek-coder-v2-lite-instruct:latest";
const REPORT_TIMEOUT_MS = parseInt(process.env.SPRINT_REPORT_TIMEOUT_MS ?? "90000", 10);

// ---------------------------------------------------------------------------
// Ollama AI report generation
// ---------------------------------------------------------------------------

async function generateSprintAiReport(params: {
  sprintName: string;
  goal: string | null;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  blockedIssues: number;
  sprintDays: number | null;
}): Promise<SprintAiReport | null> {
  const completionRate =
    params.totalIssues > 0
      ? Math.round((params.completedIssues / params.totalIssues) * 100)
      : 0;

  const velocity =
    params.sprintDays && params.sprintDays > 0
      ? Math.round((params.completedIssues / params.sprintDays) * 7 * 10) / 10
      : params.completedIssues;

  const userPrompt =
    `You are a scrum master generating a structured sprint report. ` +
    `Return ONLY valid JSON (no markdown, no extra text) matching this schema:\n` +
    `{\n` +
    `  "summary": "<2-3 sentence executive summary>",\n` +
    `  "topAccomplishments": ["<accomplishment 1>", "<accomplishment 2>", "<accomplishment 3>"],\n` +
    `  "risks": ["<risk 1>", "<risk 2>"],\n` +
    `  "recommendations": ["<recommendation 1>", "<recommendation 2>"]\n` +
    `}\n\n` +
    `Sprint data:\n` +
    `- Sprint name: ${params.sprintName}\n` +
    (params.goal ? `- Sprint goal: ${params.goal}\n` : "") +
    `- Total issues: ${params.totalIssues}\n` +
    `- Completed: ${params.completedIssues} (${completionRate}%)\n` +
    `- In progress: ${params.inProgressIssues}\n` +
    `- Blocked: ${params.blockedIssues}\n` +
    (params.sprintDays ? `- Sprint length: ${params.sprintDays} days\n` : "");

  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SPRINT_MODEL,
        stream: false,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { message?: { content?: string } };
    const raw = data.message?.content?.trim() ?? "";
    // Strip any markdown code fences
    const jsonStr = raw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
    const parsed = JSON.parse(jsonStr) as {
      summary?: string;
      topAccomplishments?: string[];
      risks?: string[];
      recommendations?: string[];
    };
    return {
      summary: parsed.summary ?? "",
      velocity,
      completionRate,
      topAccomplishments: parsed.topAccomplishments ?? [],
      risks: parsed.risks ?? [],
      recommendations: parsed.recommendations ?? [],
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sprint routes
// ---------------------------------------------------------------------------

export function sprintRoutes(db: Db) {
  const router = Router();

  /* ── List sprints ── */
  router.get("/companies/:companyId/sprints", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const projectId = req.query.projectId as string | undefined;

      const rows = await db
        .select()
        .from(sprintsTable)
        .where(
          projectId
            ? and(
                eq(sprintsTable.companyId, companyId),
                eq(sprintsTable.projectId, projectId),
              )
            : eq(sprintsTable.companyId, companyId),
        )
        .orderBy(desc(sprintsTable.createdAt));

      res.json({ sprints: rows });
    } catch (err) {
      next(err);
    }
  });

  /* ── Get sprint ── */
  router.get("/companies/:companyId/sprints/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const row = await db
        .select()
        .from(sprintsTable)
        .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
        .then((r) => r[0] ?? null);
      if (!row) throw notFound("Sprint not found");
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  /* ── Create sprint ── */
  router.post(
    "/companies/:companyId/sprints",
    validate(createSprintSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const body = req.body as {
          name: string;
          goal?: string | null;
          projectId?: string | null;
          status?: string;
          startDate?: string | null;
          endDate?: string | null;
        };
        const [created] = await db
          .insert(sprintsTable)
          .values({
            companyId,
            name: body.name,
            goal: body.goal ?? null,
            projectId: body.projectId ?? null,
            status: body.status ?? "planning",
            startDate: body.startDate ? new Date(body.startDate) : null,
            endDate: body.endDate ? new Date(body.endDate) : null,
          })
          .returning();
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  /* ── Update sprint ── */
  router.patch(
    "/companies/:companyId/sprints/:id",
    validate(updateSprintSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const body = req.body as Record<string, unknown>;
        const patch: Record<string, unknown> = { ...body, updatedAt: new Date() };
        if (typeof patch.startDate === "string") patch.startDate = new Date(patch.startDate as string);
        if (typeof patch.endDate === "string") patch.endDate = new Date(patch.endDate as string);
        if (typeof patch.completedAt === "string") patch.completedAt = new Date(patch.completedAt as string);

        const [updated] = await db
          .update(sprintsTable)
          .set(patch)
          .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Sprint not found");
        res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  /* ── Delete sprint ── */
  router.delete("/companies/:companyId/sprints/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(sprintsTable)
        .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Sprint not found");
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  /* ── Sprint velocity metrics ── */
  router.get("/companies/:companyId/sprints/:id/velocity", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);

      const sprint = await db
        .select()
        .from(sprintsTable)
        .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
        .then((r) => r[0] ?? null);
      if (!sprint) throw notFound("Sprint not found");

      const sprintIssues = await db
        .select()
        .from(issuesTable)
        .where(
          and(eq(issuesTable.companyId, companyId), eq(issuesTable.sprintId, id)),
        );

      const totalIssues = sprintIssues.length;
      const completedIssues = sprintIssues.filter((i) => i.status === "done").length;
      const completionRate = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

      let sprintDays: number | null = null;
      if (sprint.startDate && sprint.endDate) {
        sprintDays = Math.max(
          1,
          Math.round(
            (new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) /
              86400_000,
          ),
        );
      }

      const dailyRate = sprintDays && sprintDays > 0 ? Math.round((completedIssues / sprintDays) * 10) / 10 : null;

      res.json({
        sprintId: id,
        totalIssues,
        completedIssues,
        completionRate,
        dailyRate,
        sprintDays,
      });
    } catch (err) {
      next(err);
    }
  });

  /* ── Generate AI report ── */
  router.post("/companies/:companyId/sprints/:id/generate-report", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);

      const sprint = await db
        .select()
        .from(sprintsTable)
        .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
        .then((r) => r[0] ?? null);
      if (!sprint) throw notFound("Sprint not found");

      const sprintIssues = await db
        .select()
        .from(issuesTable)
        .where(and(eq(issuesTable.companyId, companyId), eq(issuesTable.sprintId, id)));

      const totalIssues = sprintIssues.length;
      const completedIssues = sprintIssues.filter((i) => i.status === "done").length;
      const inProgressIssues = sprintIssues.filter((i) => i.status === "in_progress").length;
      const blockedIssues = sprintIssues.filter((i) => i.status === "blocked").length;

      let sprintDays: number | null = null;
      if (sprint.startDate && sprint.endDate) {
        sprintDays = Math.max(
          1,
          Math.round(
            (new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) /
              86400_000,
          ),
        );
      }

      const aiReport = await generateSprintAiReport({
        sprintName: sprint.name,
        goal: sprint.goal,
        totalIssues,
        completedIssues,
        inProgressIssues,
        blockedIssues,
        sprintDays,
      });

      if (!aiReport) {
        res.status(503).json({ error: "AI report generation failed — Ollama unavailable" });
        return;
      }

      const [updated] = await db
        .update(sprintsTable)
        .set({ aiReport, updatedAt: new Date() })
        .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
        .returning();

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  /* ── List issues in a sprint ── */
  router.get("/companies/:companyId/sprints/:id/issues", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(issuesTable)
        .where(and(eq(issuesTable.companyId, companyId), eq(issuesTable.sprintId, id)));
      res.json({ issues: rows });
    } catch (err) {
      next(err);
    }
  });

  /* ── Assign issue to sprint ── */
  router.post("/companies/:companyId/sprints/:id/issues", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const { issueId } = req.body as { issueId: string };
      if (!issueId) {
        res.status(400).json({ error: "issueId required" });
        return;
      }
      // Verify sprint belongs to company
      const sprint = await db
        .select()
        .from(sprintsTable)
        .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
        .then((r) => r[0] ?? null);
      if (!sprint) throw notFound("Sprint not found");

      const [updated] = await db
        .update(issuesTable)
        .set({ sprintId: id })
        .where(and(eq(issuesTable.id, issueId), eq(issuesTable.companyId, companyId)))
        .returning();
      if (!updated) throw notFound("Issue not found");
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  /* ── Remove issue from sprint ── */
  router.delete("/companies/:companyId/sprints/:id/issues/:issueId", async (req, res, next) => {
    try {
      const { companyId, id, issueId } = req.params as {
        companyId: string;
        id: string;
        issueId: string;
      };
      assertCompanyAccess(req, companyId);
      // Verify sprint belongs to company
      const sprint = await db
        .select()
        .from(sprintsTable)
        .where(and(eq(sprintsTable.id, id), eq(sprintsTable.companyId, companyId)))
        .then((r) => r[0] ?? null);
      if (!sprint) throw notFound("Sprint not found");

      const [updated] = await db
        .update(issuesTable)
        .set({ sprintId: null })
        .where(
          and(
            eq(issuesTable.id, issueId),
            eq(issuesTable.companyId, companyId),
            eq(issuesTable.sprintId, id),
          ),
        )
        .returning();
      if (!updated) throw notFound("Issue not found in this sprint");
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
