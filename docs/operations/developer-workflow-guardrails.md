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

The pre-push hook stays check-mode only and focuses on earlier CI parity:

1. Prettier check on the files in the push range
2. Block push if the working tree still contains dirty `*.generated.*` files
3. If the push touches pricing, affiliate, or commerce sync code:
   - `pnpm sync:commerce:check`
4. If the push touches catalog or catalog sync code:
   - require `REBRICKABLE_API_KEY`
   - run `pnpm sync:catalog:check`

Why the catalog check is conditional:

- it depends on the Rebrickable API key
- it reaches the source-backed validation path
- it should only run when catalog-related work actually changed

## Manual Completion Expectations

Before declaring work complete locally, run the relevant validation commands for the changed area.

Minimum expectation:

- relevant format checks
- relevant lint or test commands
- relevant sync drift checks when touching generated-data domains

When touching catalog, pricing, affiliate, or commerce-related code, treat drift checks as part of normal completion:

- `pnpm sync:catalog:check`
- `pnpm sync:commerce:check`

Do not treat the task as complete if:

- a formatter rewrote files you have not reviewed
- a sync check reveals expected generated-artifact updates you have not handled
- the working tree still contains generated file changes that are part of the intended task

## Common Operator Or Developer Fixes

Catalog pre-push failure due to missing key:

- export `REBRICKABLE_API_KEY`
- rerun `pnpm sync:catalog:check`
- push again

Commerce pre-push failure:

- rerun `pnpm sync:commerce:check`
- review generated artifact drift before pushing

Formatting failure:

- run `pnpm format:write`
- review the formatter-only diff
- recommit before pushing
