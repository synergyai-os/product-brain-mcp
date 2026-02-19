# SynergyOS MCP

The single source of truth for product knowledge -- glossary, business rules, tensions, decisions, labels, and relations -- accessible as an MCP server in [Cursor](https://cursor.com).

SynergyOS MCP connects your AI coding assistant to your team's product knowledge base. Ask questions, capture decisions, and build a living knowledge graph without leaving your editor.

## Quick Start

### 1. Install in Cursor

Add this to your Cursor MCP config (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "synergyos": {
      "command": "npx",
      "args": ["-y", "synergyos-mcp"],
      "env": {
        "CONVEX_SITE_URL": "https://your-deployment.convex.site",
        "MCP_API_KEY": "your-secret-api-key",
        "WORKSPACE_SLUG": "your-workspace-slug"
      }
    }
  }
}
```

### 2. Get Your Credentials

You need a SynergyOS account to use SynergyOS MCP.

| Variable | Where to find it |
|----------|-----------------|
| `CONVEX_SITE_URL` | Convex dashboard > Settings > URL & Deploy Key (use the `*.convex.site` URL, **not** `*.convex.cloud`) |
| `MCP_API_KEY` | Your API key from SynergyOS -- must also be set in the Convex dashboard environment variables |
| `WORKSPACE_SLUG` | Your workspace slug from the portal URL (`/ws-<slug>/...`) |

### 3. Verify It Works

In Cursor, ask:

> "Use the health tool to check SynergyOS connectivity"

You should see a response with your workspace ID, collection count, and latency.

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
- *"What entries are related to the glossary term GT-019?"*
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
| `product-os://orientation` | System map: architecture, data model, rules, analytics |
| `product-os://terminology` | Glossary + standards summary |
| `product-os://collections` | All collection schemas with field definitions |
| `product-os://{slug}/entries` | All entries in a given collection |
| `product-os://labels` | Workspace labels with hierarchy |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `review-against-rules` | Structured compliance review against business rules |
| `name-check` | Check variable/field names against the glossary |
| `draft-decision-record` | Draft a decision record from context |
| `draft-rule-from-context` | Draft a business rule from an observation |

## Security

- **Your data stays yours.** The MCP server connects only to your authenticated Convex deployment. No data is shared with third parties.
- **API key handling.** Your `MCP_API_KEY` is stored in your local environment and sent as a Bearer token to your own Convex backend. It is never logged or exposed.
- **Workspace scoping.** All operations are scoped to your `WORKSPACE_SLUG`. No cross-workspace access is possible.
- **Analytics are opt-in.** Set `POSTHOG_MCP_KEY` to enable usage analytics. Omit it entirely to disable all tracking.

## Troubleshooting

### "CONVEX_SITE_URL environment variable is required"

Your MCP config is missing the `env` block or the variable is empty. Make sure all three required variables are set in `.cursor/mcp.json`.

### "Workspace with slug 'X' not found"

The `WORKSPACE_SLUG` doesn't match any workspace in your Convex deployment. Check the portal URL for the correct slug.

### "MCP call failed (401)"

Your `MCP_API_KEY` doesn't match the one set in the Convex dashboard environment variables. Verify both sides match.

### "MCP call network error"

The `CONVEX_SITE_URL` is unreachable. Make sure you're using the `*.convex.site` URL (not `*.convex.cloud`) and that your Convex deployment is running.

### Server doesn't appear in Cursor

Restart Cursor after editing `.cursor/mcp.json`. Check the MCP panel (Cmd+Shift+P > "MCP: Show Panel") for startup errors.

### Enable debug logging

Set `MCP_DEBUG=1` in your MCP config's `env` block to see `[MCP-ANALYTICS]` and `[MCP-AUDIT]` logs in stderr. By default these are suppressed for a quieter experience.

## Development

```bash
# Clone and install
git clone https://github.com/synergyai-os/product-os-mcp.git
cd product-os-mcp
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

# Publish prerelease (uses --tag=beta so it won't become latest)
npm run publish:beta

# Bump prerelease version (e.g. 0.1.0-beta.0 → 0.1.0-beta.1)
npm run version:prerelease
```

**Installing prerelease:** `npx synergyos-mcp@beta` or `npm install synergyos-mcp@beta`

## License

MIT
