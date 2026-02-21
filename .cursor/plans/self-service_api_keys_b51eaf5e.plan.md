---
name: Self-Service API Keys
overview: Build self-service API key provisioning for ProductBrain Cloud so that any developer can connect Cursor or Claude Desktop to their knowledge base with a single CLI command and one env var.
todos:
  - id: backend-schema
    content: Add users, apiKeys, sessions tables to convex/schema.ts with proper indexes
    status: completed
  - id: backend-auth
    content: Implement GitHub OAuth flow in convex/auth.ts (login page, callback handler, session tokens)
    status: completed
  - id: backend-provision
    content: Implement provisioning endpoint in convex/provision.ts (create workspace, generate API key, hash + store)
    status: completed
  - id: backend-http
    content: "Update convex/http.ts: add auth routes, change MCP handler from env-var key to per-user key lookup"
    status: completed
  - id: mcp-single-key
    content: Update src/client.ts and src/index.ts to support PRODUCTBRAIN_API_KEY single-key cloud mode
    status: completed
  - id: cli-setup
    content: "Build src/cli/setup.ts: browser auth flow, localhost callback server, provision call, config writer"
    status: completed
  - id: cli-config-writer
    content: Implement multi-client config detection and writing (Cursor .cursor/mcp.json, Claude Desktop config)
    status: completed
  - id: package-rename
    content: Rename npm package from synergyos-mcp to productbrain, add setup subcommand to bin entry
    status: completed
  - id: test-e2e
    content: "End-to-end test: npx productbrain setup on fresh machine, verify Cursor and Claude Desktop connectivity"
    status: completed
isProject: false
---

# Pitch: Self-Service API Key Provisioning

**Shaped by:** Randy + AI shaping partner
**Date:** February 20, 2026

---

## Problem

A developer discovers ProductBrain on GitHub and wants to connect it to Claude Desktop. Today, they would need to:

1. Clone the repo
2. Set up their own Convex deployment from scratch
3. Generate a random 64-character hex key
4. Set it as a Convex environment variable via the dashboard CLI
5. Seed a workspace to get a slug
6. Configure three separate env vars in their MCP client config
7. Restart their AI assistant

This is a cliff between Acquisition and Activation. The lean canvas says `npx productbrain` is the channel, but right now there is no bridge between installing the package and actually using it. The auth model is deployment-scoped (a single shared API key stored as a Convex env var), not user-scoped. There is no concept of user accounts, no self-service key provisioning, and no authority that issues credentials.

The result: ProductBrain Cloud has zero path to its first user.

---

## Appetite

**Time budget:** Big Batch -- 6 weeks
**Team:** 1 full-stack builder

This is worth 6 weeks because it is the critical path to having any users on ProductBrain Cloud. Without self-service provisioning, every user requires manual setup. The interactive demo, the landing page, the knowledge graph -- none of it matters if people cannot connect.

If it had to be smaller (2 weeks): ship only the backend API key tables and the single-key MCP client mode (`pb_sk_` prefix). No CLI, no auth flow -- just the infrastructure so the portal can be built next.

If we had more time: add a web dashboard for key management, team invitations, workspace switching, and usage analytics.

---

## Solution

### Core Elements

- **Per-user API keys in the Convex backend** -- New `users` and `apiKeys` tables in [convex/schema.ts](convex/schema.ts). API key format: `pb_sk_<random>`. Keys are hashed for storage, with a short prefix stored in cleartext for lookup. Each key is scoped to a user + workspace. The HTTP action in [convex/http.ts](convex/http.ts) changes from checking `process.env.MCP_API_KEY` (single shared key) to looking up the key prefix in the `apiKeys` table and resolving the workspace automatically. Self-hosted mode (the old 3-var config) continues to work as a fallback when `process.env.MCP_API_KEY` is set.
- **Browser-based auth via GitHub OAuth** -- The CLI opens a browser to a minimal auth page served by a Convex HTTP Action at `https://<deployment>.convex.site/auth/login`. The page has one button: "Sign in with GitHub." After auth, it redirects to `http://localhost:<port>` where the CLI is listening. The CLI receives a session token and proceeds. The auth page is a single inline HTML string -- one button, a loading spinner, brand styling. Not a portal.
- `**npx productbrain setup` CLI command** -- The guided onboarding flow that does everything: opens browser for auth, creates a default workspace (named after GitHub username), generates an API key, detects installed MCP clients (Cursor, Claude Desktop), and writes the config file directly. Falls back to printing a ready-to-paste JSON snippet. The CLI is added to the existing binary entry point in [package.json](package.json), which is renamed from `synergyos-mcp` to `productbrain` (matching brand decision DEC-5xht1j).
- **Single-key MCP client mode** -- [src/client.ts](src/client.ts) detects `PRODUCTBRAIN_API_KEY`. If the key starts with `pb_sk_`, the client uses the hardcoded ProductBrain Cloud URL and skips `CONVEX_SITE_URL` and `WORKSPACE_SLUG` entirely. The backend resolves the workspace from the key. The MCP config for any client collapses to one env var.
- **Multi-client config writer** -- The CLI knows the config format and file location for each supported MCP client. Cursor: `.cursor/mcp.json` in the project directory. Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS. The CLI detects which clients are installed and offers to write config to each. For unknown clients or unsupported OS, it prints the snippet.

### The setup flow (breadboard)

```
Place: Terminal
  Affordance: "npx productbrain setup"
  Connection: opens browser -->

Place: Browser (minimal auth page)
  Affordance: "Sign in with GitHub" button
  Connection: GitHub OAuth --> redirect to localhost -->

Place: Terminal (resumed)
  Affordance: "Which AI assistant?" selector (Cursor / Claude Desktop / Both / Show config)
  Connection: writes config file(s) -->

Place: Terminal (done)
  Affordance: "Done! Restart [client] and ask: Use the health tool"
```

---

## Rabbit Holes

### Auth provider complexity

**Risk:** Integrating a full auth provider (Clerk, Auth0) adds dependency, cost, and configuration weeks.
**Patch:** Use GitHub OAuth directly. One provider, no middleware, no third-party dashboard. The audience is developers -- they all have GitHub. Store GitHub user ID and email in the `users` table. More providers can be added later without schema changes.

### The package name

**Risk:** The npm package is `synergyos-mcp` but the brand is `productbrain`. The CLI command should be `npx productbrain setup`.
**Patch:** Rename the package to `productbrain` as part of this bet. The `setup` subcommand is added to the existing binary entry point. Publish `synergyos-mcp` as a deprecated alias that re-exports `productbrain`.

### Multiple workspaces per user

**Risk:** What if a user runs setup twice? What if they need multiple workspaces?
**Patch:** First run creates a default workspace named after the GitHub username. Subsequent runs detect the existing account and just generate a new API key for the same workspace. Multi-workspace is supported by the backend (`workspaces` table already exists) but the CLI only manages the default workspace. Power users use the 3-var config for additional workspaces.

### Serving the auth page from Convex

**Risk:** Convex HTTP Actions can serve HTML, but there is no templating or static hosting.
**Patch:** The auth page is a single inline HTML string returned from an HTTP Action. It renders "Sign in with GitHub," handles the OAuth redirect, and returns the token. Under 100 lines. Dark theme matching the brand. No framework, no build step.

### Claude Desktop config format and paths

**Risk:** Config format varies by client and OS. Auto-writing could break existing configs.
**Patch:** Research exact format and paths before building. The CLI reads the existing config, merges the new server entry (never overwrites), and writes back. If the file does not exist, create it. If the format is unfamiliar, fall back to printing the snippet.

### Localhost callback security

**Risk:** Another process on the machine could intercept the OAuth callback.
**Patch:** Random high port + one-time nonce in the callback URL. CLI validates the nonce before accepting the token. Standard pattern (same as `gh auth login`, `npx convex login`).

---

## No-Gos

- **NOT building:** A web dashboard or portal. All key management happens via CLI.
- **NOT building:** Team invitations, role-based access, or workspace sharing.
- **NOT building:** Auth providers beyond GitHub OAuth. No Google, no email/password, no SSO.
- **NOT building:** Key rotation automation or revocation UI. Generate new keys via CLI; old keys work until manually deleted.
- **NOT building:** Billing, usage limits, or metering. All cloud usage is free-tier.
- **NOT building:** Changes to the self-hosted flow. The 3-var config works unchanged.
- **NOT renaming:** The Convex backend deployment or database. Only the npm package name changes.

---

## Implementation Files

### Backend (Convex)

- **Edit:** [convex/schema.ts](convex/schema.ts) -- add `users`, `apiKeys`, `sessions` tables
- **Edit:** [convex/http.ts](convex/http.ts) -- add auth routes (`/auth/login`, `/auth/callback`, `/auth/github-callback`, `/api/provision`), update MCP handler to validate per-user keys
- **New:** `convex/auth.ts` -- GitHub OAuth flow, session management, OTP verification
- **New:** `convex/provision.ts` -- workspace creation, API key generation + hashing

### MCP Server

- **Edit:** [src/client.ts](src/client.ts) -- detect `PRODUCTBRAIN_API_KEY`, auto-resolve cloud URL
- **Edit:** [src/index.ts](src/index.ts) -- support single-key mode, resolve workspace from key response
- **New:** `src/cli/setup.ts` -- the `npx productbrain setup` flow (auth, provision, config writer)
- **Edit:** [package.json](package.json) -- rename to `productbrain`, add `setup` subcommand to bin

### Seed / Migration

- **Edit:** [convex/seed.ts](convex/seed.ts) -- support user-scoped workspace creation

