import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createCrmContactSchema,
  updateCrmContactSchema,
  createCrmDealSchema,
  updateCrmDealSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { crmService } from "../services/crm.js";
import { logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function crmRoutes(db: Db) {
  const router = Router();
  const svc = crmService(db);

  // ── Contacts ───────────────────────────────────────────────────────────────

  router.get("/companies/:companyId/crm/contacts", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { status } = req.query as { status?: string };
    const contacts = await svc.listContacts(companyId, { status });
    res.json(contacts);
  });

  router.get("/crm/contacts/:contactId", async (req, res) => {
    const { contactId } = req.params as { contactId: string };
    const contact = await svc.getContactById(contactId);
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    assertCompanyAccess(req, contact.companyId);
    res.json(contact);
  });

  router.post(
    "/companies/:companyId/crm/contacts",
    validate(createCrmContactSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const contact = await svc.createContact(companyId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "crm_contact.created",
        entityType: "crm_contact",
        entityId: contact!.id,
        details: { name: `${contact!.firstName} ${contact!.lastName}`.trim() },
      });
      res.status(201).json(contact);
    },
  );

  router.patch(
    "/crm/contacts/:contactId",
    validate(updateCrmContactSchema),
    async (req, res) => {
      const { contactId } = req.params as { contactId: string };
      const existing = await svc.getContactById(contactId);
      if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const updated = await svc.updateContact(contactId, req.body);
      res.json(updated);
    },
  );

  router.delete("/crm/contacts/:contactId", async (req, res) => {
    const { contactId } = req.params as { contactId: string };
    const existing = await svc.getContactById(contactId);
    if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.deleteContact(contactId);
    res.status(204).end();
  });

  // ── Deals ──────────────────────────────────────────────────────────────────

  router.get("/companies/:companyId/crm/deals", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { stage, contactId } = req.query as { stage?: string; contactId?: string };
    const deals = await svc.listDeals(companyId, { stage, contactId });
    res.json(deals);
  });

  router.get("/crm/deals/:dealId", async (req, res) => {
    const { dealId } = req.params as { dealId: string };
    const deal = await svc.getDealById(dealId);
    if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }
    assertCompanyAccess(req, deal.companyId);
    res.json(deal);
  });

  router.post(
    "/companies/:companyId/crm/deals",
    validate(createCrmDealSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const deal = await svc.createDeal(companyId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "crm_deal.created",
        entityType: "crm_deal",
        entityId: deal!.id,
        details: { title: deal!.title, stage: deal!.stage },
      });
      res.status(201).json(deal);
    },
  );

  router.patch(
    "/crm/deals/:dealId",
    validate(updateCrmDealSchema),
    async (req, res) => {
      const { dealId } = req.params as { dealId: string };
      const existing = await svc.getDealById(dealId);
      if (!existing) { res.status(404).json({ error: "Deal not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const updated = await svc.updateDeal(dealId, req.body);
      res.json(updated);
    },
  );

  router.delete("/crm/deals/:dealId", async (req, res) => {
    const { dealId } = req.params as { dealId: string };
    const existing = await svc.getDealById(dealId);
    if (!existing) { res.status(404).json({ error: "Deal not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.deleteDeal(dealId);
    res.status(204).end();
  });

  return router;
}
