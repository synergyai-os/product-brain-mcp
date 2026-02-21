---
name: Product Brain category page
overview: Create a new marketing page at `marketing/product-os-mcp/product-brain.html` that defines and claims the "Product Brain" category — positioning ProductBrain as the first MCP-native product knowledge server, distinct from AI PM copilots, content hubs, and mindset blogs.
todos:
  - id: create-page
    content: Create `marketing/product-os-mcp/product-brain.html` with all 9 sections, using shared design system + orange accent theme
    status: completed
  - id: page-specific-css
    content: "Write page-specific CSS for: definition callout card, architecture diagram (3-column MCP primitives), scenario before/after cards, landscape cards"
    status: completed
  - id: nav-crosslinks
    content: Add navigation links to the new page from existing marketing pages (index.html nav, code-is-not-truth.html nav, workflow.html nav) and link back from the new page
    status: completed
  - id: seo-meta
    content: Add comprehensive meta tags (title, description, OG tags) targeting 'product brain', 'product brain MCP', 'MCP product knowledge server'
    status: completed
  - id: verify-render
    content: Open the page in a browser to verify all sections render correctly, animations trigger, and responsive layout works
    status: completed
isProject: false
---

# Product Brain Category-Defining Page

## Strategic Intent

The existing marketing pages serve distinct purposes:

- `index.html` — feature-focused landing page ("how it works")
- `code-is-not-truth.html` — problem-focused campaign (narrative storytelling)
- `workflow.html` — proof page (interactive demo)

This new page fills the **category definition** gap. Its job: define what a "Product Brain" is at the protocol level, claim the territory before anyone else does, and make the distinction crystal clear between a marketing phrase and a technical product category.

**File:** `[marketing/product-os-mcp/product-brain.html](marketing/product-os-mcp/product-brain.html)`

## Page Architecture

Uses the shared design system (`[shared/styles.css](marketing/shared/styles.css)` + `[shared/animations.js](marketing/shared/animations.js)`) with **orange accent theme** to differentiate from the indigo product page, matching the SynergyOS brand color.

### Section Flow (9 sections)

**1. Hero — "Every AI tool promises to understand your product. None of them remember it."**

- Badge: "Defining the category"
- Headline with gradient: gradient on "remember"
- Lead: The AI era created a new problem — AI assistants are powerful but amnesiac. They read your code, guess at your domain, and start from zero every conversation.
- Sub: "Product Brain" has been a metaphor (blogs, mindset articles, marketing speak). We're turning it into infrastructure.
- CTAs: "See what a Product Brain is" (scroll) + "Install ProductBrain" (link to main page)

**2. The Landscape — "Product Brain" today**

- Section label: "The term today"
- Three cards showing the current state of "Product Brain" in the wild:
  - **As a mindset** — PM blogs and articles use it to describe how product managers think. Not a tool. Not a protocol. A narrative.
  - **As a content hub** — Sites like "The Product Brain" offer PM frameworks and case studies. Valuable content, not operational infrastructure.
  - **As marketing language** — AI PM tools pitch themselves as your "strategic product brain." It's a positioning line, not a standard.
- Punchline callout: "The term is in the narrative space — content, mindset, branding. Nobody has defined it as a technical product category. Until now."

**3. The Definition — What a Product Brain actually is**

- Section label: "The definition"
- Title: "A Product Brain is not an app. It's infrastructure."
- Centered definition block (styled callout):
  > **Product Brain** /prod-ukt breyn/ — A protocol-native knowledge server that gives AI structured, real-time access to your product's glossary, business rules, decisions, features, and relations. Not a copilot. Not a wiki adapter. An open infrastructure layer that any AI host can plug into.
- Three attribute cards below:
  - **Protocol-native** — Built on the Model Context Protocol (MCP) standard. Not bolted onto a REST API or RAG pipeline. MCP is how AI agents talk to knowledge, and a Product Brain speaks that language natively.
  - **Structured, not scraped** — Knowledge is typed, related, versioned, and quality-scored. Not unstructured documents thrown into a vector database. A knowledge graph, not a document dump.
  - **Open, not locked** — MIT licensed. Self-hostable. Your data in your infrastructure. Not another SaaS silo where your product knowledge becomes someone else's moat.

**4. Why MCP Changes Everything**

- Section label: "The protocol layer"
- Title: "Closed copilots die. Open protocols compound."
- Narrative paragraph explaining: MCP is now the standard way to connect AI models to knowledge and tools. Major vendors (Microsoft, AWS, Anthropic) have adopted it. But nobody has defined a product-management-specific MCP schema. That's the gap.
- Three-card comparison row:
  - **Before MCP**: Custom prompts, RAG pipelines, manual copy-paste, proprietary APIs
  - **Generic MCP**: Code servers, CRM connectors, database tools — horizontal, not product-aware
  - **Product Brain MCP**: Purpose-built MCP server for product knowledge — the canonical schema for product work

**5. The Architecture — Resources, Tools, Prompts**

- Section label: "The primitives"
- Title: "Three MCP primitives. One product brain."
- Visual diagram (built in HTML/CSS, not an image) showing the three MCP primitive types:
  - **Resources** (the facts) — Canonical "read" access to product knowledge: glossary terms, business rules, decisions, feature specs, collections, relations. Always current. Always structured. `productbrain://terminology`, `productbrain://collections`
  - **Tools** (the actions) — Standard operations: `kb-search`, `smart-capture`, `load-context-for-task`, `verify`, `suggest-links`, `review-rules`. Not custom endpoints — MCP-standard tool calls any AI host can invoke.
  - **Prompts** (the workflows) — Reusable thought-processes: opportunity analysis, RICE scoring, compliance review, impact sizing. Codified product thinking that any agent can execute.
- Below the diagram: a callout — "This is what makes a Product Brain different from a knowledge base. A KB stores data. A Product Brain exposes it through a protocol that AI can reason with."

**6. Comparison — AI PM Copilot vs Product Brain**

- Section label: "The difference"
- Two-column comparison (reusing the `.compare` pattern from shared styles):
  - Left (red, "AI PM Copilot"): Closed app, proprietary integrations, one vendor's AI, data in their cloud, prompt engineering to teach context, starts from zero when you switch tools, marketing phrase
  - Right (green, "Product Brain MCP"): Open protocol, standard MCP interface, any AI host (Cursor, Claude, Copilot, custom agents), your data in your infrastructure, structured knowledge graph auto-loaded, context persists across tools and sessions, technical category

**7. In Practice — What this looks like**

- Section label: "In practice"
- Title: "What happens when your AI has a Product Brain"
- Three scenario cards showing concrete before/after:
  - **Scenario 1: "Build the supplier validation feature"** — Without PB: AI reads stale code, uses "vendor" instead of "supplier", misses the credit check rule added last quarter. 3 re-runs. With PB: AI loads `load-context-for-task`, gets current glossary + business rules + decision history. First Time Good.
  - **Scenario 2: "Write a PRD for the new checkout flow"** — Without PB: AI generates generic PRD, misses domain constraints, uses wrong terminology. With PB: AI reads `productbrain://terminology`, checks `review-rules` for compliance, references actual decisions. PRD is domain-accurate on first draft.
  - **Scenario 3: "Why does this code do X?"** — Without PB: Code archeology — git blame, Slack search, ask around. 2-4 hours. With PB: `gather-context` returns the decision record, the business rule, the linked tension. 30 seconds.

**8. The Standard — Open spec, reference implementation**

- Section label: "The standard"
- Title: "ProductBrain isn't just a product. It's a proposed standard."
- Key points (callout or styled list):
  - A canonical MCP server schema for product knowledge (entry types, relations, quality scoring)
  - A reference implementation anyone can fork, extend, or build on
  - A plugin marketplace where domain-specific knowledge (industry templates, integrations, capture workflows) can be shared
  - An open community defining how product knowledge should be structured for the AI era
- Brand architecture mini-section:
  - **ProductBrain** — The open source platform (MIT licensed)
  - **SynergyOS.ai** — The company behind it (managed cloud, marketplace, enterprise support)
  - **ProductBrain Cloud** — Zero-config hosted version
  - **ProductBrain Marketplace** — Plugin ecosystem

**9. CTA — "Give your AI a Product Brain"**

- Large gradient headline
- Sub: "5 minutes to install. Zero maintenance. Free forever. Or use ProductBrain Cloud for zero-config hosting."
- Three CTAs: "Install ProductBrain" (primary) + "View on GitHub" (ghost) + "Try ProductBrain Cloud" (ghost)

## Technical Implementation

- Plain HTML file using shared CSS (`../shared/styles.css`) + shared animations (`../shared/animations.js`)
- Orange accent theme override (`--accent: #fb923c`)
- Page-specific styles in inline `<style>` block (definition card, architecture diagram, scenario cards)
- No build step, no dependencies, no imports from parent directories
- Responsive (mobile-first, following patterns from `code-is-not-truth.html`)
- SEO meta tags targeting "product brain", "product brain MCP", "MCP product knowledge"
- Nav links back to main product page and other campaign pages

## Key Copywriting Principles

- **Authoritative, not aggressive** — We're defining a category, not attacking competitors. Acknowledge the landscape honestly.
- **Technical credibility** — Reference MCP primitives, protocol standards, concrete tool names. This page is for technical product people, not just PMs.
- **Problem-first** — Even on a definition page, ground every concept in the pain it solves.
- **Concrete, not abstract** — Every claim gets a code reference, a scenario, or a specific tool name. No hand-waving.
- **Consistent with existing voice** — Match the provocative-but-grounded tone of `code-is-not-truth.html` and the technical precision of the main landing page.

