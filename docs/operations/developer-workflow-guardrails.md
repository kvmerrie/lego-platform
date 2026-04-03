# Developer Workflow Guardrails

This document defines the lightweight local workflow guardrails for the repository.

It is the companion to:

- `AGENTS.md`
- `docs/operations/catalog-sync.md`
- `docs/operations/catalog-sync-validation.md`
- `docs/operations/commerce-sync.md`
- `docs/operations/commerce-sync-validation.md`

## Current Intent

The current repo guardrails aim to catch the most common avoidable failures earlier:

- formatting drift
- whitespace or merge-marker mistakes
- forgotten generated-artifact updates
- missing catalog or commerce drift checks before push

These guardrails intentionally stay lean:

- no write-mode syncs run automatically
- no heavy full-test suite runs inside git hooks
- hooks prefer changed-file checks and check-mode commands

## Hook Installation

`pnpm install` now runs the root `prepare` script, which installs Husky hooks when the repo has a `.git` directory.

Tracked hook entrypoints:

- `.husky/pre-commit`
- `.husky/pre-push`

The generated Husky support folder stays untracked through `.husky/.gitignore`.

## Pre-Commit Hook

The pre-commit hook runs fast staged-file hygiene checks only:

1. `git diff --cached --check`
2. Prettier check on staged files only

This is intended to catch:

- trailing whitespace
- patch-format issues
- staged formatting drift

## Pre-Push Hook

The pre-push hook stays deterministic and local-only:

1. Prettier check on the files in the push range
2. Block push if the working tree still contains dirty `*.generated.*` files
3. If the push touches pricing, affiliate, or commerce sync code:
   - `pnpm sync:commerce:local:check`
4. If the push touches catalog or catalog sync code:
   - run `pnpm sync:catalog:local:check`

The live source-backed or external validation commands stay explicit:

- `pnpm sync:catalog:check`
  This is the live Rebrickable-backed drift check.
- `pnpm sync:commerce`
  This is the live commerce write path and includes the Supabase history upsert.

## Manual Completion Expectations

Before declaring work complete locally, run the relevant validation commands for the changed area.

Minimum expectation:

- relevant format checks
- relevant lint or test commands
- relevant sync drift checks when touching generated-data domains

When touching catalog, pricing, affiliate, or commerce-related code, treat drift checks as part of normal completion:

- local deterministic:
  - `pnpm sync:catalog:local:check`
  - `pnpm sync:commerce:local:check`
- live or external when appropriate:
  - `pnpm sync:catalog:check`
  - `pnpm sync:commerce`

Do not treat the task as complete if:

- a formatter rewrote files you have not reviewed
- a sync check reveals expected generated-artifact updates you have not handled
- the working tree still contains generated file changes that are part of the intended task

## Common Operator Or Developer Fixes

Commerce pre-push failure:

- rerun `pnpm sync:commerce:local:check`
- review generated artifact drift before pushing

Catalog pre-push failure:

- rerun `pnpm sync:catalog:local:check`
- review generated artifact drift before pushing

Live catalog validation:

- export `REBRICKABLE_API_KEY`
- run `pnpm sync:catalog:check`
- use this outside the default pre-push path when you need source-backed validation

Formatting failure:

- run `pnpm format:write`
- review the formatter-only diff
- recommit before pushing
