import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpQuery, mcpMutation } from "../client.js";

function extractPreview(data: any, maxLen: number): string {
  if (!data || typeof data !== "object") return "";
  const raw = data.description ?? data.canonical ?? data.detail ?? "";
  if (typeof raw !== "string" || !raw) return "";
  return raw.length > maxLen ? raw.substring(0, maxLen) + "..." : raw;
}

export function registerKnowledgeTools(server: McpServer) {

  server.registerTool(
    "list-collections",
    {
      title: "Browse Collections",
      description:
        "List every knowledge collection in the workspace — glossary, business rules, tracking events, standards, etc. " +
        "Returns each collection's slug, name, description, and field schema. " +
        "Start here before create-entry so you know which collections exist and what fields they expect.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const collections = await mcpQuery<any[]>("kb.listCollections");

      if (collections.length === 0) {
        return { content: [{ type: "text" as const, text: "No collections found in this workspace." }] };
      }

      const formatted = collections
        .map((c) => {
          const fieldList = c.fields
            .map((f: any) => `  - \`${f.key}\` (${f.type}${f.required ? ", required" : ""}${f.searchable ? ", searchable" : ""})`)
            .join("\n");
          return `## ${c.name} (\`${c.slug}\`)\n${c.description || "_No description_"}\n\n**Fields:**\n${fieldList}`;
        })
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: `# Knowledge Collections (${collections.length})\n\n${formatted}` }],
      };
    }
  );

  server.registerTool(
    "list-entries",
    {
      title: "Browse Entries",
      description:
        "List entries in a collection, with optional filters for status, tag, or label. " +
        "Returns entry IDs, names, status, and a data preview. " +
        "Use list-collections first to discover available collection slugs.",
      inputSchema: {
        collection: z.string().optional().describe("Collection slug, e.g. 'glossary', 'tracking-events', 'business-rules'"),
        status: z.string().optional().describe("Filter: draft | active | verified | deprecated"),
        tag: z.string().optional().describe("Filter by internal tag, e.g. 'health:ambiguous'"),
        label: z.string().optional().describe("Filter by label slug — matches entries across all collections"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ collection, status, tag, label }) => {
      let entries: any[];

      if (label) {
        entries = await mcpQuery<any[]>("kb.listEntriesByLabel", { labelSlug: label });
        if (status) entries = entries.filter((e: any) => e.status === status);
      } else {
        entries = await mcpQuery<any[]>("kb.listEntries", {
          collectionSlug: collection,
          status,
          tag,
        });
      }

      if (entries.length === 0) {
        return { content: [{ type: "text" as const, text: "No entries match the given filters." }] };
      }

      const formatted = entries
        .map((e) => {
          const id = e.entryId ? `**${e.entryId}:** ` : "";
          const dataPreview = e.data
            ? Object.entries(e.data)
                .slice(0, 4)
                .map(([k, v]) => `  ${k}: ${typeof v === "string" ? v.substring(0, 120) : JSON.stringify(v)}`)
                .join("\n")
            : "";
          return `- ${id}${e.name} \`${e.status}\`${dataPreview ? `\n${dataPreview}` : ""}`;
        })
        .join("\n\n");

      const scope = collection ? ` in \`${collection}\`` : "";
      return {
        content: [{ type: "text" as const, text: `# Entries${scope} (${entries.length})\n\n${formatted}` }],
      };
    }
  );

  server.registerTool(
    "get-entry",
    {
      title: "Look Up Entry",
      description:
        "Retrieve a single knowledge entry by its human-readable ID (e.g. 'T-SUPPLIER', 'BR-001', 'EVT-workspace_created'). " +
        "Returns the full record: all data fields, labels, relations, and change history. " +
        "Use kb-search or list-entries first to discover entry IDs.",
      inputSchema: {
        entryId: z.string().describe("Entry ID, e.g. 'T-SUPPLIER', 'BR-001', 'EVT-workspace_created'"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entryId }) => {
      const entry = await mcpQuery<any>("kb.getEntry", { entryId });

      if (!entry) {
        return { content: [{ type: "text" as const, text: `Entry \`${entryId}\` not found. Try kb-search to find the right ID.` }] };
      }

      const lines: string[] = [
        `# ${entry.entryId ? `${entry.entryId}: ` : ""}${entry.name}`,
        "",
        `**Status:** ${entry.status}`,
      ];

      if (entry.data && typeof entry.data === "object") {
        lines.push("");
        for (const [key, val] of Object.entries(entry.data)) {
          const display = typeof val === "string" ? val : JSON.stringify(val);
          lines.push(`**${key}:** ${display}`);
        }
      }

      if (entry.tags?.length > 0) {
        lines.push("", `**Tags:** ${entry.tags.join(", ")}`);
      }

      if (entry.labels?.length > 0) {
        lines.push("", `**Labels:** ${entry.labels.map((l: any) => `\`${l.slug ?? l.name}\``).join(", ")}`);
      }

      if (entry.relations?.length > 0) {
        lines.push("", "## Relations");
        for (const r of entry.relations) {
          const arrow = r.direction === "outgoing" ? "\u2192" : "\u2190";
          const other = r.otherEntryId ? `${r.otherEntryId}: ${r.otherName}` : (r.otherName ?? "unknown");
          lines.push(`- ${arrow} **${r.type}** ${other}`);
        }
      }

      if (entry.history?.length > 0) {
        lines.push("", "## History (last 10)");
        for (const h of entry.history.slice(-10)) {
          const date = new Date(h.timestamp).toISOString().split("T")[0];
          lines.push(`- ${date}: ${h.event}${h.changedBy ? ` _(${h.changedBy})_` : ""}`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  const governedCollections = new Set([
    "glossary", "business-rules", "principles", "standards", "strategy",
  ]);

  server.registerTool(
    "create-entry",
    {
      title: "Create Entry",
      description:
        "Create a new knowledge entry. Provide the collection slug, a display name, status, and data matching the collection's field schema. " +
        "Call list-collections first to see available collections and their field definitions. " +
        "Governed collections (glossary, business-rules, principles, standards, strategy) require status 'draft' — " +
        "to promote to 'active' or 'verified', raise a tension or use update-entry after approval.",
      inputSchema: {
        collection: z.string().describe("Collection slug, e.g. 'tracking-events', 'standards', 'glossary'"),
        entryId: z.string().optional().describe("Human-readable ID, e.g. 'EVT-workspace_created', 'STD-posthog-events'"),
        name: z.string().describe("Display name"),
        status: z.string().default("draft").describe("Lifecycle status: draft | active | verified | deprecated"),
        data: z.record(z.unknown()).describe("Data object — keys must match the collection's field definitions"),
        order: z.number().optional().describe("Manual sort order within the collection"),
      },
      annotations: { destructiveHint: false },
    },
    async ({ collection, entryId, name, status, data, order }) => {
      if (governedCollections.has(collection) && status !== "draft" && status !== "deprecated") {
        return {
          content: [{
            type: "text" as const,
            text: `# Governance Required\n\n` +
              `The \`${collection}\` collection is governed. New entries must be created with status \`draft\`.\n\n` +
              `**How to proceed:**\n` +
              `1. Create the entry with status \`draft\` (treated as a proposal)\n` +
              `2. Raise a tension in the \`tensions\` collection to request promotion\n` +
              `3. After approval, use \`update-entry\` to change status to \`active\` or \`verified\``,
          }],
        };
      }

      try {
        const id = await mcpMutation<string>("kb.createEntry", {
          collectionSlug: collection,
          entryId,
          name,
          status,
          data,
          order,
        });

        return {
          content: [{ type: "text" as const, text: `# Entry Created\n\n**${entryId ?? name}** added to \`${collection}\` as \`${status}\`.\n\nInternal ID: ${id}` }],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Duplicate entry") || msg.includes("already exists")) {
          return {
            content: [{
              type: "text" as const,
              text: `# Cannot Create — Duplicate Detected\n\n${msg}\n\n` +
                `**What to do:**\n` +
                `- Use \`get-entry\` to inspect the existing entry\n` +
                `- Use \`update-entry\` to modify it\n` +
                `- If a genuinely new entry is needed, raise a tension to propose it`,
            }],
          };
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "update-entry",
    {
      title: "Update Entry",
      description:
        "Update an existing entry by its human-readable ID. Only provide the fields you want to change — data fields are merged with existing values. " +
        "Use get-entry first to see current values. SOS-020: Cannot update tension status via MCP — process decides (use SynergyOS UI after approval).",
      inputSchema: {
        entryId: z.string().describe("Entry ID to update, e.g. 'T-SUPPLIER', 'BR-001'"),
        name: z.string().optional().describe("New display name"),
        status: z.string().optional().describe("New status: draft | active | verified | deprecated"),
        data: z.record(z.unknown()).optional().describe("Fields to update (merged with existing data)"),
        order: z.number().optional().describe("New sort order"),
      },
      annotations: { idempotentHint: true, destructiveHint: false },
    },
    async ({ entryId, name, status, data, order }) => {
      try {
        const id = await mcpMutation<string>("kb.updateEntry", {
          entryId,
          name,
          status,
          data,
          order,
        });

        return {
          content: [{ type: "text" as const, text: `# Entry Updated\n\n**${entryId}** has been updated.\n\nInternal ID: ${id}` }],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("SOS-020")) {
          return {
            content: [{
              type: "text" as const,
              text: `# SOS-020: Tension Status Cannot Be Changed via MCP\n\n` +
                `Tension status (open, in-progress, closed) must be changed through the defined process, not via MCP.\n\n` +
                `**What you can do:**\n` +
                `- Create tensions: \`create-entry collection=tensions name="..." status=open\`\n` +
                `- List tensions: \`list-entries collection=tensions\`\n` +
                `- Update non-status fields (raised, date, priority, description) via \`update-entry\`\n` +
                `- After process approval, a human uses the SynergyOS UI to change status\n\n` +
                `Process criteria (TBD): e.g. 3+ users approved, or 7 days without valid concerns.`,
            }],
          };
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "kb-search",
    {
      title: "Search Knowledge Base",
      description:
        "Full-text search across all knowledge entries. Returns entry names, collection, status, and a description preview. " +
        "Scope results to a specific collection (e.g. collection='business-rules') or filter by status (e.g. status='active'). " +
        "Use this to discover entries before calling get-entry for full details.",
      inputSchema: {
        query: z.string().describe("Search text (min 2 characters)"),
        collection: z.string().optional().describe("Scope to a collection slug, e.g. 'business-rules', 'glossary', 'tracking-events'"),
        status: z.string().optional().describe("Filter by status: draft | active | verified | deprecated"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, collection, status }) => {
      const scope = collection ? ` in \`${collection}\`` : "";
      await server.sendLoggingMessage({ level: "info", data: `Searching${scope} for "${query}"...`, logger: "product-os" });

      const [results, collections] = await Promise.all([
        mcpQuery<any[]>("kb.searchEntries", { query, collectionSlug: collection, status }),
        mcpQuery<any[]>("kb.listCollections"),
      ]);

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No results for "${query}"${scope}. Try a broader search or check list-collections for available data.` }] };
      }

      const collMap = new Map<string, { name: string; slug: string }>();
      for (const c of collections) {
        collMap.set(c._id, { name: c.name, slug: c.slug });
      }

      const countsBySlug = new Map<string, number>();
      for (const e of results) {
        const col = collMap.get(e.collectionId);
        const slug = col?.slug ?? "unknown";
        countsBySlug.set(slug, (countsBySlug.get(slug) ?? 0) + 1);
      }
      const collSummary = [...countsBySlug.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([slug, count]) => `${count} ${slug}`)
        .join(", ");

      const formatted = results
        .map((e) => {
          const id = e.entryId ? `**${e.entryId}:** ` : "";
          const col = collMap.get(e.collectionId);
          const colTag = col ? ` [${col.slug}]` : "";
          const desc = extractPreview(e.data, 150);
          const preview = desc ? `\n  ${desc}` : "";
          return `- ${id}${e.name} \`${e.status}\`${colTag}${preview}`;
        })
        .join("\n");

      const header = `# Search Results for "${query}"${scope} (${results.length} match${results.length === 1 ? "" : "es"})\n\n**By collection:** ${collSummary}`;
      const footer = `_Tip: Use \`collection\` param to scope search. Use get-entry with an entry ID for full details._`;

      return {
        content: [{ type: "text" as const, text: `${header}\n\n${formatted}\n\n${footer}` }],
      };
    }
  );

  server.registerTool(
    "get-history",
    {
      title: "Entry Change History",
      description:
        "Get the audit trail for an entry — when it was created, updated, status-changed, etc. " +
        "Returns timestamped events with change details.",
      inputSchema: {
        entryId: z.string().describe("Entry ID, e.g. 'T-SUPPLIER', 'BR-001'"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entryId }) => {
      const history = await mcpQuery<any[]>("kb.listEntryHistory", { entryId });

      if (history.length === 0) {
        return { content: [{ type: "text" as const, text: `No history found for \`${entryId}\`.` }] };
      }

      const formatted = history
        .map((h) => {
          const date = new Date(h.timestamp).toISOString();
          const changes = h.changes ? ` — ${JSON.stringify(h.changes)}` : "";
          return `- **${date}** ${h.event}${h.changedBy ? ` _(${h.changedBy})_` : ""}${changes}`;
        })
        .join("\n");

      return {
        content: [{ type: "text" as const, text: `# History for \`${entryId}\` (${history.length} events)\n\n${formatted}` }],
      };
    }
  );

  server.registerTool(
    "relate-entries",
    {
      title: "Link Two Entries",
      description:
        "Create a typed relation between two entries, building the knowledge graph. " +
        "Use get-entry to see existing relations before adding new ones.\n\n" +
        "Recommended relation types (extensible — any string is accepted):\n" +
        "- related_to, depends_on, replaces, conflicts_with, references, confused_with\n" +
        "- governs — a rule constrains behavior of a feature\n" +
        "- defines_term_for — a glossary term is canonical vocabulary for a feature/area\n" +
        "- belongs_to — a feature belongs to a product area or parent concept\n" +
        "- informs — a decision or insight informs a feature\n" +
        "- surfaces_tension_in — a tension exists within a feature area\n\n" +
        "Check glossary for relation type definitions if unsure which to use.",
      inputSchema: {
        from: z.string().describe("Source entry ID, e.g. 'T-SUPPLIER'"),
        to: z.string().describe("Target entry ID, e.g. 'BR-001'"),
        type: z.string().describe("Relation type — use a recommended type or any descriptive string"),
      },
      annotations: { destructiveHint: false },
    },
    async ({ from, to, type }) => {
      await mcpMutation("kb.createEntryRelation", {
        fromEntryId: from,
        toEntryId: to,
        type,
      });

      return {
        content: [{ type: "text" as const, text: `# Relation Created\n\n**${from}** \u2014[${type}]\u2192 **${to}**` }],
      };
    }
  );

  server.registerTool(
    "find-related",
    {
      title: "Find Related Entries",
      description:
        "Navigate the knowledge graph — find all entries related to a given entry. " +
        "Shows incoming references (what points to this entry), outgoing references (what this entry points to), or both. " +
        "Use after get-entry to explore connections, or to answer 'what depends on X?' or 'what references Y?'",
      inputSchema: {
        entryId: z.string().describe("Entry ID, e.g. 'GT-019', 'SOS-006'"),
        direction: z.enum(["incoming", "outgoing", "both"]).default("both")
          .describe("Filter: 'incoming' = what references this entry, 'outgoing' = what this entry references"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entryId, direction }) => {
      const relations = await mcpQuery<any[]>("kb.listEntryRelations", { entryId });

      if (relations.length === 0) {
        return { content: [{ type: "text" as const, text: `No relations found for \`${entryId}\`. Use relate-entries to create connections.` }] };
      }

      const sourceEntry = await mcpQuery<any>("kb.getEntry", { entryId });
      if (!sourceEntry) {
        return { content: [{ type: "text" as const, text: `Entry \`${entryId}\` not found. Try kb-search to find the right ID.` }] };
      }
      const sourceInternalId = sourceEntry._id;

      const MAX_RELATIONS = 25;
      const truncated = relations.length > MAX_RELATIONS;
      const capped = relations.slice(0, MAX_RELATIONS);

      const otherIds = new Set<string>();
      for (const r of capped) {
        const otherId = r.fromId === sourceInternalId ? r.toId : r.fromId;
        otherIds.add(otherId);
      }

      const otherEntries = new Map<string, { entryId?: string; name: string; collectionId: string }>();
      for (const id of otherIds) {
        const entry = await mcpQuery<any>("kb.getEntry", { id });
        if (entry) {
          otherEntries.set(entry._id, { entryId: entry.entryId, name: entry.name, collectionId: entry.collectionId });
        }
      }

      const collections = await mcpQuery<any[]>("kb.listCollections");
      const collMap = new Map<string, string>();
      for (const c of collections) collMap.set(c._id, c.slug);

      const lines: string[] = [`# Relations for ${entryId}: ${sourceEntry.name}`, ""];

      const enriched = capped.map((r) => {
        const isOutgoing = r.fromId === sourceInternalId;
        const otherId = isOutgoing ? r.toId : r.fromId;
        const other = otherEntries.get(otherId);
        const otherLabel = other?.entryId ? `${other.entryId}: ${other.name}` : (other?.name ?? "(deleted)");
        const colSlug = other ? (collMap.get(other.collectionId) ?? "unknown") : "unknown";
        return { isOutgoing, type: r.type, otherLabel, colSlug };
      });

      const outgoing = enriched.filter((r) => r.isOutgoing);
      const incoming = enriched.filter((r) => !r.isOutgoing);

      if ((direction === "outgoing" || direction === "both") && outgoing.length > 0) {
        lines.push(`## Outgoing (${outgoing.length})`);
        for (const r of outgoing) {
          lines.push(`- \u2192 **${r.type}** ${r.otherLabel} [${r.colSlug}]`);
        }
        lines.push("");
      }

      if ((direction === "incoming" || direction === "both") && incoming.length > 0) {
        lines.push(`## Incoming (${incoming.length})`);
        for (const r of incoming) {
          lines.push(`- \u2190 **${r.type}** ${r.otherLabel} [${r.colSlug}]`);
        }
        lines.push("");
      }

      const shown = direction === "outgoing" ? outgoing : direction === "incoming" ? incoming : enriched;
      if (shown.length === 0) {
        lines.push(`No ${direction} relations found for \`${entryId}\`.`);
      }

      if (truncated) {
        lines.push(`_Showing first ${MAX_RELATIONS} of ${relations.length} relations. Use get-entry for the full picture._`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "gather-context",
    {
      title: "Gather Full Context",
      description:
        "Assemble the full knowledge context around an entry by traversing the knowledge graph. " +
        "Returns all related entries grouped by collection — glossary terms, business rules, tensions, decisions, features, etc. " +
        "Use this when starting work on a feature or investigating an area to get the complete picture in one call.\n\n" +
        "Example: gather-context entryId='FEAT-001' returns all glossary terms, business rules, and tensions linked to that feature.",
      inputSchema: {
        entryId: z.string().describe("Entry ID, e.g. 'FEAT-001', 'GT-019', 'BR-007'"),
        maxHops: z.number().min(1).max(3).default(2)
          .describe("How many relation hops to traverse (1=direct only, 2=default, 3=wide net)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entryId, maxHops }) => {
      const result = await mcpQuery<any>("kb.gatherContext", { entryId, maxHops });

      if (!result?.root) {
        return { content: [{ type: "text" as const, text: `Entry \`${entryId}\` not found. Try kb-search to find the right ID.` }] };
      }

      if (result.related.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `# Context for ${result.root.entryId}: ${result.root.name}\n\n` +
              `_No relations found._ This entry is not yet connected to the knowledge graph.\n\n` +
              `Use \`suggest-links\` to discover potential connections, or \`relate-entries\` to link manually.`,
          }],
        };
      }

      const byCollection = new Map<string, typeof result.related>();
      for (const entry of result.related) {
        const key = entry.collectionName;
        if (!byCollection.has(key)) byCollection.set(key, []);
        byCollection.get(key)!.push(entry);
      }

      const lines: string[] = [
        `# Context for ${result.root.entryId}: ${result.root.name}`,
        `_${result.totalRelations} related entries across ${byCollection.size} collections (${result.hopsTraversed} hops traversed)_`,
        "",
      ];

      for (const [collName, entries] of byCollection) {
        lines.push(`## ${collName} (${entries.length})`);
        for (const e of entries) {
          const arrow = e.relationDirection === "outgoing" ? "\u2192" : "\u2190";
          const hopLabel = e.hop > 1 ? ` (hop ${e.hop})` : "";
          const id = e.entryId ? `${e.entryId}: ` : "";
          lines.push(`- ${arrow} **${e.relationType}** ${id}${e.name}${hopLabel}`);
        }
        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "suggest-links",
    {
      title: "Suggest Links",
      description:
        "Discover potential connections for an entry by scanning the knowledge base for related content. " +
        "Returns ranked suggestions based on text similarity — review them and use relate-entries to create the ones that make sense.\n\n" +
        "This is a discovery tool, not auto-linking. Always review suggestions before linking.",
      inputSchema: {
        entryId: z.string().describe("Entry ID to find suggestions for, e.g. 'FEAT-001'"),
        limit: z.number().min(1).max(20).default(10)
          .describe("Max number of suggestions to return"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entryId, limit }) => {
      const entry = await mcpQuery<any>("kb.getEntry", { entryId });
      if (!entry) {
        return { content: [{ type: "text" as const, text: `Entry \`${entryId}\` not found. Try kb-search to find the right ID.` }] };
      }

      const searchTerms = [entry.name];
      if (entry.data?.description) searchTerms.push(entry.data.description);
      if (entry.data?.canonical) searchTerms.push(entry.data.canonical);
      if (entry.data?.rationale) searchTerms.push(entry.data.rationale);
      if (entry.data?.rule) searchTerms.push(entry.data.rule);

      const queryText = searchTerms
        .join(" ")
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 8)
        .join(" ");

      if (!queryText) {
        return { content: [{ type: "text" as const, text: `Entry \`${entryId}\` has too little text content to generate suggestions.` }] };
      }

      const results = await mcpQuery<any[]>("kb.searchEntries", { query: queryText });
      if (!results || results.length === 0) {
        return { content: [{ type: "text" as const, text: `No suggestions found for \`${entryId}\`. The knowledge base may need more entries.` }] };
      }

      const existingRelations = await mcpQuery<any[]>("kb.listEntryRelations", { entryId });
      const relatedIds = new Set(
        existingRelations.flatMap((r) => [r.fromId, r.toId])
      );

      const collections = await mcpQuery<any[]>("kb.listCollections");
      const collMap = new Map<string, string>();
      for (const c of collections) collMap.set(c._id, c.slug);

      const suggestions = results
        .filter((r) => r._id !== entry._id && !relatedIds.has(r._id))
        .slice(0, limit)
        .map((r) => ({
          entryId: r.entryId,
          name: r.name,
          collection: collMap.get(r.collectionId) ?? "unknown",
          preview: extractPreview(r.data, 80),
        }));

      if (suggestions.length === 0) {
        return { content: [{ type: "text" as const, text: `No new link suggestions for \`${entryId}\` — it may already be well-connected, or no similar entries exist.` }] };
      }

      const lines = [
        `# Link Suggestions for ${entryId}: ${entry.name}`,
        `_${suggestions.length} potential connections found. Review and use \`relate-entries\` to create the ones that make sense._`,
        "",
      ];

      for (let i = 0; i < suggestions.length; i++) {
        const s = suggestions[i];
        const preview = s.preview ? ` — ${s.preview}` : "";
        lines.push(`${i + 1}. **${s.entryId ?? "(no ID)"}**: ${s.name} [${s.collection}]${preview}`);
      }

      lines.push("");
      lines.push("**To link:** `relate-entries from='FEAT-001' to='GT-019' type='defines_term_for'`");
      lines.push("");
      lines.push("_Recommended relation types: governs, defines_term_for, belongs_to, informs, surfaces_tension_in, related_to, depends_on_");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "quick-capture",
    {
      title: "Quick Capture",
      description:
        "Quickly capture a knowledge entry with just a name and description — no need to look up the full field schema first. " +
        "Always creates as 'draft' status with sensible defaults for remaining fields. " +
        "Use update-entry later to fill in details. Embodies 'Capture Now, Curate Later' (PRI-81cbdq).",
      inputSchema: {
        collection: z.string().describe("Collection slug, e.g. 'business-rules', 'glossary', 'tensions', 'decisions'"),
        name: z.string().describe("Display name for the entry"),
        description: z.string().describe("Short description — the essential context to capture now"),
        entryId: z.string().optional().describe("Optional human-readable ID (e.g. 'SOS-020', 'GT-031')"),
      },
      annotations: { destructiveHint: false },
    },
    async ({ collection, name, description, entryId }) => {
      const col = await mcpQuery<any>("kb.getCollection", { slug: collection });
      if (!col) {
        return { content: [{ type: "text" as const, text: `Collection \`${collection}\` not found. Use list-collections to see available collections.` }] };
      }

      const data: Record<string, unknown> = {};
      const emptyFields: string[] = [];

      for (const field of col.fields ?? []) {
        const key = field.key as string;
        if (key === "description" || key === "canonical" || key === "detail") {
          data[key] = description;
        } else if (field.type === "array" || field.type === "multi-select") {
          data[key] = [];
          emptyFields.push(key);
        } else if (field.type === "select") {
          data[key] = field.options?.[0] ?? "";
          emptyFields.push(key);
        } else {
          data[key] = "";
          emptyFields.push(key);
        }
      }

      if (!data.description && !data.canonical && !data.detail) {
        data.description = description;
      }

      try {
        const id = await mcpMutation<string>("kb.createEntry", {
          collectionSlug: collection,
          entryId,
          name,
          status: "draft",
          data,
        });

        const emptyNote = emptyFields.length > 0
          ? `\n\n**Fields to fill later** (via \`update-entry\`):\n${emptyFields.map((f) => `- \`${f}\``).join("\n")}`
          : "";

        return {
          content: [{
            type: "text" as const,
            text: `# Quick Capture — Done\n\n**${entryId ?? name}** added to \`${collection}\` as \`draft\`.\n\nInternal ID: ${id}${emptyNote}\n\n_Use \`update-entry\` to fill in details when ready. Use \`get-entry\` to review._`,
          }],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Duplicate") || msg.includes("already exists")) {
          return {
            content: [{
              type: "text" as const,
              text: `# Cannot Capture — Duplicate Detected\n\n${msg}\n\nUse \`get-entry\` to inspect the existing entry, or \`update-entry\` to modify it.`,
            }],
          };
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "load-context-for-task",
    {
      title: "Load Context for Task",
      description:
        "Auto-load relevant domain knowledge for a task in a single call. " +
        "Pass a natural-language task description; the tool searches the KB, traverses the knowledge graph, " +
        "and returns a ranked set of entries (business rules, glossary terms, decisions, features, etc.) " +
        "grouped by collection with a confidence score.\n\n" +
        "Use this at the start of a conversation to ground the agent in domain context before writing code or making recommendations.\n\n" +
        "Confidence levels:\n" +
        "- high: 3+ direct KB matches — strong domain coverage\n" +
        "- medium: 1-2 direct matches — partial coverage, may want to drill deeper\n" +
        "- low: no direct matches but related entries found via graph traversal\n" +
        "- none: no relevant entries found — KB may not cover this area yet",
      inputSchema: {
        taskDescription: z.string().describe("Natural-language description of the task or user message"),
        maxResults: z.number().min(1).max(25).default(10).optional()
          .describe("Max entries to return (default 10)"),
        maxHops: z.number().min(1).max(3).default(2).optional()
          .describe("Graph traversal depth from each search hit (default 2)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ taskDescription, maxResults, maxHops }) => {
      await server.sendLoggingMessage({
        level: "info",
        data: `Loading context for task: "${taskDescription.substring(0, 80)}..."`,
        logger: "product-os",
      });

      const result = await mcpQuery<{
        entries: Array<{
          entryId?: string;
          name: string;
          collectionSlug: string;
          collectionName: string;
          descriptionPreview: string;
          codePaths: string[];
          hop: number;
          relationType?: string;
        }>;
        confidence: string;
        searchTerms: string;
        totalFound: number;
      }>("kb.loadContextForTask", {
        taskDescription,
        maxResults: maxResults ?? 10,
        maxHops: maxHops ?? 2,
      });

      if (result.confidence === "none" || result.entries.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `# Context Loaded\n\n**Confidence:** None\n\n` +
              `No KB context found for this task. The knowledge base may not cover this area yet.\n\n` +
              `_Consider capturing domain knowledge discovered during this task via \`smart-capture\`._`,
          }],
        };
      }

      const byCollection = new Map<string, typeof result.entries>();
      for (const entry of result.entries) {
        const key = entry.collectionName;
        if (!byCollection.has(key)) byCollection.set(key, []);
        byCollection.get(key)!.push(entry);
      }

      const lines: string[] = [
        `# Context Loaded`,
        `**Confidence:** ${result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}`,
        `**Matched:** ${result.entries.length} entries across ${byCollection.size} collection${byCollection.size === 1 ? "" : "s"}`,
        "",
      ];

      for (const [collName, entries] of byCollection) {
        lines.push(`### ${collName} (${entries.length})`);
        for (const e of entries) {
          const id = e.entryId ? `**${e.entryId}:** ` : "";
          const hopLabel = e.hop > 0 ? ` _(hop ${e.hop}${e.relationType ? `, ${e.relationType}` : ""})_` : "";
          const preview = e.descriptionPreview ? `\n  ${e.descriptionPreview}` : "";
          const codePaths = e.codePaths.length > 0 ? `\n  Code: ${e.codePaths.join(", ")}` : "";
          lines.push(`- ${id}${e.name}${hopLabel}${preview}${codePaths}`);
        }
        lines.push("");
      }

      lines.push(`_Use \`get-entry\` for full details on any entry._`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  server.registerTool(
    "review-rules",
    {
      title: "Review Business Rules",
      description:
        "Surface all active business rules for a domain, formatted for compliance review. " +
        "Use when reviewing code, designs, or decisions against ProductBrain governance. " +
        "Optionally provide context (what you're building or reviewing) to help focus the review. " +
        "This is the tool form of the review-against-rules prompt.",
      inputSchema: {
        domain: z.string().describe("Business rule domain, e.g. 'AI & MCP Integration', 'Governance & Decision-Making'"),
        context: z.string().optional().describe("What you're reviewing — code change, design decision, file path, etc."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ domain, context }) => {
      const entries = await mcpQuery<any[]>("kb.listEntries", { collectionSlug: "business-rules" });

      const domainLower = domain.toLowerCase();
      const rules = entries.filter((e) => {
        const ruleDomain = (e.data?.domain ?? "") as string;
        return ruleDomain.toLowerCase() === domainLower || ruleDomain.toLowerCase().includes(domainLower);
      });

      if (rules.length === 0) {
        const allDomains = [...new Set(entries.map((e) => e.data?.domain).filter(Boolean))];
        return {
          content: [{
            type: "text" as const,
            text: `# No Rules Found for "${domain}"\n\nAvailable domains:\n${allDomains.map((d) => `- ${d}`).join("\n")}\n\n_Try one of the domains above, or use kb-search to find rules by keyword._`,
          }],
        };
      }

      const header = context
        ? `# Business Rules: ${domain}\n\n**Review context:** ${context}\n\nFor each rule, assess: compliant, at risk, violation, or not applicable.\n`
        : `# Business Rules: ${domain}\n`;

      const formatted = rules
        .map((r) => {
          const id = r.entryId ? `**${r.entryId}:** ` : "";
          const severity = r.data?.severity ? ` | Severity: ${r.data.severity}` : "";
          const desc = r.data?.description ?? "";
          const impact = r.data?.dataImpact ? `\n  Data impact: ${r.data.dataImpact}` : "";
          const related = (r.data?.relatedRules as string[] ?? []).length > 0
            ? `\n  Related: ${(r.data.relatedRules as string[]).join(", ")}`
            : "";
          return `### ${id}${r.name} \`${r.status}\`${severity}\n\n${desc}${impact}${related}`;
        })
        .join("\n\n---\n\n");

      const footer = `\n_${rules.length} rule${rules.length === 1 ? "" : "s"} in this domain. Use \`get-entry\` for full details. Use the \`draft-rule-from-context\` prompt to propose new rules._`;

      return {
        content: [{ type: "text" as const, text: `${header}\n${formatted}\n${footer}` }],
      };
    }
  );
}
