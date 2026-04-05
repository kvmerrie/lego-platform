# Repository Guidance

This file is the durable source of truth for Codex tasks and day-to-day engineering decisions in this repository. Read it before making structural changes.

## Product Direction

- This repository powers a LEGO collector platform.
- The MVP lets users browse LEGO sets and mark them as owned or wanted.
- The public experience must be SEO-friendly, highly performant, and ready for static generation and ISR patterns.
- The roadmap includes pricing history, affiliate offers, editorial content, richer social or media features, and eventually mobile or native clients.

## Stack Direction

- `Nx` monorepo with `pnpm`
- `apps/web`: Next.js public portal
- `apps/admin`: Angular admin and CRUD surface
- `apps/api`: Node/Fastify BFF
- `Contentful`: editorial and page-builder content only
- External LEGO APIs: sync and enrichment sources, not runtime-critical page dependencies

## Non-Negotiable Architecture Rules

- Apps stay thin.
- Apps compose shells and feature libraries, but do not own business logic.
- Business logic belongs in libraries.
- Libraries are organized by domain and type.
- Primary library types are `feature`, `ui`, `data-access`, and `util`.
- Shared support libraries also exist for `config`, `design-system`, and `testing`.
- All cross-project imports go through the public API entrypoint at `src/index.ts`.
- No deep imports.
- No circular dependencies.
- Shared libraries may not depend on domain libraries.
- UI libraries are presentational and may not depend directly on data-access libraries.
- Feature libraries orchestrate `ui`, `data-access`, and `util` within the enforced boundaries.
- Shell libraries own layout and app chrome and must stay thin.

## Current Workspace Reality

- Domain `util` and `data-access` libraries are shared business layers.
- Current domain `ui` and `feature-*` libraries are web-facing React libraries.
- The Angular admin surface currently uses `libs/shell/admin` plus shared and domain `util` or `data-access` libraries where appropriate.
- When the admin surface grows, add admin-specific Angular domain libraries instead of reusing web React UI libraries.
- Treat the current ESLint policy as authoritative: feature libraries do not depend on other feature libraries at all.

## Design System Guidance

- The design system must support both light and dark mode, even if only light mode is currently surfaced in the product.
- The product should feel premium, playful, clean, and retail-grade.
- Take inspiration from lego.com, but do not clone it.
- Accessibility, consistency, and performance are mandatory.

## Product Tone And Voice

- Product copy should feel clear, human, calm, and confident.
- The brand should reflect imagination, creativity, fun, learning, caring, and quality without becoming fluffy or childish.
- Write like a thoughtful collector guide: warm, practical, and slightly playful when it helps clarity.
- Favor concrete language that explains what the user can do, what happened, and what comes next.
- Keep trust high: be explicit about what is reviewed, tracked, private, public, available, unavailable, or still building.
- Prefer short, product-shaped phrasing over corporate or marketing-heavy language.
- When in doubt, choose clarity first, charm second.

Short examples:

- Avoid: Optimize your collection management workflow
- Prefer: Keep track of what you own and what you still want

- Avoid: Pricing intelligence is unavailable at this time
- Prefer: Reviewed pricing is not published for this set yet

- Avoid: Unlock premium personalization
- Prefer: Sign in to save your private collector state

---

## Brickhunt Copy Principles (Critical)

This section is stricter than the general Product Tone And Voice.
If they conflict, this section wins.

Brickhunt is not a catalog. It helps collectors choose.

All product-facing copy (set overlays, homepage, feature surfaces, emails) must:

- help users decide between sets
- explain why a set is worth getting
- sound like advice from a LEGO fan, not a product description

### Core Writing Rule

Every piece of copy must answer at least one of:

- Why would I choose this set?
- What makes this better than alternatives?
- What do I get when I own this?

If it does not help the user decide, it should be rewritten.

---

## Decision-Oriented Copy

Prefer:

- “If you pick one set, this is the one”
- “Choose this if you want…”
- “This works best if…”

Avoid:

- neutral descriptions without guidance
- explaining what something is without helping the user choose

---

## Concrete Over Abstract

Always anchor copy in something tangible:

Prefer:

- scenes (e.g. Council of Elrond)
- places (Hogwarts, Rivendell, Avengers Tower)
- characters (minifigures, cast)
- objects (ships, buildings, vehicles)

Avoid:

- nice display
- recognizable set
- strong choice
- good value
- feels like

---

## LEGO-Specific Value

Explain why the set is attractive as a LEGO product:

- minifigure appeal
- build experience
- display silhouette
- scale and presence
- scene density
- how it looks on a shelf

---

## Positioning And Contrast

Whenever possible, include:

- why this set stands out within its theme
- how it compares to similar sets

Examples:

- light vs dark (Rivendell vs Barad-dûr)
- compact vs large (Hogwarts variants)
- display vs play vs cast-focused

---

## Ownership Feeling

Help the user imagine owning it:

- what stands out first on a shelf
- what keeps it interesting over time
- how it changes the look of a collection

---

## Tone

- Dutch, natural, slightly conversational
- confident, not hesitant
- specific, not vague
- fan-aware, not niche or cringe
- avoid corporate or SaaS language entirely

---

## Hard Avoids

Do NOT use:

- SaaS language (platform, solution, insights)
- internal terms (editorial, merchandising, curation)
- vague fillers (voelt, vaak, meestal, vrij)
- generic praise without explanation

---

## Copy Quality Bar (Definition of Done)

Copy is only acceptable if it passes all of the following:

### 1. Decision Test

A user should be able to answer:

- Should I buy this set or not?
- Why would I pick this over another one?

---

### 2. Specificity Test

Must include at least one:

- scene
- character
- place
- visual element

---

### 3. Replacement Test

If the text works for another set, it is too generic.

---

### 4. Shelf Test

Must describe:

- what stands out first
  OR
- what keeps it interesting

---

### 5. No-Fluff Test

Remove anything that:

- adds no decision value
- sounds like marketing

---

## Enforcement Rule

If copy does not pass these checks:

- rewrite instead of tweaking
- do not ship “almost good” copy

---

## Content And Data Guidance

- Contentful is only for editorial and page-builder use cases.
- Contentful owns pages, sections, ordering, curated content, and SEO fields.
- Set catalog data is not manually maintained in Contentful.
- Runtime user and catalog experiences must not depend on editorial CMS uptime for core catalog integrity.

## Accessibility And UX Quality

- The product must meet WCAG 2.1 AA accessibility standards as a baseline.
- Use semantic HTML wherever possible.
- All interactive elements must be keyboard accessible and have visible focus states.
- Images must include meaningful alt text.
- Color contrast must meet accessibility guidelines.
- Avoid using color alone to communicate meaning.
- Ensure clear heading hierarchy.
- Prefer simple, readable layouts.

## Icons

- Use lucide-react
- Keep icons consistent
- No multiple icon libraries
- No decorative misuse

## UI Component API Guidance

- Keep UI components dumb and presentational
- No page-specific naming
- Use generic variants (compact, featured, etc.)

## Storybook Guidance

- Cover reusable UI components
- Focus on visual refinement

## Change Rules

- Preserve Nx boundaries
- Use @lego-platform imports
- Respect lint rules
- Update docs when changing architecture

## Pre-Launch Indexing

- Keep noindex active
- Block crawlers via robots.txt
- Only enable indexing when explicitly approved

## Completion And Validation Rules

- Run format, lint, test, build
- Run sync checks when needed
- Do not claim done with dirty working tree

## Reference Docs

- docs/architecture/product-vision.md
- docs/architecture/nx-workspace-blueprint.md
- docs/operations/catalog-sync.md
- docs/operations/commerce-sync.md
- docs/operations/mvp-deployment-runbook.md
- docs/operations/mvp-release-checklist.md
- docs/standards/coding-constitution.md
