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

- Light mode and dark mode are both required.
- The product should feel premium, playful, clean, and retail-grade.
- Take inspiration from the quality bar of `lego.com`, but do not clone it.
- Accessibility, consistency, and performance are mandatory.

## Content And Data Guidance

- Contentful is only for editorial and page-builder use cases.
- Contentful owns pages, sections, ordering, curated content, and SEO fields.
- Set catalog data is not manually maintained in Contentful.
- Runtime user and catalog experiences must not depend on editorial CMS uptime for core catalog integrity.

## Change Rules

- Preserve the Nx tag model and boundary enforcement.
- Keep import aliases in the `@lego-platform/...` form.
- If you add a new project, give it exactly one scope tag, one type tag, and one platform tag.
- If guidance and lint enforcement ever diverge, follow the enforced rule set first and update the docs in the same change.
- If you change a boundary rule, update both the lint enforcement and the docs in the same change.
- If current reality differs from the intended target architecture, document the current state and the intended evolution explicitly instead of hiding the mismatch.

## Reference Docs

- `docs/architecture/product-vision.md`
- `docs/architecture/nx-workspace-blueprint.md`
- `docs/architecture/contentful-editorial-model.md`
- `docs/architecture/contentful-space-setup.md`
- `docs/architecture/contentful-preview-usage.md`
- `docs/architecture/contentful-validation-rollout-checklist.md`
- `docs/architecture/dependency-rules.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/catalog-sync-validation.md`
- `docs/standards/coding-constitution.md`
