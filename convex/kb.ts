import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

function buildSearchText(name: string, data: any): string {
  const parts = [name];
  if (data && typeof data === "object") {
    for (const key of [
      "description",
      "canonical",
      "detail",
      "rule",
      "rationale",
    ]) {
      if (typeof data[key] === "string") parts.push(data[key]);
    }
  }
  return parts.join(" ").substring(0, 10000);
}

// ── Queries ─────────────────────────────────────────────────────────────

export const resolveWorkspace = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

export const resolveWorkspaceById = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db.get(workspaceId);
  },
});

export const listCollections = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const getCollection = internalQuery({
  args: { workspaceId: v.id("workspaces"), slug: v.string() },
  handler: async (ctx, { workspaceId, slug }) => {
    return await ctx.db
      .query("collections")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", slug),
      )
      .first();
  },
});

export const listEntries = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    collectionSlug: v.optional(v.string()),
    status: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, collectionSlug, status, tag }) => {
    let entries;

    if (collectionSlug) {
      const col = await ctx.db
        .query("collections")
        .withIndex("by_slug", (q) =>
          q.eq("workspaceId", workspaceId).eq("slug", collectionSlug),
        )
        .first();
      if (!col) return [];
      entries = await ctx.db
        .query("entries")
        .withIndex("by_collection", (q) =>
          q.eq("workspaceId", workspaceId).eq("collectionId", col._id),
        )
        .collect();
    } else {
      entries = await ctx.db
        .query("entries")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
    }

    if (status) entries = entries.filter((e) => e.status === status);
    if (tag) entries = entries.filter((e) => e.tags?.includes(tag));
    return entries;
  },
});

export const listEntriesByLabel = internalQuery({
  args: { workspaceId: v.id("workspaces"), labelSlug: v.string() },
  handler: async (ctx, { workspaceId, labelSlug }) => {
    const label = await ctx.db
      .query("labels")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", labelSlug),
      )
      .first();
    if (!label) return [];

    const links = await ctx.db
      .query("entryLabels")
      .withIndex("by_label", (q) => q.eq("labelId", label._id))
      .collect();

    const entries = [];
    for (const link of links) {
      const entry = await ctx.db.get(link.entryId);
      if (entry && entry.workspaceId === workspaceId) entries.push(entry);
    }
    return entries;
  },
});

export const getEntry = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    entryId: v.optional(v.string()),
    id: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, entryId, id }) => {
    let entry;

    if (id) {
      try {
        entry = await ctx.db.get(id as Id<"entries">);
      } catch {
        return null;
      }
      if (entry && entry.workspaceId !== workspaceId) return null;
    } else if (entryId) {
      entry = await ctx.db
        .query("entries")
        .withIndex("by_entryId", (q) =>
          q.eq("workspaceId", workspaceId).eq("entryId", entryId),
        )
        .first();
    }

    if (!entry) return null;

    // Enrich: labels
    const labelLinks = await ctx.db
      .query("entryLabels")
      .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
      .collect();
    const labels = [];
    for (const link of labelLinks) {
      const label = await ctx.db.get(link.labelId);
      if (label) labels.push({ slug: label.slug, name: label.name });
    }

    // Enrich: relations
    const outgoing = await ctx.db
      .query("entryRelations")
      .withIndex("by_from", (q) => q.eq("fromId", entry._id))
      .collect();
    const incoming = await ctx.db
      .query("entryRelations")
      .withIndex("by_to", (q) => q.eq("toId", entry._id))
      .collect();

    const relations = [];
    for (const r of outgoing) {
      const other = await ctx.db.get(r.toId);
      relations.push({
        direction: "outgoing",
        type: r.type,
        fromId: r.fromId,
        toId: r.toId,
        otherEntryId: other?.entryId,
        otherName: other?.name,
      });
    }
    for (const r of incoming) {
      const other = await ctx.db.get(r.fromId);
      relations.push({
        direction: "incoming",
        type: r.type,
        fromId: r.fromId,
        toId: r.toId,
        otherEntryId: other?.entryId,
        otherName: other?.name,
      });
    }

    // Enrich: history (last 20)
    const history = await ctx.db
      .query("entryHistory")
      .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
      .collect();

    return {
      ...entry,
      labels,
      relations,
      history: history.slice(-20),
    };
  },
});

export const searchEntries = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    collectionSlug: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { workspaceId, query: searchQuery, collectionSlug, status },
  ) => {
    let collectionId: Id<"collections"> | undefined;
    if (collectionSlug) {
      const col = await ctx.db
        .query("collections")
        .withIndex("by_slug", (q) =>
          q.eq("workspaceId", workspaceId).eq("slug", collectionSlug),
        )
        .first();
      if (!col) return [];
      collectionId = col._id;
    }

    const results = await ctx.db
      .query("entries")
      .withSearchIndex("search_text", (q) => {
        let search = q
          .search("searchText", searchQuery)
          .eq("workspaceId", workspaceId);
        if (collectionId) search = search.eq("collectionId", collectionId);
        if (status) search = search.eq("status", status);
        return search;
      })
      .take(50);

    return results;
  },
});

export const listEntryHistory = internalQuery({
  args: { workspaceId: v.id("workspaces"), entryId: v.string() },
  handler: async (ctx, { workspaceId, entryId }) => {
    const entry = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", entryId),
      )
      .first();
    if (!entry) return [];

    return await ctx.db
      .query("entryHistory")
      .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
      .collect();
  },
});

export const listEntryRelations = internalQuery({
  args: { workspaceId: v.id("workspaces"), entryId: v.string() },
  handler: async (ctx, { workspaceId, entryId }) => {
    const entry = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", entryId),
      )
      .first();
    if (!entry) return [];

    const outgoing = await ctx.db
      .query("entryRelations")
      .withIndex("by_from", (q) => q.eq("fromId", entry._id))
      .collect();
    const incoming = await ctx.db
      .query("entryRelations")
      .withIndex("by_to", (q) => q.eq("toId", entry._id))
      .collect();

    return [...outgoing, ...incoming];
  },
});

export const listLabels = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("labels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const gatherContext = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    entryId: v.string(),
    maxHops: v.number(),
  },
  handler: async (ctx, { workspaceId, entryId, maxHops }) => {
    const root = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", entryId),
      )
      .first();
    if (!root) return null;

    // Pre-cache collection names
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const collNameById = new Map<string, string>();
    for (const c of collections) collNameById.set(c._id, c.name);

    const visited = new Set<string>([root._id]);
    const queue: Array<{ id: Id<"entries">; hop: number }> = [
      { id: root._id, hop: 0 },
    ];
    const related: Array<{
      entryId: string | undefined;
      name: string;
      collectionName: string;
      collectionId: Id<"collections">;
      relationType: string;
      relationDirection: string;
      hop: number;
    }> = [];

    while (queue.length > 0) {
      const { id, hop } = queue.shift()!;
      if (hop >= maxHops) continue;

      const outgoing = await ctx.db
        .query("entryRelations")
        .withIndex("by_from", (q) => q.eq("fromId", id))
        .collect();
      const incoming = await ctx.db
        .query("entryRelations")
        .withIndex("by_to", (q) => q.eq("toId", id))
        .collect();

      const edges = [
        ...outgoing.map((r) => ({
          otherId: r.toId,
          type: r.type,
          direction: "outgoing" as const,
        })),
        ...incoming.map((r) => ({
          otherId: r.fromId,
          type: r.type,
          direction: "incoming" as const,
        })),
      ];

      for (const edge of edges) {
        if (visited.has(edge.otherId)) continue;
        visited.add(edge.otherId);

        const other = await ctx.db.get(edge.otherId);
        if (!other) continue;

        related.push({
          entryId: other.entryId,
          name: other.name,
          collectionName: collNameById.get(other.collectionId) ?? "Unknown",
          collectionId: other.collectionId,
          relationType: edge.type,
          relationDirection: edge.direction,
          hop: hop + 1,
        });

        queue.push({ id: edge.otherId, hop: hop + 1 });
      }
    }

    return {
      root: { entryId: root.entryId, name: root.name },
      related,
      totalRelations: related.length,
      hopsTraversed: maxHops,
    };
  },
});

const COLLECTION_PRIORITY: Record<string, number> = {
  "business-rules": 1,
  glossary: 2,
  decisions: 3,
  features: 4,
  standards: 5,
  principles: 6,
  tensions: 7,
  strategy: 8,
  "tracking-events": 9,
};

function extractDescriptionPreview(data: any, maxLen: number): string {
  if (!data || typeof data !== "object") return "";
  const raw = data.description ?? data.canonical ?? data.detail ?? data.rule ?? "";
  if (typeof raw !== "string" || !raw) return "";
  return raw.length > maxLen ? raw.substring(0, maxLen) + "..." : raw;
}

export const loadContextForTask = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    taskDescription: v.string(),
    maxResults: v.optional(v.number()),
    maxHops: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, taskDescription, maxResults, maxHops }) => {
    const limit = maxResults ?? 10;
    const hops = maxHops ?? 2;

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const collById = new Map<string, { name: string; slug: string }>();
    for (const c of collections) collById.set(c._id, { name: c.name, slug: c.slug });

    // Phase 1: full-text search for direct hits
    const searchHits = await ctx.db
      .query("entries")
      .withSearchIndex("search_text", (q) =>
        q.search("searchText", taskDescription).eq("workspaceId", workspaceId),
      )
      .take(3);

    type ContextEntry = {
      _id: string;
      entryId: string | undefined;
      name: string;
      collectionSlug: string;
      collectionName: string;
      descriptionPreview: string;
      codePaths: string[];
      hop: number;
      relationType?: string;
    };

    const seen = new Set<string>();
    const entries: ContextEntry[] = [];

    for (const hit of searchHits) {
      seen.add(hit._id);
      const col = collById.get(hit.collectionId) ?? { name: "Unknown", slug: "unknown" };
      const codePaths = Array.isArray(hit.data?.code_paths) ? hit.data.code_paths : [];
      entries.push({
        _id: hit._id,
        entryId: hit.entryId,
        name: hit.name,
        collectionSlug: col.slug,
        collectionName: col.name,
        descriptionPreview: extractDescriptionPreview(hit.data, 150),
        codePaths,
        hop: 0,
      });
    }

    // Phase 2: BFS graph traversal from each direct hit
    for (const root of searchHits) {
      const queue: Array<{ id: Id<"entries">; hop: number }> = [
        { id: root._id, hop: 0 },
      ];
      const visited = new Set<string>([root._id]);

      while (queue.length > 0) {
        const { id, hop } = queue.shift()!;
        if (hop >= hops) continue;

        const outgoing = await ctx.db
          .query("entryRelations")
          .withIndex("by_from", (q) => q.eq("fromId", id))
          .collect();
        const incoming = await ctx.db
          .query("entryRelations")
          .withIndex("by_to", (q) => q.eq("toId", id))
          .collect();

        const edges = [
          ...outgoing.map((r) => ({ otherId: r.toId, type: r.type })),
          ...incoming.map((r) => ({ otherId: r.fromId, type: r.type })),
        ];

        for (const edge of edges) {
          if (visited.has(edge.otherId)) continue;
          visited.add(edge.otherId);

          if (seen.has(edge.otherId)) continue;
          seen.add(edge.otherId);

          const other = await ctx.db.get(edge.otherId);
          if (!other || other.workspaceId !== workspaceId) continue;

          const col = collById.get(other.collectionId) ?? { name: "Unknown", slug: "unknown" };
          const codePaths = Array.isArray(other.data?.code_paths) ? other.data.code_paths : [];
          entries.push({
            _id: other._id,
            entryId: other.entryId,
            name: other.name,
            collectionSlug: col.slug,
            collectionName: col.name,
            descriptionPreview: extractDescriptionPreview(other.data, 150),
            codePaths,
            hop: hop + 1,
            relationType: edge.type,
          });

          queue.push({ id: edge.otherId, hop: hop + 1 });
        }
      }
    }

    // Phase 3: rank by hop distance, then collection priority
    entries.sort((a, b) => {
      if (a.hop !== b.hop) return a.hop - b.hop;
      const aPri = COLLECTION_PRIORITY[a.collectionSlug] ?? 99;
      const bPri = COLLECTION_PRIORITY[b.collectionSlug] ?? 99;
      return aPri - bPri;
    });

    const capped = entries.slice(0, limit);

    // Phase 4: compute confidence
    const directHits = searchHits.length;
    let confidence: "high" | "medium" | "low" | "none";
    if (directHits >= 3) confidence = "high";
    else if (directHits >= 1) confidence = "medium";
    else if (entries.length > 0) confidence = "low";
    else confidence = "none";

    // Strip internal _id from response
    const clean = capped.map(({ _id, ...rest }) => rest);

    return {
      entries: clean,
      confidence,
      searchTerms: taskDescription,
      totalFound: entries.length,
    };
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const createEntry = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    collectionSlug: v.string(),
    entryId: v.optional(v.string()),
    name: v.string(),
    status: v.string(),
    data: v.any(),
    order: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { workspaceId, collectionSlug, entryId, name, status, data, order, createdBy },
  ) => {
    const col = await ctx.db
      .query("collections")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", collectionSlug),
      )
      .first();
    if (!col) throw new Error(`Collection "${collectionSlug}" not found`);

    if (entryId) {
      const existing = await ctx.db
        .query("entries")
        .withIndex("by_entryId", (q) =>
          q.eq("workspaceId", workspaceId).eq("entryId", entryId),
        )
        .first();
      if (existing)
        throw new Error(
          `Duplicate entry: "${entryId}" already exists in this workspace`,
        );
    }

    const searchText = buildSearchText(name, data);

    const id = await ctx.db.insert("entries", {
      workspaceId,
      collectionId: col._id,
      entryId,
      name,
      status,
      data: data ?? {},
      tags: [],
      order,
      createdBy,
      searchText,
    });

    await ctx.db.insert("entryHistory", {
      workspaceId,
      entryId: id,
      event: "created",
      changedBy: createdBy ?? "mcp",
      timestamp: Date.now(),
    });

    return id;
  },
});

export const updateEntry = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    entryId: v.string(),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    data: v.optional(v.any()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, entryId, name, status, data, order }) => {
    const entry = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", entryId),
      )
      .first();
    if (!entry) throw new Error(`Entry "${entryId}" not found`);

    // SOS-020: tension status is process-controlled
    const col = await ctx.db.get(entry.collectionId);
    if (col?.slug === "tensions" && status && status !== entry.status) {
      throw new Error(
        "SOS-020: Tension status cannot be changed via MCP. Process decides.",
      );
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (order !== undefined) updates.order = order;
    if (data !== undefined) {
      updates.data = { ...(entry.data as Record<string, unknown>), ...data };
    }

    const finalName = updates.name ?? entry.name;
    const finalData = updates.data ?? entry.data;
    updates.searchText = buildSearchText(finalName, finalData);

    await ctx.db.patch(entry._id, updates);

    await ctx.db.insert("entryHistory", {
      workspaceId,
      entryId: entry._id,
      event: status && status !== entry.status
        ? `status changed to ${status}`
        : "updated",
      changedBy: "mcp",
      changes: data,
      timestamp: Date.now(),
    });

    return entry._id;
  },
});

export const createEntryRelation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    fromEntryId: v.string(),
    toEntryId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, { workspaceId, fromEntryId, toEntryId, type }) => {
    const from = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", fromEntryId),
      )
      .first();
    if (!from) throw new Error(`Entry "${fromEntryId}" not found`);

    const to = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", toEntryId),
      )
      .first();
    if (!to) throw new Error(`Entry "${toEntryId}" not found`);

    await ctx.db.insert("entryRelations", {
      workspaceId,
      fromId: from._id,
      toId: to._id,
      type,
    });
  },
});

export const createLabel = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    slug: v.string(),
    name: v.string(),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    parentId: v.optional(v.id("labels")),
    isGroup: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { workspaceId, slug, name, color, description, parentId, isGroup, order },
  ) => {
    const existing = await ctx.db
      .query("labels")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", slug),
      )
      .first();
    if (existing)
      throw new Error(`Label "${slug}" already exists in this workspace`);

    await ctx.db.insert("labels", {
      workspaceId,
      slug,
      name,
      color,
      description,
      parentId,
      isGroup,
      order,
    });
  },
});

export const updateLabel = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    slug: v.string(),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    isGroup: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { workspaceId, slug, name, color, description, isGroup, order },
  ) => {
    const label = await ctx.db
      .query("labels")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", slug),
      )
      .first();
    if (!label) throw new Error(`Label "${slug}" not found`);

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description;
    if (isGroup !== undefined) updates.isGroup = isGroup;
    if (order !== undefined) updates.order = order;

    await ctx.db.patch(label._id, updates);
  },
});

export const deleteLabel = internalMutation({
  args: { workspaceId: v.id("workspaces"), slug: v.string() },
  handler: async (ctx, { workspaceId, slug }) => {
    const label = await ctx.db
      .query("labels")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", slug),
      )
      .first();
    if (!label) throw new Error(`Label "${slug}" not found`);

    // Remove all entry-label associations
    const links = await ctx.db
      .query("entryLabels")
      .withIndex("by_label", (q) => q.eq("labelId", label._id))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    await ctx.db.delete(label._id);
  },
});

export const applyLabel = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    entryId: v.string(),
    labelSlug: v.string(),
  },
  handler: async (ctx, { workspaceId, entryId: humanId, labelSlug }) => {
    const entry = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", humanId),
      )
      .first();
    if (!entry) throw new Error(`Entry "${humanId}" not found`);

    const label = await ctx.db
      .query("labels")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", labelSlug),
      )
      .first();
    if (!label) throw new Error(`Label "${labelSlug}" not found`);

    // Idempotent: skip if already applied
    const existing = await ctx.db
      .query("entryLabels")
      .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
      .collect();
    if (existing.some((el) => el.labelId === label._id)) return;

    await ctx.db.insert("entryLabels", {
      entryId: entry._id,
      labelId: label._id,
    });
  },
});

export const removeLabel = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    entryId: v.string(),
    labelSlug: v.string(),
  },
  handler: async (ctx, { workspaceId, entryId: humanId, labelSlug }) => {
    const entry = await ctx.db
      .query("entries")
      .withIndex("by_entryId", (q) =>
        q.eq("workspaceId", workspaceId).eq("entryId", humanId),
      )
      .first();
    if (!entry) throw new Error(`Entry "${humanId}" not found`);

    const label = await ctx.db
      .query("labels")
      .withIndex("by_slug", (q) =>
        q.eq("workspaceId", workspaceId).eq("slug", labelSlug),
      )
      .first();
    if (!label) throw new Error(`Label "${labelSlug}" not found`);

    const links = await ctx.db
      .query("entryLabels")
      .withIndex("by_entry", (q) => q.eq("entryId", entry._id))
      .collect();
    const target = links.find((el) => el.labelId === label._id);
    if (target) await ctx.db.delete(target._id);
  },
});
