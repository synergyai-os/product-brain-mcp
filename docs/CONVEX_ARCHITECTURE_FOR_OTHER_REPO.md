# Convex Architecture — For the Other Repo / Agent

**TL;DR:** Convex lives in **this repo** (`product-os-mcp`). The MCP server is a thin client that calls the Convex HTTP API. There is **one** Convex deployment; the old `mcp-server/` and `convex/` in the other repo are stale and should be ignored.

---

## Answer to "Where does Convex live?"

**Answer: A — Convex is in THIS repo (product-os-mcp).** The MCP product calls into it.

- **Schema, collections, mutations:** All live in `convex/` in **this** repo
- **Deployment:** One Convex project, deployed from this repo via `npx convex deploy`
- **Production URL:** `https://earnest-sheep-635.convex.site`

The other repo’s `mcp-server/src/` and `convex/` are **legacy/stale**. The canonical MCP product and backend are in **product-os-mcp**.

---

## How It Works (End-to-End)

### 1. Repo Layout (product-os-mcp)

```
product-os-mcp/
├── convex/           ← Convex backend (schema, functions, HTTP routes)
│   ├── schema.ts     ← Tables: workspaces, collections, entries, entryRelations, users, apiKeys, etc.
│   ├── kb.ts         ← KB queries/mutations (search, getEntry, gatherContext, loadContextForTask, etc.)
│   ├── auth.ts       ← GitHub OAuth, sessions
│   ├── provision.ts  ← Workspace creation, API key generation
│   └── http.ts       ← HTTP router: /api/mcp, /auth/*, /api/provision
├── src/              ← MCP server (stdio, tools, client)
│   ├── index.ts      ← MCP server entry, registers tools
│   ├── client.ts     ← HTTP client that calls Convex
│   └── tools/        ← MCP tools (kb-search, get-entry, load-context-for-task, etc.)
└── package.json      ← "productbrain" / "synergyos-mcp" binary
```

### 2. Request Flow

```
MCP Client (Cursor, Claude Desktop)
        │
        │ stdio
        ▼
┌─────────────────────────────────────┐
│  MCP Server (src/index.ts)          │
│  - Runs as stdio process            │
│  - Registers tools (kb-search, etc.) │
│  - Each tool calls src/client.ts    │
└─────────────────────────────────────┘
        │
        │ HTTP POST to CONVEX_SITE_URL/api/mcp
        │ Headers: Authorization: Bearer MCP_API_KEY
        │ Body: { fn: "kb.searchEntries", args: { workspaceId, ... } }
        ▼
┌─────────────────────────────────────┐
│  Convex HTTP Action (convex/http.ts)│
│  - Validates API key                │
│  - Resolves workspace (cloud key)   │
│  - Runs internal query/mutation     │
└─────────────────────────────────────┘
        │
        │ ctx.runQuery / ctx.runMutation
        ▼
┌─────────────────────────────────────┐
│  Convex Backend (convex/kb.ts, etc.)│
│  - Queries/mutations against DB     │
│  - Returns JSON                     │
└─────────────────────────────────────┘
```

The MCP server **never** talks to Convex directly (no `ConvexClient`). It only uses HTTP to `CONVEX_SITE_URL/api/mcp`.

### 3. Configuration Modes

**Cloud mode (single key):**

- `PRODUCTBRAIN_API_KEY=pb_sk_...`
- URL is hardcoded: `https://earnest-sheep-635.convex.site`
- Workspace is inferred from the key

**Self-hosted mode (three vars):**

- `CONVEX_SITE_URL` — e.g. `https://earnest-sheep-635.convex.site`
- `MCP_API_KEY` — must match `MCP_API_KEY` in Convex dashboard env vars
- `WORKSPACE_SLUG` — e.g. `product-os`

### 4. Convex Deployment

- **Project:** `earnest-sheep-635` (or similar; the `.convex.site` subdomain)
- **Deploy:** From this repo: `npx convex dev` or `npx convex deploy`
- **Env vars in Convex:** `MCP_API_KEY` must be set in the Convex dashboard for self-hosted auth

---

## For New Features (e.g. workstream-briefs)

**Where to build:** In **this repo** (`product-os-mcp`).

1. **Schema:** Add tables in `convex/schema.ts`
2. **Logic:** Add queries/mutations in `convex/kb.ts` (or a new file)
3. **HTTP:** Register in `convex/http.ts` in `QUERIES` or `MUTATIONS`
4. **MCP tools:** Add tool handlers in `src/tools/` that call `mcpQuery` / `mcpMutation`

The other repo’s `convex/` and `mcp-server/` are **not** the source of truth. Do not add workstream-briefs (or similar) there.

---

## Summary for the Other Agent

| Question | Answer |
|----------|--------|
| What Convex server do we use? | The one deployed from **product-os-mcp** at `https://earnest-sheep-635.convex.site` |
| Where is the schema? | `product-os-mcp/convex/schema.ts` |
| Where are KB functions? | `product-os-mcp/convex/kb.ts` |
| How does the MCP connect? | HTTP POST to `{CONVEX_SITE_URL}/api/mcp` with Bearer token |
| Does the other repo have its own Convex? | It may have an old `convex/` folder; that is **stale**. Use this repo. |
| Both repos share the same Convex? | No. Only **product-os-mcp** has the active Convex backend. The other repo should not maintain a separate Convex deployment for this product. |
