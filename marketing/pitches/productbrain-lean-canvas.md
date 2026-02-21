# ProductBrain — Lean Canvas

**Date:** February 20, 2026
**Version:** 1.0

---

## 1. Problem

1. **AI starts from zero every session.** Product teams using AI coding assistants (Cursor, Copilot, etc.) lose domain context between conversations. The AI confidently generates code with wrong terminology, missed business rules, and broken assumptions — requiring 3-4 iteration cycles to get right.
2. **Product knowledge is scattered and decays.** Glossaries live in wikis nobody reads. Business rules live in someone's head. Decisions live in Slack threads that scroll away. There is no single source of truth that both humans and AI can consume.
3. **No ecosystem for product knowledge tooling.** Teams build ad-hoc solutions (custom prompts, system instructions, RAG pipelines) but there's no standard, extensible platform for product knowledge that AI tools can plug into.

**Existing alternatives:**

- Custom system prompts (fragile, don't scale)
- RAG over documentation (noisy, no structure, no relations)
- Wikis + manual copy-paste into AI (high friction, low adoption)
- Cursor rules / `.cursorrules` files (flat text, no graph, no tooling)

---

## 2. Customer Segments

**Early adopters:**

- Solo developers and small teams (2-10) using Cursor who care about AI output quality
- Technical product managers who document decisions and want that knowledge to flow into code
- Open source maintainers who want contributors' AI to understand the project domain

**Later segments:**

- Enterprise product teams (compliance-heavy domains: fintech, healthcare, procurement)
- Agencies building for multiple clients (one ProductBrain per client)
- AI tool builders who want structured product knowledge as a service

---

## 3. Unique Value Proposition

> **"Give your AI a Product Brain."**

ProductBrain is the open source knowledge graph that makes your AI get it right on Run 1 — correct terminology, real business rules, actual decisions — not on Run 4 after you've corrected it three times.

**High-level concept:** "Product knowledge as infrastructure" — like a database for what your product *means*, accessible to both humans and AI.

---

## 4. Solution


| Problem                  | Solution                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI has no domain context | **MCP Server** — ProductBrain runs as a Model Context Protocol server, giving AI assistants structured access to glossary terms, business rules, decisions, features, and relations in real time |
| Knowledge is scattered   | **Living Knowledge Graph** — A unified, connected knowledge base with typed relations, labels, history tracking, and quality scoring                                                             |
| No ecosystem for this    | **Plugin Marketplace** — A marketplace where developers sell and share domain-specific plugins (industry templates, collection types, integrations, capture workflows) with tools to build them  |


---

## 5. Channels


| Channel                                                               | Stage                    |
| --------------------------------------------------------------------- | ------------------------ |
| **GitHub** (MIT open source)                                          | Awareness → Acquisition  |
| **npm** (`npx productbrain`)                                          | Acquisition → Activation |
| **Cursor MCP ecosystem**                                              | Discovery → Activation   |
| **Interactive demo on landing page**                                  | Awareness → Activation   |
| **Dev community content** (blog posts, "code is not truth" narrative) | Awareness                |
| **Plugin marketplace**                                                | Retention → Revenue      |
| **Word of mouth** (team invites)                                      | Referral                 |


---

## 6. Key Metrics


| Metric                                 | What it measures                                      |
| -------------------------------------- | ----------------------------------------------------- |
| **Active installations** (weekly)      | Adoption — how many teams have ProductBrain running   |
| **Knowledge entries created** (weekly) | Activation — are people actually building their brain |
| **First Time Good rate**               | Value delivered — AI gets it right on first attempt   |
| **Marketplace plugin installs**        | Ecosystem health                                      |
| **Cloud conversion rate**              | Revenue — free → paid                                 |
| **Contributor count**                  | Community health                                      |


**North star:** Knowledge entries created per active installation per week (measures both adoption *and* engagement).

---

## 7. Unfair Advantage

1. **First mover in MCP-native product knowledge.** ProductBrain is purpose-built for the Model Context Protocol standard — not a RAG bolt-on or wiki adapter. As MCP becomes the standard for AI tool integration, ProductBrain is the native knowledge layer.
2. **Knowledge graph network effects.** Every entry makes the graph smarter (auto-linking, quality scoring, relation suggestions). The more you use it, the harder it is to leave.
3. **Open source community moat.** Contributors build plugins, WorkChains, Skill, Artifacts, Coaching Flows, industry templates, and integrations. The marketplace creates a flywheel: more plugins attract more users, more users attract more plugin builders.
4. **Capture-during-work model.** Knowledge is captured as a byproduct of normal development conversations — not as a separate documentation task. This dramatically lowers the adoption barrier compared to traditional knowledge management.

---

## 8. Revenue Streams


| Stream                                       | Model                                                                       | Timeline    |
| -------------------------------------------- | --------------------------------------------------------------------------- | ----------- |
| **ProductBrain Cloud** (hosted by SynergyOS) | Freemium SaaS — free tier + paid team/enterprise tiers                      | Now         |
| **Marketplace commission**                   | % cut on paid plugin sales                                                  | Medium-term |
| **Plugin developer tools** (pro tier)        | Subscription for advanced plugin development, analytics, featured placement | Medium-term |
| **Enterprise features**                      | SSO, audit logs, compliance exports, priority support                       | Later       |


**Pricing anchor:** The core platform is always free and open source. Revenue comes from convenience (cloud hosting), ecosystem (marketplace), and enterprise needs (compliance/support).

---

## 9. Cost Structure


| Cost                                                            | Type                         |
| --------------------------------------------------------------- | ---------------------------- |
| **Development** (core platform + marketplace)                   | Fixed                        |
| **Cloud hosting** (Convex infrastructure for SynergyOS.ai)      | Variable (scales with users) |
| **Community management**                                        | Fixed                        |
| **Marketing & content**                                         | Fixed                        |
| **Marketplace infrastructure** (payments, review, distribution) | Fixed + variable             |


**Most expensive:** Development of core platform and marketplace. The MCP server itself is lightweight (Node.js, no GPU, no heavy infra). Convex handles the database scaling.

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTBRAIN                                │
│                     "Give your AI a Product Brain"                  │
├──────────────────────┬──────────────────────┬───────────────────────┤
│     PROBLEM          │    SOLUTION          │  UNFAIR ADVANTAGE     │
│                      │                      │                       │
│ • AI starts from     │ • MCP Server for     │ • First MCP-native    │
│   zero every session │   real-time context  │   knowledge platform  │
│ • Knowledge is       │ • Living knowledge   │ • Knowledge graph     │
│   scattered & decays │   graph              │   network effects     │
│ • No ecosystem for   │ • Plugin marketplace │ • Open source moat    │
│   product knowledge  │   + dev tools        │ • Capture-during-work │
├──────────────────────┼──────────────────────┼───────────────────────┤
│  KEY METRICS         │  UVP                 │  CHANNELS             │
│                      │                      │                       │
│ • Active installs    │ First Time Good:     │ • GitHub (MIT)        │
│ • Entries created    │ AI gets it right on  │ • npm / npx           │
│ • First Time Good %  │ Run 1, not Run 4     │ • Cursor MCP          │
│ • Plugin installs    │                      │ • Interactive demo    │
│ • Cloud conversion   │                      │ • Marketplace         │
├──────────────────────┴──────────────────────┴───────────────────────┤
│  CUSTOMER SEGMENTS        │  REVENUE STREAMS                        │
│                           │                                         │
│ Early: Solo devs & small  │ • ProductBrain Cloud (freemium SaaS)    │
│   teams using Cursor      │ • Marketplace commission                │
│ Next: Enterprise product  │ • Plugin dev tools (pro subscription)   │
│   teams, agencies         │ • Enterprise features (SSO, compliance) │
├───────────────────────────┴─────────────────────────────────────────┤
│  COST STRUCTURE                                                     │
│  Development > Cloud hosting > Community > Marketing > Marketplace  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Brand Architecture


| Name                                           | What it is                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **ProductBrain (PB)**                          | The open source platform (MCP server, knowledge graph, plugin system). MIT licensed. Anyone can self-host, contribute, or build plugins. |
| **[SynergyOS.ai](http://SynergyOS.ai) (SYOS)** | The company behind ProductBrain. Operates the hosted cloud, curates the marketplace, and provides enterprise support.                    |
| **ProductBrain Cloud**                         | The managed hosting service run by SynergyOS. Zero-config, pay-as-you-grow alternative to self-hosting.                                  |
| **ProductBrain Marketplace**                   | The plugin ecosystem where developers sell and share extensions (industry templates, integrations, capture workflows).                   |


