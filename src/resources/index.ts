import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpQuery } from "../client.js";

function formatEntryMarkdown(entry: any): string {
  const id = entry.entryId ? `${entry.entryId}: ` : "";
  const lines = [`## ${id}${entry.name} [${entry.status}]`];
  if (entry.data && typeof entry.data === "object") {
    for (const [key, val] of Object.entries(entry.data)) {
      if (val && key !== "rawData") {
        lines.push(`**${key}**: ${typeof val === "string" ? val : JSON.stringify(val)}`);
      }
    }
  }
  return lines.join("\n");
}

function buildOrientationMarkdown(
  collections: any[] | null,
  trackingEvents: any[] | null,
  standards: any[] | null,
  businessRules: any[] | null,
): string {
  const sections: string[] = ["# ProductBrain — Orientation"];

  // Architecture
  sections.push(
    "## Architecture\n" +
    "```\n" +
    "Cursor (stdio) → MCP Server (mcp-server/src/index.ts)\n" +
    "  → POST /api/mcp with Bearer token\n" +
    "  → Convex HTTP Action (convex/http.ts)\n" +
    "  → internalQuery / internalMutation (convex/mcpKnowledge.ts)\n" +
    "  → Convex DB (workspace-scoped)\n" +
    "```\n" +
    "Security: API key auth on every request, workspace-scoped data, internal functions blocked from external clients.\n" +
    "Key files: `mcp-server/src/client.ts` (HTTP client + audit), `convex/schema.ts` (9-table schema).",
  );

  // Data model
  if (collections) {
    const collList = collections
      .map((c) => {
        const prefix = c.icon ? `${c.icon} ` : "";
        return `- ${prefix}**${c.name}** (\`${c.slug}\`) — ${c.description || "no description"}`;
      })
      .join("\n");
    sections.push(
      `## Data Model (${collections.length} collections)\n` +
      "Unified entries model: collections define field schemas, entries hold data in a flexible `data` field.\n" +
      "Tags for filtering (e.g. `severity:high`), relations via `entryRelations`, history via `entryHistory`, labels via `labels` + `entryLabels`.\n\n" +
      collList + "\n\n" +
      "Use `list-collections` for field schemas, `get-entry` for full records.",
    );
  } else {
    sections.push(
      "## Data Model\n" +
      "Could not load collections — use `list-collections` to browse manually.",
    );
  }

  // Business rules
  const rulesCount = businessRules ? `${businessRules.length} entries` : "not loaded — collection may not exist yet";
  sections.push(
    "## Business Rules\n" +
    `Collection: \`business-rules\` (${rulesCount}).\n` +
    "Find rules: `kb-search` for text search, `list-entries collection=business-rules` to browse.\n" +
    "Check compliance: use the `review-against-rules` prompt (pass a domain).\n" +
    "Draft a new rule: use the `draft-rule-from-context` prompt.",
  );

  // Analytics / tracking
  const eventsCount = trackingEvents ? `${trackingEvents.length} events` : "not loaded — collection may not exist yet";
  const conventionNote = standards
    ? "Naming convention: `object_action` in snake_case with past-tense verbs (from standards collection)."
    : "Naming convention: `object_action` in snake_case with past-tense verbs.";
  sections.push(
    "## Analytics & Tracking\n" +
    `Event catalog: \`tracking-events\` collection (${eventsCount}).\n` +
    `${conventionNote}\n` +
    "Implementation: `src/lib/analytics.ts`. Workspace-scoped events MUST use `withWorkspaceGroup()`.\n" +
    "Browse: `list-entries collection=tracking-events`. Full setup: `docs/posthog-setup.md`.",
  );

  // Knowledge Graph
  sections.push(
    "## Knowledge Graph\n" +
    "Entries are connected via typed relations (`entryRelations` table). Relations are bidirectional and collection-agnostic — any entry can link to any other entry.\n\n" +
    "**Recommended relation types** (extensible — any string accepted):\n" +
    "- `governs` — a rule constrains behavior of a feature\n" +
    "- `defines_term_for` — a glossary term is canonical vocabulary for a feature/area\n" +
    "- `belongs_to` — a feature belongs to a product area or parent concept\n" +
    "- `informs` — a decision or insight informs a feature\n" +
    "- `surfaces_tension_in` — a tension exists within a feature area\n" +
    "- `related_to`, `depends_on`, `replaces`, `conflicts_with`, `references`, `confused_with`\n\n" +
    "Each relation type is defined as a glossary entry (prefix `GT-REL-*`) to prevent terminology drift.\n\n" +
    "**Tools:**\n" +
    "- `gather-context` — get the full context around any entry (multi-hop graph traversal)\n" +
    "- `suggest-links` — discover potential connections for an entry\n" +
    "- `relate-entries` — create a typed link between two entries\n" +
    "- `find-related` — list direct relations for an entry\n\n" +
    "**Convention:** When creating or updating entries in governed collections, always use `suggest-links` to discover and create relevant relations.",
  );

  // Creating Knowledge
  sections.push(
    "## Creating Knowledge\n" +
    "Use `smart-capture` as the primary tool for creating new entries. It handles the full workflow in one call:\n" +
    "1. Creates the entry with collection-aware defaults (auto-fills dates, infers domains, sets priority)\n" +
    "2. Auto-links related entries from across the knowledge base (up to 5 confident matches)\n" +
    "3. Returns a quality scorecard (X/10) with actionable improvement suggestions\n\n" +
    "**Smart profiles** exist for: `tensions`, `business-rules`, `glossary`, `decisions`.\n" +
    "All other collections use sensible defaults.\n\n" +
    "Example: `smart-capture collection='tensions' name='...' description='...'`\n\n" +
    "Use `quality-check` to score existing entries retroactively.\n" +
    "Use `create-entry` only when you need full control over every field.\n" +
    "Use `quick-capture` for minimal ceremony without auto-linking.",
  );

  // Where to go next
  sections.push(
    "## Where to Go Next\n" +
    "- **Create entry** → `smart-capture` tool (auto-links + quality score in one call)\n" +
    "- **Full context** → `gather-context` tool (start here when working on a feature)\n" +
    "- **Discover links** → `suggest-links` tool\n" +
    "- **Quality audit** → `quality-check` tool\n" +
    "- **Terminology** → `name-check` prompt or `productbrain://terminology` resource\n" +
    "- **Schema details** → `productbrain://collections` resource or `list-collections` tool\n" +
    "- **Labels** → `productbrain://labels` resource or `list-labels` tool\n" +
    "- **Any collection** → `productbrain://{slug}/entries` resource\n" +
    "- **Log a decision** → `draft-decision-record` prompt\n" +
    "- **Health check** → `health` tool\n" +
    "- **Debug MCP calls** → `mcp-audit` tool",
  );

  return sections.join("\n\n---\n\n");
}

export function registerResources(server: McpServer) {
  // Orientation: single-call system map for AI developers
  server.resource(
    "kb-orientation",
    "productbrain://orientation",
    async (uri) => {
      const [collectionsResult, eventsResult, standardsResult, rulesResult] = await Promise.allSettled([
        mcpQuery<any[]>("kb.listCollections"),
        mcpQuery<any[]>("kb.listEntries", { collectionSlug: "tracking-events" }),
        mcpQuery<any[]>("kb.listEntries", { collectionSlug: "standards" }),
        mcpQuery<any[]>("kb.listEntries", { collectionSlug: "business-rules" }),
      ]);

      const collections = collectionsResult.status === "fulfilled" ? collectionsResult.value : null;
      const trackingEvents = eventsResult.status === "fulfilled" ? eventsResult.value : null;
      const standards = standardsResult.status === "fulfilled" ? standardsResult.value : null;
      const businessRules = rulesResult.status === "fulfilled" ? rulesResult.value : null;

      return {
        contents: [{
          uri: uri.href,
          text: buildOrientationMarkdown(collections, trackingEvents, standards, businessRules),
          mimeType: "text/markdown",
        }],
      };
    }
  );

  // Terminology: glossary + standards summary for deep-dives
  server.resource(
    "kb-terminology",
    "productbrain://terminology",
    async (uri) => {
      const [glossaryResult, standardsResult] = await Promise.allSettled([
        mcpQuery<any[]>("kb.listEntries", { collectionSlug: "glossary" }),
        mcpQuery<any[]>("kb.listEntries", { collectionSlug: "standards" }),
      ]);

      const lines: string[] = ["# ProductBrain — Terminology"];

      if (glossaryResult.status === "fulfilled") {
        if (glossaryResult.value.length > 0) {
          const terms = glossaryResult.value
            .map((t) => `- **${t.name}** (${t.entryId ?? "—"}) [${t.status}]: ${t.data?.canonical ?? t.data?.description ?? ""}`)
            .join("\n");
          lines.push(`## Glossary (${glossaryResult.value.length} terms)\n\n${terms}`);
        } else {
          lines.push("## Glossary\n\nNo glossary terms yet. Use `create-entry` with collection `glossary` to add terms.");
        }
      } else {
        lines.push("## Glossary\n\nCould not load glossary — use `list-entries collection=glossary` to browse manually.");
      }

      if (standardsResult.status === "fulfilled") {
        if (standardsResult.value.length > 0) {
          const stds = standardsResult.value
            .map((s) => `- **${s.name}** (${s.entryId ?? "—"}) [${s.status}]: ${s.data?.description ?? ""}`)
            .join("\n");
          lines.push(`## Standards (${standardsResult.value.length} entries)\n\n${stds}`);
        } else {
          lines.push("## Standards\n\nNo standards yet. Use `create-entry` with collection `standards` to add standards.");
        }
      } else {
        lines.push("## Standards\n\nCould not load standards — use `list-entries collection=standards` to browse manually.");
      }

      return {
        contents: [{ uri: uri.href, text: lines.join("\n\n---\n\n"), mimeType: "text/markdown" }],
      };
    }
  );

  server.resource(
    "kb-collections",
    "productbrain://collections",
    async (uri) => {
      const collections = await mcpQuery<any[]>("kb.listCollections");

      if (collections.length === 0) {
        return { contents: [{ uri: uri.href, text: "No collections in this workspace.", mimeType: "text/markdown" }] };
      }

      const formatted = collections
        .map((c) => {
          const fieldList = c.fields
            .map((f: any) => `  - \`${f.key}\` (${f.type}${f.required ? ", required" : ""}${f.searchable ? ", searchable" : ""})`)
            .join("\n");
          return `## ${c.icon ?? ""} ${c.name} (\`${c.slug}\`)\n${c.description || ""}\n\n**Fields:**\n${fieldList}`;
        })
        .join("\n\n---\n\n");

      return {
        contents: [{ uri: uri.href, text: `# Knowledge Collections (${collections.length})\n\n${formatted}`, mimeType: "text/markdown" }],
      };
    }
  );

  server.resource(
    "kb-collection-entries",
    new ResourceTemplate("productbrain://{slug}/entries", {
      list: async () => {
        const collections = await mcpQuery<any[]>("kb.listCollections");
        return {
          resources: collections.map((c) => ({
            uri: `productbrain://${c.slug}/entries`,
            name: `${c.icon ?? ""} ${c.name}`.trim(),
          })),
        };
      },
    }),
    async (uri, { slug }) => {
      const entries = await mcpQuery<any[]>("kb.listEntries", { collectionSlug: slug as string });
      const formatted = entries.map(formatEntryMarkdown).join("\n\n---\n\n");

      return {
        contents: [{
          uri: uri.href,
          text: formatted || "No entries in this collection.",
          mimeType: "text/markdown",
        }],
      };
    }
  );

  server.resource(
    "kb-labels",
    "productbrain://labels",
    async (uri) => {
      const labels = await mcpQuery<any[]>("kb.listLabels");

      if (labels.length === 0) {
        return { contents: [{ uri: uri.href, text: "No labels in this workspace.", mimeType: "text/markdown" }] };
      }

      const groups = labels.filter((l) => l.isGroup);
      const ungrouped = labels.filter((l) => !l.isGroup && !l.parentId);
      const children = (parentId: string) => labels.filter((l) => l.parentId === parentId);

      const lines: string[] = [];
      for (const group of groups) {
        lines.push(`## ${group.name}`);
        for (const child of children(group._id)) {
          lines.push(`- \`${child.slug}\` ${child.name}${child.color ? ` (${child.color})` : ""}`);
        }
      }
      if (ungrouped.length > 0) {
        lines.push("## Ungrouped");
        for (const l of ungrouped) {
          lines.push(`- \`${l.slug}\` ${l.name}${l.color ? ` (${l.color})` : ""}`);
        }
      }

      return {
        contents: [{ uri: uri.href, text: `# Workspace Labels (${labels.length})\n\n${lines.join("\n")}`, mimeType: "text/markdown" }],
      };
    }
  );
}
