# Repository Guidance

This file is the durable source of truth for Codex tasks and day-to-day engineering decisions in this repository. Read it before making structural changes.

---

## Product Direction

- This repository powers a LEGO collector platform.
- The MVP lets users browse LEGO sets and mark them as owned or wanted.
- The public experience must be SEO-friendly, highly performant, and ready for static generation and ISR patterns.
- The roadmap includes pricing history, affiliate offers, editorial content, richer social or media features, and eventually mobile or native clients.

---

## Stack Direction

- `Nx` monorepo with `pnpm`
- `apps/web`: Next.js public portal
- `apps/admin`: Angular admin and CRUD surface
- `apps/api`: Node/Fastify BFF
- `Contentful`: editorial and page-builder content only
- External LEGO APIs: sync and enrichment sources, not runtime-critical page dependencies

---

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

---

## Current Workspace Reality

- Domain `util` and `data-access` libraries are shared business layers.
- Current domain `ui` and `feature-*` libraries are web-facing React libraries.
- The Angular admin surface currently uses `libs/shell/admin` plus shared and domain `util` or `data-access` libraries where appropriate.
- When the admin surface grows, add admin-specific Angular domain libraries instead of reusing web React UI libraries.
- Treat the current ESLint policy as authoritative.

---

## Design System Guidance

- The design system must support both light and dark mode.
- The product should feel premium, playful, clean, and retail-grade.
- Take inspiration from lego.com, but do not clone it.
- Accessibility, consistency, and performance are mandatory.

---

# Brickhunt Copy System (Critical)

This overrides general tone rules.
If anything conflicts, this section wins.

## Purpose

Brickhunt is not a catalog.
It helps collectors choose.

All product-facing copy must:

- help users decide between sets
- explain why a set is worth getting
- feel like advice from a LEGO fan

---

## Core Writing Rule

Every piece of copy must answer at least one of:

- Why would I choose this set?
- What makes this better than alternatives?
- What do I get when I own this?

If it doesn’t help a decision → rewrite it.

---

## Tone

- Natural Dutch
- Slightly conversational
- Confident, not hesitant
- Specific, not vague
- Fan-aware, not niche or cringe
- Never corporate or SaaS-like

---

## Natural Language Rule

Copy must sound like a real person.

Avoid:

- “sets om verder te openen”
- “thematische lijnen om in te bladeren”

Prefer:

- “begin hier”
- “dit zijn goede keuzes”
- “hier wil je kijken”

If it sounds translated → rewrite it.

---

## LEGO Specificity

Copy must trigger recognition or imagination.

Always prefer:

- scenes (Council of Elrond)
- places (Hogwarts, Rivendell)
- characters (minifigures)
- objects (ships, buildings)

Avoid generic phrasing:

- “goede keuze”
- “mooie set”
- “interessant product”

If it could be used on a cooking or fashion site → rewrite it.

---

## Decision-Oriented Copy

Prefer:

- “Als je er één kiest, pak deze”
- “Kies deze als je …”
- “Dit werkt het best als …”

Avoid:

- neutral descriptions
- explaining without guiding

---

## Ownership Feeling

Help the user imagine owning it:

- what stands out first on a shelf
- what keeps it interesting
- how it changes a collection

---

## Copy Rhythm And Punch

Copy must be:

- short
- scannable
- direct

Avoid:

- long sentences
- multi-clause explanations
- describing the product instead of triggering interest

Prefer:

- 1–2 short sentences
- strong phrasing
- emotional clarity

Example:

Bad:
"Brickhunt laat zien welke set blijft hangen en waar hij goed geprijsd is."

Good:
"Dit zijn de sets die blijven hangen."

---

## Hard Avoids

Do NOT use:

- SaaS language (platform, solution, insights)
- internal terms (editorial, merchandising, curation)
- vague fillers (voelt, vaak, meestal, vrij)
- generic praise without explanation

---

## Copy Quality Bar (Definition of Done)

Copy is only acceptable if it passes:

### 1. Decision Test

Can the user decide something?

### 2. Specificity Test

Contains a scene, place, character, or visual element.

### 3. Replacement Test

If it fits another set → too generic.

### 4. Shelf Test

Describes what stands out or stays interesting.

### 5. No-Fluff Test

No useless or marketing filler.

---

## Enforcement Rule

If copy fails:

- rewrite instead of tweaking
- do not ship “almost good”

---

## Content And Data Guidance

- Contentful is for editorial only.
- Catalog data is not manually maintained in Contentful.
- Core catalog must not depend on CMS uptime.

---

## Accessibility And UX Quality

- WCAG 2.1 AA baseline
- Semantic HTML
- Keyboard accessibility
- Visible focus states
- Proper contrast
- No color-only meaning
- Clear heading hierarchy

---

## Icons

- Use `lucide-react`
- Keep consistent
- No multiple icon systems

---

## UI Component API Guidance

- UI components are presentational only
- No page-specific naming
- Use generic variants (compact, featured, etc.)

---

## Admin UX And Design Rules

These rules are separate from the public web experience.

### Public Web

- The public site is collector-facing, premium, playful, visual, and editorial.
- It should feel polished, brand-led, and emotionally engaging.
- Public-facing UI may use richer presentation patterns, stronger branding, and more expressive layout.

### Admin

- The admin is operator-facing and should behave like a compact SaaS/CRUD tool.
- Prefer density, clarity, and speed over branding or visual flourish.
- Admin should feel closer to tools like Supabase, Stripe Dashboard, Linear, or a clean backoffice.
- Use compact spacing, clear table layouts, filters, sorting, bulk actions, and status badges.
- Default admin surfaces to data tables and structured forms, not marketing-style cards or editorial sections.
- Avoid reusing public-web presentation components when they reduce density or operator efficiency.
- When admin grows, prefer admin-specific Angular feature/ui libraries over adapting public React UI patterns.

### Separation Rule

- Do not apply public-site copy, layout, or visual design rules to admin by default.
- Public web and admin may share low-level tokens and primitives where useful, but they are different UX systems.
- If there is doubt, optimize admin for operational efficiency, not brand expression.

---

## Storybook Guidance

- Cover reusable UI components
- Focus on visual refinement

---

## Change Rules

- Preserve Nx boundaries
- Use `@lego-platform/...` imports
- Follow lint rules
- Update docs when changing architecture

---

## Pre-Launch Indexing

- Keep `noindex, nofollow`
- Block via `robots.txt`
- Only enable indexing when explicitly approved

---

## Completion And Validation Rules

- Run format, lint, test, build
- Run sync checks where needed
- Do not mark done with a dirty working tree

---

## Reference Docs

- docs/architecture/product-vision.md
- docs/architecture/nx-workspace-blueprint.md
- docs/operations/catalog-sync.md
- docs/operations/commerce-sync.md
- docs/operations/mvp-deployment-runbook.md
- docs/operations/mvp-release-checklist.md
- docs/standards/coding-constitution.md
