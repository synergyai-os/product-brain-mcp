import { v } from "convex/values";
import { mutation } from "./_generated/server";

const DEFAULT_COLLECTIONS = [
  {
    name: "Glossary",
    slug: "glossary",
    description: "Canonical terminology for the product domain",
    fields: [
      { key: "canonical", type: "string", required: true, searchable: true },
      {
        key: "category",
        type: "select",
        options: [
          "Platform & Architecture",
          "Knowledge Management",
          "AI & Developer Tools",
          "Governance & Process",
        ],
      },
      { key: "confusedWith", type: "array" },
      { key: "codeMapping", type: "array" },
    ],
  },
  {
    name: "Business Rules",
    slug: "business-rules",
    description: "Constraints and policies that govern product behavior",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "domain", type: "string" },
      {
        key: "severity",
        type: "select",
        options: ["low", "medium", "high", "critical"],
      },
      { key: "rationale", type: "string" },
      { key: "dataImpact", type: "string" },
      { key: "relatedRules", type: "array" },
    ],
  },
  {
    name: "Tensions",
    slug: "tensions",
    description:
      "Friction points, pain points, and unmet needs worth addressing",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      {
        key: "priority",
        type: "select",
        options: ["low", "medium", "high", "critical"],
      },
      {
        key: "severity",
        type: "select",
        options: ["low", "medium", "high", "critical"],
      },
      { key: "date", type: "string" },
      { key: "raised", type: "string" },
      { key: "affectedArea", type: "string" },
    ],
  },
  {
    name: "Decisions",
    slug: "decisions",
    description: "Significant decisions with rationale and context",
    fields: [
      { key: "rationale", type: "string", required: true, searchable: true },
      { key: "date", type: "string" },
      { key: "decidedBy", type: "string" },
      { key: "alternatives", type: "string" },
    ],
  },
  {
    name: "Tracking Events",
    slug: "tracking-events",
    description: "Analytics events for product instrumentation",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "properties", type: "array" },
      { key: "triggers", type: "string" },
    ],
  },
  {
    name: "Standards",
    slug: "standards",
    description: "Technical and process standards the team follows",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "scope", type: "string" },
      { key: "references", type: "string" },
    ],
  },
  {
    name: "Principles",
    slug: "principles",
    description: "Guiding principles that inform decisions and tradeoffs",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "rationale", type: "string" },
    ],
  },
  {
    name: "Strategy",
    slug: "strategy",
    description: "Strategic goals, bets, and direction",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "goals", type: "string" },
      { key: "metrics", type: "string" },
    ],
  },
  {
    name: "Features",
    slug: "features",
    description: "Product features and capabilities",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "scope", type: "string" },
      { key: "area", type: "string" },
    ],
  },
];

export const seedWorkspace = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { name, slug, userId }) => {
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existing) {
      if (userId) {
        await ctx.db.patch(userId, { defaultWorkspaceId: existing._id });
      }
      return { workspaceId: existing._id, seeded: false };
    }

    const workspaceId = await ctx.db.insert("workspaces", { name, slug });

    for (const col of DEFAULT_COLLECTIONS) {
      await ctx.db.insert("collections", { workspaceId, ...col });
    }

    if (userId) {
      await ctx.db.patch(userId, { defaultWorkspaceId: workspaceId });
    }

    return { workspaceId, seeded: true };
  },
});
