---
name: ProductBrain Claude Desktop
overview: "Rebrand to ProductBrain, replace GitHub OAuth with Clerk, publish to npm, and validate the full loop: SynergyOS account -> API key -> Claude Desktop -> chat with knowledge base."
todos:
  - id: claude-test
    content: Test Claude Desktop MCP with manually generated key — verify basic connectivity works before building anything else
    status: completed
  - id: npm-publish
    content: Check npm name availability, publish productbrain to npm, verify npx -y productbrain works
    status: completed
  - id: rebrand
    content: "ProductBrain rebrand: server name, README, docs, all synergyos references. Rename GitHub repo."
    status: completed
  - id: env-url
    content: Make backend URL configurable via PRODUCTBRAIN_URL env var in src/client.ts (default to production)
    status: completed
  - id: clerk-auth
    content: Add clerkId to users schema, implement Clerk JWT validation in convex/auth.ts, update convex/http.ts provision endpoint
    status: completed
  - id: settings-page
    content: Build API key settings page in SynergyOS web app (Product-OS repo) with generate/delete/copy-config
    status: completed
  - id: e2e-validate
    content: "End-to-end: SynergyOS settings -> API key -> Claude Desktop config -> chat with knowledge base"
    status: completed
  - id: polish-docs
    content: Polish error handling, update README with complete setup flow, verify dev-to-prod switching
    status: completed
isProject: false
---

# Pitch: ProductBrain — Prove the Loop

**Shaped by:** Randy + AI shaping partner
**Date:** February 21, 2026
**Build target:** `product-os-mcp` repo (renamed to `productbrain`) + API key page in Product-OS repo

---

## Problem

Randy built a ProductBrain MCP server — a knowledge graph that gives AI assistants real-time access to glossary terms, business rules, decisions, and features. The Convex backend works. The MCP tools work. There are 20+ internal functions, a full-text search index, label hierarchies, and relation graphs.

But Randy has never chatted with his knowledge base through Claude Desktop.

The auth system uses direct GitHub OAuth — but ProductBrain should authenticate via SynergyOS accounts (Clerk). The npm package hasn't been published, so `npx productbrain` doesn't work outside the dev machine. The backend URL is hardcoded to a single Convex deployment, so there's no way to point at a dev server. The MCP server still identifies itself as `"synergyos"` — a name that doesn't match the product. The README documents a manual 7-step setup process that no one has ever completed.

**ProductBrain is the MCP that connects AI assistants to SynergyOS** — the operating system for remote product-driven teams (10-50 people) working async. Until a user can go from their SynergyOS account to chatting with their knowledge base in Claude Desktop, the product isn't validated. Everything else — the landing page, the workstream briefs, the plugin marketplace on the lean canvas — depends on this loop working.

---

## Appetite

**Time budget:** Big Batch — 6 weeks
**Team:** 1 full-stack builder

This is worth a full cycle because it is the trust test for the entire product. If the loop doesn't close — SynergyOS account, API key, Claude Desktop, chat — then nothing built on top of it matters. The workstream-briefs bet, the plugin marketplace, cloud conversion — all blocked behind "does ProductBrain actually work in a real AI assistant?"

If it had to be smaller (2 weeks): skip the SynergyOS settings page and Clerk integration. Just publish to npm, generate a key manually via Convex dashboard, configure Claude Desktop, and verify the tools work. Branding rename only.

If we had more time: add the `npx productbrain setup` CLI flow that opens SynergyOS login in the browser and auto-writes Claude Desktop config. Add workspace switching. Add a "test my connection" page in SynergyOS.

---

## Solution

### Core Element 1: ProductBrain Rebrand

Rename everything to establish the ProductBrain identity:

- **GitHub repo:** `product-os-mcp` -> `productbrain` (GitHub auto-redirects old URLs)
- **MCP server name:** `"synergyos"` -> `"productbrain"` in [src/index.ts](src/index.ts)
- **npm package:** already `productbrain` in [package.json](package.json) — publish it
- **README:** rewrite for the new identity and setup flow
- **Folder references:** update any path references, CI, MCP configs
- **Legacy alias:** keep `synergyos-mcp` binary alias for backward compatibility

The server name matters because it's what appears in Cursor's MCP panel and Claude Desktop's tool list. Users should see "productbrain" not "synergyos."

### Core Element 2: Clerk JWT Auth (Replace GitHub OAuth)

Replace the GitHub OAuth flow in [convex/auth.ts](convex/auth.ts) with Clerk JWT validation. The architecture:

- SynergyOS.ai authenticates users with Clerk (already working on localhost)
- When a user hits the API key settings page in SynergyOS, they're already authenticated
- SynergyOS calls ProductBrain's `/api/provision` endpoint with the Clerk session JWT in the Authorization header
- The Convex HTTP Action in [convex/http.ts](convex/http.ts) validates the JWT against Clerk's JWKS endpoint (`https://<clerk-domain>/.well-known/jwks.json`)
- If valid, the Convex backend creates/looks up the user (by Clerk `sub` claim) and generates an API key

New env vars on the Convex deployment: `CLERK_ISSUER_URL` (the Clerk frontend API URL for JWKS validation). The `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` env vars are removed.

The `users` table already has the right shape — `githubId` field becomes `clerkId` (a rename, not a new column).

### Core Element 3: Configurable Backend URL

Replace the hardcoded `PRODUCTBRAIN_CLOUD_URL` constant in [src/client.ts](src/client.ts) with an env var:

```
PRODUCTBRAIN_URL=https://earnest-sheep-635.convex.site    # production (default)
PRODUCTBRAIN_URL=http://localhost:3210                      # dev
```

When `PRODUCTBRAIN_API_KEY` is set (cloud mode), the client uses `PRODUCTBRAIN_URL` instead of the hardcoded constant. If `PRODUCTBRAIN_URL` is not set, it falls back to the production URL. This means:

- Dev: set both `PRODUCTBRAIN_API_KEY` and `PRODUCTBRAIN_URL` in Claude Desktop config
- Production: set only `PRODUCTBRAIN_API_KEY` — URL defaults to production

Self-hosted mode (3-var config) is unchanged.

### Core Element 4: API Key Settings Page in SynergyOS

In the Product-OS repo (the SynergyOS web app), add a settings page behind Clerk auth:

- **Route:** `/settings/api-keys` (or equivalent in the SynergyOS app structure)
- **Generate button:** calls ProductBrain's `/api/provision` endpoint with Clerk JWT
- **Key display:** shows the full key exactly once (after generation), then only the `pb_sk_xxxx...` prefix
- **Delete button:** calls a new `/api/keys/revoke` endpoint
- **Copy button:** one-click copy to clipboard
- **Config snippet:** shows the ready-to-paste JSON for Claude Desktop and Cursor configs

This is a single page — not a dashboard. No analytics, no usage graphs, no team management. A list of keys with generate and delete.

### Core Element 5: Claude Desktop Integration

The validation target. The Claude Desktop MCP config lives at:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

The config entry:

```json
{
  "mcpServers": {
    "productbrain": {
      "command": "npx",
      "args": ["-y", "productbrain"],
      "env": {
        "PRODUCTBRAIN_API_KEY": "pb_sk_..."
      }
    }
  }
}
```

For dev environment, add `"PRODUCTBRAIN_URL": "http://localhost:3210"` to the env block.

Test matrix:

- Claude Desktop launches the MCP server via npx
- Server authenticates with the API key
- User asks "What is [glossary term]?" and gets an answer from the knowledge base
- User asks to create a new entry and it persists
- `health` tool confirms connectivity

### Core Element 6: npm Publish

Publish `productbrain` to npm so `npx -y productbrain` works (the `-y` flag is what Claude Desktop uses to auto-install). Verify:

- Package name `productbrain` is available on npm
- `npx -y productbrain` starts the MCP server
- `npx -y productbrain setup` runs the CLI (keep the setup flow for future use, even if not the primary path in this bet)
- The `dist/` folder includes all necessary files
- The `synergyos-mcp` binary alias still works

### The validated flow (breadboard)

```
Place: SynergyOS Settings Page (Clerk-authenticated)
  Affordance: "Generate API Key" button
  Connection: calls /api/provision with Clerk JWT -->

Place: SynergyOS Settings Page (key displayed)
  Affordance: Copy key button, Claude Desktop config snippet
  Connection: user copies config -->

Place: Claude Desktop config file
  Affordance: paste JSON config with PRODUCTBRAIN_API_KEY
  Connection: restart Claude Desktop -->

Place: Claude Desktop (chat)
  Affordance: "What is [term]?" / "Create a new glossary entry"
  Connection: MCP tools call Convex backend, return knowledge
```

---

## Rabbit Holes

### Clerk JWT validation in Convex

**Risk:** Convex HTTP Actions run in a serverless environment. Can they fetch external JWKS endpoints and validate JWTs?
**Patch:** Convex HTTP Actions support `fetch()` — they can call Clerk's JWKS endpoint. Use manual JWT validation (decode header, fetch matching key from JWKS, verify RS256 signature) rather than importing a heavy Clerk SDK. Cache the JWKS response for the lifetime of the action (they're stable for hours). Alternatively, use Clerk's session token verification via their Backend API (`POST /tokens/verify`) which is a simpler HTTP call.

### GitHub repo rename

**Risk:** Renaming `product-os-mcp` to `productbrain` on GitHub changes URLs. Existing clones, bookmarks, and MCP configs referencing the old URL break.
**Patch:** GitHub automatically redirects old URLs to the new name. Existing `git remote` continues to work. Update the `repository` field in `package.json`, update any absolute URLs in docs. Do the rename after publishing to npm (so the npm publish doesn't reference a repo that doesn't exist yet).

### Two-repo bet

**Risk:** The API key settings page lives in the Product-OS repo (SynergyOS web app). Work in two repos creates coordination overhead and context switching.
**Patch:** The settings page is a single route with minimal UI — a list of keys, a generate button, a delete button, a config snippet. Estimate: 1-2 days of work in the other repo. The bulk of the bet (4+ weeks) is in the ProductBrain repo. Build and test the ProductBrain side first using manually generated keys, then add the SynergyOS settings page last.

### npm package name availability

**Risk:** The name `productbrain` may already be taken on npm.
**Patch:** Check immediately. If taken, use `@synergyos/productbrain` as a scoped package. The `npx` command becomes `npx @synergyos/productbrain` — longer but unambiguous. The Claude Desktop config and docs adjust accordingly.

### Claude Desktop MCP reliability

**Risk:** Claude Desktop's MCP integration may have quirks — timeouts, env var handling, error recovery — that we haven't encountered in Cursor.
**Patch:** Test Claude Desktop first, before doing any auth or branding work. If basic MCP connectivity doesn't work in Claude Desktop, that's the highest-priority fix. Don't build auth infrastructure on top of a broken foundation.

### Schema migration (githubId to clerkId)

**Risk:** The `users` table has a `githubId` field and `by_githubId` index. Renaming to `clerkId` requires a schema change and potential data migration.
**Patch:** Add a new `clerkId` field alongside `githubId`. Index on `clerkId`. The GitHub OAuth users (if any exist from testing) keep their `githubId`. New Clerk users only have `clerkId`. The lookup logic checks `clerkId` first. No migration needed — the table is empty or near-empty.

---

## No-Gos

- **NOT building** the `npx productbrain setup` browser-auth flow with Clerk. The setup command stays as-is (or is simplified to a config helper). Key generation happens in SynergyOS settings, not via CLI.
- **NOT building** workspace switching in the MCP. One API key = one workspace. Power users use the 3-var self-hosted config for additional workspaces.
- **NOT deploying** SynergyOS.ai to production as part of this bet. Dev/localhost is the test environment. The architecture supports switching to production with one env var change.
- **NOT building** team invitations, sharing, or role-based access on API keys.
- **NOT building** usage analytics, billing, or metering.
- **NOT building** a key management dashboard. The settings page has generate, view prefix, delete, copy config snippet. That's it.
- **NOT renaming** the Convex deployment. The `earnest-sheep-635` project name stays. Only the GitHub repo and npm package name change.

---

## Implementation Sequence

1. **Week 1:** Test Claude Desktop MCP integration with a manually generated key. Verify `npx productbrain` works from a published package. If Claude Desktop has issues, fix them first.
2. **Week 1-2:** ProductBrain rebrand — server name, README, docs, all references. Rename GitHub repo.
3. **Week 2-3:** Configurable backend URL. Add `clerkId` to schema. Implement Clerk JWT validation in `convex/auth.ts` and `convex/http.ts`. Deploy.
4. **Week 3-4:** Build API key settings page in SynergyOS web app. Wire it to ProductBrain's `/api/provision` endpoint with Clerk JWT auth.
5. **Week 4-5:** End-to-end test: SynergyOS settings (localhost) -> generate key -> configure Claude Desktop -> chat with knowledge base. Fix whatever breaks.
6. **Week 5-6:** Polish, error handling, documentation. Verify the flow works when pointing at dev (localhost) and can switch to production later.

## Success Criteria

- Randy can open Claude Desktop, ask "What is [glossary term from ProductBrain]?" and get the correct answer
- The API key was generated from the SynergyOS settings page (Clerk-authenticated)
- The MCP server identifies as "productbrain" in Claude Desktop's tool list
- `npx -y productbrain` installs and runs from npm
- Switching from dev to production requires changing one env var (`PRODUCTBRAIN_URL`)
- The README documents the setup flow clearly enough that another developer could follow it

---

## Files Changed

### ProductBrain repo (product-os-mcp -> productbrain)

- **Edit:** [src/index.ts](src/index.ts) — server name `"synergyos"` -> `"productbrain"`
- **Edit:** [src/client.ts](src/client.ts) — configurable `PRODUCTBRAIN_URL` instead of hardcoded constant
- **Edit:** [convex/schema.ts](convex/schema.ts) — add `clerkId` field to `users` table
- **Rewrite:** [convex/auth.ts](convex/auth.ts) — Clerk JWT validation replacing GitHub OAuth
- **Edit:** [convex/http.ts](convex/http.ts) — update provision endpoint to accept Clerk JWTs, add `/api/keys/revoke` route
- **Edit:** [package.json](package.json) — update repository URL after rename
- **Rewrite:** `README.md` — new setup flow, ProductBrain identity
- **Keep:** [src/cli/setup.ts](src/cli/setup.ts) — keep for future use, not the primary flow in this bet

### Product-OS repo (SynergyOS web app)

- **New:** API key settings page (route, component, API calls to ProductBrain backend)

