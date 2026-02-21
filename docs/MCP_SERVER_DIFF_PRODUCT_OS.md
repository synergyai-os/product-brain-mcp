# MCP Server Diff: Product-OS vs product-os-mcp

Comparison of the two MCP server setups for agents working across both repos.

---

## High-Level Summary

| Aspect | Product-OS (`mcp-server/`) | product-os-mcp (`src/`) |
|--------|----------------------------|--------------------------|
| **Role** | MCP server inside the full Product-OS platform | Standalone MCP product (ProductBrain / SynergyOS) |
| **Convex backend** | Product-OS's own `convex/` (mcpKnowledge, gitchain, chainwork) | product-os-mcp's `convex/` (kb.ts, auth, provision) |
| **Deployment** | Likely a different Convex project | `earnest-sheep-635.convex.site` |
| **Package name** | `product-os-mcp` (private) | `productbrain` (published) |
| **Server name** | `product-os` | `synergyos` |

**Important:** These are **two different systems**. Product-OS's mcp-server talks to Product-OS's Convex. product-os-mcp talks to its own Convex. They do **not** share the same backend.

---

## File Structure Comparison

### Product-OS mcp-server
```
mcp-server/
├── package.json          # "product-os-mcp" v0.1.0, private
├── src/
│   ├── index.ts          # Entry, loads .env from ../../.env.mcp
│   ├── client.ts         # HTTP client (no cloud mode)
│   ├── analytics.ts      # PostHog (always logs to stderr)
│   ├── tools/
│   │   ├── health.ts
│   │   ├── verify.ts
│   │   ├── knowledge.ts
│   │   ├── smart-capture.ts
│   │   ├── architecture.ts   ← Product-OS only
│   │   ├── workflows.ts      ← Product-OS only
│   │   └── gitchain.ts       ← Product-OS only
│   ├── prompts/index.ts
│   ├── workflows/definitions.ts  ← Product-OS only
│   └── resources/index.ts
└── scripts/test-smart-capture.ts
```

### product-os-mcp
```
src/
├── index.ts              # Entry, loads .env.mcp from cwd
├── client.ts             # HTTP client + cloud mode (PRODUCTBRAIN_API_KEY)
├── analytics.ts          # PostHog (MCP_DEBUG=1 to log)
├── tools/
│   ├── health.ts
│   ├── verify.ts
│   ├── knowledge.ts      # + load-context-for-task, review-rules
│   ├── smart-capture.ts
│   └── labels.ts
├── cli/                  ← product-os-mcp only (setup, config-writer)
├── prompts/index.ts
└── resources/index.ts
```

---

## Tool Inventory

### Shared tools (both have)
| Tool | Product-OS | product-os-mcp |
|------|------------|-----------------|
| list-collections | ✓ | ✓ |
| list-entries | ✓ | ✓ |
| kb-search | ✓ | ✓ |
| get-entry | ✓ | ✓ |
| create-entry | ✓ | ✓ |
| update-entry | ✓ | ✓ |
| suggest-links | ✓ | ✓ |
| relate-entries | ✓ | ✓ |
| quality-check | ✓ | ✓ |
| quick-capture | ✓ | ✓ |
| smart-capture | ✓ | ✓ |
| list-labels, create-label, etc. | ✓ | ✓ |
| health, mcp-audit | ✓ | ✓ |
| name-check (verify) | ✓ | ✓ |

### product-os-mcp only
| Tool | Notes |
|------|-------|
| **load-context-for-task** | Auto-load KB context for a task; search + graph traversal + ranking |
| **review-rules** | Surface business rules for compliance review |

### Product-OS only
| Tool | Backend dependency |
|------|--------------------|
| **architecture** (show-architecture, explore-layer, show-flow, seed-architecture, check-architecture) | `kb.createCollection`, `kb.updateCollection` |
| **workflows** (list-workflows, run-workflow) | `chainwork.*` routes, `workflows/definitions.ts` |
| **gitchain** (chain-create, chain-edit, chain-commit, etc. — 14 tools) | `gitchain.*` routes |

---

## Client Differences

### Product-OS client.ts
- **Config:** Always requires `CONVEX_SITE_URL`, `MCP_API_KEY`, `WORKSPACE_SLUG`
- **Auth:** Single shared key only (Bearer token must match `MCP_API_KEY` in Convex)
- **Audit:** Always logs every call to stderr
- **Workspace:** Resolved via `resolveWorkspace` with `WORKSPACE_SLUG`

### product-os-mcp client.ts
- **Config:** Two modes:
  - **Cloud:** `PRODUCTBRAIN_API_KEY=pb_sk_...` → auto-sets URL, workspace from key
  - **Self-hosted:** Same as Product-OS (3 vars)
- **Auth:** Per-user cloud keys (`pb_sk_`) or legacy shared `MCP_API_KEY`
- **Audit:** Only logs on error (or when `MCP_DEBUG=1`)
- **Workspace:** Cloud keys resolve workspace from key; self-hosted uses `WORKSPACE_SLUG`
- **Exports:** `bootstrapCloudMode()` for startup

---

## Env Loading

| | Product-OS | product-os-mcp |
|---|------------|-----------------|
| **Path** | `resolve(import.meta.dirname, "../../.env.mcp")` — fixed relative to mcp-server | `resolve(process.cwd(), ".env.mcp")` — cwd |
| **When** | Always tries to load | Only if `CONVEX_SITE_URL` and `PRODUCTBRAIN_API_KEY` are unset |

---

## Convex Backend Comparison

### Product-OS convex/
- **KB:** `mcpKnowledge.ts` — listCollections, getCollection, **createCollection**, **updateCollection**, listEntries, getEntry, createEntry, updateEntry, searchEntries, listEntryHistory, createEntryRelation, listEntryRelations, gatherContext, labels, etc.
- **Extra:** `gitchain/`, `chainwork/`, `admin/`, `entries.ts`, `commandCenter.ts`, `versioning.ts`, `people.ts`, `workspaces.ts`
- **HTTP:** Single shared key; routes for `kb.*`, `chainwork.*`, `gitchain.*`

### product-os-mcp convex/
- **KB:** `kb.ts` — same core KB ops, **no** createCollection/updateCollection
- **Extra:** `auth.ts` (GitHub OAuth), `provision.ts` (workspaces, API keys)
- **HTTP:** Per-user cloud keys + legacy shared key; routes for `kb.*` only; `/auth/*`, `/api/provision`

---

## Package & Scripts

| | Product-OS mcp-server | product-os-mcp |
|---|---------------------|----------------|
| **name** | product-os-mcp | productbrain |
| **version** | 0.1.0 | 0.2.0-beta.1 |
| **convex** | ^1.0.0 | ^1.32.0 |
| **bin** | (none) | productbrain, synergyos-mcp |
| **scripts** | start, test, inspect, typecheck | build, start, dev, typecheck, publish:beta |

---

## Migration Notes (Product-OS → product-os-mcp)

If moving from Product-OS's mcp-server to product-os-mcp:

1. **architecture, workflows, gitchain** — Not available in product-os-mcp. Those tools depend on Product-OS's Convex (createCollection, chainwork, gitchain). Either keep using Product-OS for those, or port the backend logic to product-os-mcp.

2. **load-context-for-task** — Only in product-os-mcp. Requires `kb.loadContextForTask` in Convex (and it must be registered in `convex/http.ts` QUERIES).

3. **Cloud mode** — product-os-mcp supports `PRODUCTBRAIN_API_KEY`; Product-OS does not.

4. **Env path** — product-os-mcp loads `.env.mcp` from `process.cwd()`, so ensure Cursor/MCP config uses the right working directory or sets env vars explicitly.

5. **Convex URL** — Product-OS and product-os-mcp use different Convex deployments. Point `CONVEX_SITE_URL` to the correct one for the MCP server you're running.
