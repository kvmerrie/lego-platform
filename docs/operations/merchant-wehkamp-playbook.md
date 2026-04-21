# Wehkamp Technic Operator Playbook

This playbook standardizes how Brickhunt operators use `wehkamp` in the
commerce pipeline.

Current position:

- `wehkamp` is a proven secondary merchant for `Technic`
- `wehkamp` remains inspect-first and explicitly scoped
- `wehkamp` is not part of broad default automation

This is an operator rule, not a merchant-config change.

## Current Merchant Status

What is already proven:

- fetchable from the current runtime
- inspectable
- generatable
- validatable
- refreshable through explicit merchant-scoped sync

Where it currently adds the most value:

- `Technic`: strong, repeatable value
- `Art`: occasional value
- `Botanicals`: opportunistic value
- `Icons`: selective only
- `Star Wars`, `Ideas`, `Disney`: do not prioritize for now

## Core Rule

For any batch that includes `Technic` sets:

- always include `wehkamp` in merchant-scoped runs

That applies to:

- bulk onboarding batches
- recovery queue work
- manual operator runs

## Standard Technic Workflow

Run the same explicit `wehkamp` lane for Technic work:

1. Inspect
2. Generate with `--write`
3. Validate with `--write`
4. Sync with `--write`

Example commands:

```bash
pnpm nx run commerce-seed-generator:run --skip-nx-cache -- --inspect --set-ids 42154,42171,42172,42177 --merchant-slugs wehkamp
pnpm nx run commerce-seed-generator:run --skip-nx-cache -- --generate --write --set-ids 42154,42171,42172,42177 --merchant-slugs wehkamp
pnpm nx run commerce-seed-generator:run --skip-nx-cache -- --validate --write --recheck-generated --set-ids 42154,42171,42172,42177 --merchant-slugs wehkamp
pnpm nx run commerce-sync:run -- --write --set-ids 42154,42171,42172,42177 --merchant-slugs wehkamp
```

When the batch is broader than Technic:

- still keep `wehkamp` in scope for the Technic sets
- do not assume `wehkamp` should be added for every other theme in the batch

## Non-Technic Rules

Use `wehkamp` outside Technic only with explicit intent:

- `Botanicals`, `Art`: optional and opportunistic
- `Icons`: selective only
- `Star Wars`, `Ideas`, `Disney`: do not prioritize for now

Only include `wehkamp` outside Technic when:

- inspect shows strong candidates
- or we are explicitly testing a theme expansion

## Failure Handling

Keep `wehkamp` strict.

If inspect returns:

- `stale`
- weak candidates
- non-product result pages

Then:

- do not force generation
- do not relax validation
- skip the set

This merchant should stay high-confidence, not high-volume.

## Automation Boundaries

Keep the current merchant safety model:

- `defaultSeedGeneration = false`
- `defaultRefresh = false`

Meaning:

- `wehkamp` is not part of broad default generation
- `wehkamp` is not part of broad default refresh
- `wehkamp` is included only through explicit `--merchant-slugs wehkamp`

Do not change those defaults yet.

## Ongoing Success Criteria

Operators should keep checking:

- percentage of Technic sets with valid `wehkamp` offers
- percentage where `wehkamp` is best or tied best
- whether `wehkamp` changes the public `beste deal` outcome in a meaningful way

If Technic remains strong across multiple batches, the next discussion can be:

- whether `wehkamp` should later join default seed generation
- while keeping refresh scoped

That is a later decision, not part of the current standard.

## Expansion Guardrails

Do not:

- add `wehkamp` to all themes by default
- enable broad automatic refresh
- add heuristics only to increase hit rate

Expand only when live value is proven.
