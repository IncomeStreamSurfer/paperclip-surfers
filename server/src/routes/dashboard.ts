import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { dashboardService } from "../services/dashboard.js";
import { assertCompanyAccess } from "./authz.js";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);

  router.get("/companies/:companyId/dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const summary = await svc.summary(companyId);
    res.json(summary);
  });

  router.get("/companies/:companyId/dashboard/token-usage", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.tokenUsageByAgent(companyId, days);
    res.json(result);
  });

  router.get("/companies/:companyId/dashboard/burndown", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.burndown(companyId, days);
    res.json(result);
  });

  router.get("/companies/:companyId/dashboard/agent-time", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.agentTimeWorked(companyId, days);
    res.json(result);
  });

  router.get("/companies/:companyId/dashboard/tasks-by-agent", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.tasksByAgent(companyId, days);
    res.json(result);
  });

  router.get("/companies/:companyId/dashboard/issues-by-project", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.issuesByProject(companyId, days);
    res.json(result);
  });

  router.get("/companies/:companyId/dashboard/cycle-time", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.cycleTime(companyId, days);
    res.json(result);
  });

  router.get("/companies/:companyId/dashboard/cost-trend", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.costTrend(companyId, days);
    res.json(result);
  });

  router.get("/companies/:companyId/dashboard/project-health", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await svc.projectHealth(companyId, days);
    res.json(result);
  });

  return router;
}
