import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { departmentRoutes } from "../routes/departments.js";
import type { Db } from "@paperclipai/db";

vi.mock("../services/index.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const DEPT_ID = "00000000-0000-0000-0000-000000000002";

const mockDept = {
  id: DEPT_ID,
  companyId: COMPANY_ID,
  name: "Engineering",
  description: null,
  color: "#3b82f6",
  leadUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createApp(db: Db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      userId: "user-1",
      companyIds: [COMPANY_ID],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", departmentRoutes(db));
  app.use(errorHandler);
  return app;
}

describe("department routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /companies/:companyId/departments", () => {
    it("returns empty department list", async () => {
      const db = {
        select: () => ({ from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }) }),
      } as unknown as Db;

      const app = createApp(db);
      const res = await request(app).get(`/api/companies/${COMPANY_ID}/departments`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ departments: [] });
    });

    it("returns departments", async () => {
      const db = {
        select: () => ({
          from: () => ({ where: () => ({ orderBy: () => Promise.resolve([mockDept]) }) }),
        }),
      } as unknown as Db;

      const app = createApp(db);
      const res = await request(app).get(`/api/companies/${COMPANY_ID}/departments`);
      expect(res.status).toBe(200);
      expect(res.body.departments).toHaveLength(1);
      expect(res.body.departments[0].name).toBe("Engineering");
    });
  });

  describe("POST /companies/:companyId/departments", () => {
    it("creates a department and returns 201", async () => {
      const db = {
        insert: () => ({ values: () => ({ returning: () => Promise.resolve([mockDept]) }) }),
      } as unknown as Db;

      const app = createApp(db);
      const res = await request(app)
        .post(`/api/companies/${COMPANY_ID}/departments`)
        .send({ name: "Engineering", color: "#3b82f6" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Engineering");
      expect(res.body.id).toBe(DEPT_ID);
    });

    it("returns 400 when name is missing", async () => {
      const db = {} as unknown as Db;
      const app = createApp(db);
      const res = await request(app)
        .post(`/api/companies/${COMPANY_ID}/departments`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /companies/:companyId/departments/:departmentId", () => {
    it("returns 404 when department does not exist", async () => {
      const db = {
        delete: () => ({
          where: () => ({ returning: () => Promise.resolve([]) }),
        }),
      } as unknown as Db;

      const app = createApp(db);
      const res = await request(app).delete(
        `/api/companies/${COMPANY_ID}/departments/${DEPT_ID}`,
      );
      expect(res.status).toBe(404);
    });

    it("returns 204 on successful delete", async () => {
      const db = {
        delete: () => ({
          where: () => ({ returning: () => Promise.resolve([mockDept]) }),
        }),
      } as unknown as Db;

      const app = createApp(db);
      const res = await request(app).delete(
        `/api/companies/${COMPANY_ID}/departments/${DEPT_ID}`,
      );
      expect(res.status).toBe(204);
    });
  });
});
