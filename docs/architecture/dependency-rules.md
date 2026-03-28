# Dependency Rules

## Enforcement Sources

Dependency boundaries are enforced primarily through:

- Nx project tags
- root ESLint module-boundary rules
- file-level cycle detection

The rules in this document should match the actual enforcement in the workspace. If this document and the lint rules ever diverge, treat the enforced rule set as authoritative until the docs are updated.

## Tag Model

Every project must have exactly:

- one scope tag
- one type tag
- one platform tag

### Scope Tags

- `scope:shared`
- `scope:shell`
- `scope:catalog`
- `scope:collection`
- `scope:wishlist`
- `scope:pricing`
- `scope:affiliate`
- `scope:content`
- `scope:user`
- `scope:api`

### Type Tags

- `type:app`
- `type:feature`
- `type:ui`
- `type:data-access`
- `type:util`
- `type:config`
- `type:design-system`
- `type:testing`

### Platform Tags

- `platform:web`
- `platform:admin`
- `platform:server`
- `platform:shared`

## Type Rules

- `type:app` may depend on `feature`, `ui`, `data-access`, `util`, `config`, `design-system`, `testing`
- `type:feature` may depend on `ui`, `data-access`, `util`, `config`, `design-system`, `testing`
- `type:ui` may depend on `ui`, `util`, `config`, `design-system`
- `type:data-access` may depend on `data-access`, `util`, `config`
- `type:util` may depend on `util`, `config`
- `type:config` may depend only on `config`
- `type:design-system` may depend on `design-system`, `util`, `config`
- `type:testing` may depend on library types only, never apps

Current enforced reality:

- feature libraries do not depend on other feature libraries at all, including feature libraries in the same domain
- shell libraries are tagged as `type:feature`, so they inherit feature-type dependency rules even though their behavioral role is thin layout and app composition

## Scope Rules

- `scope:shared` may depend only on `scope:shared`
- `scope:shell` may depend on `scope:shared`, `scope:shell`, and domain scopes
- domain scopes may depend only on themselves plus `scope:shared` and `scope:shell`
- `scope:api` may depend on `scope:api`, `scope:shared`, and domain scopes, but not `scope:shell`

## Platform Rules

- `platform:web` may depend on `platform:web` and `platform:shared`
- `platform:admin` may depend on `platform:admin` and `platform:shared`
- `platform:server` may depend on `platform:server` and `platform:shared`
- `platform:shared` may depend only on `platform:shared`

## Architectural Interpretation

- Apps are wiring layers that compose shells and feature libraries, not business layers.
- Shared libraries must remain domain-neutral.
- UI libraries are presentational and must not import data-access libraries.
- Feature libraries orchestrate allowed lower layers.
- If a cross-domain need appears, solve it through shared contracts, a lower-level abstraction, or an API/BFF boundary rather than a shortcut import.
- Do not route Angular admin work through web React feature libraries.

## Public API Rule

All cross-project imports must go through the library public API:

- allowed: `@lego-platform/catalog/data-access`
- not allowed: `@lego-platform/catalog/data-access/src/lib/catalog-data-access`
- not allowed: `../../catalog/data-access/src/lib/catalog-data-access`

Every library must expose `src/index.ts`.

## Circular Dependency Rule

Circular dependencies are architectural regressions at both levels:

- project-level cycles are disallowed
- file-level import cycles are disallowed

If two parts of the system want each other, use one of these fixes:

1. move the shared contract into `shared/*`
2. move orchestration upward into a feature, shell, or app layer
3. introduce an API/BFF boundary
