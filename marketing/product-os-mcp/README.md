# Marketing — Product OS MCP

**This folder is completely isolated from the rest of the system.**

Everything in `/marketing/` is self-contained. No imports, no shared dependencies, no build pipeline integration with the MCP server or Convex backend. It's plain HTML + CSS that you open in a browser.

## Rules

1. **No imports from parent directories.** Nothing in this folder references `../src/`, `../convex/`, or any other part of the codebase.
2. **No shared build step.** This does not run through the project's `npm run build`, `tsconfig`, or any bundler. It has no `package.json`.
3. **No shared dependencies.** All CSS is inline or local. No Tailwind, no PostCSS, no build tools. If it needs a font, it loads from a CDN.
4. **Changes here cannot break the system.** You can delete this entire folder and the MCP server continues to work. You can rewrite every file here and nothing else is affected.
5. **No secrets.** This is a public marketing page. No API keys, no environment variables, no `.env` files.
6. **Outputs feed the Product Brain.** Marketing decisions, positioning choices, and growth learnings should be captured as KB entries in SynergyOS using Product OS MCP.

## What's here

```
marketing/
├── shared/                          ← Reusable component system
│   ├── styles.css                   ← Design tokens + shared component CSS
│   └── animations.js                ← Scroll-triggered fade-in observer
├── index.html                       ← Marketing & Growth hub page
├── product-os-mcp/
│   ├── README.md                    ← You are here
│   └── index.html                   ← Product landing page
└── prototypes/
    └── synergyos-homepage.html      ← SynergyOS.ai homepage prototype
```

## How to use

```bash
# Open the marketing hub
open marketing/index.html

# Open the product landing page
open marketing/product-os-mcp/index.html

# Or serve it locally
npx serve marketing
```

## Why isolated?

The MCP server is the product. This folder is the pitch. They change at different speeds, for different reasons, by different people. Coupling them would mean marketing changes risk breaking the server, and server changes risk breaking the page. Neither is acceptable.

---

## Shared Component System

The `shared/` directory contains reusable CSS and JavaScript that any marketing page can link to. This eliminates copy-paste drift while preserving the zero-build-step principle.

### Quick start — new page template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title — SynergyOS.ai</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../shared/styles.css">
  <style>
    /* Page-specific overrides and custom sections go here */
  </style>
</head>
<body>

<div class="glow glow--indigo"></div>

<nav class="nav">
  <div class="container">
    <a href="#" class="nav-brand">
      <span class="dot"></span>
      SynergyOS<span style="color:var(--text-dim);font-weight:400">.ai</span>
    </a>
    <ul class="nav-links">
      <li><a href="#section1">Section 1</a></li>
      <li><a href="#section2">Section 2</a></li>
    </ul>
    <div class="nav-actions">
      <a href="https://github.com/synergyai-os/product-os-mcp" class="btn btn-ghost">GitHub</a>
      <a href="https://synergyos.ai" class="btn btn-primary">Get started</a>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="container">
    <div class="hero-badge"><span class="pulse"></span> Badge Text</div>
    <h1>Headline with <span class="gradient">gradient text</span></h1>
    <p class="hero-sub">Subtitle paragraph describing the page.</p>
    <div class="hero-actions">
      <a href="#" class="btn btn-primary">Primary CTA</a>
      <a href="#" class="btn btn-ghost">Secondary CTA</a>
    </div>
  </div>
</section>

<!-- Your sections here -->

<footer class="footer">
  <div class="container">
    <span>Footer text</span>
    <div class="footer-links">
      <a href="#">Link 1</a>
      <a href="#">Link 2</a>
    </div>
  </div>
</footer>

<script src="../shared/animations.js" defer></script>

</body>
</html>
```

### Theming

Override the accent color per page by adding CSS variables after the shared stylesheet:

```html
<link rel="stylesheet" href="../shared/styles.css">
<style>
  :root {
    --accent: #fb923c;       /* orange */
    --accent-bright: #fdba74;
    --accent-dim: #ea580c;
  }
</style>
```

Preset themes:

| Theme   | `--accent` | `--accent-bright` | `--accent-dim` |
|---------|------------|--------------------|-----------------|
| Indigo  | `#818cf8`  | `#a5b4fc`          | `#4f46e5`       |
| Orange  | `#fb923c`  | `#fdba74`          | `#ea580c`       |

### Available components

#### Layout

| Class            | Description                                  |
|------------------|----------------------------------------------|
| `.container`     | 1120px max-width centered wrapper            |
| `.glow`          | Fixed ambient background glow                |
| `.glow--indigo`  | Indigo glow variant                          |
| `.glow--orange`  | Orange glow variant                          |
| `.glow--blend`   | Orange + purple blend glow                   |

#### Navigation

| Class          | Description                                    |
|----------------|------------------------------------------------|
| `.nav`         | Sticky nav bar with backdrop blur              |
| `.nav-brand`   | Brand logo with colored `.dot`                 |
| `.nav-links`   | Horizontal link list (hidden on mobile)        |
| `.nav-actions` | Right-aligned action buttons                   |

#### Hero / Page Header

| Class              | Description                                |
|--------------------|--------------------------------------------|
| `.hero`            | Full hero section (centered text)          |
| `.hero-badge`      | Pill badge above headline                  |
| `.hero-badge--accent` | Accent-colored badge variant            |
| `.hero h1 .gradient` | Gradient text within headline            |
| `.hero-sub`        | Hero subtitle                              |
| `.hero-lead`       | Emphasized lead paragraph                  |
| `.hero-actions`    | CTA button row                             |
| `.page-header`     | Alternative compact header for sub-pages   |

#### Section Headers

| Class            | Description                              |
|------------------|------------------------------------------|
| `.section-label` | Uppercase colored label above title      |
| `.section-title` | Large responsive heading                 |
| `.section-sub`   | Muted subtitle below heading             |

#### Buttons

| Class          | Description                                    |
|----------------|------------------------------------------------|
| `.btn`         | Base button (required)                         |
| `.btn-primary` | Filled accent-colored button                   |
| `.btn-ghost`   | Transparent bordered button                    |
| `.btn-subtle`  | Lightly tinted accent button                   |
| `.btn-full`    | Full-width button modifier                     |

#### Cards

| Class           | Description                                   |
|-----------------|-----------------------------------------------|
| `.card`         | Base card (bg, border, radius, hover)         |
| `.card--lift`   | Card with translateY hover effect             |
| `.card .icon`   | Emoji/icon block inside card                  |
| `.card-grid`    | Auto-fit grid for cards (300px min)           |
| `.card-grid--narrow` | Narrower cards (240px min)              |
| `.card-grid--wide`   | Wider cards (320px min)                 |

#### Tags & Status

| Class             | Description                                 |
|-------------------|---------------------------------------------|
| `.tag`            | Inline category tag                         |
| `.tag--accent`    | Accent-colored tag                          |
| `.tag--green`     | Green tag                                   |
| `.tag--orange`    | Orange tag                                  |
| `.tag--purple`    | Purple tag                                  |
| `.status`         | Status pill for cards                       |
| `.status--active` | Green "active" status                       |
| `.status--planned`| Indigo "planned" status                     |
| `.status--idea`   | Muted "idea" status                         |

#### Callout

| Class              | Description                                |
|--------------------|--------------------------------------------|
| `.callout`         | Bordered highlight box (720px max)         |
| `.callout--accent` | Accent-tinted callout                      |
| `.callout--orange` | Orange-tinted callout                      |
| `.callout--purple` | Purple-tinted callout                      |

#### Steps

| Class       | Description                                      |
|-------------|--------------------------------------------------|
| `.steps`    | Numbered step list container                     |
| `.step`     | Individual step row                              |
| `.step-num` | Circular number indicator                        |

#### Comparison

| Class                | Description                              |
|----------------------|------------------------------------------|
| `.compare`           | Two-column comparison grid               |
| `.compare-col`       | Individual column                        |
| `.compare-col--bad`  | Red-tinted "before" column               |
| `.compare-col--good` | Green-tinted "after" column              |

#### Code Block

| Class         | Description                                     |
|---------------|-------------------------------------------------|
| `.code-block` | Terminal-style code container                   |
| `.chrome`     | macOS-style title bar with traffic light dots   |

#### CTA Section

| Class          | Description                                    |
|----------------|------------------------------------------------|
| `.cta`         | Full-width call-to-action section              |
| `.cta-actions` | Centered button group                          |

#### Footer

| Class           | Description                                   |
|-----------------|-----------------------------------------------|
| `.footer`       | Page footer with border-top                   |
| `.footer-links` | Horizontal link group                         |

#### Utilities

| Class            | Description                                  |
|------------------|----------------------------------------------|
| `.fade-in`       | Scroll-triggered fade-in (needs animations.js) |
| `.gradient-text`  | Gradient accent text                        |

### Design tokens (CSS variables)

All pages share these tokens. Override `--accent-*` per page for theming.

```css
--bg: #09090b          /* Page background */
--bg-subtle: #111113   /* Subtle background */
--bg-card: #18181b     /* Card background */
--border: #27272a      /* Default border */
--border-hover: #3f3f46 /* Hover border */
--text: #fafafa        /* Primary text */
--text-muted: #a1a1aa  /* Secondary text */
--text-dim: #71717a    /* Tertiary text */
--accent: #818cf8      /* Primary accent (override per page) */
--accent-bright: #a5b4fc
--accent-dim: #4f46e5
--green: #34d399       /* Success / positive */
--red: #f87171         /* Error / negative */
--orange: #fb923c      /* SynergyOS brand orange */
--purple: #c084fc      /* Gradient secondary */
--radius: 12px         /* Default border-radius */
--radius-sm: 8px       /* Small border-radius */
--font-sans            /* Inter stack */
--font-mono            /* Monospace stack */
```

### Section anatomy

Every content section follows the same structure:

```html
<section class="my-section fade-in" id="my-section">
  <div class="container">
    <span class="section-label">Label</span>
    <h2 class="section-title">Title</h2>
    <p class="section-sub">Subtitle text.</p>

    <div class="card-grid">
      <div class="card">
        <span class="icon">&#128196;</span>
        <h3>Card title</h3>
        <p>Card description.</p>
      </div>
      <!-- more cards -->
    </div>
  </div>
</section>
```

### Page-specific styles

Any styles unique to a single page go in an inline `<style>` block **after** the shared stylesheet link. This keeps page-specific concerns isolated while inheriting all shared tokens and components.
