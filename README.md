# lego-platform

Production-grade Nx monorepo bootstrap for a LEGO collector platform with a high-performance public portal, an Angular admin portal, and a Node BFF.

## Workspace overview

- `apps/web`: Next.js public portal, App Router ready, library-driven composition.
- `apps/admin`: Angular standalone admin portal for CRUD and operational workflows.
- `apps/api`: Fastify-based Node BFF for backend and integration orchestration.

- `libs/shared/*`: cross-cutting config, types, util, design tokens, UI helpers, and testing primitives.
- `libs/shell/*`: app shells and top-level layout orchestration.
- `libs/<domain>/*`: domain-owned util, data-access, UI, and feature libraries.

## Architecture principles

- Apps stay thin. Business and view orchestration live in libraries.
- All cross-project imports go through public entrypoints such as `@lego-platform/catalog/data-access`.
- Shared scope stays domain-neutral and may not depend on domain libraries.
- UI libraries remain presentational and never reach into data-access directly.
- Feature libraries orchestrate UI + data-access + util inside their own domain.
- Module boundaries are enforced with Nx tags plus ESLint, not just team convention.
- Domain data-access and util libraries are kept framework-agnostic for future reuse in admin, API, and native clients.
- Current domain UI and feature libraries are web-facing React libraries. The Angular admin shell composes shared and domain data-access/util libraries directly until admin-specific domain UI/features are introduced.

## Run the apps

```bash
pnpm install
pnpm dev:web
pnpm dev:admin
pnpm dev:api
```

Useful workspace commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm format:check
pnpm graph
```

## Generate new libraries correctly

Use the library type that matches the responsibility and tag it explicitly.

Examples:

```bash
pnpm nx g @nx/js:library --name=catalog-search-util --directory=libs/catalog/search-util --importPath=@lego-platform/catalog/search-util --tags=scope:catalog,type:util,platform:shared
pnpm nx g @nx/react:library --name=catalog-feature-search --directory=libs/catalog/feature-search --importPath=@lego-platform/catalog/feature-search --tags=scope:catalog,type:feature,platform:web
pnpm nx g @nx/angular:library --name=admin-reporting --directory=libs/shell/reporting --importPath=@lego-platform/shell/reporting --tags=scope:shell,type:feature,platform:admin
```

Rules to keep:

- Pick one scope tag, one type tag, and one platform tag for every project.
- Never deep import from another project. Always use the package alias.
- Keep admin-specific Angular UI/features separate from the current web-facing React UI/features.
- Put reusable contracts and theme logic in `libs/shared/*` first when they are truly cross-domain.

## Docs

- `docs/architecture/nx-workspace-blueprint.md`
- `docs/architecture/dependency-rules.md`
- `docs/standards/coding-constitution.md`
