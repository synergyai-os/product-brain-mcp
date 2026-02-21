# Pitch: Update Product Brain

**Shaped by:** Randy + AI shaping partner
**Date:** February 20, 2026

---

## Problem

The open source platform has an identity crisis. The codebase, npm package, documentation, and marketing all use a mix of names — "SynergyOS MCP," "Product OS MCP," "Product OS," "synergyos-mcp" — none of which communicate what the product actually is. The platform that anyone can install and contribute to doesn't have its own name; it's tangled with the company brand (SynergyOS.ai).

Here's the real story: a developer finds the GitHub repo. They see `synergyos-mcp` in `package.json`, "Product OS MCP" in the page title, "SynergyOS" in the nav bar, and `product-os://` in the resource URIs. They can't tell what's the product, what's the company, and what's the protocol. The README says "You need a SynergyOS account" — which signals closed platform, not open source.

Meanwhile, the name **ProductBrain** already exists in the marketing copy ("Give your AI a Product Brain") and perfectly captures the value: your product's brain, accessible to AI. But it's just a tagline — it hasn't been applied to the actual codebase, package, or documentation.

The naming confusion has three downstream effects:
1. **Discoverability** — searching npm or GitHub for "product brain" or "product knowledge MCP" returns nothing, because the package is called `synergyos-mcp`
2. **Contributor friction** — open source contributors can't tell which parts are the open platform and which are SynergyOS-specific
3. **Brand clarity** — marketplace plugin builders need to know they're building for "ProductBrain," not for a single company's internal tool

---

## Appetite

**Time budget:** Small Batch — 2 weeks
**Team:** 1 programmer (full-stack)

This is worth 2 weeks because it's foundational — every future piece of work (marketplace, plugins, community docs, landing pages) depends on the name being right. Shipping features on top of confused naming creates compounding debt.

If it had to be smaller (3 days), we'd do just the npm package rename, README, and `package.json` — the technical identity. Marketing pages and resource URIs would come later.

If we had more time (6 weeks), we'd also redesign the landing page with ProductBrain as the hero brand, create contributor docs, and set up the GitHub org under a ProductBrain identity.

---

## Solution

### Core Elements

- **Package & Binary Rename** — The npm package changes from `synergyos-mcp` to `productbrain` (or `productbrain-mcp`). The binary name in `package.json` `bin` field changes to match. The install command becomes `npx productbrain`. All keywords updated for discoverability (`productbrain`, `product-brain`, `product-knowledge`, `mcp`).

- **MCP Server Identity** — The MCP server name registered in `src/index.ts` changes from `"synergyos"` to `"productbrain"`. The server description and instructions text updated to use ProductBrain consistently. Users' `.cursor/mcp.json` config examples updated in README (server key becomes `"productbrain"`).

- **Resource URI Scheme** — All `product-os://` URIs migrate to `productbrain://` (e.g., `productbrain://orientation`, `productbrain://terminology`, `productbrain://collections`). The resource templates in `src/resources/index.ts` and all references in tool descriptions, cursor rules, and documentation updated. This is a breaking change — documented in a migration note.

- **Documentation Sweep** — `README.md` rewritten with ProductBrain as the product name. Clear brand architecture section: "ProductBrain is the open source platform. SynergyOS.ai is the managed cloud." The `.env.mcp.example` header, cursor rules (`.cursor/rules/*.mdc`), and pitch documents updated.

- **Marketing Page Updates** — All references in `marketing/product-os-mcp/index.html`, `marketing/index.html`, `marketing/product-os-mcp/code-is-not-truth.html`, and `marketing/product-os-mcp/workflow.html` updated. "Product OS MCP" becomes "ProductBrain" in headings, descriptions, CTAs, and meta tags. SynergyOS.ai references preserved only where they refer to the cloud/company (not the open source tool).

- **Source Code Strings** — Logger names, tool descriptions, and user-facing strings in `src/tools/*.ts` updated from "Product OS" to "ProductBrain." Internal variable names and file structure stay as-is (no refactoring of code architecture — this is a naming pass only).

- **Git & GitHub Alignment** — Repository description updated. A note in the README explains the rename for existing users: "Previously known as SynergyOS MCP / Product OS MCP." Git remote URL change is a separate task (requires GitHub repo rename, which is an org decision).

### Brand Architecture (applied consistently)

| Context | Use |
|---------|-----|
| The open source product | **ProductBrain** |
| The npm package | `productbrain` |
| The MCP server name | `productbrain` |
| Resource URI scheme | `productbrain://` |
| The company / cloud | **SynergyOS.ai** |
| The managed hosting | **ProductBrain Cloud** (by SynergyOS) |
| The marketplace | **ProductBrain Marketplace** |
| GitHub org (future) | TBD — separate decision |

---

## Rabbit Holes

### Breaking change for existing users

**Risk:** Anyone with `"synergyos"` in their `.cursor/mcp.json` or scripts referencing `npx synergyos-mcp` will break on update.

**Patch:** This is beta software (`0.1.0-beta.1`) with a small user base. Publish the renamed package as a new version with a clear changelog. Keep the old `synergyos-mcp` package on npm with a deprecation notice pointing to `productbrain`. Document the migration in 3 steps: (1) update `mcp.json` server name, (2) update the npx command, (3) update any `product-os://` URIs in custom rules. Total migration time for a user: under 2 minutes.

### Resource URI migration

**Risk:** The `product-os://` URI scheme is embedded in cursor rules, tool descriptions, and potentially in users' saved KB data. Changing it touches many files and could break resource fetching.

**Patch:** Change all URIs in code and documentation to `productbrain://`. Since the resource URIs are defined in `src/resources/index.ts` and consumed by the MCP protocol, the change is atomic — update the registration and all references together. No backward compatibility layer needed at this stage (beta).

### Marketing page rename scope creep

**Risk:** Touching every marketing page for naming could turn into a redesign. "While we're in there, let's also fix the layout, add the demo section, update the copy..."

**Patch:** This bet is strictly a naming pass. Changes are limited to: (1) find-and-replace product name references, (2) update meta tags, (3) update nav/footer brand text. No layout changes, no new sections, no copy rewrites beyond the name swap. Design improvements are separate bets.

### npm package name availability

**Risk:** `productbrain` might already be taken on npm.

**Patch:** Check npm availability before starting. Fallback names in priority order: `productbrain-mcp`, `@productbrain/mcp`, `product-brain`. The team picks the best available option as the first task.

### GitHub repository and org rename

**Risk:** Renaming the GitHub repo breaks existing clone URLs, issue links, and contributor forks.

**Patch:** Don't rename the GitHub repo or org in this bet. GitHub auto-redirects old URLs after rename, but the org rename (`synergyai-os` → something ProductBrain-aligned) is a bigger decision with its own considerations (other repos, org membership, CI/CD). For this bet, update the repo *description* only. Add "Previously: SynergyOS MCP" to the repo description. Repo/org rename is a separate decision.

---

## No-Gos

- **NOT renaming** the GitHub repository or organization. Repo description updated only. Org rename is a separate decision.
- **NOT redesigning** any marketing pages. This is a naming pass — same layouts, same sections, same styles. Just updated text.
- **NOT refactoring** internal code structure, variable names, or file paths (e.g., `src/tools/knowledge.ts` stays as-is). Only user-facing strings and documentation change.
- **NOT building** backward-compatibility layers for the URI scheme change. It's beta — clean break.
- **NOT creating** new marketing content, contributor docs, or marketplace pages. Those are separate bets.
- **NOT changing** the SynergyOS.ai company brand or domain. SynergyOS.ai remains the company; ProductBrain is the product.
- **NOT setting up** a new GitHub org or transferring the repository. That's a future organizational decision.
- **NOT updating** the Convex backend or schema. Backend resource names and internal Convex function names are unaffected.

---

## Scope Map

For reference, the audit identified **~180+ occurrences across 26 files** that need updating:

| Category | Files | Occurrences | Complexity |
|----------|-------|-------------|------------|
| Config (package.json, mcp.json, .env) | 4 | ~12 | Low — straightforward replacement |
| TypeScript source | 5 | ~24 | Medium — need to verify string context |
| Documentation (README, pitches) | 3 | ~24 | Low — text replacement |
| Cursor rules (.mdc files) | 3 | ~12 | Low — text replacement |
| Marketing HTML | 5 | ~100+ | Medium — many occurrences, need brand-aware replacement (keep "SynergyOS" where it means the company) |
| Marketing JS/CSS | 2 | ~2 | Low — comment headers only |
| Plan files | 3 | ~6 | Low — historical docs, optional |

**Estimated effort:** The rename itself is 2-3 days of focused work. The remaining time is for testing, verifying all pages render correctly, publishing the renamed npm package, writing the migration note, and updating the deprecation notice on the old package.

---

## Additional Context

**Current state:**
- Package: `synergyos-mcp@0.1.0-beta.1` on npm
- License: MIT
- Users: Small beta group
- GitHub: `synergyai-os/product-os-mcp`

**The name "ProductBrain" already exists in the marketing copy** — the CTA on the landing page reads "Give your AI a Product Brain" and the marketing hub page describes "The Product Brain is the living knowledge graph." This rename makes the product name match the value proposition that's already resonating.

**Success criteria:**
- `npx productbrain` (or chosen package name) installs and runs correctly
- All marketing pages show "ProductBrain" as the product name, "SynergyOS.ai" only for the cloud/company
- README clearly states the brand architecture (ProductBrain = open source, SynergyOS.ai = cloud)
- Old `synergyos-mcp` npm package shows deprecation notice pointing to new package
- A user can migrate from old to new in under 2 minutes following the migration guide
- No broken links or missing references in documentation or marketing pages
