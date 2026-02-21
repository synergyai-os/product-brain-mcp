import { v } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Helpers ─────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// ── Default collections (same as seed.ts) ───────────────────────────────

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
    description: "Friction points, pain points, and unmet needs",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "priority", type: "select", options: ["low", "medium", "high", "critical"] },
      { key: "severity", type: "select", options: ["low", "medium", "high", "critical"] },
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
    description: "Technical and process standards",
    fields: [
      { key: "description", type: "string", required: true, searchable: true },
      { key: "scope", type: "string" },
      { key: "references", type: "string" },
    ],
  },
  {
    name: "Principles",
    slug: "principles",
    description: "Guiding principles that inform decisions",
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

// ── Internal functions ──────────────────────────────────────────────────

export const createWorkspaceForUser = internalMutation({
  args: { userId: v.id("users"), name: v.string(), slug: v.string() },
  handler: async (ctx, { userId, name, slug }) => {
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      await ctx.db.patch(userId, { defaultWorkspaceId: existing._id });
      return existing._id;
    }

    const workspaceId = await ctx.db.insert("workspaces", { name, slug });

    for (const col of DEFAULT_COLLECTIONS) {
      await ctx.db.insert("collections", { workspaceId, ...col });
    }

    await ctx.db.patch(userId, { defaultWorkspaceId: workspaceId });
    return workspaceId;
  },
});

export const generateApiKey = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    keyHash: v.string(),
    keyPrefix: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { userId, workspaceId, keyHash, keyPrefix, name }) => {
    return await ctx.db.insert("apiKeys", {
      userId,
      workspaceId,
      keyHash,
      keyPrefix,
      name,
      createdAt: Date.now(),
    });
  },
});

export const validateApiKey = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
      .first();
    if (!apiKey) return null;

    return {
      userId: apiKey.userId,
      workspaceId: apiKey.workspaceId,
      keyId: apiKey._id,
    };
  },
});

export const touchApiKeyUsage = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, { keyId }) => {
    await ctx.db.patch(keyId, { lastUsedAt: Date.now() });
  },
});

export const revokeApiKey = internalMutation({
  args: { keyId: v.id("apiKeys"), userId: v.id("users") },
  handler: async (ctx, { keyId, userId }) => {
    const key = await ctx.db.get(keyId);
    if (!key) throw new Error("API key not found");
    if (key.userId !== userId) throw new Error("Not authorized to revoke this key");
    await ctx.db.delete(keyId);
  },
});

export const listApiKeys = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return keys.map((k) => ({
      _id: k._id,
      keyPrefix: k.keyPrefix,
      name: k.name,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
      workspaceId: k.workspaceId,
    }));
  },
});

// ── HTTP Action: /api/provision ─────────────────────────────────────────

export const provisionHandler = httpAction(async (ctx, request) => {
  const { validateAuth } = await import("./auth");
  const authResult = await validateAuth(ctx, request);

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (authResult.error) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const user = await ctx.runQuery(internal.auth.getUserById, {
    userId: authResult.userId,
  });
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  }

  let workspaceId = user.defaultWorkspaceId;
  const slug = user.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 40);

  if (!workspaceId) {
    workspaceId = await ctx.runMutation(internal.provision.createWorkspaceForUser, {
      userId: user._id,
      name: `${user.name}'s workspace`,
      slug,
    });
  }

  const rawKey = `pb_sk_${randomHex(24)}`;
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  await ctx.runMutation(internal.provision.generateApiKey, {
    userId: user._id,
    workspaceId: workspaceId!,
    keyHash,
    keyPrefix,
    name: "Default (created via SynergyOS)",
  });

  return new Response(
    JSON.stringify({
      data: {
        apiKey: rawKey,
        workspaceSlug: slug,
        workspaceId,
        userName: user.name,
      },
    }),
    { status: 200, headers: corsHeaders },
  );
});
