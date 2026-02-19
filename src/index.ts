import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerLabelTools } from "./tools/labels.js";
import { registerHealthTools } from "./tools/health.js";
import { registerVerifyTools } from "./tools/verify.js";
import { registerSmartCaptureTools } from "./tools/smart-capture.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { getWorkspaceId } from "./client.js";
import { initAnalytics, trackSessionStarted, shutdownAnalytics } from "./analytics.js";

// Dev convenience: load .env.mcp from cwd when env vars aren't already set.
// In production (npx / Cursor MCP config), env vars come from the launcher.
if (!process.env.CONVEX_SITE_URL) {
  try {
    const envPath = resolve(process.cwd(), ".env.mcp");
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      process.env[trimmed.slice(0, eqIdx)] ??= trimmed.slice(eqIdx + 1);
    }
  } catch {
    // .env.mcp not found — rely on env vars being set by the launcher
  }
}

const SERVER_VERSION = "1.0.0";

initAnalytics();

let workspaceId: string;
try {
  workspaceId = await getWorkspaceId();
} catch (err: any) {
  process.stderr.write(`[MCP] Startup failed: ${err.message}\n`);
  process.exit(1);
}

trackSessionStarted(
  process.env.WORKSPACE_SLUG ?? "unknown",
  workspaceId,
  SERVER_VERSION,
);

const server = new McpServer(
  {
    name: "synergyos",
    version: SERVER_VERSION,
  },
  {
    capabilities: { logging: {} },
    instructions: [
      "Product OS — the single source of truth for product knowledge.",
      "Terminology, standards, and core data all live here — no need to check external docs.",
      "",
      "Terminology & naming: For 'what is X?' or naming questions, fetch `product-os://terminology`",
      "or use the `name-check` prompt to validate names against the glossary.",
      "",
      "Workflow:",
      "  1. Verify: call `health` to confirm connectivity.",
      "  2. Terminology: fetch `product-os://terminology` or use `name-check` prompt for naming questions.",
      "  3. Discover: use `kb-search` to find entries by text, or `list-entries` to browse a collection.",
      "  4. Drill in: use `get-entry` for full details — data, labels, relations, history.",
      "  5. Capture: use `smart-capture` to create entries — it auto-links related entries and",
      "     returns a quality scorecard in one call. Use `create-entry` only when you need",
      "     full control over every field.",
      "  6. Connect: use `suggest-links` then `relate-entries` to build the graph.",
      "  7. Quality: use `quality-check` to assess entry completeness.",
      "  8. Debug: use `mcp-audit` to see what backend calls happened this session.",
      "",
      "Always prefer `smart-capture` over `create-entry` or `quick-capture` for new entries.",
      "Always prefer kb-search or list-entries before get-entry — discover, then drill in.",
      "",
      "Orientation:",
      "  When you need to understand the system — architecture, data model, rules,",
      "  or analytics — fetch the `product-os://orientation` resource first.",
      "  It gives you the map. Then use the appropriate tool to drill in.",
    ].join("\n"),
  },
);

registerKnowledgeTools(server);
registerLabelTools(server);
registerHealthTools(server);
registerVerifyTools(server);
registerSmartCaptureTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);

async function gracefulShutdown() {
  await shutdownAnalytics();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
