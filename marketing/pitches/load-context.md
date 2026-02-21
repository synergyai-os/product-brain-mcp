# Pitch: Load Context — Auto-Loading Domain Knowledge for Every Conversation

**Shaped by:** Randy + AI shaping partner
**Date:** February 20, 2026

---

## Problem

A developer is working in Cursor with Product OS installed. They type: "Add supplier validation to the order form." The AI agent starts coding immediately — but it doesn't know that "supplier" has a canonical definition (GT-019), that there's a business rule governing supplier field governance (BR-012), or that a decision was already made about how validation should work (DR-005). It invents its own terminology, contradicts existing rules, and produces code that works syntactically but is wrong for the domain.

The KB has all the answers. The rules say "search the KB first." But in practice, the agent doesn't reliably follow through. It skips the search, or does a shallow one, or doesn't connect the dots between related entries. The result: the developer either babysits the context-loading manually ("search the KB for supplier," "check business rules for validation," "what decisions exist about...") or corrects the agent after it's already gone down the wrong path.

This breaks the core promise of Product OS: **First Time Good** — the agent gets it right on run 1 because it has the right context. When context-loading is unreliable, every conversation is a coin flip between "the agent knew the domain" and "the agent guessed."

Meanwhile, the knowledge graph is rich with connections — business rules that govern features, glossary terms that define entities, decisions that constrain implementation. But the agent never traverses this graph proactively. It treats the KB as a lookup table instead of a connected knowledge system.

The fix isn't better documentation or more rules. The fix is a system that automatically loads the right domain context before the agent writes a single line of code — silently when the task is clear, with a clarifying question when it's genuinely ambiguous.

---

## Appetite

**Time budget:** Big Batch — 6 weeks
**Team:** 1 full-stack developer (comfortable with Convex, MCP protocol, Cursor rules/skills)

This is worth 6 weeks because auto-context-loading is the connective tissue between "having knowledge" and "using knowledge." Without it, Product OS is a KB that exists but doesn't reliably flow into the agent's work. With it, every conversation starts from a position of domain awareness — which is the entire value proposition.

If it had to be smaller (2 weeks): ship the Auto-Context Rule and Load Context Skill using only existing MCP tools (`kb-search` + `gather-context`). Skip the server-side tool, skip the Code Map, skip the feedback loop. Functional but chatty (many MCP calls) and no code-context awareness.

If we had more time: add embedding-based semantic search for concept detection, build a visual "context loaded" panel in Cursor, and add cross-session context persistence ("remember what we loaded last time for this feature area").

---

## Solution

### Core Elements

- **The Auto-Context Rule** — An always-on `.mdc` rule that fires on every conversation. It tells the agent: "Before doing any work, assess whether this task touches the product domain. If yes, call the `load-context-for-task` MCP tool with the user's message. If clearly non-domain (CSS, infra, generic programming), skip." The rule is procedural, not advisory — it names the specific tool to call and the specific steps to follow, because simple explicit instructions stick where vague guidelines don't.

- **The Load Context Skill** — A `SKILL.md` that provides the full multi-step procedure the agent follows when context loading is triggered. Steps: (1) Call `load-context-for-task` with the user's message to get relevant KB entries and their graph neighborhood. (2) Use Cursor's `SemanticSearch` to find code files related to the loaded domain concepts. (3) Assemble the Context Packet. (4) If the tool returned high-confidence matches, load silently and show the summary. (5) If matches are weak or ambiguous, ask one focused clarifying question: "This seems related to [X] — should I also load context for [Y]?" (6) Proceed with the user's actual task, grounded in loaded context.

- **The `load-context-for-task` MCP Tool** — A new server-side tool that does the heavy lifting in a single call. Accepts a task description. Runs full-text search across all KB collections, takes the top 3 search hits, performs multi-hop BFS traversal (2 hops) on each, deduplicates, and returns up to 10 entries ranked by relevance. Relevance ranking: direct search hits first (hop 0), then 1-hop relations, then 2-hop. Within each hop level, collection priority: business rules > glossary > decisions > features > tensions. Returns structured payload: entries with IDs, names, collection types, relation types, and confidence score. One HTTP call instead of 5-10.

- **The Code Map** — A progressive mapping from domain concepts to code locations. Bootstraps via two paths: (A) At launch, the skill uses Cursor's `SemanticSearch` to find relevant code based on loaded KB concepts — no maintained index needed. (B) Over time, as the agent works on domain code, the feedback loop annotates KB entries with `code_paths` in their data field (e.g., `"code_paths": ["convex/mcpKnowledge.ts:createEntry"]`). The `load-context-for-task` tool returns these code paths alongside entries. The map builds itself through use.

- **The Context Packet** — A standard output format for assembled context, displayed to the user as a brief summary at the start of the conversation. Example: `Context Loaded — Domain: Supplier management. KB: GT-019 (Supplier), BR-012 (Field governance), DR-005 (Validation approach). Code: convex/schema.ts, convex/suppliers.ts. Confidence: High.` The agent internalizes the full entry details; the user sees the receipt.

- **The Feedback Loop** — An enhancement to the existing knowledge capture rule. When the agent gets corrected on domain knowledge mid-conversation ("No, we call that a 'vendor,' not a 'supplier'"), the system: (1) Captures the correction as a KB update or new entry. (2) If the correction reveals a code-concept link, adds it to the entry's `code_paths`. (3) Future context loads automatically benefit because the KB is richer. Turns every correction into a flywheel contribution.

---

## Rabbit Holes

### Concept detection from vague messages

**Risk:** The system needs to extract domain concepts from arbitrary user messages. "Fix the supplier validation bug" is clear. "That thing we talked about yesterday" is not. Over-engineering NLP here would blow the budget.

**Patch:** No NLP. Pass the raw task description to `load-context-for-task`, which runs Convex full-text search against the KB's `searchText` fields. The KB defines the vocabulary — if a word matches a glossary term, it's a domain concept. If nothing matches, either the task is non-domain or the KB doesn't cover it yet. Both cases degrade gracefully: no context loaded, agent proceeds normally or suggests capturing new knowledge.

### Too much context = noise

**Risk:** A single concept like "supplier" could pull dozens of related entries via graph traversal. Dumping all of them into the conversation eats tokens and confuses the agent.

**Patch:** Hard budget: max 10 entries returned by `load-context-for-task`. Ranked by relevance (search hit > 1-hop > 2-hop) and collection priority (rules > glossary > decisions). The Context Packet shows entry IDs and names — the agent can drill into any specific entry via `get-entry` if it needs the full detail during the task. Start slim, go deep on demand.

### Code Map bootstrapping

**Risk:** The Code Map doesn't exist yet. If it requires manual maintenance, it'll stay empty. If it's purely automatic, it'll be wrong.

**Patch:** Two-phase approach. At launch: use Cursor's `SemanticSearch` (already available) to find code files — no map needed. Over time: the feedback loop adds `code_paths` annotations to KB entries organically. The map builds itself through normal use. No manual maintenance required.

### Latency on every conversation

**Risk:** An always-on context phase adds delay before the agent starts working. If it's noticeable, users disable it.

**Patch:** The `load-context-for-task` tool is a single HTTP call. Server-side: one search query + up to 3 BFS traversals, each sub-100ms on Convex. Total server-side: ~500ms. Network + agent SemanticSearch: ~2.5 seconds. Total overhead: ~3 seconds. For non-domain tasks, the rule skips entirely (zero overhead). 3 seconds is acceptable when it means the agent gets things right on run 1 instead of stumbling for 5 minutes.

### Empty or sparse KB

**Risk:** Most KB collections have 0 entries today. If Load Context ships before the KB is populated, it returns nothing and feels broken.

**Patch:** When zero matches are returned, the Context Packet says: "No KB context found for this task area." The skill then offers: "Want me to capture the domain knowledge we discover during this task?" This turns the empty-KB case into a capture opportunity — feeding the "people contributing to the KB" North Star. Load Context is useful even with an empty KB because it bootstraps the flywheel.

### The rule not "sticking"

**Risk:** The existing `kb-first` rule already tells agents to search the KB. They don't reliably follow through. A new rule could suffer the same fate.

**Patch:** Three structural differences: (1) The rule is **procedural** — "call this specific tool with this specific input" rather than "you should search." (2) It's **one tool call**, not a multi-step behavioral guideline. (3) The Load Context Skill provides mechanical steps the agent follows without judgment. Simple, specific instructions are followed more reliably than aspirational guidelines.

### Convex full-text search quality

**Risk:** Convex search is basic full-text. "Refactor entry creation" might not match an entry called "Knowledge Entry" because "entry" is too generic.

**Patch:** Accept this for v1. Good KB hygiene (descriptive names, rich descriptions via `smart-capture`) makes full-text search sufficient. The `searchText` field already concatenates name + description + canonical terms + rules. If search quality is insufficient after the KB matures, add Convex vector search with embeddings as a separate follow-up bet.

---

## No-Gos

- **NOT building** persistent cross-session memory. Load Context runs fresh every conversation. No "remember what we loaded last time."
- **NOT building** semantic/vector search in v1. Full-text search is the baseline. Embeddings are a future bet.
- **NOT building** automatic code indexing or AST parsing. Code discovery uses Cursor's existing `SemanticSearch`.
- **NOT building** a UI component, settings panel, or visual dashboard for context loading.
- **NOT building** per-conversation context filtering ("only load rules, not decisions"). The budget-and-rank algorithm handles relevance.
- **NOT building** multi-workspace context. One workspace, one KB, one context scope.
- **NOT building** real-time context updating during a conversation. Context loads once at the start; subsequent KB searches during the task use existing tools.

---

## Additional Context

**Existing architecture:**
- MCP server at `mcp-server/src/` with modular tool registration pattern (`registerXTools(server)`)
- Convex backend at `convex/` with HTTP routing via `convex/http.ts` (single `/api/mcp` endpoint)
- Existing tools: `kb-search` (full-text), `gather-context` (BFS graph traversal), `smart-capture` (auto-link + quality score)
- Schema: 7 tables, `entries` table has `search_text` index, `entryRelations` table for graph edges
- Cursor rules at `.cursor/rules/`: `kb-first` (always-on, advisory), `capture-knowledge` (always-on, proactive), `orientation` (on-demand)

**Implementation sequence:**
1. **Week 1-2:** Build `load-context-for-task` Convex function + HTTP route + MCP tool. Extend existing `kb-search` + `gatherContext` patterns.
2. **Week 2-3:** Build the Load Context Skill (`SKILL.md`) with the full multi-step procedure. Test with various task types.
3. **Week 3-4:** Build the Auto-Context Rule (`.mdc`). Integrate with the skill. Tune detection heuristics and the "skip vs. load vs. ask" logic.
4. **Week 4-5:** Build the Code Map enrichment (add `code_paths` to entry data schema, feedback loop in capture rule). Build the Context Packet format.
5. **Week 5-6:** Integration testing across scenario types (domain-heavy, code-only, ambiguous, empty KB). Tune relevance ranking and context budget. Polish.

**Success criteria:**
- The agent correctly loads relevant domain context for 80%+ of domain-related tasks without manual prompting
- Context loading adds < 5 seconds of latency to conversation start
- The Context Packet is concise (< 200 tokens) and shows the user what was loaded
- Non-domain tasks see zero latency overhead (rule skips cleanly)
- Empty KB conversations result in a capture prompt, not a silent failure
- After 2 weeks of use, KB entries begin accumulating `code_paths` annotations organically
