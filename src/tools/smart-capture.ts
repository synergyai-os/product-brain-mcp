import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpQuery, mcpMutation } from "../client.js";

// ── Collection Workflow Profiles ────────────────────────────────────────────

interface FieldDefault {
  key: string;
  value: unknown | "today" | "infer";
}

interface QualityCheck {
  id: string;
  label: string;
  check: (ctx: CaptureContext) => boolean;
  suggestion?: (ctx: CaptureContext) => string;
}

interface CollectionProfile {
  idPrefix: string;
  governedDraft: boolean;
  defaults: FieldDefault[];
  descriptionField: string;
  recommendedRelationTypes: string[];
  qualityChecks: QualityCheck[];
  inferField?: (ctx: CaptureContext) => Record<string, unknown>;
}

interface CaptureContext {
  collection: string;
  name: string;
  description: string;
  context?: string;
  data: Record<string, unknown>;
  entryId: string;
  linksCreated: LinkResult[];
  linksSuggested: LinkSuggestion[];
  collectionFields: Array<{ key: string; type: string; required?: boolean }>;
}

interface LinkResult {
  targetEntryId: string;
  targetName: string;
  targetCollection: string;
  relationType: string;
}

interface LinkSuggestion {
  entryId?: string;
  name: string;
  collection: string;
  reason: string;
  preview: string;
}

const AREA_KEYWORDS: Record<string, string[]> = {
  "Architecture": ["convex", "schema", "database", "migration", "api", "backend", "infrastructure", "scaling", "performance"],
  "Knowledge Base": ["knowledge", "glossary", "entry", "collection", "terminology", "drift", "graph"],
  "AI & MCP Integration": ["mcp", "ai", "cursor", "agent", "tool", "llm", "prompt", "context"],
  "Developer Experience": ["dx", "developer", "ide", "workflow", "friction", "ceremony"],
  "Governance & Decision-Making": ["governance", "decision", "rule", "policy", "compliance", "approval"],
  "Analytics & Tracking": ["analytics", "posthog", "tracking", "event", "metric", "funnel"],
  "Security": ["security", "auth", "api key", "permission", "access", "token"],
};

function inferArea(text: string): string {
  const lower = text.toLowerCase();
  let bestArea = "";
  let bestScore = 0;
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestArea = area;
    }
  }
  return bestArea;
}

function inferDomain(text: string): string {
  return inferArea(text) || "";
}

const COMMON_CHECKS: Record<string, QualityCheck> = {
  clearName: {
    id: "clear-name",
    label: "Clear, specific name (not vague)",
    check: (ctx) => ctx.name.length > 10 && !["new tension", "new entry", "untitled", "test"].includes(ctx.name.toLowerCase()),
    suggestion: () => "Rename to something specific — describe the actual problem or concept.",
  },
  hasDescription: {
    id: "has-description",
    label: "Description provided (>50 chars)",
    check: (ctx) => ctx.description.length > 50,
    suggestion: () => "Add a fuller description explaining context and impact.",
  },
  hasRelations: {
    id: "has-relations",
    label: "At least 1 relation created",
    check: (ctx) => ctx.linksCreated.length >= 1,
    suggestion: () => "Use `suggest-links` and `relate-entries` to connect this entry to related knowledge.",
  },
  diverseRelations: {
    id: "diverse-relations",
    label: "Relations span multiple collections",
    check: (ctx) => {
      const colls = new Set(ctx.linksCreated.map((l) => l.targetCollection));
      return colls.size >= 2;
    },
    suggestion: () => "Try linking to entries in different collections (glossary, business-rules, strategy).",
  },
};

const PROFILES: Map<string, CollectionProfile> = new Map([
  ["tensions", {
    idPrefix: "TEN",
    governedDraft: false,
    descriptionField: "description",
    defaults: [
      { key: "priority", value: "medium" },
      { key: "date", value: "today" },
      { key: "raised", value: "infer" },
      { key: "severity", value: "infer" },
    ],
    recommendedRelationTypes: ["surfaces_tension_in", "references", "belongs_to", "related_to"],
    inferField: (ctx) => {
      const fields: Record<string, unknown> = {};
      const text = `${ctx.name} ${ctx.description}`;
      const area = inferArea(text);
      if (area) fields.raised = area;
      if (text.toLowerCase().includes("critical") || text.toLowerCase().includes("blocker")) {
        fields.severity = "critical";
      } else if (text.toLowerCase().includes("bottleneck") || text.toLowerCase().includes("scaling") || text.toLowerCase().includes("breaking")) {
        fields.severity = "high";
      } else {
        fields.severity = "medium";
      }
      if (area) fields.affectedArea = area;
      return fields;
    },
    qualityChecks: [
      COMMON_CHECKS.clearName,
      COMMON_CHECKS.hasDescription,
      COMMON_CHECKS.hasRelations,
      {
        id: "has-severity",
        label: "Severity specified",
        check: (ctx) => !!ctx.data.severity && ctx.data.severity !== "",
        suggestion: (ctx) => {
          const text = `${ctx.name} ${ctx.description}`.toLowerCase();
          const inferred = text.includes("critical") ? "critical" : text.includes("bottleneck") ? "high" : "medium";
          return `Set severity — suggest: ${inferred} (based on description keywords).`;
        },
      },
      {
        id: "has-affected-area",
        label: "Affected area identified",
        check: (ctx) => !!ctx.data.affectedArea && ctx.data.affectedArea !== "",
        suggestion: (ctx) => {
          const area = inferArea(`${ctx.name} ${ctx.description}`);
          return area
            ? `Set affectedArea — suggest: "${area}" (inferred from content).`
            : "Specify which product area or domain this tension impacts.";
        },
      },
    ],
  }],

  ["business-rules", {
    idPrefix: "SOS",
    governedDraft: true,
    descriptionField: "description",
    defaults: [
      { key: "severity", value: "medium" },
      { key: "domain", value: "infer" },
    ],
    recommendedRelationTypes: ["governs", "references", "conflicts_with", "related_to"],
    inferField: (ctx) => {
      const fields: Record<string, unknown> = {};
      const domain = inferDomain(`${ctx.name} ${ctx.description}`);
      if (domain) fields.domain = domain;
      return fields;
    },
    qualityChecks: [
      COMMON_CHECKS.clearName,
      COMMON_CHECKS.hasDescription,
      COMMON_CHECKS.hasRelations,
      {
        id: "has-rationale",
        label: "Rationale provided",
        check: (ctx) => typeof ctx.data.rationale === "string" && ctx.data.rationale.length > 10,
        suggestion: () => "Add a rationale explaining why this rule exists via `update-entry`.",
      },
      {
        id: "has-domain",
        label: "Domain specified",
        check: (ctx) => !!ctx.data.domain && ctx.data.domain !== "",
        suggestion: (ctx) => {
          const domain = inferDomain(`${ctx.name} ${ctx.description}`);
          return domain
            ? `Set domain — suggest: "${domain}" (inferred from content).`
            : "Specify the business domain this rule belongs to.";
        },
      },
    ],
  }],

  ["glossary", {
    idPrefix: "GT",
    governedDraft: true,
    descriptionField: "canonical",
    defaults: [
      { key: "category", value: "infer" },
    ],
    recommendedRelationTypes: ["defines_term_for", "confused_with", "related_to", "references"],
    inferField: (ctx) => {
      const fields: Record<string, unknown> = {};
      const area = inferArea(`${ctx.name} ${ctx.description}`);
      if (area) {
        const categoryMap: Record<string, string> = {
          "Architecture": "Platform & Architecture",
          "Knowledge Base": "Knowledge Management",
          "AI & MCP Integration": "AI & Developer Tools",
          "Developer Experience": "AI & Developer Tools",
          "Governance & Decision-Making": "Governance & Process",
          "Analytics & Tracking": "Platform & Architecture",
          "Security": "Platform & Architecture",
        };
        fields.category = categoryMap[area] ?? "";
      }
      return fields;
    },
    qualityChecks: [
      COMMON_CHECKS.clearName,
      {
        id: "has-canonical",
        label: "Canonical definition provided (>20 chars)",
        check: (ctx) => {
          const canonical = ctx.data.canonical;
          return typeof canonical === "string" && canonical.length > 20;
        },
        suggestion: () => "Add a clear canonical definition — this is the single source of truth for this term.",
      },
      COMMON_CHECKS.hasRelations,
      {
        id: "has-category",
        label: "Category assigned",
        check: (ctx) => !!ctx.data.category && ctx.data.category !== "",
        suggestion: () => "Assign a category (e.g., 'Platform & Architecture', 'Governance & Process').",
      },
    ],
  }],

  ["decisions", {
    idPrefix: "DEC",
    governedDraft: false,
    descriptionField: "rationale",
    defaults: [
      { key: "date", value: "today" },
      { key: "decidedBy", value: "infer" },
    ],
    recommendedRelationTypes: ["informs", "references", "replaces", "related_to"],
    inferField: (ctx) => {
      const fields: Record<string, unknown> = {};
      const area = inferArea(`${ctx.name} ${ctx.description}`);
      if (area) fields.decidedBy = area;
      return fields;
    },
    qualityChecks: [
      COMMON_CHECKS.clearName,
      {
        id: "has-rationale",
        label: "Rationale provided (>30 chars)",
        check: (ctx) => {
          const rationale = ctx.data.rationale;
          return typeof rationale === "string" && rationale.length > 30;
        },
        suggestion: () => "Explain why this decision was made — what was considered and rejected?",
      },
      COMMON_CHECKS.hasRelations,
      {
        id: "has-date",
        label: "Decision date recorded",
        check: (ctx) => !!ctx.data.date && ctx.data.date !== "",
        suggestion: () => "Record when this decision was made.",
      },
    ],
  }],
]);

const FALLBACK_PROFILE: CollectionProfile = {
  idPrefix: "",
  governedDraft: false,
  descriptionField: "description",
  defaults: [],
  recommendedRelationTypes: ["related_to", "references"],
  qualityChecks: [
    COMMON_CHECKS.clearName,
    COMMON_CHECKS.hasDescription,
    COMMON_CHECKS.hasRelations,
  ],
};

// ── ID Generation ───────────────────────────────────────────────────────────

function generateEntryId(prefix: string): string {
  if (!prefix) return "";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${suffix}`;
}

// ── Auto-Linking Logic ──────────────────────────────────────────────────────

function extractSearchTerms(name: string, description: string): string {
  const text = `${name} ${description}`;
  return text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8)
    .join(" ");
}

function computeLinkConfidence(
  candidate: { name: string; data?: any; entryId?: string },
  sourceName: string,
  sourceDescription: string,
  sourceCollection: string,
  candidateCollection: string,
): number {
  const text = `${sourceName} ${sourceDescription}`.toLowerCase();
  const candidateName = candidate.name.toLowerCase();
  let score = 0;

  if (text.includes(candidateName) && candidateName.length > 3) {
    score += 40;
  }

  const candidateWords = candidateName.split(/\s+/).filter((w) => w.length > 3);
  const matchingWords = candidateWords.filter((w) => text.includes(w));
  score += (matchingWords.length / Math.max(candidateWords.length, 1)) * 30;

  const HUB_COLLECTIONS = new Set(["strategy", "features"]);
  if (HUB_COLLECTIONS.has(candidateCollection)) {
    score += 15;
  }

  if (candidateCollection !== sourceCollection) {
    score += 10;
  }

  return Math.min(score, 100);
}

function inferRelationType(
  sourceCollection: string,
  targetCollection: string,
  profile: CollectionProfile,
): string {
  const typeMap: Record<string, Record<string, string>> = {
    tensions: {
      glossary: "surfaces_tension_in",
      "business-rules": "references",
      strategy: "belongs_to",
      features: "surfaces_tension_in",
      decisions: "references",
    },
    "business-rules": {
      glossary: "references",
      features: "governs",
      strategy: "belongs_to",
      tensions: "references",
    },
    glossary: {
      features: "defines_term_for",
      "business-rules": "references",
      strategy: "references",
    },
    decisions: {
      features: "informs",
      "business-rules": "references",
      strategy: "references",
      tensions: "references",
    },
  };

  return typeMap[sourceCollection]?.[targetCollection]
    ?? profile.recommendedRelationTypes[0]
    ?? "related_to";
}

// ── Quality Scoring ─────────────────────────────────────────────────────────

interface QualityResult {
  score: number;
  maxScore: number;
  checks: Array<{ id: string; label: string; passed: boolean; suggestion?: string }>;
}

function scoreQuality(ctx: CaptureContext, profile: CollectionProfile): QualityResult {
  const checks = profile.qualityChecks.map((qc) => {
    const passed = qc.check(ctx);
    return {
      id: qc.id,
      label: qc.label,
      passed,
      suggestion: passed ? undefined : qc.suggestion?.(ctx),
    };
  });

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 10) : 10;

  return { score, maxScore: 10, checks };
}

export function formatQualityReport(result: QualityResult): string {
  const lines: string[] = [`## Quality: ${result.score}/${result.maxScore}`];
  for (const check of result.checks) {
    const icon = check.passed ? "[x]" : "[ ]";
    const suggestion = check.passed ? "" : ` -- ${check.suggestion ?? ""}`;
    lines.push(`${icon} ${check.label}${suggestion}`);
  }
  return lines.join("\n");
}

// ── Exported: quality-check for existing entries ────────────────────────────

export async function checkEntryQuality(entryId: string): Promise<{ text: string; quality: QualityResult }> {
  const entry = await mcpQuery<any>("kb.getEntry", { entryId });
  if (!entry) {
    return {
      text: `Entry \`${entryId}\` not found. Try kb-search to find the right ID.`,
      quality: { score: 0, maxScore: 10, checks: [] },
    };
  }

  const collections = await mcpQuery<any[]>("kb.listCollections");
  const collMap = new Map<string, string>();
  for (const c of collections) collMap.set(c._id, c.slug);
  const collectionSlug = collMap.get(entry.collectionId) ?? "unknown";

  const profile = PROFILES.get(collectionSlug) ?? FALLBACK_PROFILE;

  const relations = await mcpQuery<any[]>("kb.listEntryRelations", { entryId });
  const linksCreated: LinkResult[] = [];
  for (const r of relations) {
    const otherId = r.fromId === entry._id ? r.toId : r.fromId;
    linksCreated.push({
      targetEntryId: otherId,
      targetName: "",
      targetCollection: "",
      relationType: r.type,
    });
  }

  const descField = profile.descriptionField;
  const description = typeof entry.data?.[descField] === "string" ? entry.data[descField] : "";

  const ctx: CaptureContext = {
    collection: collectionSlug,
    name: entry.name,
    description,
    data: entry.data ?? {},
    entryId: entry.entryId ?? "",
    linksCreated,
    linksSuggested: [],
    collectionFields: [],
  };

  const quality = scoreQuality(ctx, profile);

  const lines: string[] = [
    `# Quality Check: ${entry.entryId ?? entry.name}`,
    `**${entry.name}** in \`${collectionSlug}\` [${entry.status}]`,
    "",
    formatQualityReport(quality),
  ];

  if (quality.score < 10) {
    const failedChecks = quality.checks.filter((c) => !c.passed && c.suggestion);
    if (failedChecks.length > 0) {
      lines.push("");
      lines.push(`_To improve: use \`update-entry\` to fill missing fields, or \`relate-entries\` to add connections._`);
    }
  }

  return { text: lines.join("\n"), quality };
}

// ── Tool Registration ───────────────────────────────────────────────────────

const GOVERNED_COLLECTIONS = new Set([
  "glossary", "business-rules", "principles", "standards", "strategy", "features",
]);

const AUTO_LINK_CONFIDENCE_THRESHOLD = 35;
const MAX_AUTO_LINKS = 5;
const MAX_SUGGESTIONS = 5;

export function registerSmartCaptureTools(server: McpServer) {

  server.registerTool(
    "smart-capture",
    {
      title: "Smart Capture",
      description:
        "One-call knowledge capture: creates an entry, auto-links related entries, and returns a quality scorecard. " +
        "Replaces the multi-step workflow of create-entry + suggest-links + relate-entries. " +
        "Provide a collection, name, and description — everything else is inferred or auto-filled.\n\n" +
        "Supported collections with smart profiles: tensions, business-rules, glossary, decisions.\n" +
        "All other collections use sensible defaults (same as quick-capture + auto-linking).\n\n" +
        "Always creates as 'draft' for governed collections. Embodies 'Capture Now, Curate Later' (PRI-81cbdq).",
      inputSchema: {
        collection: z.string().describe("Collection slug, e.g. 'tensions', 'business-rules', 'glossary', 'decisions'"),
        name: z.string().describe("Display name — be specific (e.g. 'Convex adjacency list won't scale for graph traversal')"),
        description: z.string().describe("Full context — what's happening, why it matters, what you observed"),
        context: z.string().optional().describe("Optional additional context (e.g. 'Observed during gather-context calls taking 700ms+')"),
        entryId: z.string().optional().describe("Optional custom entry ID (e.g. 'TEN-my-id'). Auto-generated if omitted."),
      },
      annotations: { destructiveHint: false },
    },
    async ({ collection, name, description, context, entryId }) => {
      const profile = PROFILES.get(collection) ?? FALLBACK_PROFILE;

      // 1. Resolve collection schema
      const col = await mcpQuery<any>("kb.getCollection", { slug: collection });
      if (!col) {
        return {
          content: [{ type: "text" as const, text: `Collection \`${collection}\` not found. Use \`list-collections\` to see available collections.` }],
        };
      }

      // 2. Build data with profile defaults + inference
      const data: Record<string, unknown> = {};
      const today = new Date().toISOString().split("T")[0];

      for (const field of col.fields ?? []) {
        const key = field.key as string;
        if (key === profile.descriptionField) {
          data[key] = description;
        } else if (field.type === "array" || field.type === "multi-select") {
          data[key] = [];
        } else {
          data[key] = "";
        }
      }

      for (const def of profile.defaults) {
        if (def.value === "today") {
          data[def.key] = today;
        } else if (def.value !== "infer") {
          data[def.key] = def.value;
        }
      }

      if (profile.inferField) {
        const inferred = profile.inferField({
          collection, name, description, context, data, entryId: "",
          linksCreated: [], linksSuggested: [], collectionFields: col.fields ?? [],
        });
        for (const [key, val] of Object.entries(inferred)) {
          if (val !== undefined && val !== "") {
            data[key] = val;
          }
        }
      }

      if (!data[profile.descriptionField] && !data.description && !data.canonical) {
        data[profile.descriptionField || "description"] = description;
      }

      // 3. Determine status
      const status = GOVERNED_COLLECTIONS.has(collection) ? "draft" : "draft";

      // 4. Generate entry ID
      const finalEntryId = entryId ?? generateEntryId(profile.idPrefix);

      // 5. Create entry
      let internalId: string;
      try {
        internalId = await mcpMutation<string>("kb.createEntry", {
          collectionSlug: collection,
          entryId: finalEntryId || undefined,
          name,
          status,
          data,
          createdBy: "smart-capture",
        });
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

      // 6. Discover and auto-link related entries
      const linksCreated: LinkResult[] = [];
      const linksSuggested: LinkSuggestion[] = [];

      const searchQuery = extractSearchTerms(name, description);
      if (searchQuery) {
        const [searchResults, allCollections] = await Promise.all([
          mcpQuery<any[]>("kb.searchEntries", { query: searchQuery }),
          mcpQuery<any[]>("kb.listCollections"),
        ]);

        const collMap = new Map<string, string>();
        for (const c of allCollections) collMap.set(c._id, c.slug);

        const candidates = (searchResults ?? [])
          .filter((r) => r.entryId !== finalEntryId && r._id !== internalId)
          .map((r) => ({
            ...r,
            collSlug: collMap.get(r.collectionId) ?? "unknown",
            confidence: computeLinkConfidence(r, name, description, collection, collMap.get(r.collectionId) ?? "unknown"),
          }))
          .sort((a, b) => b.confidence - a.confidence);

        // Auto-link high-confidence matches
        for (const c of candidates) {
          if (linksCreated.length >= MAX_AUTO_LINKS) break;
          if (c.confidence < AUTO_LINK_CONFIDENCE_THRESHOLD) break;
          if (!c.entryId || !finalEntryId) continue;

          const relationType = inferRelationType(collection, c.collSlug, profile);
          try {
            await mcpMutation("kb.createEntryRelation", {
              fromEntryId: finalEntryId,
              toEntryId: c.entryId,
              type: relationType,
            });
            linksCreated.push({
              targetEntryId: c.entryId,
              targetName: c.name,
              targetCollection: c.collSlug,
              relationType,
            });
          } catch {
            // Relation creation failed (e.g. entry not found) — skip silently
          }
        }

        // Collect suggestions for remaining candidates
        const linkedIds = new Set(linksCreated.map((l) => l.targetEntryId));
        for (const c of candidates) {
          if (linksSuggested.length >= MAX_SUGGESTIONS) break;
          if (linkedIds.has(c.entryId)) continue;
          if (c.confidence < 10) continue;

          const preview = extractPreview(c.data, 80);
          const reason = c.confidence >= AUTO_LINK_CONFIDENCE_THRESHOLD
            ? "high relevance (already linked)"
            : `"${c.name.toLowerCase().split(/\s+/).filter((w: string) => `${name} ${description}`.toLowerCase().includes(w) && w.length > 3).slice(0, 2).join('", "')}" appears in content`;

          linksSuggested.push({
            entryId: c.entryId,
            name: c.name,
            collection: c.collSlug,
            reason,
            preview,
          });
        }
      }

      // 7. Score quality
      const captureCtx: CaptureContext = {
        collection,
        name,
        description,
        context,
        data,
        entryId: finalEntryId,
        linksCreated,
        linksSuggested,
        collectionFields: col.fields ?? [],
      };
      const quality = scoreQuality(captureCtx, profile);

      // 8. Format response
      const lines: string[] = [
        `# Captured: ${finalEntryId || name}`,
        `**${name}** added to \`${collection}\` as \`${status}\``,
      ];

      if (linksCreated.length > 0) {
        lines.push("");
        lines.push(`## Auto-linked (${linksCreated.length})`);
        for (const link of linksCreated) {
          lines.push(`- -> **${link.relationType}** ${link.targetEntryId}: ${link.targetName} [${link.targetCollection}]`);
        }
      }

      if (linksSuggested.length > 0) {
        lines.push("");
        lines.push("## Suggested links (review and use relate-entries)");
        for (let i = 0; i < linksSuggested.length; i++) {
          const s = linksSuggested[i];
          const preview = s.preview ? ` — ${s.preview}` : "";
          lines.push(`${i + 1}. **${s.entryId ?? "(no ID)"}**: ${s.name} [${s.collection}]${preview}`);
        }
      }

      lines.push("");
      lines.push(formatQualityReport(quality));

      const failedChecks = quality.checks.filter((c) => !c.passed);
      if (failedChecks.length > 0) {
        lines.push("");
        lines.push(`_To improve: \`update-entry entryId="${finalEntryId}"\` to fill missing fields._`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // ── Quality Check Tool ──────────────────────────────────────────────────

  server.registerTool(
    "quality-check",
    {
      title: "Quality Check",
      description:
        "Score an existing knowledge entry against collection-specific quality criteria. " +
        "Returns a scorecard (X/10) with specific, actionable suggestions for improvement. " +
        "Checks: name clarity, description completeness, relation connectedness, and collection-specific fields.\n\n" +
        "Use after creating entries to assess their quality, or to audit existing entries.",
      inputSchema: {
        entryId: z.string().describe("Entry ID to check, e.g. 'TEN-graph-db', 'GT-019', 'SOS-006'"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entryId }) => {
      const result = await checkEntryQuality(entryId);
      return { content: [{ type: "text" as const, text: result.text }] };
    }
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractPreview(data: any, maxLen: number): string {
  if (!data || typeof data !== "object") return "";
  const raw = data.description ?? data.canonical ?? data.detail ?? data.rule ?? "";
  if (typeof raw !== "string" || !raw) return "";
  return raw.length > maxLen ? raw.substring(0, maxLen) + "..." : raw;
}
