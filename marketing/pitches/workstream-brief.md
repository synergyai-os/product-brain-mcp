# Pitch: Workstream Brief — Context Before Cursor

**Shaped by:** Randy + AI shaping partner
**Date:** 2026-02-21
**Build target:** `product-os-mcp` repo (the standalone ProductBrain / SynergyOS MCP product)

---

## Problem

A developer opens Cursor and types: "Refactor the supplier validation logic." The AI starts working immediately — but it has no idea which repos are in scope, which ones are off-limits, what constraints exist (don't touch the legacy Gateway code), or what artifact the developer actually wants back (a working PR? a plan? just a code review?).

These constraints surface reactively. Three messages in: "Oh, I meant only the Convex backend, not the MCP server code." Five messages in: "Actually, don't consider the Product-OS repo at all — that's stale." Seven messages in: "I wanted a pitch document, not code changes." Each correction triggers rework — re-scoping, re-analyzing, re-drafting. The developer had all this context in their head from the start, but the conversation format never prompted them to surface it.

This wastes roughly 30% of back-and-forth per session. Multiply across a team of five people each running 3-4 AI sessions per day, and the cumulative cost is significant.

The problem compounds in three ways:

1. **Cold start on every conversation.** MCP conversations have no session memory. Every new Cursor chat begins from zero — even if the developer is continuing yesterday's workstream. There is no way to say "I'm still working on X" and have the AI pick up the context.

2. **No structural spine for long sessions.** A session that runs too long degrades: the AI starts relying on summaries instead of original details, the developer loses sharpness, and scope creeps because nobody remembers the original boundaries.

3. **Team-wide repetition.** Every person connected to ProductBrain MCP hits the same cold start. The same constraints get re-explained, the same boundaries get re-drawn, the same mistakes get re-made.

The existing `load-context-for-task` tool solves *what domain knowledge to load*. The workstream brief solves the upstream problem: *what is the developer actually trying to do, and what are the boundaries?*

---

## Appetite

**Time budget:** Big Batch — 6 weeks
**Team:** 1 designer + 1-2 programmers

This is worth a full cycle because it is team-wide infrastructure, not a personal productivity hack. The brief protocol must:

- Work for anyone connected to ProductBrain MCP (not just one user in one IDE)
- Support different workstream types (coding, shaping, retro, audit) with appropriate templates
- Persist across sessions so workstreams don't restart from zero
- Respect user communication preferences while enforcing organizational standards

If this had to be smaller (2 weeks): ship the MCP tool and a sample Cursor rule without templates or user preferences. If we had more time: add auto-brief from git/file context and session analytics (next cycle).

---

## Solution

### Architecture: All Intelligence in product-os-mcp

Everything ships in the `product-os-mcp` repo. The Convex backend (`convex/`), MCP tools (`src/tools/`), and MCP prompts (`src/prompts/`) all live there. The only client-side artifact is a thin Cursor rule (`.mdc` file) distributed as a template.

This matters because product-os-mcp is the standalone MCP product that any team can connect to. Building the brief protocol here means every MCP client (Cursor, Claude Desktop, any future client) gets workstream awareness automatically. No per-repo setup required beyond copying the Cursor rule.

**Important:** No changes to `convex/schema.ts` are needed. The existing schema already handles this pattern — collections are runtime data (rows in the `collections` table) and entries use the generic `entries` table with `data: v.any()`. The backend work is: (1) seed `workstream-briefs` and `user-preferences` collection rows, (2) write query/mutation functions.

```
product-os-mcp/                          Client (any repo)
├── convex/                              ├── .cursor/rules/
│   ├── kb.ts      ← add brief fns      │   └── workstream.mdc  (thin pointer)
│   └── http.ts    ← register routes    │
├── src/                                 └── (no other changes needed)
│   ├── tools/
│   │   └── workstream-brief.ts  ← NEW
│   ├── prompts/
│   │   └── index.ts  ← add start-workstream
│   ├── resources/
│   │   └── index.ts  ← expose active briefs
│   └── client.ts  (unchanged)
└── docs/
    └── cursor-rule-template.mdc  ← NEW (distribution artifact)
```

**Request flow** (follows existing patterns in `convex/http.ts`):

```
Cursor / Claude Desktop
    │ stdio
    ▼
MCP Server (src/index.ts)
    │ registers workstream-brief tool
    │ calls mcpQuery / mcpMutation via src/client.ts
    │
    │ HTTP POST → {CONVEX_SITE_URL}/api/mcp
    │ Body: { fn: "kb.createBrief", args: { ... } }
    ▼
Convex HTTP Action (convex/http.ts)
    │ QUERIES / MUTATIONS maps route to internal functions
    ▼
Convex Backend (convex/kb.ts)
    │ CRUD on workstream-briefs collection entries
    ▼
Returns structured brief JSON
```

### Core Element 1: Workstream Briefs as a KB Collection

A new `workstream-briefs` collection seeded as a runtime row in the existing `collections` table. Each brief is a standard entry in the `entries` table with structured fields in `data`:

- **scope_in** (required) — what repos, files, features, domains are in play
- **scope_out** — what is explicitly excluded
- **constraints** — time budget, technical boundaries, dependencies, environment details
- **desired_output** (required) — what artifact the user wants back (pitch, code, KB entries, plan, review)
- **workstream_type** — coding / shaping / retro / audit / exploration
- **verbosity** — concise / standard / detailed (user preference, bounded by org principles)
- **status** — active / paused / complete

Only `scope_in` and `desired_output` are required at creation. Everything else fills in progressively as the conversation reveals constraints. The AI updates the brief as it learns ("You mentioned this repo is out of scope — I've added that to the brief").

Because briefs are standard KB entries, they automatically participate in the knowledge graph via `suggest-links` and `relate-entries`. A coding brief can link to the feature it implements; a shaping brief can link to the tension it addresses.

### Core Element 2: `workstream-brief` MCP Tool

A new file: `src/tools/workstream-brief.ts`. Registers a single tool with an `action` parameter, following the pattern established in `src/tools/knowledge.ts`:

- **create** — start a new brief with initial fields. Calls `mcpMutation("kb.createBrief", ...)`. Returns the brief ID.
- **get** — retrieve a specific brief by ID. Calls `mcpQuery("kb.getBrief", ...)`.
- **list-active** — list all briefs with status "active" for the current workspace. Calls `mcpQuery("kb.listActiveBriefs", ...)`. This is what the AI calls at conversation start.
- **update** — patch specific fields (scope_out changed, new constraint discovered). Calls `mcpMutation("kb.updateBrief", ...)`.
- **complete** — mark a workstream as done. Stores a summary of what was accomplished. Calls `mcpMutation("kb.completeBrief", ...)`.
- **scope-check** — given a description of what the AI is about to do, check if it falls within the brief's declared scope. Calls `mcpQuery("kb.scopeCheck", ...)`. Returns "in-scope" / "edge" / "out-of-scope" with reasoning.

Backend functions live in `convex/kb.ts` alongside existing entry functions. They follow the same patterns as `searchEntries`, `createEntry`, `updateEntry` — no new infrastructure. Registered in `convex/http.ts` in the existing QUERIES/MUTATIONS maps.

### Core Element 3: `start-workstream` MCP Prompt

Added to `src/prompts/index.ts` alongside existing prompts (`review-against-rules`, `draft-decision-record`, `name-check`, `draft-rule-from-context`). Takes two arguments:

- **workstream_type** (required) — coding / shaping / retro / audit
- **context** (optional) — any upfront context the user wants to provide

The prompt returns structured messages that guide brief collection, tailored per workstream type:

- **Coding**: asks about repos, files, what to change, what to leave alone, desired output (working code, PR, plan)
- **Shaping**: asks about problem space, appetite, what's in/out of scope (repos, envs, teams), desired output (pitch, elements, exploration)
- **Retro**: asks about timeframe, what to reflect on, desired output (KB entry, action items, discussion)
- **Audit**: asks about what to audit (KB, architecture, rules), criteria, desired output (report, fixes, scorecard)

The prompt uses embedded resource fetches to pull in relevant organizational principles that should constrain the session (from `product-os://terminology` and business rules).

### Core Element 4: Cursor Rule (Thin Behavioral Pointer)

A `.mdc` file that ships as `docs/cursor-rule-template.mdc` — teams copy it into their repo's `.cursor/rules/`. It teaches the AI three things:

1. **At conversation start**: call `workstream-brief list-active`. If there's an active brief, offer to continue it (one-line confirmation). Multiple active: quick pick. None: ask 2-3 natural questions to create one — not a form.
2. **During the session**: respect the brief. If the conversation drifts outside declared scope, flag it once (advisory, not blocking). If the user says "expand the scope," update the brief silently.
3. **Communication style**: read the brief's verbosity preference. "Concise" means shorter sentences, fewer preambles. It does NOT mean skipping trade-off analysis or risk callouts — those are governed by organizational principles (substance), not user preferences (style).

If the user ignores the brief prompt and jumps straight into work, the AI proceeds without one. Graceful degradation, not a gate.

This rule does NOT live in product-os-mcp's `.cursor/rules/`. It is a client-side distribution artifact only.

### Core Element 5: User Preferences (Style Bounded by Substance)

User-level preferences stored as entries in a `user-preferences` collection (not per-brief, but reused across briefs):

- **verbosity** — concise / standard / detailed
- **interaction_style** — directive (short signals, "y", "1") / collaborative (discussion) / exploratory (thinking out loud)
- **defaults** — preferred workstream type, default repos, common constraints

These are *style* preferences. Organizational *substance* constraints (from business-rules, principles, standards collections) always apply. The distinction: preferences govern *how* the AI communicates, org constraints govern *what* it must communicate. A user who prefers "concise" still gets trade-off analysis — it's just delivered in fewer words.

The MCP prompt and Cursor rule both encode this distinction: load user preferences AND org principles, apply both.

### Core Element 6: Brief Templates per Workstream Type

Different workstream types need different brief shapes. Templates are built into the `start-workstream` MCP prompt (not a separate system):

- **Coding**: repos, files/modules in scope, technical constraints, test expectations, desired output (code, PR, refactor, fix)
- **Shaping**: problem space, appetite, what's in/out of scope (repos, envs, teams), desired output (pitch, elements, exploration)
- **Retro/Facilitated**: timeframe, participants, what to reflect on, desired output (KB entry, actions, discussion)
- **Audit/Review**: what to audit (KB, architecture, rules), criteria, desired output (report, fixes, scorecard)

---

## Rabbit Holes

### "New workstream" detection

**Risk:** Every MCP conversation starts fresh (no session memory). The AI can't distinguish "new workstream" from "continuing yesterday's work." If it asks for a brief every time, that's friction.

**Patch:** Don't detect — ask lightly. At conversation start, call `list-active`. If one active brief exists: "Continuing [name]?" (one-word confirmation). Multiple active: quick pick. None: ask for a brief. If the user ignores and jumps in: proceed without one.

### Brief schema rigidity

**Risk:** Too structured = form nobody fills out. Too free-form = machine can't use it for scope guarding.

**Patch:** Hybrid. Only `scope_in` and `desired_output` are required. Everything else fills in progressively. The AI updates the brief as constraints emerge naturally: "You mentioned this is out of scope — added to the brief."

### Scope guard false positives

**Risk:** Flagging every tangent as "outside scope" interrupts creative exploration.

**Patch:** Advisory only. Fires on clear boundary violations (different repo, different problem domain, different artifact type) — not on tangential questions within the problem space. Fires once per drift, not repeatedly. "Expand the scope" silently updates the brief.

### User preferences vs. organizational constraints

**Risk:** "Be concise" vs. "always explain trade-offs" — which wins?

**Patch:** Preferences are style, constraints are substance. "Concise" = shorter sentences, fewer preambles. It does NOT mean skip risk analysis. The MCP prompt encodes this distinction: load user preferences AND org principles, apply both.

### Backend work scope

**Risk:** New collection + new MCP tool + new prompt could be more backend work than expected.

**Patch:** The existing `convex/kb.ts` already handles collection CRUD generically. The workstream-brief functions follow the same patterns as `searchEntries`, `createEntry`, `updateEntry`. The MCP tool follows `src/tools/knowledge.ts`. No schema changes, no new infrastructure — just new functions using existing patterns and new collection rows seeded at deploy time.

### Cursor rule drift from MCP capabilities

**Risk:** If behavior logic lives in the MCP but the Cursor rule encodes behavior, they could drift apart.

**Patch:** The Cursor rule is intentionally thin — "use workstream-brief tools" and "respect the brief." It does NOT encode brief logic, templates, or preference rules. Those live in the MCP prompt/tool. The rule is a pointer, not a replica. If the MCP adds new workstream types or fields, the rule doesn't need updating.

---

## No-Gos

- **NOT building** cross-session conversation replay. The brief captures context and scope, not transcripts. No conversation persistence or memory across Cursor sessions.
- **NOT building** auto-brief from git/file context. The brief is human-authored (with AI assistance). Inferring scope from open files or recent commits is a future enhancement.
- **NOT building** multi-user brief collaboration. One author per brief. Team members can view briefs (they're KB entries) but not co-edit them in real-time.
- **NOT building** IDE plugins beyond the Cursor rule template. The MCP server is IDE-agnostic; the Cursor rule is a convenience template, not a hard dependency.
- **NOT building** brief analytics or session quality scoring. Tracking which briefs lead to better outcomes is a future bet.
- **NOT building** automatic session splitting. The brief helps scope a session, but no system that detects "this session is too long" and forces a break.
- **NOT building** this in the Product-OS repo. The stale `mcp-server/` and `convex/` there are legacy. All new MCP work goes in product-os-mcp.
- **NOT building** changes to `convex/schema.ts`. New collection types are runtime data (rows in the `collections` table), not compile-time table definitions.

---

## Relationship to Other Bets

### load-context-for-task (product-os-mcp)

The existing `load-context-for-task` tool auto-loads KB context for a task via search + graph traversal. Workstream briefs complement this: the brief tells the AI *what to focus on*, and `load-context-for-task` fetches *the relevant knowledge within that focus*. A natural pairing — the brief's `scope_in` field could feed into `load-context-for-task`'s search parameters.

### GitChain (Product-OS repo)

The GitChain bet builds version control for KB entries. Because workstream briefs are standard KB entries, they would inherit GitChain capabilities if/when that ships to product-os-mcp: version history on briefs, diffs when scope changes. The two bets solve different problems (knowledge evolution vs. collaboration quality) and neither blocks the other.

---

## Files Created/Modified (in product-os-mcp)

**New:**
- `src/tools/workstream-brief.ts` — MCP tool handler (create, get, list-active, update, complete, scope-check)
- `docs/cursor-rule-template.mdc` — Cursor rule template for distribution

**Modified:**
- `convex/kb.ts` — add createBrief, getBrief, listActiveBriefs, updateBrief, completeBrief, scopeCheck functions
- `convex/http.ts` — register new functions in QUERIES/MUTATIONS maps
- `src/index.ts` — import and call `registerWorkstreamBriefTools(server)`
- `src/prompts/index.ts` — add `start-workstream` prompt with per-type templates
- `src/resources/index.ts` — expose active briefs as `product-os://active-briefs` resource

**Seed data (not code changes):**
- Create `workstream-briefs` collection row via admin/seed script
- Create `user-preferences` collection row via admin/seed script

**NOT modified:**
- `convex/schema.ts` — no compile-time schema changes; collections are runtime data

---

## Implementation Sequence

1. **Week 1-2:** Seed collections. Build Convex functions (createBrief, getBrief, listActiveBriefs, updateBrief, completeBrief, scopeCheck) in `convex/kb.ts`. Register HTTP routes. Build `src/tools/workstream-brief.ts` MCP tool. Validate via curl + MCP.
2. **Week 2-3:** Build `start-workstream` prompt in `src/prompts/index.ts` with templates per workstream type. Build active-briefs resource.
3. **Week 3-4:** Build scope-check logic (compare action description against brief scope fields). Write thin Cursor rule template.
4. **Week 4-5:** Add user-preferences collection and integrate into prompt/rule. Build the style-vs-substance distinction into prompt output.
5. **Week 5-6:** Integration testing across scenario types (new workstream, continue existing, multiple active, scope drift, complete). Tune scope-check sensitivity. Polish.

## Success Criteria

- Active brief persists across Cursor conversations via `list-active` (AI picks up where user left off)
- Scope-check catches clear boundary violations (wrong repo, wrong artifact type) without flagging tangential exploration
- Brief creation takes < 30 seconds of user input (2-3 natural questions, not a form)
- Users who skip the brief prompt experience zero friction (graceful degradation)
- All brief functions follow existing `convex/kb.ts` patterns — no new infrastructure needed
