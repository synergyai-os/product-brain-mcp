---
name: Update Product Brain
overview: "Rename the platform from \"SynergyOS MCP\" / \"Product OS\" to \"ProductBrain\" across all code, config, documentation, cursor rules, and marketing pages. Anchor the entire experience around the 3-step onboarding: Install, Setup in Cursor, Train your Product Brain."
todos:
  - id: check-npm-name
    content: "Check if `productbrain` is available on npm (fallbacks: `productbrain-mcp`, `@productbrain/mcp`, `product-brain`)"
    status: pending
  - id: package-identity
    content: "Update package.json: name, description, bin, keywords, author. Regenerate package-lock.json."
    status: pending
  - id: mcp-server-identity
    content: "Update src/index.ts: server name to `productbrain`, instructions text, all URI references"
    status: pending
  - id: resource-uris
    content: "Update src/resources/index.ts: all 12 `product-os://` URIs to `productbrain://`, section headings"
    status: pending
  - id: tool-strings
    content: "Update src/tools/health.ts, knowledge.ts, verify.ts: user-facing strings and logger names"
    status: pending
  - id: env-template
    content: Update .env.mcp.example header comment
    status: pending
  - id: cursor-rules
    content: "Update 3 .cursor/rules/*.mdc files: descriptions, headings, server names, URI references"
    status: pending
  - id: readme-rewrite
    content: Rewrite README.md with 3-step onboarding narrative (Install, Setup in Cursor, Train your Product Brain)
    status: pending
  - id: marketing-pages
    content: Naming pass across 5 HTML files + 2 shared assets + marketing README (~100+ replacements)
    status: pending
  - id: verify-build
    content: Run `npm run typecheck` and `npm run build` to confirm nothing is broken
    status: pending
isProject: false
---

# Update Product Brain

Rename the open source platform to **ProductBrain** across the entire codebase (~180 occurrences, 26 files). The new identity anchors around a dead-simple onboarding:

1. **Install** -- `npm install productbrain` / `npx productbrain`
2. **Setup in Cursor** -- paste the MCP config block
3. **Train your Product Brain** -- start capturing knowledge

## Brand Architecture (applied everywhere)

- **ProductBrain** = the open source platform (MIT, self-hostable)
- **SynergyOS.ai** = the company + managed cloud (keep where it means the company)
- **ProductBrain Cloud** = hosted version (by SynergyOS)
- **productbrain://** = resource URI scheme (replaces `product-os://`)

## Scope by Layer

### 1. Package identity ([package.json](package.json))

- `name`: `synergyos-mcp` -> `productbrain`
- `description`: rewrite with ProductBrain branding
- `bin`: `synergyos-mcp` -> `productbrain`
- `keywords`: add `productbrain`, `product-brain`, `product-knowledge`
- `author`: `SynergyAI OS` -> `ProductBrain Contributors` (or keep SynergyAI if preferred)
- `repository.url` / `homepage`: keep current GitHub URLs for now (repo rename is a no-go)
- Regenerate `package-lock.json` via `npm install` after changes

### 2. MCP server identity ([src/index.ts](src/index.ts))

- Line 53: `name: "synergyos"` -> `name: "productbrain"`
- Line 59: `"Product OS — the single source of truth..."` -> `"ProductBrain — the single source of truth..."`
- Lines 62-83: all `product-os://` URI references in `instructions` string -> `productbrain://`

### 3. Resource URI scheme ([src/resources/index.ts](src/resources/index.ts))

12 occurrences -- all `product-os://` become `productbrain://`:

- Line 23: heading `"# Product OS — Orientation"` -> `"# ProductBrain — Orientation"`
- Lines 126-129: URI references in "Where to Go Next" section
- Lines 142, 169, 212, 264: static resource URIs (`productbrain://orientation`, `productbrain://terminology`, `productbrain://collections`, `productbrain://labels`)
- Line 176: heading `"# Product OS — Terminology"` -> `"# ProductBrain — Terminology"`
- Lines 237, 242: `ResourceTemplate` URI pattern and dynamic entries URI

### 4. Tool descriptions (source strings)

- [src/tools/health.ts](src/tools/health.ts) line 102: `"Product OS"` -> `"ProductBrain"`
- [src/tools/knowledge.ts](src/tools/knowledge.ts) lines 239, 274, 301, 744: `"Product OS"` -> `"ProductBrain"`, logger `"product-os"` -> `"productbrain"`
- [src/tools/verify.ts](src/tools/verify.ts) lines 253, 263: `"Product OS"` -> `"ProductBrain"`, logger `"product-os"` -> `"productbrain"`

### 5. Environment template ([.env.mcp.example](.env.mcp.example))

- Line 1: `# SynergyOS MCP — Environment Variables` -> `# ProductBrain — Environment Variables`

### 6. Cursor rules (3 files in [.cursor/rules/](.cursor/rules/))

**[product-os-kb-first.mdc](.cursor/rules/product-os-kb-first.mdc):**

- Description, heading, MCP server name (`synergyos` -> `productbrain`), response patterns -- all `Product OS` -> `ProductBrain`

**[product-os-capture-knowledge.mdc](.cursor/rules/product-os-capture-knowledge.mdc):**

- Description and heading -- `Product OS` -> `ProductBrain`

**[product-os-orientation.mdc](.cursor/rules/product-os-orientation.mdc):**

- Description, heading, URI references (`product-os://` -> `productbrain://`), instruction text

Optionally rename the files themselves (`product-os-*.mdc` -> `productbrain-*.mdc`).

### 7. README rewrite ([README.md](README.md))

Full rewrite anchored on the 3-step onboarding narrative:

```
# ProductBrain

The open source knowledge graph for AI coding assistants.

## Get Started in 3 Steps

### 1. Install
npm install -g productbrain   # or: npx productbrain

### 2. Setup in Cursor
(paste MCP config with server name "productbrain")

### 3. Train your Product Brain
"Capture a glossary term: ..."
"Log a decision: ..."
```

Key changes:

- Title: `SynergyOS MCP` -> `ProductBrain`
- Config example: server key `synergyos` -> `productbrain`, args `synergyos-mcp` -> `productbrain`
- All `product-os://` URIs -> `productbrain://`
- "You need a SynergyOS account" -> clarify this is the cloud option (ProductBrain Cloud by SynergyOS.ai), self-hosting needs only Convex
- npx command: `npx synergyos-mcp` -> `npx productbrain`
- Git clone URL: keep as-is (repo rename is out of scope)
- Add brand architecture note: "ProductBrain is the open source platform. SynergyOS.ai provides managed cloud hosting."

### 8. Marketing pages (5 HTML files)

These are the highest-volume files (~100+ occurrences). The rule: **naming pass only, no layout or design changes.**

**[marketing/product-os-mcp/index.html](marketing/product-os-mcp/index.html)** (~35 occurrences):

- Meta tags: title, description, og:title, og:site_name
- Nav bar brand text
- All "Product OS" / "Product OS MCP" in headings, body copy, button labels
- Config example block (server name, npx command)
- Footer brand text
- Keep `SynergyOS.ai` only where it refers to the cloud/company (CTA links, cloud pricing badge)

**[marketing/index.html](marketing/index.html)** (~15 occurrences):

- Title, nav, headings, body copy -- `Product OS` -> `ProductBrain`
- Footer links

**[marketing/product-os-mcp/code-is-not-truth.html](marketing/product-os-mcp/code-is-not-truth.html)** (~20 occurrences):

- Same pattern: meta tags, headings, body copy, footer

**[marketing/product-os-mcp/workflow.html](marketing/product-os-mcp/workflow.html)** (~13 occurrences):

- Same pattern

**[marketing/prototypes/synergyos-homepage.html](marketing/prototypes/synergyos-homepage.html)** (~30 occurrences):

- This is the SynergyOS.ai homepage prototype -- the company page. Here "SynergyOS" stays as the company brand, but "Product OS MCP" references become "ProductBrain"

**[marketing/shared/animations.js](marketing/shared/animations.js)** and **[marketing/shared/styles.css](marketing/shared/styles.css):**

- Comment headers only (1 each)

### 9. Marketing README ([marketing/product-os-mcp/README.md](marketing/product-os-mcp/README.md))

- Update header, template examples, and file descriptions to use "ProductBrain"

## No-gos (from the shaped pitch)

- No GitHub repo or org rename
- No marketing page redesign -- text changes only
- No internal code refactoring (variable names, file paths stay as-is)
- No backward-compat layer for URI scheme -- clean break (beta)
- No Convex backend changes

## Execution order

Work inside-out: core identity first, then documentation, then marketing. This way each layer can reference the previous one for consistency.