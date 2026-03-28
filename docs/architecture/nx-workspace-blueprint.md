# Nx Workspace Blueprint

## Purpose

This workspace is built for long-term maintainability, low initial cost, and clean scaling. Nx is the primary mechanism for keeping application surfaces separate while sharing stable business logic, contracts, and tooling.

## Runtime Applications

- `apps/web`
  - Next.js public portal
  - App Router structure
  - Optimized for future static generation, ISR, SEO, and strong performance
- `apps/admin`
  - Angular standalone admin and CRUD portal
  - Intended for curation, moderation, editorial support, and operational workflows
- `apps/api`
  - Node/Fastify BFF
  - Owns orchestration, integration boundaries, aggregation, and future auth or job concerns

## Workspace Shape

### Shared

- `libs/shared/config`
- `libs/shared/types`
- `libs/shared/util`
- `libs/shared/design-tokens`
- `libs/shared/ui`
- `libs/shared/testing`

Shared libraries are domain-neutral. If a library needs catalog, pricing, user, or any other domain knowledge, it does not belong in `shared`.

### Shell

- `libs/shell/web`
- `libs/shell/admin`

Shell libraries own product-level layout, navigation, theming, and app chrome. Apps compose domain feature libraries into those shells. Shell libraries are not business-logic layers.

### Domains

Current domains in the repo:

- `catalog`
- `collection`
- `wishlist`
- `pricing`
- `affiliate`
- `content`
- `user`

Each domain uses a predictable structure when needed:

- `util`
- `data-access`
- `ui`
- `feature-*`

This keeps the workspace easy to navigate and makes future growth easier than app-local sprawl.

## Type Responsibilities

- `util`: pure helpers, validation, constants, mapping, low-level reusable logic
- `data-access`: repositories, API clients, sync adapters, query abstractions, mappers, state access
- `ui`: presentational components only
- `feature-*`: orchestration for a concrete use case

The repo also uses shared support types:

- `config`
- `design-system`
- `testing`

## Current Platform Split

Current reality in this workspace:

- Domain `util` and `data-access` libraries are `platform:shared`
- Domain `ui` and `feature-*` libraries are currently `platform:web`
- `libs/shell/admin` is Angular-based and may use shared and domain `util` or `data-access` libraries, but it stays separate from the web React UI layer

This is intentional for v1:

- shared business logic stays reusable across web, admin, API, and future mobile clients
- React UI is not forced into Angular
- admin-specific Angular domain features can be added later without restructuring the repo

## Import And Naming Rules

- Project names must stay explicit and unique, such as `catalog-data-access` or `pricing-feature-price-history`
- Project names and aliases should match the folder structure to keep the repo predictable
- Import paths must use public package aliases only
- Every library exposes a public API through `src/index.ts`
- Cross-project relative imports and deep imports are architectural violations

Examples:

- `@lego-platform/shared/ui`
- `@lego-platform/catalog/data-access`
- `@lego-platform/user/feature-profile`

## Evolution Guidance

- Add Contentful delivery and preview clients under `content/data-access`
- Keep the initial Contentful model aligned with `docs/architecture/contentful-editorial-model.md`
- Use `docs/architecture/contentful-space-setup.md` for repeatable space setup and editor workflow
- Treat external LEGO APIs as sync sources, not page-critical runtime dependencies
- Keep catalog truth outside Contentful; use Contentful for editorial structure and SEO-driven page composition
- Add admin-specific Angular domain libraries when admin workflows need reusable domain surfaces
- Add mobile-focused libraries with explicit platform boundaries rather than stretching the current web UI layer
