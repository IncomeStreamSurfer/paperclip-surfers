import type { BusinessType } from "./constants.js";

export interface IndustryMcpEntry {
  /** Unique key (used for deduplication). */
  key: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Short description of what this MCP provides. */
  description: string;
  /** Transport type for this server. */
  transportType: "stdio" | "http" | "sse";
  /**
   * URL for HTTP/SSE servers.
   * Use the placeholder `__PAPERCLIP_BASE_URL__` for built-in servers —
   * the UI replaces it with `window.location.protocol + '//' + window.location.host`.
   */
  url?: string;
  /** Command for stdio servers. */
  command?: string;
  /** Args for stdio servers. */
  args?: string[];
  /** Whether this is a built-in server served by Paperclip itself. */
  builtin?: boolean;
}

// ---- Built-in MCP catalog (served by Paperclip server at /api/mcp/:toolset) ----

export const INDUSTRY_MCP_CATALOG: IndustryMcpEntry[] = [
  {
    key: "builtin-writing-tools",
    name: "Writing Tools (Built-in)",
    description:
      "Thesaurus, grammar check (diction), word count, readability analysis, and text transformation utilities.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/writing-tools",
    builtin: true,
  },
  {
    key: "builtin-cad-tools",
    name: "CAD / 3D Tools (Built-in)",
    description:
      "OpenSCAD rendering, DXF metadata, FreeCAD Python scripting helpers, and QGIS CLI integration.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/cad-tools",
    builtin: true,
  },
  {
    key: "builtin-design-tools",
    name: "Design Tools (Built-in)",
    description:
      "ImageMagick transforms (resize, convert, composite), color palette extraction, and SVG utilities.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/design-tools",
    builtin: true,
  },
  {
    key: "builtin-sysadmin-tools",
    name: "Sysadmin Tools (Built-in)",
    description:
      "Shell command execution sandbox, network diagnostics, service health checks, and log tailing.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/sysadmin-tools",
    builtin: true,
  },
  {
    key: "builtin-eda-tools",
    name: "EDA / Electronics Tools (Built-in)",
    description:
      "KiCad CLI netlist export, Spice simulation wrappers, component lookup, and PCB metadata helpers.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/eda-tools",
    builtin: true,
  },
  {
    key: "builtin-research-tools",
    name: "Research Tools (Built-in)",
    description:
      "arXiv search, citation formatting (BibTeX/APA), DOI resolution, and reference deduplication.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/research-tools",
    builtin: true,
  },
  {
    key: "builtin-r-tools",
    name: "R Statistical Tools (Built-in)",
    description:
      "Execute R snippets, generate plots (PNG/SVG), and run tidyverse/ggplot2 data pipelines.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/r-tools",
    builtin: true,
  },
  {
    key: "builtin-ros-tools",
    name: "ROS / Robotics Tools (Built-in)",
    description:
      "ROS 2 topic inspection, bag file analysis, URDF validation, and launch-file helpers.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/ros-tools",
    builtin: true,
  },
  {
    key: "builtin-ledger-tools",
    name: "Ledger / Accounting Tools (Built-in)",
    description:
      "Plain-text accounting (hledger/ledger-cli), balance sheet generation, and transaction parsing.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/ledger-tools",
    builtin: true,
  },
  {
    key: "builtin-security-tools",
    name: "Security Tools (Built-in)",
    description:
      "Nmap host discovery, CVE lookup, certificate inspection, hash utilities, and secrets scanning.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/security-tools",
    builtin: true,
  },
  {
    key: "builtin-aviation-tools",
    name: "Aviation Tools (Built-in)",
    description:
      "METAR/TAF weather fetch, NOTAM lookup, ICAO/IATA airport info, and runway data.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/aviation-tools",
    builtin: true,
  },
  {
    key: "builtin-asterisk-tools",
    name: "Asterisk / VoIP Tools (Built-in)",
    description:
      "Asterisk AMI command bridge, call queue inspection, extension lookup, and CDR query helpers.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/asterisk-tools",
    builtin: true,
  },
  {
    key: "builtin-gis-tools",
    name: "GIS / Mapping Tools (Built-in)",
    description:
      "QGIS CLI raster/vector processing, OpenStreetMap geocoding, coordinate conversion, and tile fetching.",
    transportType: "http",
    url: "__PAPERCLIP_BASE_URL__/api/mcp/gis-tools",
    builtin: true,
  },
  // ---- Community / external MCPs ----
  {
    key: "github-mcp",
    name: "GitHub MCP",
    description:
      "Official GitHub MCP server — manage repos, PRs, issues, and code review from agents.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
  },
  {
    key: "filesystem-code",
    name: "Filesystem (Code Workspace)",
    description:
      "Read/write access to a code workspace directory via the MCP filesystem server.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/code"],
  },
  {
    key: "filesystem-notes",
    name: "Filesystem (Notes / Drafts)",
    description:
      "Read/write access to a notes/drafts directory for copywriting and research workflows.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/notes"],
  },
  {
    key: "filesystem-design",
    name: "Filesystem (Design Assets)",
    description:
      "Read/write access to a design assets directory for graphic design workflows.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/design"],
  },
  {
    key: "filesystem-cad",
    name: "Filesystem (CAD Files)",
    description:
      "Read/write access to a CAD/BIM files directory for architecture and engineering workflows.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/cad"],
  },
  {
    key: "postgres-mcp",
    name: "PostgreSQL MCP",
    description:
      "Query and inspect PostgreSQL databases directly from agents.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
  },
  {
    key: "web-fetch",
    name: "Web Fetch",
    description:
      "Fetch and extract content from arbitrary web URLs for research and link checking.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "mcp-fetch"],
  },
  {
    key: "gitlab-mcp",
    name: "GitLab MCP",
    description:
      "Official GitLab MCP server — manage repos, merge requests, issues, and CI/CD pipelines from agents.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gitlab"],
  },
  {
    key: "azure-devops-mcp",
    name: "Azure DevOps MCP",
    description:
      "Interact with Azure DevOps — repos, work items, pipelines, boards, and sprints from agents.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@azure-devops/mcp"],
  },
  {
    key: "bitbucket-mcp",
    name: "BitBucket MCP",
    description:
      "Manage BitBucket Cloud/Server repositories, pull requests, pipelines, and issues from agents.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "bitbucket-mcp"],
  },
];

// ---- Suggestions per business type ----

/** Map from business type → ordered list of MCP catalog keys to suggest. */
export const INDUSTRY_MCP_SUGGESTIONS: Partial<Record<BusinessType, string[]>> = {
  copywriting: [
    "builtin-writing-tools",
    "filesystem-notes",
    "web-fetch",
  ],
  seo_agency: [
    "web-fetch",
    "filesystem-notes",
    "builtin-writing-tools",
    "postgres-mcp",
  ],
  software_agency: [
    "github-mcp",
    "gitlab-mcp",
    "azure-devops-mcp",
    "bitbucket-mcp",
    "filesystem-code",
    "postgres-mcp",
    "web-fetch",
  ],
  marketing_agency: [
    "web-fetch",
    "filesystem-notes",
    "builtin-writing-tools",
  ],
  graphic_design: [
    "builtin-design-tools",
    "filesystem-design",
  ],
  architecture_civil: [
    "builtin-cad-tools",
    "builtin-gis-tools",
    "filesystem-cad",
  ],
  electrical_engineering: [
    "builtin-eda-tools",
    "filesystem-cad",
    "web-fetch",
  ],
  robotics: [
    "builtin-ros-tools",
    "filesystem-code",
    "web-fetch",
  ],
  msp_rmm: [
    "builtin-sysadmin-tools",
    "builtin-security-tools",
    "azure-devops-mcp",
    "postgres-mcp",
  ],
  cybersecurity: [
    "builtin-security-tools",
    "web-fetch",
    "filesystem-code",
  ],
  phd_research: [
    "builtin-research-tools",
    "builtin-r-tools",
    "filesystem-notes",
    "web-fetch",
  ],
  data_analytics: [
    "builtin-r-tools",
    "postgres-mcp",
    "filesystem-notes",
    "web-fetch",
  ],
  finance_accounting: [
    "builtin-ledger-tools",
    "postgres-mcp",
    "web-fetch",
  ],
  aviation: [
    "builtin-aviation-tools",
    "web-fetch",
    "filesystem-notes",
  ],
  call_center: [
    "builtin-asterisk-tools",
    "postgres-mcp",
    "web-fetch",
  ],
  ecommerce: [
    "web-fetch",
    "postgres-mcp",
    "filesystem-notes",
  ],
  sales: [
    "web-fetch",
    "filesystem-notes",
    "builtin-writing-tools",
  ],
  social_media_management: [
    "web-fetch",
    "filesystem-notes",
    "builtin-writing-tools",
  ],
  legal_tech: [
    "filesystem-notes",
    "web-fetch",
    "builtin-writing-tools",
  ],
  healthcare_admin: [
    "filesystem-notes",
    "postgres-mcp",
    "web-fetch",
  ],
  hr_recruiting: [
    "filesystem-notes",
    "web-fetch",
    "builtin-writing-tools",
  ],
};
