import { Router } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  authUsers,
  companies,
  companyMemberships,
  userCompanyRoles,
  userInvitations,
} from "@paperclipai/db";
import {
  COMPANY_USER_ROLE_HIERARCHY,
  inviteUserSchema,
  updateUserRoleSchema,
} from "@paperclipai/shared";
import { forbidden, notFound, badRequest, conflict } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { logActivity, emailService } from "../services/index.js";

const USER_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

function isInstanceAdminActor(req: { actor: { isInstanceAdmin?: boolean; source?: string } }) {
  return req.actor.isInstanceAdmin || req.actor.source === "local_implicit";
}

async function requireCompanyAdminRole(
  db: Db,
  companyId: string,
  userId: string | null | undefined,
) {
  if (!userId) throw forbidden("Login required");
  const row = await db
    .select({ role: userCompanyRoles.role })
    .from(userCompanyRoles)
    .where(and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)))
    .then((rows) => rows[0] ?? null);
  if (!row) throw forbidden("Not a member of this company");
  const level = COMPANY_USER_ROLE_HIERARCHY[row.role] ?? -1;
  if (level < (COMPANY_USER_ROLE_HIERARCHY["company_admin"] ?? 2)) {
    throw forbidden("Company admin role required");
  }
}

export function teamRoutes(db: Db) {
  const router = Router();

  router.get("/companies/:companyId/team", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const rows = await db
        .select({
          userId: userCompanyRoles.userId,
          role: userCompanyRoles.role,
          createdAt: userCompanyRoles.createdAt,
          name: authUsers.name,
          email: authUsers.email,
        })
        .from(userCompanyRoles)
        .leftJoin(authUsers, eq(userCompanyRoles.userId, authUsers.id))
        .where(eq(userCompanyRoles.companyId, companyId))
        .orderBy(userCompanyRoles.createdAt);

      res.json({ members: rows });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/companies/:companyId/team/invite",
    validate(inviteUserSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);

        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const { email, role } = req.body as { email: string; role: string };

        // Fix 5: include expiry filter in duplicate-invite check
        const existing = await db
          .select({ id: userInvitations.id })
          .from(userInvitations)
          .where(
            and(
              eq(userInvitations.companyId, companyId),
              eq(userInvitations.email, email.toLowerCase()),
              isNull(userInvitations.acceptedAt),
              isNull(userInvitations.revokedAt),
              gt(userInvitations.expiresAt, new Date()),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) {
          throw conflict("An active invitation for this email already exists");
        }

        const [invite] = await db
          .insert(userInvitations)
          .values({
            email: email.toLowerCase(),
            companyId,
            role,
            invitedByUserId: req.actor.userId ?? null,
            expiresAt: new Date(Date.now() + USER_INVITATION_TTL_MS),
          })
          .returning();

        if (!invite) throw new Error("Insert returned no row");

        // Fix 7: activity logging for invite creation
        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: req.actor.userId ?? "unknown",
          action: "user_invitation_created",
          entityType: "user_invitation",
          entityId: invite.id,
          details: { email, role },
        });

        // Fire-and-forget invite email if SMTP is configured
        const company = await db
          .select({ name: companies.name })
          .from(companies)
          .where(eq(companies.id, companyId))
          .then((rows) => rows[0] ?? null);

        const origin =
          (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "http://") +
          (req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost");

        emailService(db)
          .sendInviteEmail({
            email: invite.email,
            role: invite.role,
            companyName: company?.name ?? "your team",
            acceptLink: `${origin}/accept-user-invite/${invite.token}`,
          })
          .catch(() => {/* SMTP not configured or failed — ignore */});

        res.status(201).json({
          invitation: {
            id: invite!.id,
            email: invite!.email,
            role: invite!.role,
            token: invite!.token,
            expiresAt: invite!.expiresAt,
            acceptLink: `/accept-user-invite/${invite!.token}`,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/companies/:companyId/team/:userId/role",
    validate(updateUserRoleSchema),
    async (req, res, next) => {
      try {
        const { companyId, userId } = req.params as { companyId: string; userId: string };
        assertCompanyAccess(req, companyId);

        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const { role } = req.body as { role: string };

        // Fix 4: last-admin guard on PATCH role
        const currentRole = await db
          .select({ role: userCompanyRoles.role })
          .from(userCompanyRoles)
          .where(and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)))
          .then((rows) => rows[0] ?? null);

        if (currentRole?.role === "company_admin" && role !== "company_admin") {
          const adminCount = await db
            .select({ id: userCompanyRoles.id })
            .from(userCompanyRoles)
            .where(and(eq(userCompanyRoles.companyId, companyId), eq(userCompanyRoles.role, "company_admin")))
            .then((rows) => rows.length);
          if (adminCount <= 1) throw badRequest("Cannot remove the last company admin");
        }

        const [updated] = await db
          .update(userCompanyRoles)
          .set({ role, updatedAt: new Date() })
          .where(
            and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)),
          )
          .returning();

        if (!updated) throw notFound("Member not found");

        // Fix 7: activity logging for role change
        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: req.actor.userId ?? "unknown",
          action: "team_member_role_changed",
          entityType: "user_company_role",
          entityId: updated.id,
          details: { targetUserId: userId, newRole: role },
        });

        res.json({ member: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete("/companies/:companyId/team/:userId", async (req, res, next) => {
    try {
      const { companyId, userId } = req.params as { companyId: string; userId: string };
      assertCompanyAccess(req, companyId);

      if (!isInstanceAdminActor(req)) {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      const memberToDelete = await db
        .select({ role: userCompanyRoles.role })
        .from(userCompanyRoles)
        .where(and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (memberToDelete?.role === "company_admin") {
        const adminCount = await db
          .select({ id: userCompanyRoles.id })
          .from(userCompanyRoles)
          .where(and(eq(userCompanyRoles.companyId, companyId), eq(userCompanyRoles.role, "company_admin")))
          .then((rows) => rows.length);
        if (adminCount <= 1) throw badRequest("Cannot remove the last company admin");
      }

      const [deleted] = await db
        .delete(userCompanyRoles)
        .where(
          and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)),
        )
        .returning();

      if (!deleted) throw notFound("Member not found");

      // Fix 2: also delete companyMemberships row
      await db
        .delete(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, userId),
          ),
        );

      // Fix 7: activity logging for member removal
      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "unknown",
        action: "team_member_removed",
        entityType: "user_company_role",
        entityId: deleted.id,
        details: { targetUserId: userId },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get("/user-invitations/:token", async (req, res, next) => {
    try {
      const { token } = req.params as { token: string };

      const invite = await db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          role: userInvitations.role,
          expiresAt: userInvitations.expiresAt,
          acceptedAt: userInvitations.acceptedAt,
          revokedAt: userInvitations.revokedAt,
          companyName: companies.name,
        })
        .from(userInvitations)
        .leftJoin(companies, eq(userInvitations.companyId, companies.id))
        .where(eq(userInvitations.token, token))
        .then((rows) => rows[0] ?? null);

      if (!invite) throw notFound("Invitation not found");
      if (invite.revokedAt) throw badRequest("This invitation has been revoked");
      if (invite.acceptedAt) throw badRequest("This invitation has already been accepted");
      if (new Date(invite.expiresAt) < new Date()) throw badRequest("This invitation has expired");

      res.json({
        invitation: {
          email: invite.email,
          role: invite.role,
          companyName: invite.companyName,
          expiresAt: invite.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/user-invitations/:token/claim", async (req, res, next) => {
    try {
      const { token } = req.params as { token: string };
      const userId = req.actor.userId;
      if (!userId) throw forbidden("Login required");

      const invite = await db
        .select()
        .from(userInvitations)
        .where(eq(userInvitations.token, token))
        .then((rows) => rows[0] ?? null);

      if (!invite) throw notFound("Invitation not found");
      if (invite.revokedAt) throw badRequest("Invitation revoked");
      if (invite.acceptedAt) throw badRequest("Invitation already accepted");
      if (new Date(invite.expiresAt) < new Date()) throw badRequest("Invitation expired");

      const user = await db
        .select({ email: authUsers.email })
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .then((rows) => rows[0] ?? null);

      if (!user) throw forbidden("User not found");
      if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
        throw forbidden("Signed-in email does not match invitation email");
      }

      await db.transaction(async (tx) => {
        const existingRole = await tx
          .select({ id: userCompanyRoles.id })
          .from(userCompanyRoles)
          .where(and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, invite.companyId)))
          .then((rows) => rows[0] ?? null);

        if (!existingRole) {
          await tx.insert(userCompanyRoles).values({
            userId,
            companyId: invite.companyId,
            role: invite.role,
          });
        } else {
          await tx
            .update(userCompanyRoles)
            .set({ role: invite.role, updatedAt: new Date() })
            .where(eq(userCompanyRoles.id, existingRole.id));
        }

        // Fix 1: ensure companyMemberships row exists so assertCompanyAccess allows this user
        const existingMembership = await tx
          .select({ id: companyMemberships.id })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, invite.companyId),
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.principalId, userId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!existingMembership) {
          await tx.insert(companyMemberships).values({
            companyId: invite.companyId,
            principalType: "user",
            principalId: userId,
            status: "active",
            membershipRole: invite.role,
          });
        }

        await tx
          .update(userInvitations)
          .set({ acceptedAt: new Date() })
          .where(eq(userInvitations.id, invite.id));
      });

      // Fix 3: fetch issuePrefix for navigation
      const company = await db
        .select({ issuePrefix: companies.issuePrefix })
        .from(companies)
        .where(eq(companies.id, invite.companyId))
        .then((rows) => rows[0] ?? null);

      res.json({ ok: true, companyId: invite.companyId, issuePrefix: company?.issuePrefix ?? null, role: invite.role });
    } catch (err) {
      next(err);
    }
  });

  router.delete(
    "/companies/:companyId/team/invitations/:invitationId",
    async (req, res, next) => {
      try {
        const { companyId, invitationId } = req.params as {
          companyId: string;
          invitationId: string;
        };
        assertCompanyAccess(req, companyId);

        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const [revoked] = await db
          .update(userInvitations)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(userInvitations.id, invitationId),
              eq(userInvitations.companyId, companyId),
              isNull(userInvitations.acceptedAt),
              isNull(userInvitations.revokedAt),
            ),
          )
          .returning();

        if (!revoked) throw notFound("Invitation not found or already resolved");

        // Fix 7: activity logging for invite revocation
        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: req.actor.userId ?? "unknown",
          action: "user_invitation_revoked",
          entityType: "user_invitation",
          entityId: invitationId,
          details: { invitationId },
        });

        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/companies/:companyId/team/invitations", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      if (!isInstanceAdminActor(req)) {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      // Fix 6: filter expired invitations from list
      const invites = await db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          role: userInvitations.role,
          token: userInvitations.token,
          expiresAt: userInvitations.expiresAt,
          createdAt: userInvitations.createdAt,
        })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.companyId, companyId),
            isNull(userInvitations.acceptedAt),
            isNull(userInvitations.revokedAt),
            gt(userInvitations.expiresAt, new Date()),
          ),
        )
        .orderBy(userInvitations.createdAt);

      res.json({ invitations: invites });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
