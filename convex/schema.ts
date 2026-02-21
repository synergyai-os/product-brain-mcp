import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
  }).index("by_slug", ["slug"]),

  collections: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    fields: v.array(
      v.object({
        key: v.string(),
        type: v.string(),
        required: v.optional(v.boolean()),
        searchable: v.optional(v.boolean()),
        options: v.optional(v.array(v.string())),
      }),
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_slug", ["workspaceId", "slug"]),

  entries: defineTable({
    workspaceId: v.id("workspaces"),
    collectionId: v.id("collections"),
    entryId: v.optional(v.string()),
    name: v.string(),
    status: v.string(),
    data: v.any(),
    tags: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    searchText: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_collection", ["workspaceId", "collectionId"])
    .index("by_entryId", ["workspaceId", "entryId"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["workspaceId", "collectionId", "status"],
    }),

  entryRelations: defineTable({
    workspaceId: v.id("workspaces"),
    fromId: v.id("entries"),
    toId: v.id("entries"),
    type: v.string(),
  })
    .index("by_from", ["fromId"])
    .index("by_to", ["toId"]),

  entryHistory: defineTable({
    workspaceId: v.id("workspaces"),
    entryId: v.id("entries"),
    event: v.string(),
    changedBy: v.optional(v.string()),
    changes: v.optional(v.any()),
    timestamp: v.number(),
  }).index("by_entry", ["entryId"]),

  labels: defineTable({
    workspaceId: v.id("workspaces"),
    slug: v.string(),
    name: v.string(),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    parentId: v.optional(v.id("labels")),
    isGroup: v.optional(v.boolean()),
    order: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_slug", ["workspaceId", "slug"]),

  entryLabels: defineTable({
    entryId: v.id("entries"),
    labelId: v.id("labels"),
  })
    .index("by_entry", ["entryId"])
    .index("by_label", ["labelId"]),

  // ── Auth & Provisioning ─────────────────────────────────────────────

  users: defineTable({
    clerkId: v.optional(v.string()),
    githubId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    defaultWorkspaceId: v.optional(v.id("workspaces")),
    createdAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_githubId", ["githubId"]),

  apiKeys: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    keyHash: v.string(),
    keyPrefix: v.string(),
    name: v.optional(v.string()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_userId", ["userId"])
    .index("by_workspace", ["workspaceId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_token", ["token"]),
});
