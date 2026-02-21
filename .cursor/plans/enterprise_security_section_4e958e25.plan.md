---
name: Enterprise Security Section
overview: Replace the existing lightweight security section on the marketing page with a comprehensive, enterprise-grade "Trust & Security" section that addresses AI data safety, data protection architecture, certifications, and compliance readiness -- at the same quality level as the rest of the page.
todos:
  - id: css-trust-badges
    content: Add CSS for .trust-badges row and .trust-badge items (compact pill-style cards with icons)
    status: completed
  - id: css-security-grid
    content: Add CSS for expanded security card grid (reuse existing .security-grid pattern but ensure 3-col layout)
    status: completed
  - id: css-self-host-callout
    content: Add CSS for .security-callout block (green-tinted variant of .cc-philosophy)
    status: completed
  - id: html-replace-section
    content: "Replace existing security section HTML (lines 2411-2438) with the three-part structure: trust badges, card grid, self-host callout"
    status: completed
  - id: nav-security-link
    content: "Verify nav includes Security link pointing to #security"
    status: completed
isProject: false
---

# Enterprise Trust & Security Section

## What Changes

Replace the existing security section in [marketing/product-os-mcp/index.html](marketing/product-os-mcp/index.html) (lines 2411-2438) with a comprehensive three-part section. Add a nav link for "Security" if missing. All new CSS stays inline in the same `<style>` block.

## Section Structure

### Part 1: Trust Badges Row

A horizontal row of 4 certification/compliance badges styled as pill-shaped cards with icons, providing instant visual trust signals:

- **SOC 2 Type II** -- "Audited annually by independent security firm"
- **Encrypted everywhere** -- "AES-256 at rest, TLS 1.2+ in transit"
- **Multi-AZ durability** -- "11 9's backup durability, 4 9's availability"
- **Pen-tested annually** -- "Independent penetration testing every year"

These will be styled as compact, high-contrast badges in a horizontal strip (similar to pricing badges) -- not full cards. They're the "glanceable proof" that catches a compliance officer's eye.

### Part 2: Six-Card Grid -- "How We Protect Your Data"

Same card style as the existing feature grid (`.feature-card` / `.problem-card`), 2-3 columns. Each addresses a specific enterprise concern:

1. **Your data never trains AI models** -- Product OS reads and writes your KB. Your knowledge is never sent to third-party model providers for training. The LLM interaction happens in your editor; the MCP server only serves structured data.
2. **Workspace isolation** -- Every API call is scoped to your workspace ID. No cross-workspace queries are possible. Your team's knowledge graph is invisible to every other workspace.
3. **Authenticated every request** -- Bearer token API key on every single call. Keys are never logged, never stored in code, never exposed in error messages.
4. **Internal functions only** -- All database operations use Convex `internalQuery` / `internalMutation`, blocked from all external clients by the platform. Only the authenticated HTTP gateway can dispatch calls.
5. **Full audit trail** -- Every read, write, and search is logged with timestamp, function, workspace, and duration. Entry-level change history tracks who changed what and when. Compliance teams can review the full session audit.
6. **Zero telemetry by default** -- No analytics, no tracking, no phone-home. Set a PostHog key to opt in. Omit it to disable everything. You decide what gets measured.

### Part 3: Self-Host Callout Block

A highlighted callout block (same style as `.cc-philosophy`) that makes the self-host security argument:

> **The ultimate security: run it yourself.** Product OS is MIT-licensed, fully open source. Self-host on your own Convex deployment and your data never leaves your infrastructure. No third-party access. No trust required. Inspect every line of code that touches your knowledge.

With a ghost button: "Self-host now" linking to #install.

## Design Tokens

Follows existing page design system exactly:

- Section label: `TRUST & SECURITY` (accent uppercase)
- Section title: "Built for teams that can't afford to get security wrong"
- Section sub: "SOC 2 Type II certified infrastructure. Your data encrypted, isolated, and audited -- whether you self-host or use our cloud."
- Cards: `var(--bg-card)`, `var(--border)`, `var(--radius)`
- Trust badges: Use a new `.trust-badge` class with subtle green/accent tinting
- Callout: Reuse `.cc-philosophy` pattern with green accent instead of indigo

## Nav Update

Add "Security" to the nav links list pointing to `#security` (it may already exist as a section ID).

## No New Files

All changes are in `marketing/product-os-mcp/index.html` -- CSS in the existing `<style>` block, HTML replacing the existing security section, no new JS needed (uses existing fade-in scroll observer).