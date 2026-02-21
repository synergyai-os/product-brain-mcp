# Pitch: First Time Good — The Interactive Showcase

**Shaped by:** Randy + AI shaping partner
**Date:** February 20, 2026

---

## Problem

A developer discovers Product OS and lands on the product page. They read about "First Time Good" and "Critical Context" — but so does every other dev tool. Claims are cheap. They've seen a dozen tools promise better AI output.

The page has copy, a flywheel diagram, messaging pillars — but nothing that lets them *feel* the difference. They can't experience what it's like when their AI actually knows their domain vs. when it's guessing.

So they do what everyone does: they bookmark it and forget. Or they skim, think "maybe later," and leave.

The belief gap — "would my AI actually be better with this?" — never gets crossed. And without crossing that gap, no one installs, no one captures knowledge, and the flywheel never starts.

Meanwhile, a single static screenshot (the side-by-side comparison image) has been the most compelling proof point so far. People see the "WITHOUT" panel making confident-but-wrong domain choices and the "WITH" panel citing business rules and getting it right on Run 1, and they *get it* instantly. That one frame does more selling than paragraphs of positioning copy.

The problem: that proof moment is trapped in a static image. It needs to become an experience.

---

## Appetite

**Time budget:** Big Batch — 6 weeks
**Team:** 1 designer + 1 programmer (or a strong full-stack solo)

This is worth 6 weeks because the interactive showcase becomes the primary conversion mechanism for the product page. It's not a nice-to-have feature — it's the answer to "why should I try this?" If this works, it replaces the need for case studies, testimonials, and lengthy explainer content in the early funnel. The demo *is* the pitch.

If it had to be smaller (2 weeks), we'd ship curated comparisons only — no free-type, no typewriter animation, just a static-but-clickable before/after. Functional but not magical.

If we had more time, we'd add multiple domain scenarios (healthcare, fintech, SaaS), a "connect your KB" teaser flow, and A/B test different prompt sequences for conversion optimization.

---

## Solution

### Core Elements

- **The Split-Screen Comparison Engine** — Two side-by-side panels styled like IDE chat windows (dark theme, monospace code, syntax highlighting). Left panel: "Without Product OS" shows a confident-but-domain-wrong AI response. Right panel: "With Product OS" shows a KB-grounded response with entry badges (BR-012, GT-019, etc.) and correct terminology. On mobile, this becomes a tab-toggle between "Without" and "With" views.

- **The Curated Prompt Chips** — 3-4 pre-crafted prompts against a procurement domain sample KB, displayed as clickable chips below a shared prompt input. Each prompt is carefully chosen to maximize the visible gap between "with context" and "without context." Examples: "Add supplier validation to the order form," "Create the purchase approval workflow," "Add email notification when inventory drops below reorder point," "Validate order totals against department budget rules."

- **The Typewriter Streaming Effect** — Responses don't appear instantly. They stream in character-by-character like watching a real LLM respond. Both panels stream simultaneously. The left side types confidently-wrong. The right side types correctly with KB citations. The responses are pre-rendered HTML revealed progressively (CSS clip-path or JS innerHTML chunking) — not live LLM calls. The pacing builds tension as the two responses visibly diverge.

- **The Scorecard Strip** — A bottom comparison bar beneath the two panels. Left side (red): "Wrong terminology, wrong table, contradicts BR-012 · 3 attempts." Right side (green): "Correct terms, correct table, rules satisfied · First Time Good." This is the "receipt" — objective proof, not subjective impression.

- **The Smart Prompt Input** — The free-type field accepts any text but matches to the nearest curated scenario via simple keyword matching (e.g., "vendor" or "validation" → supplier scenario; "approval" or "purchase" → approval scenario). If no keywords match, a friendly nudge highlights the curated chips: "Great question! Try one of these domain-loaded prompts to see the real difference." No ML, no NLP — just keyword matching.

- **The CTA Reveal** — After the scorecard strip appears, a call-to-action fades in below: "Give your AI a Product Brain" with Install and Learn More buttons. The demo creates the desire; the CTA converts it.

### The Universal Frame

Above the demo, a single line that makes the specific domain feel universal:

> *"Every product has domain knowledge your AI doesn't know. Here's what happens when it does."*

The procurement domain proves the concept concretely. The framing makes every developer see their own domain in it.

---

## Rabbit Holes

### Writing convincingly "wrong" responses

**Risk:** If the "without" response looks obviously stupid, visitors dismiss it — "my AI isn't that bad." If it's too subtle, the difference doesn't land.

**Patch:** Calibrate all "without" responses to the existing image template: structurally correct, professionally formatted, confident — but wrong on domain specifics (wrong terms, wrong table names, plausible-but-incorrect assumptions). This is exactly how real LLMs fail on domain tasks: they sound right but are wrong. Author response pairs as a team, review with someone unfamiliar with the domain to verify the "wrong" response feels plausible.

### Fuzzy prompt matching for free-type

**Risk:** "Fake free-type" needs to map arbitrary input to the nearest curated scenario. Edge cases could feel broken or misleading.

**Patch:** Simple keyword matching, not ML. Map specific keywords to scenarios. For unmatched input, show a friendly redirect to curated chips — not a broken experience. Visitors who use the chips (90%+ expected) never hit this path. The free-type is a credibility signal, not the primary path.

### Mobile layout for split-screen

**Risk:** The side-by-side comparison is the core visual metaphor. It doesn't fit on mobile.

**Patch:** On screens below 768px, switch to a tab-toggle UI: "Without" and "With" tabs the user taps between. The scorecard strip stays visible below both. Different experience, same message. Don't attempt to squeeze two panels side-by-side on a phone.

### Typewriter animation performance

**Risk:** Simultaneously streaming two panels of formatted text with syntax highlighting could cause jank on older devices.

**Patch:** Pre-render all response HTML server-side (at build time). The "typewriter" effect progressively reveals pre-existing content — not building DOM nodes in real time. Syntax highlighting is static in the HTML. Total component JS stays under 15KB gzipped. No framework — vanilla JS/CSS, matching the existing marketing page stack.

### Landing page load impact

**Risk:** A heavy interactive component could hurt Core Web Vitals and slow down first paint of the marketing page.

**Patch:** Lazy-load the component with IntersectionObserver (the page already uses this pattern for fade-in animations). All response data is inlined as static JSON — no network fetches. The demo section is below the fold, so it has no impact on LCP. Critical CSS for the demo is minimal; animation JS loads deferred.

### Domain resonance

**Risk:** The procurement domain is specific. Developers building SaaS, games, or healthcare products might not see themselves in it.

**Patch:** The universal frame ("Every product has domain knowledge your AI doesn't know") handles this. We do NOT build multiple domain scenarios in v1 — that's scope creep. The procurement domain is rich enough, complex enough, and professional enough to be universally relatable as "this is what a real product domain looks like."

---

## No-Gos

- **NOT building** real LLM integration for the demo. No API calls, no tokens, no backend. All responses are pre-authored and pre-rendered. Zero per-visitor cost.
- **NOT building** multiple domain scenarios. One domain (procurement), 3-4 curated prompts. More domains can be added later if the format proves out.
- **NOT building** a standalone app or separate page. This is a section embedded in the existing product landing page.
- **NOT building** user accounts, saved sessions, analytics dashboards, or any persistent state.
- **NOT building** a "connect your own KB" flow. That's the product's job, not the demo's.
- **NOT building** a video/recording/export feature. This is a live interactive component only.
- **NOT building** this as a React/Vue/Svelte component. Vanilla HTML/CSS/JS, matching the existing marketing page architecture (single-file, no build step).

---

## Additional Context

**Existing assets:**
- The side-by-side comparison image (the "standard chat experience" screenshot) is the design reference. The interactive demo should feel like this image *came alive.*
- The product landing page already exists at `marketing/product-os-mcp/index.html`. The demo section should integrate into this page.
- The marketing hub page at `marketing/index.html` already defines the brand system: dark theme, Inter font, orange accent, fade-in scroll animations.

**Sample KB entries to author for the demo:**
- GT-019: Supplier (glossary term — "external entity providing goods")
- BR-012: Supplier field governance (business rule)
- BR-015: Approved supplier list validation (business rule)
- DR-005: Decision record (e.g., "chose Convex over Supabase" or similar)
- 4-8 additional entries to support the other curated prompts (purchase orders, budget rules, inventory reorder points, approval workflows)

**Success criteria:**
- A developer who has never seen Product OS spends 30+ seconds interacting with the demo
- The demo communicates the "First Time Good" value proposition without the visitor reading any surrounding copy
- The existing marketing page's performance (LCP, CLS, FID) does not degrade measurably
- The demo works on desktop (1024px+) and mobile (375px+) with appropriate layouts for each
