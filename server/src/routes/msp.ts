import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  mspClients as mspClientsTable,
  mspTickets as mspTicketsTable,
} from "@paperclipai/db";
import {
  createMspClientSchema,
  updateMspClientSchema,
  createMspTicketSchema,
  updateMspTicketSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { notFound } from "../errors.js";

export function mspRoutes(db: Db) {
  const router = Router();

  /* ── MSP Clients ── */

  router.get("/companies/:companyId/msp/clients", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(mspClientsTable)
        .where(eq(mspClientsTable.companyId, companyId))
        .orderBy(mspClientsTable.name);
      res.json({ clients: rows });
    } catch (err) { next(err); }
  });

  router.get("/companies/:companyId/msp/clients/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const row = await db
        .select()
        .from(mspClientsTable)
        .where(and(eq(mspClientsTable.id, id), eq(mspClientsTable.companyId, companyId)))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Client not found");
      res.json(row);
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/msp/clients",
    validate(createMspClientSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const [created] = await db
          .insert(mspClientsTable)
          .values({ companyId, ...req.body })
          .returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/msp/clients/:id",
    validate(updateMspClientSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const [updated] = await db
          .update(mspClientsTable)
          .set({ ...req.body, updatedAt: new Date() })
          .where(and(eq(mspClientsTable.id, id), eq(mspClientsTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Client not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/msp/clients/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(mspClientsTable)
        .where(and(eq(mspClientsTable.id, id), eq(mspClientsTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Client not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  /* ── MSP Tickets ── */

  router.get("/companies/:companyId/msp/tickets", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const clientId = req.query.clientId as string | undefined;
      const rows = await db
        .select()
        .from(mspTicketsTable)
        .where(
          clientId
            ? and(eq(mspTicketsTable.companyId, companyId), eq(mspTicketsTable.clientId, clientId))
            : eq(mspTicketsTable.companyId, companyId),
        )
        .orderBy(desc(mspTicketsTable.createdAt));
      res.json({ tickets: rows });
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/msp/tickets",
    validate(createMspTicketSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const [created] = await db
          .insert(mspTicketsTable)
          .values({ companyId, ...req.body })
          .returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/msp/tickets/:id",
    validate(updateMspTicketSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const body = { ...req.body };
        if (body.resolvedAt) body.resolvedAt = new Date(body.resolvedAt);
        const [updated] = await db
          .update(mspTicketsTable)
          .set({ ...body, updatedAt: new Date() })
          .where(and(eq(mspTicketsTable.id, id), eq(mspTicketsTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Ticket not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/msp/tickets/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(mspTicketsTable)
        .where(and(eq(mspTicketsTable.id, id), eq(mspTicketsTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Ticket not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  return router;
}
