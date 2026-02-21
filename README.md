# ProductBrain

The single source of truth for product knowledge — glossary, business rules, tensions, decisions, labels, and relations — accessible as an MCP server in [Claude Desktop](https://claude.ai/download), [Cursor](https://cursor.com), and any MCP-compatible AI assistant.

ProductBrain connects your AI assistant to your team's knowledge base. Ask questions, capture decisions, and build a living knowledge graph without leaving your editor.

## Quick Start (Cloud)

### Option A: Guided setup (recommended)

```bash
npx @productbrain/mcp setup
```

This opens SynergyOS → Settings → API Keys, prompts you to paste your key, and writes the config for Cursor or Claude Desktop.

### Option B: Manual config

**1. Get your API key**

Go to **SynergyOS → Settings → API Keys** and click **Generate Key**. Copy the `pb_sk_...` key.

**2. Configure your AI assistant**

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "productbrain": {
      "command": "npx",
      "args": ["-y", "@productbrain/mcp"],
      "env": {
        "PRODUCTBRAIN_API_KEY": "pb_sk_your_key_here"
      }
    }
  }
}
```

**Cursor** — edit `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "productbrain": {
      "command": "npx",
      "args": ["-y", "@productbrain/mcp"],
      "env": {
        "PRODUCTBRAIN_API_KEY": "pb_sk_your_key_here"
      }
    }
  }
}
```

**3. Restart your assistant and verify**

Ask:

> "Use the health tool to check ProductBrain connectivity"

You should see your workspace ID, collection count, and latency.

## Self-Hosted Setup

If you're running your own Convex deployment, use the three-variable config:

```json
{
  "mcpServers": {
    "productbrain": {
      "command": "npx",
      "args": ["-y", "@productbrain/mcp"],
      "env": {
        "CONVEX_SITE_URL": "https://your-deployment.convex.site",
        "MCP_API_KEY": "your-shared-api-key",
        "WORKSPACE_SLUG": "your-workspace-slug"
      }
    }
  }
}
```

| Variable | Where to find it |
|----------|-----------------|
| `CONVEX_SITE_URL` | Convex dashboard → Settings → URL (use `*.convex.site`, not `*.convex.cloud`) |
| `MCP_API_KEY` | Must match the `MCP_API_KEY` env var in your Convex deployment |
| `WORKSPACE_SLUG` | Your workspace slug from the SynergyOS URL |

## Dev vs Production

Set `PRODUCTBRAIN_URL` to switch between environments:

```json
{
  "env": {
    "PRODUCTBRAIN_API_KEY": "pb_sk_your_key_here",
    "PRODUCTBRAIN_URL": "http://localhost:3210"
  }
}
```

Omit `PRODUCTBRAIN_URL` to default to production.

## What You Can Do

### Search and explore

- *"Search the glossary for 'tension'"*
- *"List all business rules in the Governance domain"*
- *"What is the canonical definition of 'supplier'?"*

### Capture knowledge

- *"Capture a tension: our MCP entry creation takes too many steps"*
- *"Draft a decision record for choosing Convex over Supabase"*
- *"Create a business rule about API key rotation"*

### Navigate the knowledge graph

- *"Gather full context around FEAT-001"*
- *"What entries are related to GT-019?"*
- *"Suggest links for this new tension"*

### Check quality

- *"Run a quality check on TEN-graph-db"*
- *"Review business rules for the AI & MCP Integration domain"*
- *"Verify the glossary against the codebase"*

## Tools (20+)

| Tool | What it does |
|------|-------------|
| `health` | Verify connectivity and get workspace stats |
| `kb-search` | Full-text search across all knowledge entries |
| `list-collections` | Browse all collection schemas |
| `list-entries` | Browse entries with optional filters |
| `get-entry` | Full record with data, labels, relations, history |
| `smart-capture` | One-call entry creation with auto-linking and quality scoring |
| `create-entry` | Create with full field control |
| `update-entry` | Partial update (merges with existing data) |
| `gather-context` | Multi-hop graph traversal around an entry |
| `suggest-links` | Discover potential connections |
| `relate-entries` | Create typed relations between entries |
| `find-related` | List direct relations for an entry |
| `quality-check` | Score an entry against collection-specific criteria |
| `review-rules` | Surface business rules for a domain |
| `verify` | Check knowledge entries against the actual codebase |
| `list-labels` | Browse workspace labels |
| `manage-labels` | Create, update, or delete labels |
| `label-entry` | Apply or remove labels from entries |
| `quick-capture` | Minimal-ceremony entry creation |
| `mcp-audit` | Session audit log with call statistics |

## Resources

| URI | Content |
|-----|---------|
| `productbrain://orientation` | System map: architecture, data model, rules, analytics |
| `productbrain://terminology` | Glossary + standards summary |
| `productbrain://collections` | All collection schemas with field definitions |
| `productbrain://{slug}/entries` | All entries in a given collection |
| `productbrain://labels` | Workspace labels with hierarchy |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `review-against-rules` | Structured compliance review against business rules |
| `name-check` | Check variable/field names against the glossary |
| `draft-decision-record` | Draft a decision record from context |
| `draft-rule-from-context` | Draft a business rule from an observation |

## Security

- **Your data stays yours.** The MCP server connects only to your authenticated Convex deployment. No data is shared with third parties.
- **API key handling.** Cloud keys (`pb_sk_...`) are SHA-256 hashed before storage. Only the prefix is persisted for display. Keys are sent as Bearer tokens over HTTPS.
- **Workspace scoping.** Each API key is bound to a single workspace. No cross-workspace access is possible.

## Troubleshooting

### "Missing API key" or "Invalid API key"

Your `PRODUCTBRAIN_API_KEY` is missing or incorrect. Generate a new key from SynergyOS Settings → API Keys.

### "CONVEX_SITE_URL environment variable is required"

You're using self-hosted mode but missing the `env` block. Make sure all three variables are set.

### "Workspace not found"

For self-hosted: check your `WORKSPACE_SLUG`. For cloud: your API key may have been revoked.

### "MCP call network error"

The backend is unreachable. If using `PRODUCTBRAIN_URL`, verify the URL is correct and the server is running.

### Server doesn't appear in Claude Desktop / Cursor

Restart the application after editing the config file. In Cursor, check the MCP panel (Cmd+Shift+P → "MCP: Show Panel") for startup errors.

### Enable debug logging

Set `MCP_DEBUG=1` in your config's `env` block to see audit logs in stderr.

## Development

```bash
# Clone and install
git clone https://github.com/synergyai-os/productbrain.git
cd productbrain
# Or install: npm install @productbrain/mcp
npm install

# Copy env template and fill in your values
cp .env.mcp.example .env.mcp

# Run in dev mode (TypeScript, hot reload)
npm run dev

# Build for production
npm run build

# Run the built version
npm start

# Typecheck
npm run typecheck

# Publish beta
npm run publish:beta
# (Maintainers: set SYNERGYOS_POSTHOG_KEY=phc_... for usage tracking)
```

## License

MIT
