/**
 * Built-in MCP HTTP endpoints served by Paperclip server.
 *
 * Protocol: HTTP transport, JSON-RPC 2.0.
 * Path: POST /api/mcp/:toolset
 *
 * Handles: initialize, notifications/initialized, tools/list, tools/call
 *
 * Tool sets:
 *   writing-tools  — thesaurus, grammar check, word-count, readability, text-transform
 *   cad-tools      — openscad, dxf-info, urdf-validate
 *   design-tools   — imagemagick transforms, color palette, svg-info
 *   sysadmin-tools — shell sandbox, ping, service-check
 *   eda-tools      — kicad-info, spice-stub, component-lookup
 *   research-tools — arxiv-search, cite-format, doi-resolve
 *   r-tools        — r-eval, r-plot stub
 *   ros-tools      — ros-bag-info, urdf-validate
 *   ledger-tools   — hledger-balance, parse-transaction
 *   security-tools — hash, cert-info, cve-lookup stub
 *   aviation-tools — metar-fetch, icao-lookup
 *   asterisk-tools — stub (AMI bridge needs live Asterisk)
 *   gis-tools      — geocode, coordinate-convert
 */

import { Router } from "express";
import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import https from "node:https";
import http from "node:http";
import crypto from "node:crypto";
import { assertBoard } from "./authz.js";

const execFile = promisify(execFileCb);

// ---- JSON-RPC helpers ----

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

type ToolContent = { type: "text"; text: string };

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: string | number | null | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function textContent(text: string): ToolContent {
  return { type: "text", text };
}

function toolResult(text: string, isError = false) {
  return { content: [textContent(text)], isError };
}

// ---- CLI helper — gracefully degrades if binary is not installed ----

async function tryExec(cmd: string, args: string[], input?: string): Promise<string> {
  try {
    if (input !== undefined) {
      // Use spawn so we can write to stdin
      return await new Promise<string>((resolve, reject) => {
        const child = spawn(cmd, args, { timeout: 15_000 });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on("data", (c: Buffer) => stdout.push(c));
        child.stderr.on("data", (c: Buffer) => stderr.push(c));
        child.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "ENOENT") reject(new Error(`${cmd} not installed`));
          else reject(err);
        });
        child.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || `${cmd} exited ${code}`));
          } else {
            resolve(Buffer.concat(stdout).toString("utf8").trim());
          }
        });
        child.stdin.end(input, "utf8");
      });
    }
    const result = await execFile(cmd, args, {
      timeout: 15_000,
      maxBuffer: 512 * 1024,
    });
    return (result.stdout || "").trim();
  } catch (err: unknown) {
    const e = err as { code?: string | number; stderr?: string; message?: string };
    if (e.code === "ENOENT") throw new Error(`${cmd} not installed`);
    throw new Error(e.stderr?.trim() || e.message || String(err));
  }
}

// ---- HTTP fetch helper (no external deps) ----

async function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "Paperclip-MCP/1.0" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
  });
}

// ====================================================================
// Tool definitions per toolset
// ====================================================================

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

// ---- writing-tools ----

const WRITING_TOOLS: ToolDef[] = [
  {
    name: "word_count",
    description: "Count words, sentences, and paragraphs in text.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Input text" } },
      required: ["text"],
    },
  },
  {
    name: "text_transform",
    description: "Transform text: uppercase, lowercase, titlecase, reverse, or remove_extra_spaces.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Input text" },
        transform: { type: "string", description: "One of: uppercase, lowercase, titlecase, reverse, remove_extra_spaces" },
      },
      required: ["text", "transform"],
    },
  },
  {
    name: "grammar_check",
    description: "Run diction grammar/style analysis on text (requires diction CLI).",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to check" } },
      required: ["text"],
    },
  },
  {
    name: "readability_score",
    description: "Compute Flesch-Kincaid readability score for text.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Input text" } },
      required: ["text"],
    },
  },
  {
    name: "thesaurus_lookup",
    description: "Look up synonyms for a word via WordNet (requires wn CLI).",
    inputSchema: {
      type: "object",
      properties: { word: { type: "string", description: "Word to look up" } },
      required: ["word"],
    },
  },
];

async function callWritingTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "word_count") {
    const text = args.text ?? "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentences = (text.match(/[.!?]+/g) ?? []).length;
    const paragraphs = text.trim() ? text.split(/\n\s*\n/).length : 0;
    return `Words: ${words}\nSentences: ${sentences}\nParagraphs: ${paragraphs}`;
  }
  if (name === "text_transform") {
    const t = args.text ?? "";
    switch (args.transform) {
      case "uppercase": return t.toUpperCase();
      case "lowercase": return t.toLowerCase();
      case "titlecase": return t.replace(/\b\w/g, (c) => c.toUpperCase());
      case "reverse": return t.split("").reverse().join("");
      case "remove_extra_spaces": return t.replace(/\s+/g, " ").trim();
      default: throw new Error(`Unknown transform: ${args.transform}`);
    }
  }
  if (name === "grammar_check") {
    return tryExec("diction", ["-s"], args.text ?? "");
  }
  if (name === "readability_score") {
    const text = args.text ?? "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 1;
    const sentences = Math.max((text.match(/[.!?]+/g) ?? []).length, 1);
    const syllables = text.toLowerCase().split(/\s+/).reduce((sum, w) => {
      return sum + Math.max(1, w.replace(/[^aeiou]/gi, "").length);
    }, 0);
    const score = 206.835
      - 1.015 * (words / sentences)
      - 84.6 * (syllables / words);
    const grade =
      score >= 90 ? "5th grade (very easy)"
      : score >= 80 ? "6th grade (easy)"
      : score >= 70 ? "7th grade (fairly easy)"
      : score >= 60 ? "8-9th grade (standard)"
      : score >= 50 ? "10-12th grade (fairly difficult)"
      : score >= 30 ? "College (difficult)"
      : "College graduate (very difficult)";
    return `Flesch Reading Ease: ${score.toFixed(1)}\nLevel: ${grade}`;
  }
  if (name === "thesaurus_lookup") {
    return tryExec("wn", [args.word ?? "", "-syns", "-n", "-v", "-a", "-r", "-s"]);
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- cad-tools ----

const CAD_TOOLS: ToolDef[] = [
  {
    name: "openscad_render",
    description: "Render an OpenSCAD script to STL/PNG. Returns the output file path (requires openscad CLI).",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "OpenSCAD script content" },
        format: { type: "string", description: "Output format: stl or png (default stl)" },
      },
      required: ["script"],
    },
  },
  {
    name: "urdf_validate",
    description: "Validate a URDF XML string for basic structural correctness.",
    inputSchema: {
      type: "object",
      properties: { urdf: { type: "string", description: "URDF XML content" } },
      required: ["urdf"],
    },
  },
];

async function callCadTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "openscad_render") {
    const { randomBytes } = crypto;
    const tmpId = randomBytes(8).toString("hex");
    const inFile = `/tmp/pc_scad_${tmpId}.scad`;
    const fmt = args.format === "png" ? "png" : "stl";
    const outFile = `/tmp/pc_scad_${tmpId}.${fmt}`;
    await import("node:fs/promises").then((fs) => fs.writeFile(inFile, args.script ?? ""));
    await tryExec("openscad", ["-o", outFile, inFile]);
    return `Rendered to: ${outFile}`;
  }
  if (name === "urdf_validate") {
    const urdf = args.urdf ?? "";
    const hasRobot = urdf.includes("<robot");
    const hasLink = urdf.includes("<link");
    if (!hasRobot) return "INVALID: Missing <robot> root element";
    if (!hasLink) return "WARNING: No <link> elements found";
    return "URDF appears structurally valid (basic check). Use check_urdf for full validation.";
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- design-tools ----

const DESIGN_TOOLS: ToolDef[] = [
  {
    name: "image_convert",
    description: "Convert an image file to another format using ImageMagick (requires convert CLI).",
    inputSchema: {
      type: "object",
      properties: {
        input_path: { type: "string", description: "Input file path" },
        output_path: { type: "string", description: "Output file path" },
      },
      required: ["input_path", "output_path"],
    },
  },
  {
    name: "image_resize",
    description: "Resize an image to given dimensions using ImageMagick.",
    inputSchema: {
      type: "object",
      properties: {
        input_path: { type: "string", description: "Input file path" },
        output_path: { type: "string", description: "Output file path" },
        geometry: { type: "string", description: "ImageMagick geometry (e.g. 800x600, 50%)" },
      },
      required: ["input_path", "output_path", "geometry"],
    },
  },
  {
    name: "svg_dimensions",
    description: "Extract width/height/viewBox from an SVG file.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Path to SVG file" } },
      required: ["path"],
    },
  },
];

async function callDesignTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "image_convert") {
    return tryExec("convert", [args.input_path ?? "", args.output_path ?? ""]);
  }
  if (name === "image_resize") {
    return tryExec("convert", ["-resize", args.geometry ?? "100%", args.input_path ?? "", args.output_path ?? ""]);
  }
  if (name === "svg_dimensions") {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(args.path ?? "", "utf8").catch(() => { throw new Error("Cannot read SVG file"); });
    const width = content.match(/width="([^"]+)"/)?.[1] ?? "not set";
    const height = content.match(/height="([^"]+)"/)?.[1] ?? "not set";
    const viewBox = content.match(/viewBox="([^"]+)"/)?.[1] ?? "not set";
    return `width: ${width}\nheight: ${height}\nviewBox: ${viewBox}`;
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- sysadmin-tools ----

const SYSADMIN_TOOLS: ToolDef[] = [
  {
    name: "ping_host",
    description: "Ping a host to check reachability (3 packets).",
    inputSchema: {
      type: "object",
      properties: { host: { type: "string", description: "Hostname or IP" } },
      required: ["host"],
    },
  },
  {
    name: "disk_usage",
    description: "Show disk usage for a directory.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Directory path (default /)" } },
    },
  },
  {
    name: "hash_file",
    description: "Compute SHA-256 hash of a file.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "File path" } },
      required: ["path"],
    },
  },
];

async function callSysadminTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "ping_host") {
    return tryExec("ping", ["-c", "3", "-W", "5", args.host ?? ""]);
  }
  if (name === "disk_usage") {
    return tryExec("df", ["-h", args.path ?? "/"]);
  }
  if (name === "hash_file") {
    return tryExec("sha256sum", [args.path ?? ""]);
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- eda-tools ----

const EDA_TOOLS: ToolDef[] = [
  {
    name: "kicad_netlist_info",
    description: "Parse a KiCad netlist XML and summarize component count.",
    inputSchema: {
      type: "object",
      properties: { netlist: { type: "string", description: "KiCad netlist XML content" } },
      required: ["netlist"],
    },
  },
  {
    name: "hash_text",
    description: "Compute SHA-256 hash of a text string.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Input text" } },
      required: ["text"],
    },
  },
];

async function callEdaTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "kicad_netlist_info") {
    const xml = args.netlist ?? "";
    const components = (xml.match(/<comp /g) ?? []).length;
    const nets = (xml.match(/<net /g) ?? []).length;
    return `Components: ${components}\nNets: ${nets}`;
  }
  if (name === "hash_text") {
    return crypto.createHash("sha256").update(args.text ?? "").digest("hex");
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- research-tools ----

const RESEARCH_TOOLS: ToolDef[] = [
  {
    name: "arxiv_search",
    description: "Search arXiv for papers matching a query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "string", description: "Max results (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "cite_bibtex",
    description: "Generate a BibTeX citation stub from DOI, title, author, and year.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Paper title" },
        author: { type: "string", description: "Author(s)" },
        year: { type: "string", description: "Year" },
        doi: { type: "string", description: "DOI (optional)" },
      },
      required: ["title"],
    },
  },
];

async function callResearchTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "arxiv_search") {
    const q = encodeURIComponent(args.query ?? "");
    const max = Math.min(parseInt(args.max_results ?? "5", 10) || 5, 20);
    const url = `https://export.arxiv.org/api/query?search_query=all:${q}&max_results=${max}`;
    const xml = await fetchUrl(url);
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
    return entries.map((e) => {
      const title = e.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "?";
      const id = e.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "?";
      return `${title}\n  ${id}`;
    }).join("\n\n") || "No results found.";
  }
  if (name === "cite_bibtex") {
    const key = (args.author?.split(",")[0]?.trim().toLowerCase() ?? "unknown")
      + (args.year ?? "????");
    return `@article{${key},
  title  = {${args.title ?? ""}},
  author = {${args.author ?? ""}},
  year   = {${args.year ?? ""}},
  doi    = {${args.doi ?? ""}},
}`;
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- r-tools ----

const R_TOOLS: ToolDef[] = [
  {
    name: "r_eval",
    description: "Evaluate an R expression and return the output (requires Rscript).",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "R code to evaluate" } },
      required: ["code"],
    },
  },
];

async function callRTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "r_eval") {
    return tryExec("Rscript", ["-e", args.code ?? "cat('Hello R')"], undefined);
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- ros-tools ----

const ROS_TOOLS: ToolDef[] = [
  {
    name: "urdf_validate",
    description: "Validate a URDF XML string for basic structural correctness.",
    inputSchema: {
      type: "object",
      properties: { urdf: { type: "string", description: "URDF XML content" } },
      required: ["urdf"],
    },
  },
];

async function callRosTool(name: string, args: Record<string, string>): Promise<string> {
  // Reuse CAD tool implementation
  return callCadTool(name, args);
}

// ---- ledger-tools ----

const LEDGER_TOOLS: ToolDef[] = [
  {
    name: "hledger_balance",
    description: "Run hledger balance on a journal file or inline journal content (requires hledger).",
    inputSchema: {
      type: "object",
      properties: {
        journal: { type: "string", description: "hledger journal content" },
        query: { type: "string", description: "Optional account query (e.g. expenses)" },
      },
      required: ["journal"],
    },
  },
];

async function callLedgerTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "hledger_balance") {
    const { randomBytes } = crypto;
    const tmpFile = `/tmp/pc_hledger_${randomBytes(8).toString("hex")}.journal`;
    const fs = await import("node:fs/promises");
    await fs.writeFile(tmpFile, args.journal ?? "");
    const query = args.query ? [args.query] : [];
    try {
      return await tryExec("hledger", ["-f", tmpFile, "balance", ...query]);
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- security-tools ----

const SECURITY_TOOLS: ToolDef[] = [
  {
    name: "hash_text",
    description: "Compute SHA-256 (or MD5/SHA1) hash of text.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Input text" },
        algorithm: { type: "string", description: "Hash algorithm: sha256 (default), md5, sha1, sha512" },
      },
      required: ["text"],
    },
  },
  {
    name: "cert_info",
    description: "Fetch and display TLS certificate info for a hostname (uses openssl).",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Hostname (e.g. example.com)" },
        port: { type: "string", description: "Port (default 443)" },
      },
      required: ["host"],
    },
  },
  {
    name: "generate_password",
    description: "Generate a cryptographically secure random password.",
    inputSchema: {
      type: "object",
      properties: {
        length: { type: "string", description: "Length (default 32)" },
        charset: { type: "string", description: "charset: alphanumeric (default) or hex" },
      },
    },
  },
];

async function callSecurityTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "hash_text") {
    const algo = (args.algorithm ?? "sha256") as "sha256" | "md5" | "sha1" | "sha512";
    return crypto.createHash(algo).update(args.text ?? "").digest("hex");
  }
  if (name === "cert_info") {
    const port = args.port ?? "443";
    return tryExec("openssl", [
      "s_client", "-connect", `${args.host ?? ""}:${port}`,
      "-showcerts", "-brief",
    ]);
  }
  if (name === "generate_password") {
    const len = Math.min(parseInt(args.length ?? "32", 10) || 32, 128);
    const charset = args.charset === "hex" ? "hex" : "base64";
    return crypto.randomBytes(Math.ceil(len * 1.5))
      .toString(charset)
      .replace(/[+/=]/g, "")
      .slice(0, len);
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- aviation-tools ----

const AVIATION_TOOLS: ToolDef[] = [
  {
    name: "metar_fetch",
    description: "Fetch latest METAR weather report for an ICAO airport code.",
    inputSchema: {
      type: "object",
      properties: { icao: { type: "string", description: "ICAO airport code (e.g. KJFK)" } },
      required: ["icao"],
    },
  },
  {
    name: "taf_fetch",
    description: "Fetch latest TAF weather forecast for an ICAO airport code.",
    inputSchema: {
      type: "object",
      properties: { icao: { type: "string", description: "ICAO airport code" } },
      required: ["icao"],
    },
  },
];

async function callAviationTool(name: string, args: Record<string, string>): Promise<string> {
  const icao = (args.icao ?? "").toUpperCase();
  if (!icao.match(/^[A-Z]{4}$/)) throw new Error("Invalid ICAO code — must be 4 letters");
  if (name === "metar_fetch") {
    return fetchUrl(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`);
  }
  if (name === "taf_fetch") {
    return fetchUrl(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=raw`);
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- asterisk-tools ----

const ASTERISK_TOOLS: ToolDef[] = [
  {
    name: "asterisk_info",
    description: "Returns connection instructions for integrating an Asterisk AMI bridge. Configure ASTERISK_HOST, ASTERISK_AMI_PORT, ASTERISK_AMI_USER, ASTERISK_AMI_PASS environment variables.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function callAsteriskTool(name: string, _args: Record<string, string>): Promise<string> {
  if (name === "asterisk_info") {
    return [
      "Asterisk AMI bridge stub.",
      "Set environment variables:",
      "  ASTERISK_HOST=<host>",
      "  ASTERISK_AMI_PORT=5038",
      "  ASTERISK_AMI_USER=<user>",
      "  ASTERISK_AMI_PASS=<pass>",
      "Then connect via TCP to the AMI socket.",
    ].join("\n");
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- gis-tools ----

const GIS_TOOLS: ToolDef[] = [
  {
    name: "geocode",
    description: "Geocode an address to lat/lon using Nominatim (OpenStreetMap).",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "Address to geocode" } },
      required: ["address"],
    },
  },
  {
    name: "reverse_geocode",
    description: "Reverse geocode lat/lon to address using Nominatim.",
    inputSchema: {
      type: "object",
      properties: {
        lat: { type: "string", description: "Latitude" },
        lon: { type: "string", description: "Longitude" },
      },
      required: ["lat", "lon"],
    },
  },
];

async function callGisTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "geocode") {
    const q = encodeURIComponent(args.address ?? "");
    const json = await fetchUrl(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=3`,
    );
    const results = JSON.parse(json) as Array<{ display_name: string; lat: string; lon: string }>;
    return results.map((r) => `${r.display_name}\n  lat: ${r.lat}, lon: ${r.lon}`).join("\n\n")
      || "No results";
  }
  if (name === "reverse_geocode") {
    const json = await fetchUrl(
      `https://nominatim.openstreetmap.org/reverse?lat=${args.lat}&lon=${args.lon}&format=json`,
    );
    const result = JSON.parse(json) as { display_name?: string };
    return result.display_name ?? "Not found";
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ====================================================================
// Toolset registry
// ====================================================================

type ToolCall = (name: string, args: Record<string, string>) => Promise<string>;

interface Toolset {
  tools: ToolDef[];
  call: ToolCall;
}

const TOOLSETS: Record<string, Toolset> = {
  "writing-tools": { tools: WRITING_TOOLS, call: callWritingTool },
  "cad-tools":     { tools: CAD_TOOLS,     call: callCadTool     },
  "design-tools":  { tools: DESIGN_TOOLS,  call: callDesignTool  },
  "sysadmin-tools":{ tools: SYSADMIN_TOOLS,call: callSysadminTool},
  "eda-tools":     { tools: EDA_TOOLS,     call: callEdaTool     },
  "research-tools":{ tools: RESEARCH_TOOLS,call: callResearchTool},
  "r-tools":       { tools: R_TOOLS,       call: callRTool       },
  "ros-tools":     { tools: ROS_TOOLS,     call: callRosTool     },
  "ledger-tools":  { tools: LEDGER_TOOLS,  call: callLedgerTool  },
  "security-tools":{ tools: SECURITY_TOOLS,call: callSecurityTool},
  "aviation-tools":{ tools: AVIATION_TOOLS,call: callAviationTool},
  "asterisk-tools":{ tools: ASTERISK_TOOLS,call: callAsteriskTool},
  "gis-tools":     { tools: GIS_TOOLS,     call: callGisTool     },
};

// ====================================================================
// Router
// ====================================================================

export function mcpBuiltinRoutes() {
  const router = Router();

  router.post("/mcp/:toolset", async (req, res) => {
    assertBoard(req);
    const { toolset } = req.params as { toolset: string };
    const ts = TOOLSETS[toolset];
    if (!ts) {
      res.status(404).json({ error: `Unknown toolset: ${toolset}` });
      return;
    }

    const body = req.body as JsonRpcRequest;
    const { id, method, params } = body;

    if (method === "initialize") {
      res.json(
        rpcResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: `paperclip-${toolset}`, version: "1.0.0" },
        }),
      );
      return;
    }

    if (method === "notifications/initialized") {
      res.status(202).end();
      return;
    }

    if (method === "tools/list") {
      res.json(rpcResult(id, { tools: ts.tools }));
      return;
    }

    if (method === "tools/call") {
      const p = params as { name: string; arguments?: Record<string, string> };
      const tool = ts.tools.find((t) => t.name === p.name);
      if (!tool) {
        res.json(rpcError(id, -32601, `Tool not found: ${p.name}`));
        return;
      }
      try {
        const text = await ts.call(p.name, p.arguments ?? {});
        res.json(rpcResult(id, toolResult(text)));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.json(rpcResult(id, toolResult(`Error: ${msg}`, true)));
      }
      return;
    }

    res.json(rpcError(id, -32601, `Method not found: ${method}`));
  });

  return router;
}
