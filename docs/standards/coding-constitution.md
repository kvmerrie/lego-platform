# Coding Constitution

## Engineering Posture

- Keep TypeScript strict.
- Prefer explicit names over clever abstractions.
- Optimize for maintainability, clarity, and future extension.
- Do not add complexity before the product needs it.
- If logic grows in an app or shell, move it into the correct library.

## Architecture Discipline

- Apps stay thin.
- Shell libraries stay thin.
- Apps compose shells and feature libraries, but do not absorb domain logic.
- Business logic belongs in libraries.
- Organize new code by domain and type before writing implementation.
- Preserve scope-based and type-based boundaries even when a shortcut feels faster.
- Treat current lint-enforced boundaries as authoritative.

## Import Discipline

- Use `@lego-platform/...` aliases for every cross-project import.
- Import only through `src/index.ts` public APIs.
- Never deep import another project.
- Never use cross-project relative imports.
- Treat circular dependencies as release-blocking issues.

## Library Responsibilities

- `shared/*`: cross-domain primitives only
- `*/util`: pure helpers, validation, mapping, constants, low-level reusable logic
- `*/data-access`: repositories, API clients, sync adapters, query abstractions, mappers, state access
- `*/ui`: presentational components only
- `*/feature-*`: concrete use-case orchestration
- `shell/*`: layout, navigation, theming, and app chrome

## Web Product Standards

- Build the public web experience for strong SEO, fast initial render, and future static-first delivery patterns.
- Prefer server-friendly and cache-friendly composition in the public portal.
- Avoid turning the web app into a runtime integration hub when sync or BFF patterns are safer.

## Design System Standards

- Support both light mode and dark mode.
- Aim for a premium, playful, clean, retail-grade experience.
- Accessibility is mandatory.
- Performance is mandatory.
- Consistency matters more than one-off visual cleverness.

## Content And Data Standards

- Contentful is for editorial and page-builder concerns only.
- Contentful owns curated pages, sections, ordering, and SEO fields.
- Set catalog data is not maintained manually in Contentful.
- External LEGO APIs are sync inputs and enrichment sources, not runtime-critical dependencies for core product flows.

## Testing Posture

- Keep test setup simple, but write code that is easy to test.
- Prefer tests around util and data-access logic first.
- Use feature tests to verify orchestration behavior.
- Avoid bloated snapshot-heavy UI testing that duplicates simpler lower-level coverage.

## Documentation Rules

- When adding a domain, boundary exception, or structural pattern, update the relevant docs in the same change.
- If dependency enforcement changes, update both the lint rules and the docs together.
- If there is a gap between current reality and intended evolution, document both clearly.

## Evolution Rules

- Add admin-specific Angular domain libraries when admin workflows become substantial.
- Do not reuse web-only React UI libraries inside Angular.
- Place integration-specific adapters in `data-access` or `apps/api`.
- Promote truly cross-domain concerns into `shared/*` deliberately rather than copying code.
