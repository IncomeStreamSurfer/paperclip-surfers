/**
 * ComfyUI txt2img service for generating agent avatars.
 *
 * Requires COMFYUI_URL env var (default: http://192.168.68.230:8188).
 * Available checkpoints (lowvram RTX 3060):
 *   realistic   → cyberrealistic_v40.safetensors
 *   cartoon     → meinaunreal_v41.safetensors
 *   anime       → meinaunreal_v41.safetensors
 *   oil-painting, watercolor, sketch, 3d-render → cyberrealistic_v40.safetensors
 *   pixel-art   → MOHAWK_v18VAEBaked.safetensors
 *
 * Prompt expansion uses Ollama (OLLAMA_HOST env var).
 * Temperature (1–10) maps to CFG scale: T=1→CFG≈14, T=5→CFG≈7, T=10→CFG≈2.
 */

const COMFYUI_URL = (process.env.COMFYUI_URL ?? "http://192.168.68.230:8188").replace(/\/$/, "");
const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://192.168.68.230:11434").replace(/\/$/, "");
const EXPAND_MODEL = process.env.AVATAR_EXPAND_MODEL ?? "dagbs/deepseek-coder-v2-lite-instruct:latest";
const EXPAND_TIMEOUT_MS = parseInt(process.env.AVATAR_EXPAND_TIMEOUT_MS ?? "300000", 10);
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 60; // 90 s

export type AvatarStyle =
  | "realistic"
  | "cartoon"
  | "anime"
  | "oil-painting"
  | "watercolor"
  | "pixel-art"
  | "3d-render"
  | "sketch";

export type AvatarGender = "male" | "female" | "neutral";

export interface GenerateAvatarOptions {
  agentName: string;
  style?: AvatarStyle;
  gender?: AvatarGender;
  seed?: number;
  customPrompt?: string;
  /** Override the checkpoint instead of using the style-default. */
  checkpoint?: string;
  /**
   * Temperature 1–10.
   * Maps to CFG scale: T=1 → CFG≈14 (strict), T=5 → CFG≈7 (balanced), T=10 → CFG≈2 (creative).
   */
  temperature?: number;
}

// ─── Checkpoint preferences per style ────────────────────────────────────────

const STYLE_CHECKPOINT: Record<AvatarStyle, string> = {
  realistic:     "cyberrealistic_v40.safetensors",
  cartoon:       "meinaunreal_v41.safetensors",
  anime:         "meinaunreal_v41.safetensors",
  "oil-painting": "cyberrealistic_v40.safetensors",
  watercolor:    "cyberrealistic_v40.safetensors",
  sketch:        "cyberrealistic_v40.safetensors",
  "3d-render":   "cyberrealistic_v40.safetensors",
  "pixel-art":   "MOHAWK_v18VAEBaked.safetensors",
};

const DEFAULT_STEPS: Record<AvatarStyle, number> = {
  realistic:     25,
  cartoon:       20,
  anime:         22,
  "oil-painting": 28,
  watercolor:    26,
  sketch:        20,
  "3d-render":   25,
  "pixel-art":   18,
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

function genderWords(gender: AvatarGender): { tag: string; word: string } {
  if (gender === "male")   return { tag: "man, male",         word: "man" };
  if (gender === "female") return { tag: "woman, female",     word: "woman" };
  return                          { tag: "person",             word: "person" };
}

function buildPositivePrompt(
  name: string,
  style: AvatarStyle,
  gender: AvatarGender,
): string {
  const g = genderWords(gender);
  switch (style) {
    case "realistic":
      return (
        `professional portrait photo of a ${g.tag}, named ${name}, ` +
        `corporate headshot, high quality, detailed face, sharp focus, ` +
        `natural lighting, clean background, photorealistic, 8k`
      );
    case "cartoon":
      return (
        `cartoon avatar of a ${g.tag}, named ${name}, ` +
        `colorful toon style, expressive face, clean lines, vibrant colors, ` +
        `digital art, smooth shading, white background`
      );
    case "anime":
      return (
        `anime portrait of a ${g.tag}, named ${name}, ` +
        `manga style, detailed eyes, clean linework, soft shading, ` +
        `vibrant colors, studio-quality illustration, white background`
      );
    case "oil-painting":
      return (
        `oil painting portrait of a ${g.tag}, named ${name}, ` +
        `classical art style, rich colors, visible brush strokes, ` +
        `detailed face, painterly texture, museum quality, dramatic lighting`
      );
    case "watercolor":
      return (
        `watercolor illustration portrait of a ${g.tag}, named ${name}, ` +
        `soft washes of color, delicate linework, paper texture, ` +
        `artistic, gentle gradients, white background`
      );
    case "sketch":
      return (
        `pencil sketch portrait of a ${g.tag}, named ${name}, ` +
        `detailed linework, cross-hatching, graphite drawing, ` +
        `high contrast, white background, fine art illustration`
      );
    case "3d-render":
      return (
        `3D rendered portrait of a ${g.tag}, named ${name}, ` +
        `CGI character, subsurface scattering, studio lighting, ` +
        `ultra-detailed, octane render, 8k resolution, clean background`
      );
    case "pixel-art":
      return (
        `pixel art avatar of a ${g.tag}, named ${name}, ` +
        `16-bit sprite, retro video game style, limited palette, ` +
        `crisp pixels, transparent background, RPG character`
      );
  }
}

function buildNegativePrompt(style: AvatarStyle): string {
  const base =
    "ugly, blurry, nsfw, watermark, deformed, extra limbs, bad anatomy, text, signature, " +
    "lowres, jpeg artifacts, cropped, mutation, disfigured";
  switch (style) {
    case "realistic":
      return `${base}, cartoon, anime, illustration, painting, drawing`;
    case "cartoon":
    case "anime":
      return `${base}, photo, photorealistic, 3d render, realistic skin`;
    case "oil-painting":
    case "watercolor":
    case "sketch":
      return `${base}, photo, photorealistic, 3d render, cartoon, anime`;
    case "3d-render":
      return `${base}, cartoon, anime, flat illustration, 2d`;
    case "pixel-art":
      return `${base}, photo, 3d render, blurry edges, anti-aliased, smooth gradients`;
  }
}

/** Convert UI temperature (1–10) → CFG scale (2–14). */
function temperatureToCfg(temperature: number): number {
  const t = Math.max(1, Math.min(10, temperature));
  // T=1 → 14, T=5 → 7, T=10 → 2
  return Math.max(2, Math.round(15 - t * 1.3));
}

function buildWorkflow(
  checkpoint: string,
  positivePrompt: string,
  negativePrompt: string,
  seed: number,
  style: AvatarStyle,
  cfg: number,
): Record<string, unknown> {
  const steps = DEFAULT_STEPS[style] ?? 22;
  const width  = style === "pixel-art" ? 256 : 512;
  const height = style === "pixel-art" ? 256 : 512;

  return buildImageWorkflow(checkpoint, positivePrompt, negativePrompt, seed, steps, width, height, cfg);
}

/** Generic workflow builder — used by both avatar and design generation. */
function buildImageWorkflow(
  checkpoint: string,
  positivePrompt: string,
  negativePrompt: string,
  seed: number,
  steps: number,
  width: number,
  height: number,
  cfg: number,
): Record<string, unknown> {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: checkpoint },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: positivePrompt, clip: ["1", 1] },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt, clip: ["1", 1] },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model:        ["1", 0],
        positive:     ["2", 0],
        negative:     ["3", 0],
        latent_image: ["4", 0],
        seed,
        steps,
        cfg,
        sampler_name: "dpmpp_2m",
        scheduler:    "karras",
        denoise:      1.0,
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { images: ["6", 0], filename_prefix: "paperclip_avatar" },
    },
  };
}

// ─── ComfyUI polling ──────────────────────────────────────────────────────────

interface ComfyHistoryOutput {
  images?: Array<{ filename: string; subfolder: string; type: string }>;
}
interface ComfyHistoryEntry {
  outputs?: Record<string, ComfyHistoryOutput>;
  status?: { completed?: boolean; status_str?: string };
}

async function pollUntilDone(promptId: string): Promise<Buffer> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const resp = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!resp.ok) continue;

    const history = (await resp.json()) as Record<string, ComfyHistoryEntry>;
    const entry = history[promptId];
    if (!entry) continue;

    if (entry.status?.completed !== true) continue;
    if (entry.status?.status_str === "error") {
      throw new Error(`ComfyUI generation failed for prompt ${promptId}`);
    }

    const outputs = entry.outputs ?? {};
    for (const nodeOutput of Object.values(outputs)) {
      const images = nodeOutput.images ?? [];
      for (const img of images) {
        if (img.type === "output") {
          const params = new URLSearchParams({
            filename: img.filename,
            subfolder: img.subfolder ?? "",
            type: "output",
          });
          const imgResp = await fetch(`${COMFYUI_URL}/view?${params}`);
          if (!imgResp.ok) {
            throw new Error(`Failed to download ComfyUI image: HTTP ${imgResp.status}`);
          }
          return Buffer.from(await imgResp.arrayBuffer());
        }
      }
    }
  }
  throw new Error(`ComfyUI generation timed out after ${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}

async function expandDesignPromptViaOllama(
  description: string,
  style: AvatarStyle,
): Promise<string> {
  const styleDescriptions: Record<AvatarStyle, string> = {
    realistic:     "a photorealistic high-quality image",
    cartoon:       "a colorful cartoon illustration",
    anime:         "an anime/manga style illustration",
    "oil-painting": "a classical oil painting",
    watercolor:    "a watercolor illustration",
    sketch:        "a detailed pencil sketch",
    "3d-render":   "a 3D CGI rendered image",
    "pixel-art":   "a pixel art image",
  };

  const systemPrompt =
    "You are an expert at writing Stable Diffusion image generation prompts. " +
    "Respond with ONLY the prompt text — no explanation, no quotes, no extra commentary. " +
    "Include subject details, rendering style, lighting, and quality tags.";

  const userPrompt =
    `Write a detailed Stable Diffusion positive prompt for ${styleDescriptions[style]}. ` +
    `The image should depict: "${description}". ` +
    `Include: the subject, composition, lighting, color palette, background, and end with quality tags.`;

  const resp = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EXPAND_MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(EXPAND_TIMEOUT_MS),
  });

  if (!resp.ok) {
    throw new Error(`Ollama design expand request failed (HTTP ${resp.status})`);
  }

  const data = (await resp.json()) as { message?: { content?: string }; error?: string };
  const expanded = data.message?.content?.trim();
  if (!expanded) throw new Error(data.error ?? "Ollama returned empty response");
  return expanded;
}

// ─── Ollama prompt expansion ──────────────────────────────────────────────────

async function expandPromptViaOllama(
  description: string,
  style: AvatarStyle,
  gender: AvatarGender,
): Promise<string> {
  const g = genderWords(gender);
  const styleDescriptions: Record<AvatarStyle, string> = {
    realistic:     "a photorealistic professional portrait photo",
    cartoon:       "a colorful cartoon avatar",
    anime:         "an anime/manga style portrait illustration",
    "oil-painting": "a classical oil painting portrait",
    watercolor:    "a watercolor illustration portrait",
    sketch:        "a detailed pencil sketch portrait",
    "3d-render":   "a 3D CGI rendered portrait",
    "pixel-art":   "a pixel art avatar sprite",
  };

  const systemPrompt =
    "You are an expert at writing Stable Diffusion image generation prompts. " +
    "Respond with ONLY the prompt text — no explanation, no quotes, no extra commentary. " +
    "Always include the subject's gender, rendering style, and quality tags in the output.";

  const userPrompt =
    `Write a detailed Stable Diffusion positive prompt for ${styleDescriptions[style]} of a ${g.word}. ` +
    `Base the appearance, outfit, and mood on this description: "${description}". ` +
    `The output MUST explicitly mention: the gender (${g.word}), the rendering style (${style}), ` +
    `hair color, eye color, clothing, lighting, background, and end with quality tags for the style.`;

  const resp = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EXPAND_MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(EXPAND_TIMEOUT_MS),
  });

  if (!resp.ok) {
    throw new Error(`Ollama expand request failed (HTTP ${resp.status})`);
  }

  const data = (await resp.json()) as { message?: { content?: string }; error?: string };
  const expanded = data.message?.content?.trim();
  if (!expanded) throw new Error(data.error ?? "Ollama returned empty response");
  return expanded;
}

// ─── Public service ───────────────────────────────────────────────────────────

export const comfyuiService = {
  isConfigured(): boolean {
    return Boolean(COMFYUI_URL);
  },

  /** Returns the list of available checkpoint names from ComfyUI. Empty array on any error. */
  async getCheckpoints(): Promise<string[]> {
    try {
      const resp = await fetch(`${COMFYUI_URL}/object_info/CheckpointLoaderSimple`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as {
        CheckpointLoaderSimple?: {
          input?: { required?: { ckpt_name?: [string[]] } };
        };
      };
      const names = data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
      return Array.isArray(names) ? names : [];
    } catch {
      return [];
    }
  },

  /** Pick the best checkpoint for a given style from the available list. */
  pickCheckpoint(style: AvatarStyle, available: string[]): string | null {
    if (available.length === 0) return null;
    const preferred = STYLE_CHECKPOINT[style];
    if (available.includes(preferred)) return preferred;
    // Fallback priority
    const fallbacks = [
      "cyberrealistic_v40.safetensors",
      "meinaunreal_v41.safetensors",
      "MOHAWK_v18VAEBaked.safetensors",
      "sdxl_base.safetensors",
    ];
    for (const fb of fallbacks) {
      if (available.includes(fb)) return fb;
    }
    return available[0] ?? null;
  },

  async expandPrompt(
    description: string,
    style: AvatarStyle = "realistic",
    gender: AvatarGender = "neutral",
  ): Promise<string> {
    return expandPromptViaOllama(description, style, gender);
  },

  async expandDesignPrompt(description: string, style: AvatarStyle = "realistic"): Promise<string> {
    return expandDesignPromptViaOllama(description, style);
  },

  async generateAvatar(opts: GenerateAvatarOptions): Promise<Buffer> {
    const style: AvatarStyle = opts.style ?? "realistic";
    const gender: AvatarGender = opts.gender ?? "neutral";
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);
    const cfg  = temperatureToCfg(opts.temperature ?? 5);

    const checkpoint = opts.checkpoint ?? STYLE_CHECKPOINT[style];

    let positivePrompt: string;
    if (opts.customPrompt?.trim()) {
      const g = genderWords(gender);
      const styleTag = style.replace(/-/g, " ");
      positivePrompt = `${g.tag}, ${opts.customPrompt.trim()}, ${styleTag} style`;
    } else {
      positivePrompt = buildPositivePrompt(opts.agentName, style, gender);
    }
    const negativePrompt = buildNegativePrompt(style);
    const workflow = buildWorkflow(checkpoint, positivePrompt, negativePrompt, seed, style, cfg);

    const queueResp = await fetch(`${COMFYUI_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueResp.ok) {
      const text = await queueResp.text().catch(() => "");
      throw new Error(`ComfyUI queue request failed (HTTP ${queueResp.status}): ${text}`);
    }

    const queueData = (await queueResp.json()) as { prompt_id?: string; error?: string };
    if (!queueData.prompt_id) {
      throw new Error(
        `ComfyUI did not return a prompt_id: ${queueData.error ?? JSON.stringify(queueData)}`,
      );
    }

    return pollUntilDone(queueData.prompt_id);
  },

  /** Generate a design image with an explicit positive/negative prompt and dimensions. */
  async generateImage(opts: {
    positivePrompt: string;
    negativePrompt?: string;
    checkpoint: string;
    seed?: number;
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
  }): Promise<{ imageBuffer: Buffer; seed: number }> {
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);
    const negativePrompt =
      opts.negativePrompt ??
      "ugly, blurry, nsfw, watermark, deformed, extra limbs, bad anatomy, text, signature, lowres, jpeg artifacts, cropped";
    const workflow = buildImageWorkflow(
      opts.checkpoint,
      opts.positivePrompt,
      negativePrompt,
      seed,
      opts.steps ?? 22,
      opts.width ?? 512,
      opts.height ?? 512,
      opts.cfg ?? 7,
    );

    const queueResp = await fetch(`${COMFYUI_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueResp.ok) {
      const text = await queueResp.text().catch(() => "");
      throw new Error(`ComfyUI queue request failed (HTTP ${queueResp.status}): ${text}`);
    }

    const queueData = (await queueResp.json()) as { prompt_id?: string; error?: string };
    if (!queueData.prompt_id) {
      throw new Error(
        `ComfyUI did not return a prompt_id: ${queueData.error ?? JSON.stringify(queueData)}`,
      );
    }

    const imageBuffer = await pollUntilDone(queueData.prompt_id);
    return { imageBuffer, seed };
  },
};
