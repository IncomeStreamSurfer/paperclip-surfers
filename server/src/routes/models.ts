import { Router, type Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companyAllowedModels,
  userCompanyRoles,
  agents as agentsTable,
} from "@paperclipai/db";
import {
  COMPANY_USER_ROLE_HIERARCHY,
  updateAllowedModelsSchema,
  toggleModelSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { forbidden, notFound } from "../errors.js";
import { getActorInfo } from "./authz.js";
import {
  getModelSuggestions,
  getAvailableOllamaModels,
  installOllamaModel,
  getInstalledOllamaModels,
  deleteOllamaModel,
  getVllmModels,
  discoverModelsFromProvider,
  type DiscoveredModel,
} from "../services/model-discovery.js";
import { instanceSettings as instanceSettingsTable } from "@paperclipai/db";
import { comfyuiService } from "../services/comfyui.js";

interface VllmEndpoint {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
}

function isInstanceAdminActor(req: { actor: { isInstanceAdmin?: boolean; source?: string } }) {
  return req.actor.isInstanceAdmin || req.actor.source === "local_implicit";
}

function assertModelAdmin(req: Request): void {
  if (req.actor.type !== "board") throw forbidden("Board access required");
  if (isInstanceAdminActor(req)) return;
  throw forbidden("Instance admin access required");
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
    throw forbidden("Company admin required");
  }
}

function getUserIdFromActor(actor: { actorType: string; actorId: string }): string | null {
  if (actor.actorType === "user") {
    return actor.actorId;
  }
  return null;
}

export function modelRoutes(db: Db) {
  const router = Router();

  // Get allowed models for company (Pro+ management)
  router.get("/companies/:companyId/models/allowed", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCompanyAccess(req, companyId);

    const allowed = await db
      .select()
      .from(companyAllowedModels)
      .where(eq(companyAllowedModels.companyId, sql`${companyId}::uuid`));

    res.json({ models: allowed });
  });

  // Bulk update allowed models (Pro+ admin)
  router.patch(
    "/companies/:companyId/models/allowed",
    validate(updateAllowedModelsSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const actor = getActorInfo(req);
      const userId = getUserIdFromActor(actor);
      await requireCompanyAdminRole(db, companyId, userId);

      const { models } = req.body as { models: Array<{ modelId: string; provider: string; enabled: boolean }> };

      // Delete existing and insert new
      await db.delete(companyAllowedModels).where(eq(companyAllowedModels.companyId, sql`${companyId}::uuid`));

      if (models.length > 0) {
        await db.insert(companyAllowedModels).values(
          models.map((m) => ({
            companyId,
            modelId: m.modelId,
            provider: m.provider,
            enabled: m.enabled,
            allowedByUserId: userId,
          })),
        );
      }

      const updated = await db
        .select()
        .from(companyAllowedModels)
        .where(eq(companyAllowedModels.companyId, sql`${companyId}::uuid`));

      res.json({ models: updated });
    },
  );

  // Toggle single model (Pro+ admin)
  router.patch(
    "/companies/:companyId/models/allowed/:modelId",
    validate(toggleModelSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const modelId = req.params.modelId as string;
      const actor = getActorInfo(req);
      const userId = getUserIdFromActor(actor);
      await requireCompanyAdminRole(db, companyId, userId);

      const { enabled } = req.body as { enabled: boolean };

      const existing = await db
        .select()
        .from(companyAllowedModels)
        .where(and(eq(companyAllowedModels.companyId, sql`${companyId}::uuid`), eq(companyAllowedModels.modelId, sql`${modelId}`)))
        .then((rows) => rows[0]);

      if (!existing) {
        throw notFound("Model not found in allowed list");
      }

      await db
        .update(companyAllowedModels)
        .set({ enabled, allowedByUserId: userId ?? undefined })
        .where(and(eq(companyAllowedModels.companyId, sql`${companyId}::uuid`), eq(companyAllowedModels.modelId, sql`${modelId}`)));

      const updated = await db
        .select()
        .from(companyAllowedModels)
        .where(and(eq(companyAllowedModels.companyId, sql`${companyId}::uuid`), eq(companyAllowedModels.modelId, sql`${modelId}`)))
        .then((rows) => rows[0]);

      res.json({ model: updated });
    },
  );

  // Get suggestions (filtered by allowed for Pro+)
  router.get("/models/suggestions", async (req, res) => {
    const useCase = req.query.useCase as string | undefined;
    const companyId = req.query.companyId as string | undefined;

    let allowedModelIds: string[] | undefined;

    // If company specified, check for Pro+ allowed models
    if (companyId) {
      const allowed = await db
        .select({ modelId: companyAllowedModels.modelId, enabled: companyAllowedModels.enabled })
        .from(companyAllowedModels)
        .where(eq(companyAllowedModels.companyId, sql`${companyId}::uuid`));

      const enabledModels = allowed.filter((m) => m.enabled).map((m) => m.modelId);

      // If company has allowed models, use them (Pro+ mode)
      // If no allowed models entry exists, treat as Free (all models available)
      if (allowed.length > 0) {
        allowedModelIds = enabledModels;
      }
    }

    const suggestions = await getModelSuggestions(useCase as "code" | "reasoning" | "fast" | "general" | undefined, allowedModelIds);
    res.json(suggestions);
  });

  // Get available Ollama models to install
  router.get("/models/available", async (_req, res) => {
    const models = await getAvailableOllamaModels();
    res.json(models);
  });

  // Get installed Ollama models
  router.get("/models/installed", async (_req, res) => {
    const models = await getInstalledOllamaModels();
    res.json(models);
  });

  // Install Ollama model
  router.post("/models/install", async (req, res) => {
    const { modelName } = req.body;
    if (!modelName) {
      res.status(400).json({ error: "modelName is required" });
      return;
    }

    const result = await installOllamaModel(modelName);
    res.json(result);
  });

  // Delete installed Ollama model
  router.delete("/models/ollama/:modelName", async (req, res) => {
    const modelName = decodeURIComponent(req.params.modelName as string);
    const result = await deleteOllamaModel(modelName);
    res.json(result);
  });

  // List vLLM endpoint configs (stored in instance_settings)
  router.get("/models/vllm/endpoints", async (_req, res) => {
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((rows) => rows[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const endpoints = (general.vllmEndpoints as VllmEndpoint[]) ?? [];
    res.json({ endpoints });
  });

  // Add vLLM endpoint
  router.post("/models/vllm/endpoints", async (req, res) => {
    const { name, baseURL, apiKey } = req.body as { name: string; baseURL: string; apiKey?: string };
    if (!name || !baseURL) {
      res.status(400).json({ error: "name and baseURL are required" });
      return;
    }

    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const existing = (general.vllmEndpoints as VllmEndpoint[]) ?? [];
    const newEndpoint: VllmEndpoint = { id: crypto.randomUUID(), name, baseURL, apiKey: apiKey ?? "" };
    const updated = [...existing, newEndpoint];

    if (row) {
      await db
        .update(instanceSettingsTable)
        .set({ general: { ...general, vllmEndpoints: updated } });
    } else {
      await db.insert(instanceSettingsTable).values({ general: { vllmEndpoints: updated } });
    }

    res.json({ endpoint: newEndpoint });
  });

  // Delete vLLM endpoint
  router.delete("/models/vllm/endpoints/:id", async (req, res) => {
    const id = req.params.id as string;
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const existing = (general.vllmEndpoints as VllmEndpoint[]) ?? [];
    const updated = existing.filter((e) => e.id !== id);

    if (row) {
      await db
        .update(instanceSettingsTable)
        .set({ general: { ...general, vllmEndpoints: updated } });
    }

    res.json({ ok: true });
  });

  // Probe vLLM endpoint and return discovered models
  router.get("/models/vllm/endpoints/:id/models", async (req, res) => {
    const id = req.params.id as string;
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const endpoints = (general.vllmEndpoints as VllmEndpoint[]) ?? [];
    const endpoint = endpoints.find((e) => e.id === id);

    if (!endpoint) {
      res.status(404).json({ error: "Endpoint not found" });
      return;
    }

    const models = await getVllmModels(endpoint.baseURL, endpoint.apiKey || undefined);
    res.json(models);
  });

  // Get all agents with their current models for a company
  router.get("/companies/:companyId/agents/models", async (req, res) => {
    const companyId = req.params.companyId as string;
    const actor = getActorInfo(req);
    const userId = getUserIdFromActor(actor);
    if (!isInstanceAdminActor(req)) {
      await requireCompanyAdminRole(db, companyId, userId);
    }

    const agentsWithModels = await db
      .select({
        id: agentsTable.id,
        name: agentsTable.name,
        adapterType: agentsTable.adapterType,
        adapterConfig: agentsTable.adapterConfig,
      })
      .from(agentsTable)
      .where(eq(agentsTable.companyId, sql`${companyId}::uuid`));

    res.json({ agents: agentsWithModels });
  });

  // Bulk update agent models
  router.patch("/companies/:companyId/agents/models", async (req, res) => {
    const companyId = req.params.companyId as string;
    const actor = getActorInfo(req);
    const userId = getUserIdFromActor(actor);
    if (!isInstanceAdminActor(req)) {
      await requireCompanyAdminRole(db, companyId, userId);
    }

    const { updates } = req.body as { updates: Array<{ agentId: string; model: string }> };

    for (const update of updates) {
      const agent = await db
        .select({ adapterConfig: agentsTable.adapterConfig })
        .from(agentsTable)
        .where(eq(agentsTable.id, update.agentId))
        .then((rows) => rows[0]);

      if (agent) {
        const newConfig = { ...agent.adapterConfig, model: update.model };
        await db
          .update(agentsTable)
          .set({ adapterConfig: newConfig })
          .where(eq(agentsTable.id, update.agentId));
      }
    }

    const agentsWithModels = await db
      .select({
        id: agentsTable.id,
        name: agentsTable.name,
        adapterType: agentsTable.adapterType,
        adapterConfig: agentsTable.adapterConfig,
      })
      .from(agentsTable)
      .where(eq(agentsTable.companyId, sql`${companyId}::uuid`));

    res.json({ agents: agentsWithModels });
  });

  // Image generation checkpoints (ComfyUI)
  router.get("/models/image-checkpoints", async (_req, res) => {
    const checkpoints = await comfyuiService.getCheckpoints();
    res.json({ checkpoints, available: checkpoints.length > 0 });
  });

  // ── OpenAI API key management ─────────────────────────────────────────────

  const OPENAI_MODEL_PREFIXES = [
    "gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5", "o1", "o3", "o4",
    "chatgpt", "text-embedding", "whisper", "tts", "dall-e",
  ];

  router.get("/models/openai/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const key = general.openaiApiKey as string | undefined;
    res.json({ configured: !!key, maskedKey: key ? `sk-...${key.slice(-4)}` : null });
  });

  router.post("/models/openai/key", async (req, res) => {
    assertModelAdmin(req);
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey?.trim()) {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const updated = { ...general, openaiApiKey: apiKey.trim() };
    if (row) {
      await db.update(instanceSettingsTable).set({ general: updated });
    } else {
      await db.insert(instanceSettingsTable).values({ general: updated });
    }
    res.json({ ok: true, maskedKey: `sk-...${apiKey.trim().slice(-4)}` });
  });

  router.delete("/models/openai/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    if (row) {
      const general = (row.general as Record<string, unknown> | null) ?? {};
      const { openaiApiKey: _k, ...rest } = general;
      await db.update(instanceSettingsTable).set({ general: rest });
    }
    res.json({ ok: true });
  });

  router.get("/models/openai/models", async (_req, res) => {
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const apiKey = (general.openaiApiKey as string | undefined) || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json([]);
      return;
    }
    const all = await discoverModelsFromProvider({ provider: "openai", type: "openai", apiKey });
    const filtered = all.filter((m) =>
      OPENAI_MODEL_PREFIXES.some((p) => m.label.startsWith(p)),
    );
    res.json(filtered.length > 0 ? filtered : all.slice(0, 30));
  });

  // ── OpenRouter API key management ─────────────────────────────────────────

  router.get("/models/openrouter/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const key = general.openrouterApiKey as string | undefined;
    res.json({ configured: !!key, maskedKey: key ? `sk-or-...${key.slice(-4)}` : null });
  });

  router.post("/models/openrouter/key", async (req, res) => {
    assertModelAdmin(req);
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey?.trim()) {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const updated = { ...general, openrouterApiKey: apiKey.trim() };
    if (row) {
      await db.update(instanceSettingsTable).set({ general: updated });
    } else {
      await db.insert(instanceSettingsTable).values({ general: updated });
    }
    res.json({ ok: true, maskedKey: `sk-or-...${apiKey.trim().slice(-4)}` });
  });

  router.delete("/models/openrouter/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    if (row) {
      const general = (row.general as Record<string, unknown> | null) ?? {};
      const { openrouterApiKey: _k, ...rest } = general;
      await db.update(instanceSettingsTable).set({ general: rest });
    }
    res.json({ ok: true });
  });

  router.get("/models/openrouter/models", async (_req, res) => {
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const apiKey = (general.openrouterApiKey as string | undefined) || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      res.json([]);
      return;
    }
    const models = await discoverModelsFromProvider({ provider: "openrouter", type: "openrouter", apiKey });
    res.json(models);
  });

  // ── Vercel AI Gateway ─────────────────────────────────────────────────────

  router.get("/models/vercelai/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const key = general.vercelaiApiKey as string | undefined;
    const url = (general.vercelaiBaseURL as string | undefined) ?? null;
    res.json({ configured: !!key, maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null, url });
  });

  router.post("/models/vercelai/key", async (req, res) => {
    assertModelAdmin(req);
    const { apiKey, baseURL } = req.body as { apiKey?: string; baseURL?: string };
    if (!apiKey?.trim() || !baseURL?.trim()) {
      res.status(400).json({ error: "apiKey and baseURL are required" });
      return;
    }
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const updated = { ...general, vercelaiApiKey: apiKey.trim(), vercelaiBaseURL: baseURL.trim() };
    if (row) {
      await db.update(instanceSettingsTable).set({ general: updated });
    } else {
      await db.insert(instanceSettingsTable).values({ general: updated });
    }
    const k = apiKey.trim();
    res.json({ ok: true, maskedKey: `${k.slice(0, 4)}...${k.slice(-4)}` });
  });

  router.delete("/models/vercelai/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    if (row) {
      const general = (row.general as Record<string, unknown> | null) ?? {};
      const { vercelaiApiKey: _k, vercelaiBaseURL: _u, ...rest } = general;
      await db.update(instanceSettingsTable).set({ general: rest });
    }
    res.json({ ok: true });
  });

  router.get("/models/vercelai/models", async (_req, res) => {
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const apiKey = general.vercelaiApiKey as string | undefined;
    const baseURL = general.vercelaiBaseURL as string | undefined;
    if (!apiKey || !baseURL) {
      res.json([]);
      return;
    }
    const models = await discoverModelsFromProvider({ provider: "vercelai", type: "vercelai", baseURL, apiKey });
    res.json(models);
  });

  // ── Azure OpenAI ──────────────────────────────────────────────────────────

  router.get("/models/azure/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const key = general.azureOpenaiApiKey as string | undefined;
    const url = (general.azureOpenaiEndpoint as string | undefined) ?? null;
    const apiVersion = (general.azureOpenaiApiVersion as string | undefined) ?? null;
    res.json({ configured: !!key, maskedKey: key ? `...${key.slice(-4)}` : null, url, apiVersion });
  });

  router.post("/models/azure/key", async (req, res) => {
    assertModelAdmin(req);
    const { apiKey, endpoint, apiVersion } = req.body as { apiKey?: string; endpoint?: string; apiVersion?: string };
    if (!apiKey?.trim() || !endpoint?.trim()) {
      res.status(400).json({ error: "apiKey and endpoint are required" });
      return;
    }
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const updated = {
      ...general,
      azureOpenaiApiKey: apiKey.trim(),
      azureOpenaiEndpoint: endpoint.trim(),
      azureOpenaiApiVersion: (apiVersion?.trim() || "2024-02-15-preview"),
    };
    if (row) {
      await db.update(instanceSettingsTable).set({ general: updated });
    } else {
      await db.insert(instanceSettingsTable).values({ general: updated });
    }
    res.json({ ok: true, maskedKey: `...${apiKey.trim().slice(-4)}` });
  });

  router.delete("/models/azure/key", async (req, res) => {
    assertModelAdmin(req);
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    if (row) {
      const general = (row.general as Record<string, unknown> | null) ?? {};
      const { azureOpenaiApiKey: _k, azureOpenaiEndpoint: _e, azureOpenaiApiVersion: _v, ...rest } = general;
      await db.update(instanceSettingsTable).set({ general: rest });
    }
    res.json({ ok: true });
  });

  router.get("/models/azure/models", async (_req, res) => {
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((r) => r[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};
    const apiKey = general.azureOpenaiApiKey as string | undefined;
    const baseURL = general.azureOpenaiEndpoint as string | undefined;
    const apiVersion = (general.azureOpenaiApiVersion as string | undefined) || "2024-02-15-preview";
    if (!apiKey || !baseURL) {
      res.json([]);
      return;
    }
    const models = await discoverModelsFromProvider({ provider: "azure", type: "azure", baseURL, apiKey, apiVersion });
    res.json(models);
  });

  // ── Aggregate: all models from all configured providers ───────────────────

  router.get("/models/all", async (_req, res) => {
    const row = await db
      .select({ general: instanceSettingsTable.general })
      .from(instanceSettingsTable)
      .limit(1)
      .then((rows) => rows[0] ?? null);
    const general = (row?.general as Record<string, unknown> | null) ?? {};

    const tasks: Promise<DiscoveredModel[]>[] = [];

    // Ollama installed models
    tasks.push(getInstalledOllamaModels());

    // OpenAI (direct key or env fallback)
    const openaiKey = (general.openaiApiKey as string | undefined) || process.env.OPENAI_API_KEY;
    if (openaiKey) {
      tasks.push(
        discoverModelsFromProvider({ provider: "openai", type: "openai", apiKey: openaiKey }).then(
          (models) => {
            const filtered = models.filter((m) =>
              OPENAI_MODEL_PREFIXES.some((p) => m.label.startsWith(p)),
            );
            return filtered.length > 0 ? filtered : models.slice(0, 30);
          },
        ),
      );
    }

    // OpenRouter
    const orKey = (general.openrouterApiKey as string | undefined) || process.env.OPENROUTER_API_KEY;
    if (orKey) {
      tasks.push(
        discoverModelsFromProvider({ provider: "openrouter", type: "openrouter", apiKey: orKey }),
      );
    }

    // Vercel AI Gateway
    const vercelKey = general.vercelaiApiKey as string | undefined;
    const vercelBaseURL = general.vercelaiBaseURL as string | undefined;
    if (vercelKey && vercelBaseURL) {
      tasks.push(
        discoverModelsFromProvider({
          provider: "vercelai",
          type: "vercelai",
          baseURL: vercelBaseURL,
          apiKey: vercelKey,
        }),
      );
    }

    // Azure OpenAI
    const azureKey = general.azureOpenaiApiKey as string | undefined;
    const azureEndpoint = general.azureOpenaiEndpoint as string | undefined;
    if (azureKey && azureEndpoint) {
      const azureVersion =
        (general.azureOpenaiApiVersion as string | undefined) || "2024-02-15-preview";
      tasks.push(
        discoverModelsFromProvider({
          provider: "azure",
          type: "azure",
          baseURL: azureEndpoint,
          apiKey: azureKey,
          apiVersion: azureVersion,
        }),
      );
    }

    // vLLM / custom GPU endpoints
    const vllmEndpoints = (general.vllmEndpoints as VllmEndpoint[]) ?? [];
    for (const ep of vllmEndpoints) {
      const epName = ep.name;
      tasks.push(
        getVllmModels(ep.baseURL, ep.apiKey || undefined).then((models) =>
          models.map((m) => ({ ...m, provider: epName })),
        ),
      );
    }

    const results = await Promise.allSettled(tasks);
    const all: DiscoveredModel[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") all.push(...r.value);
    }

    res.json({ models: all });
  });

  return router;
}