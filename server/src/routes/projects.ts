import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { issues as issuesTable, projects as projectsTable } from "@paperclipai/db";
import {
  createProjectSchema,
  createProjectWorkspaceSchema,
  isUuidLike,
  updateProjectSchema,
  updateProjectWorkspaceSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { projectService, logActivity } from "../services/index.js";
import { conflict } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

// ---------------------------------------------------------------------------
// Ollama helper for AI-generated sprint narrative (10.1 Scrum artifacts)
// ---------------------------------------------------------------------------
const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://192.168.68.230:11434").replace(/\/$/, "");
const SPRINT_MODEL =
  process.env.SPRINT_MODEL ?? process.env.DEFAULT_MODEL ?? "dagbs/deepseek-coder-v2-lite-instruct:latest";
const SPRINT_TIMEOUT_MS = parseInt(process.env.SPRINT_GENERATE_TIMEOUT_MS ?? "60000", 10);

interface SprintStats {
  totalIssues: number;
  doneAllTime: number;
  doneThisWeek: number;
  inProgress: number;
  blocked: number;
  activeProjects: number;
  velocity: number; // issues/week (= doneThisWeek)
  blockedTitles: string[];
  overdueProjects: string[];
}

async function generateSprintNarrative(stats: SprintStats): Promise<string | null> {
  const overdueStr =
    stats.overdueProjects.length > 0
      ? `Overdue projects: ${stats.overdueProjects.slice(0, 5).join(", ")}.`
      : "No overdue projects.";
  const blockedStr =
    stats.blockedTitles.length > 0
      ? `Blocked issues include: ${stats.blockedTitles.slice(0, 5).join("; ")}.`
      : "No blocked issues.";

  const userPrompt =
    `You are a scrum master writing an executive sprint summary. ` +
    `Based on the following sprint metrics, write a concise 2–3 paragraph narrative (plain prose, no bullet points, no headers). ` +
    `Cover: overall health, velocity commentary, key risks, and one recommended action.\n\n` +
    `Sprint metrics:\n` +
    `- Total issues: ${stats.totalIssues}\n` +
    `- Completed all-time: ${stats.doneAllTime}\n` +
    `- Completed this week (velocity): ${stats.doneThisWeek}\n` +
    `- In progress: ${stats.inProgress}\n` +
    `- Blocked: ${stats.blocked}\n` +
    `- Active projects: ${stats.activeProjects}\n` +
    `- ${overdueStr}\n` +
    `- ${blockedStr}\n\n` +
    `Respond with ONLY the narrative — no preamble, no markdown formatting.`;

  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SPRINT_MODEL,
        stream: false,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(SPRINT_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export function projectRoutes(db: Db) {
  const router = Router();
  const svc = projectService(db);

  async function resolveCompanyIdForProjectReference(req: Request) {
    const companyIdQuery = req.query.companyId;
    const requestedCompanyId =
      typeof companyIdQuery === "string" && companyIdQuery.trim().length > 0
        ? companyIdQuery.trim()
        : null;
    if (requestedCompanyId) {
      assertCompanyAccess(req, requestedCompanyId);
      return requestedCompanyId;
    }
    if (req.actor.type === "agent" && req.actor.companyId) {
      return req.actor.companyId;
    }
    return null;
  }

  async function normalizeProjectReference(req: Request, rawId: string) {
    if (isUuidLike(rawId)) return rawId;
    const companyId = await resolveCompanyIdForProjectReference(req);
    if (!companyId) return rawId;
    const resolved = await svc.resolveByReference(companyId, rawId);
    if (resolved.ambiguous) {
      throw conflict("Project shortname is ambiguous in this company. Use the project ID.");
    }
    return resolved.project?.id ?? rawId;
  }

  router.param("id", async (req, _res, next, rawId) => {
    try {
      req.params.id = await normalizeProjectReference(req, rawId);
      next();
    } catch (err) {
      next(err);
    }
  });

  router.get("/companies/:companyId/projects", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  router.get("/projects/:id/metrics", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);
    const metrics = await svc.getMetrics(id);
    res.json(metrics);
  });

  router.get("/projects/:id", async (req, res) => {
    const id = req.params.id as string;
    const project = await svc.getById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);
    res.json(project);
  });

  router.post("/companies/:companyId/projects", validate(createProjectSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    type CreateProjectPayload = Parameters<typeof svc.create>[1] & {
      workspace?: Parameters<typeof svc.createWorkspace>[1];
    };

    const { workspace, ...projectData } = req.body as CreateProjectPayload;
    const project = await svc.create(companyId, projectData);
    let createdWorkspaceId: string | null = null;
    if (workspace) {
      const createdWorkspace = await svc.createWorkspace(project.id, workspace);
      if (!createdWorkspace) {
        await svc.remove(project.id);
        res.status(422).json({ error: "Invalid project workspace payload" });
        return;
      }
      createdWorkspaceId = createdWorkspace.id;
    }
    const hydratedProject = workspace ? await svc.getById(project.id) : project;

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      details: {
        name: project.name,
        workspaceId: createdWorkspaceId,
      },
    });
    res.status(201).json(hydratedProject ?? project);
  });

  router.patch("/projects/:id", validate(updateProjectSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const body = { ...req.body };
    if (typeof body.archivedAt === "string") {
      body.archivedAt = new Date(body.archivedAt);
    }
    const project = await svc.update(id, body);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.updated",
      entityType: "project",
      entityId: project.id,
      details: req.body,
    });

    res.json(project);
  });

  router.get("/projects/:id/workspaces", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const workspaces = await svc.listWorkspaces(id);
    res.json(workspaces);
  });

  router.post("/projects/:id/workspaces", validate(createProjectWorkspaceSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const workspace = await svc.createWorkspace(id, req.body);
    if (!workspace) {
      res.status(422).json({ error: "Invalid project workspace payload" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.workspace_created",
      entityType: "project",
      entityId: id,
      details: {
        workspaceId: workspace.id,
        name: workspace.name,
        cwd: workspace.cwd,
        isPrimary: workspace.isPrimary,
      },
    });

    res.status(201).json(workspace);
  });

  router.patch(
    "/projects/:id/workspaces/:workspaceId",
    validate(updateProjectWorkspaceSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const workspaceId = req.params.workspaceId as string;
      const existing = await svc.getById(id);
      if (!existing) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      assertCompanyAccess(req, existing.companyId);
      const workspaceExists = (await svc.listWorkspaces(id)).some((workspace) => workspace.id === workspaceId);
      if (!workspaceExists) {
        res.status(404).json({ error: "Project workspace not found" });
        return;
      }
      const workspace = await svc.updateWorkspace(id, workspaceId, req.body);
      if (!workspace) {
        res.status(422).json({ error: "Invalid project workspace payload" });
        return;
      }

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.workspace_updated",
        entityType: "project",
        entityId: id,
        details: {
          workspaceId: workspace.id,
          changedKeys: Object.keys(req.body).sort(),
        },
      });

      res.json(workspace);
    },
  );

  router.delete("/projects/:id/workspaces/:workspaceId", async (req, res) => {
    const id = req.params.id as string;
    const workspaceId = req.params.workspaceId as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const workspace = await svc.removeWorkspace(id, workspaceId);
    if (!workspace) {
      res.status(404).json({ error: "Project workspace not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.workspace_deleted",
      entityType: "project",
      entityId: id,
      details: {
        workspaceId: workspace.id,
        name: workspace.name,
      },
    });

    res.json(workspace);
  });

  router.delete("/projects/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const project = await svc.remove(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "project.deleted",
      entityType: "project",
      entityId: project.id,
    });

    res.json(project);
  });

  // Sprint report: GET /companies/:companyId/reports/sprint (returns Markdown)
  router.get("/companies/:companyId/reports/sprint", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const allProjects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.companyId, companyId));

    const allIssues = await db
      .select()
      .from(issuesTable)
      .where(eq(issuesTable.companyId, companyId));

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400_000);

    const totalIssues = allIssues.length;
    const doneIssues = allIssues.filter((i) => i.status === "done");
    const inProgressIssues = allIssues.filter((i) => i.status === "in_progress");
    const blockedIssues = allIssues.filter((i) => i.status === "blocked");
    const recentlyDone = doneIssues.filter(
      (i) => i.completedAt && new Date(i.completedAt) >= weekAgo,
    );
    const activeProjects = allProjects.filter((p) => p.status !== "done" && !p.archivedAt);
    const overdueProjects = activeProjects.filter(
      (p) => p.targetDate && new Date(p.targetDate) < now,
    );

    // Velocity = issues completed in the last 7 days
    const velocity = recentlyDone.length;

    // Generate AI narrative (non-blocking — falls back gracefully)
    const aiNarrative = await generateSprintNarrative({
      totalIssues,
      doneAllTime: doneIssues.length,
      doneThisWeek: velocity,
      inProgress: inProgressIssues.length,
      blocked: blockedIssues.length,
      activeProjects: activeProjects.length,
      velocity,
      blockedTitles: blockedIssues.slice(0, 5).map((i) => i.title),
      overdueProjects: overdueProjects.slice(0, 5).map((p) => p.name),
    });

    const lines: string[] = [
      `# Sprint Report`,
      ``,
      `Generated: ${now.toISOString().split("T")[0]}`,
      ``,
    ];

    // AI Executive Summary section
    lines.push(`## AI Executive Summary`);
    lines.push(``);
    if (aiNarrative) {
      lines.push(aiNarrative);
    } else {
      lines.push(`_AI summary unavailable — Ollama did not respond in time._`);
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    lines.push(
      `## Metrics`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total issues | ${totalIssues} |`,
      `| Completed (all time) | ${doneIssues.length} |`,
      `| Velocity (last 7 days) | ${velocity} issues/week |`,
      `| In progress | ${inProgressIssues.length} |`,
      `| Blocked | ${blockedIssues.length} |`,
      `| Active projects | ${activeProjects.length} |`,
      `| Overdue projects | ${overdueProjects.length} |`,
      ``,
      `## Projects`,
      ``,
    );

    for (const project of allProjects.filter((p) => !p.archivedAt)) {
      const projectIssues = allIssues.filter((i) => i.projectId === project.id);
      const done = projectIssues.filter((i) => i.status === "done").length;
      const total = projectIssues.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const isOverdue = project.targetDate && new Date(project.targetDate) < now && project.status !== "done";
      lines.push(`### ${project.name}${isOverdue ? " ⚠️ OVERDUE" : ""}`);
      lines.push(``);
      lines.push(`- Status: **${project.status}**`);
      lines.push(`- Issues: ${done}/${total} done (${pct}%)`);
      if (project.targetDate) lines.push(`- Target: ${project.targetDate}${isOverdue ? " _(overdue)_" : ""}`);
      lines.push(``);
    }

    if (recentlyDone.length > 0) {
      lines.push(`## Completed This Week`);
      lines.push(``);
      for (const issue of recentlyDone.slice(0, 20)) {
        lines.push(`- [${issue.identifier ?? issue.id}] ${issue.title}`);
      }
      lines.push(``);
    }

    if (blockedIssues.length > 0) {
      lines.push(`## Blocked Issues`);
      lines.push(``);
      for (const issue of blockedIssues.slice(0, 20)) {
        lines.push(`- [${issue.identifier ?? issue.id}] ${issue.title}`);
      }
      lines.push(``);
    }

    const md = lines.join("\n");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sprint-report-${now.toISOString().split("T")[0]}.md"`,
    );
    res.send(md);
  });

  return router;
}
