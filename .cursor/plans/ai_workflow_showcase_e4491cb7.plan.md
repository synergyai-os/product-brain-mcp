---
name: AI Workflow Showcase
overview: Create a viral-worthy marketing component that showcases the complete AI chat workflow (Shape, Scope, Tickets, Build) as a standalone page with a teaser section on the landing page. Data-driven, animated, and reusable.
todos:
  - id: page-scaffold
    content: "Create workflow.html with page structure: nav, hero, scenario tabs, chat container, journey controls, CTA, footer. Reuse CSS variables and fonts from index.html."
    status: completed
  - id: chat-css
    content: "Build the chat UI CSS: user messages, AI messages, tool call cards, KB badges, code blocks, message animations (slide-in + stagger), tab switching transitions."
    status: completed
  - id: scenario-data
    content: "Define the 4 scenario data objects (Shape, Scope, Tickets, Build) as JS arrays of message objects with types: user, tool, ai. Each AI message includes KB refs and optional code blocks."
    status: completed
  - id: render-engine
    content: "Write the JS rendering engine: parseScenario() builds DOM from data, switchTab() handles transitions, animateMessages() handles staggered slide-in of messages."
    status: completed
  - id: journey-mode
    content: "Implement auto-play journey mode: progress bar across all 4 tabs, auto-advance with 6s per scenario, pause/resume, end with summary counter (4 conversations / 8 KB entries / 0 rework)."
    status: completed
  - id: teaser-section
    content: "Add teaser section to index.html after #how: section label, title, subtitle, condensed scenario preview, CTA button linking to workflow.html. Add nav link."
    status: completed
isProject: false
---

# Pitch: AI Chat Workflow Showcase

**Shaped by:** AI + Randy
**Date:** Feb 20, 2026

---

## Problem

A developer lands on the Product OS landing page. They see the feature list, the architecture flow, and the before/after demo -- but they still can't picture *their daily workflow* with Product OS. The gap between "interesting tool" and "I need this" is the inability to watch the end-to-end journey from raw idea to shipped code. Nobody wants to install a tool to find out what working with it feels like.

The existing demos show **one interaction at a time**. What's missing is the **connected narrative** -- the same thread flowing through Shape, Scope, Tickets, and Build. That's the "aha" moment that converts browsers into users.

---

## Appetite

**Time budget:** Small Batch -- 1 session (~2 hours build time)
**Team:** 1 AI + 1 developer

This is a single standalone HTML page with inline CSS/JS (matching the existing `index.html` pattern). No framework, no build step, no external dependencies. The content is hand-crafted for maximum resonance.

---

## Solution

### Core Elements

- **Standalone page** at `marketing/product-os-mcp/workflow.html` -- its own URL, sharable, linkable
- **4 scenario tabs** (Shape / Scope / Tickets / Build) showing the full workflow journey
- **Chat UI** mimicking a real AI chat panel -- user messages, AI responses, tool call indicators, KB badges, code blocks
- **Journey auto-play mode** -- click "Watch the journey" and all 4 scenarios play in sequence with smooth transitions, ending with a "4 conversations | 8 KB entries | 0 rework" summary
- **Teaser section** added to `index.html` (between Architecture and Critical Context) with a condensed preview + CTA linking to the full page
- **Data-driven architecture** -- scenarios defined as JS objects, trivial to add/modify later (the "reusable" part)

### Narrative Thread (same supplier validation example across all scenarios)

**Scenario 1: Shape the Bet**

- You: "We keep getting bugs because devs use 'vendor' instead of 'supplier'. Help me shape this."
- Tool: `kb-search` finds TN-008 (terminology drift), GT-019 (supplier definition)
- AI: Shapes the bet -- problem, appetite (2 weeks), 3 solution elements
- You: "Perfect. Let's scope it."

**Scenario 2: Scope the Work**

- You: "Break this bet into buildable scopes"
- Tool: `gather-context` walks the KB graph, returns BR-012, GT-019, DR-005, BR-015
- AI: 3 scopes (Form Validation, Schema Migration, Drift Detection) -- all within appetite
- You: "Start with Scope 1. Write the tickets."

**Scenario 3: Write Tickets**

- You: "Write implementation tickets for Scope 1"
- Tool: `review-rules` surfaces BR-012, BR-015
- AI: 3 tickets (SV-001, SV-002, SV-003) using correct terminology from glossary
- You: "Let's build SV-001."

**Scenario 4: Build with AI**

- You: "Implement SV-001: Create the SupplierForm"
- Tool: `get-entry` pulls GT-019, BR-012, BR-015
- AI: Writes the component with correct field names, correct table, correct validation. Includes a code block.
- Ends with: "First time good."

### Chat UI Design (fat-marker sketch)

```
  [Shape] [Scope] [Tickets] [Build]    <-- pill tabs, active one highlighted
  ┌─ chat-window ──────────────────────────────────┐
  │  ┌─ chrome-bar: cursor — your-project ───────┐ │
  │  │ ● ● ●                                     │ │
  │  ├─────────────────────────────────────────────┤ │
  │  │                                             │ │
  │  │  ┌── user-msg ───────────────────────────┐  │ │
  │  │  │ You                                   │  │ │
  │  │  │ "Help me shape the supplier..."       │  │ │
  │  │  └───────────────────────────────────────┘  │ │
  │  │                                             │ │
  │  │  ┌── tool-call (subtle, collapsed) ──────┐  │ │
  │  │  │ kb-search → TN-008, GT-019 loaded     │  │ │
  │  │  └───────────────────────────────────────┘  │ │
  │  │                                             │ │
  │  │  ┌── ai-msg ─────────────────────────────┐  │ │
  │  │  │ AI Assistant                          │  │ │
  │  │  │ Found TN-008... Here's the shaped     │  │ │
  │  │  │ bet: [BR-012] [GT-019]                │  │ │
  │  │  │ **Problem:** Developers create...     │  │ │
  │  │  └───────────────────────────────────────┘  │ │
  │  │                                             │ │
  │  └─────────────────────────────────────────────┘ │
  │  Scenario insight: "Shape identified the problem │
  │  and solution — grounded in KB knowledge."       │
  └──────────────────────────────────────────────────┘
```

### Animation Strategy

- Messages slide in from below with staggered timing (NOT char-by-char typing -- too slow for this volume)
- Tool calls show a brief "loading" shimmer, then resolve with KB badges
- Code blocks in Build scenario get a subtle syntax-highlight fade-in
- Tab switches: old chat fades out (200ms), new chat messages stagger in
- Journey mode: auto-advance tabs with a progress bar, 6s per scenario

### Teaser Section in index.html

Placed after the Architecture section (#how), before Critical Context (#context):

```
  Section label: "See it in action"
  Title: "Your AI Chat Workflow"
  Subtitle: "Watch how 4 conversations take you from raw idea to shipped
             code — with zero rework."
  [Preview: condensed single-scenario snippet from Shape]
  CTA button: "Watch the full workflow →" links to workflow.html
```

---

## Rabbit Holes

### Content volume per scenario

**Risk:** Writing too many message exchanges per scenario makes the component feel slow and overwhelming.
**Patch:** Max 3 exchanges per scenario (user-AI-user). Keep each AI response under 8 lines. The goal is to show the *shape* of the workflow, not recreate a full session.

### Character-by-character typing

**Risk:** Typing animations are compelling but would make 4 scenarios painfully slow (the existing demo already takes 15+ seconds for one exchange).
**Patch:** Use message slide-in animations instead. Fast, smooth, works for any content length. Reserve typing animation for the journey-mode "punchline" only (the final "First time good." line).

### Journey auto-play timing

**Risk:** If scenarios auto-advance too fast, users can't read the content. Too slow, they leave.
**Patch:** 6 seconds per scenario. Messages stagger in over 3s, then 3s reading time before auto-advancing. Include a pause/resume control.

---

## No-Gos

- **NOT building:** A CMS, admin panel, or dynamic scenario editor. Scenarios are hardcoded JS objects.
- **NOT building:** Backend API or data fetching. Everything is static marketing content.
- **NOT building:** A web component or npm package. "Reusable" means copy-paste-friendly, self-contained HTML/CSS/JS.
- **NOT building:** Mobile-first or PWA features. Responsive yes, but optimized for desktop (where Cursor users are).
- **NOT changing:** The existing interactive demo or flow component. This is additive.

---

## Implementation Files

- **New:** `[marketing/product-os-mcp/workflow.html](marketing/product-os-mcp/workflow.html)` -- standalone showcase page (HTML + inline CSS + inline JS, matching index.html pattern)
- **Edit:** `[marketing/product-os-mcp/index.html](marketing/product-os-mcp/index.html)` -- add teaser section + nav link to workflow page

