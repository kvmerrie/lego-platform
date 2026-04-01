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
- Take inspiration from the quality bar of `lego.com`, but do not clone it.
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

- Avoid: `Optimize your collection management workflow`
- Prefer: `Keep track of what you own and what you still want`
- Avoid: `Pricing intelligence is unavailable at this time`
- Prefer: `Reviewed pricing is not published for this set yet`
- Avoid: `Unlock premium personalization`
- Prefer: `Sign in to save your private collector state`

## Content And Data Guidance

- Contentful is only for editorial and page-builder use cases.
- Contentful owns pages, sections, ordering, curated content, and SEO fields.
- Set catalog data is not manually maintained in Contentful.
- Runtime user and catalog experiences must not depend on editorial CMS uptime for core catalog integrity.

## Accessibility And UX Quality

- The product must meet WCAG 2.1 AA accessibility standards as a baseline.
- Use semantic HTML wherever possible (headings, lists, buttons, landmarks).
- All interactive elements must be keyboard accessible and have visible focus states.
- Images must include meaningful alt text where they convey content.
- Color contrast must meet accessibility guidelines, especially for buttons, badges, and pricing signals.
- Avoid using color alone to communicate meaning (e.g. deal states).
- Ensure clear and consistent heading hierarchy for SEO and screen readers.
- Prefer simple, readable layouts over visually complex patterns.

## Icons

- Use a single, consistent icon system across the product.
- Prefer `lucide-react` for all icons.
- Do not introduce multiple icon libraries.
- Do not inline custom SVGs unless there is a strong reason.
- Icons should be used to support clarity and affordance, not decoration.
- Common actions (search, close, navigation, profile, wishlist) should use consistent icon semantics.

Implementation guidance:

- Prefer using a shared `<Icon />` component from the design system layer instead of importing icons directly in feature or UI libraries.
- Keep icons lightweight and consistent in size and stroke.

## Change Rules

- Preserve the Nx tag model and boundary enforcement.
- Keep import aliases in the `@lego-platform/...` form.
- If you add a new project, give it exactly one scope tag, one type tag, and one platform tag.
- If guidance and lint enforcement ever diverge, follow the enforced rule set first and update the docs in the same change.
- If you change a boundary rule, update both the lint enforcement and the docs in the same change.
- If current reality differs from the intended target architecture, document the current state and the intended evolution explicitly instead of hiding the mismatch.

## Pre-Launch Indexing And Environment Exposure

- During pre-launch, any publicly reachable environment must remain non-indexable by search engines.
- Keep `noindex, nofollow` enabled site-wide until the team explicitly decides the public site is ready for indexing.
- Keep `robots.txt` configured to disallow all crawling during pre-launch.
- Do not remove or relax search-engine blocking unless explicitly requested.
- If domains are connected in Vercel or any other public host, verify that indexing protection is still active.

## Next.js Implementation Guidance For Pre-Launch

- Prefer a global robots policy through the Next.js app metadata configuration or root layout.
- Ensure a `robots.txt` route or static file exists and returns a full-site disallow during pre-launch.
- Keep the implementation minimal, obvious, and easy to remove at launch.
- Favor a single source of truth for indexing behavior rather than page-by-page exceptions unless explicitly required.

## Launch Transition Rule

- Only remove `noindex` and crawl blocking when the team explicitly says the site may be indexed.
- When enabling indexing, also ensure the sitemap, canonical setup, and Google Search Console handoff are ready.

## Completion And Validation Rules

- Before declaring work complete, run the relevant format, lint, test, build, and check commands for the area you changed.
- If the change touches catalog, pricing, affiliate, commerce sync, or generated data read facades, run the relevant drift checks before claiming completion.
- Catalog-related changes require `pnpm sync:catalog:check` when the source-backed path is available.
- Pricing, affiliate, or commerce-related changes require `pnpm sync:commerce:check`.
- If a formatter, sync writer, or generated-artifact check reveals expected file updates, do not claim the task is complete until those updates are either committed intentionally or explicitly called out as still outstanding.
- Do not report “done” while the working tree still contains expected generated-artifact or formatter changes from the task.

## Reference Docs

- `docs/architecture/product-vision.md`
- `docs/architecture/nx-workspace-blueprint.md`
- `docs/architecture/contentful-editorial-model.md`
- `docs/architecture/contentful-space-setup.md`
- `docs/architecture/contentful-preview-usage.md`
- `docs/architecture/contentful-validation-rollout-checklist.md`
- `docs/architecture/dependency-rules.md`
- `docs/architecture/mvp-search-spike.md`
- `docs/architecture/next-phase-roadmap.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/catalog-sync-validation.md`
- `docs/operations/commerce-sync.md`
- `docs/operations/commerce-sync-validation.md`
- `docs/operations/pricing-history.md`
- `docs/operations/developer-workflow-guardrails.md`
- `docs/operations/mvp-alerting-observability.md`
- `docs/operations/mvp-deployment-runbook.md`
- `docs/operations/mvp-production-rollout-checklist.md`
- `docs/operations/mvp-operator-troubleshooting.md`
- `docs/operations/production-auth-hardening.md`
- `docs/operations/mvp-release-checklist.md`
- `docs/operations/supabase-auth-foundation.md`
- `docs/standards/coding-constitution.md`
