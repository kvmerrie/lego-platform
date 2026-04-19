# Commerce Seed Generation

Brickhunt seed generation is deterministic and deliberately conservative.

- Step 1 generates merchant search URLs as candidate seeds.
- Step 2 validates those candidates against real merchant result or product pages.
- A generated search URL is not treated as correct until validation promotes it.

## Commands

Dry-run candidate generation:

```bash
pnpm nx run commerce-seed-generator:run -- --generate
```

Primary coverage report:

```bash
pnpm nx run commerce-seed-generator:run -- --report
```

Primary coverage gap audit for actionable partial coverage:

```bash
pnpm nx run commerce-seed-generator:run -- --gap-audit
```

Coverage metrics and deterministic batch selection default to actionable sets
only. Retired or otherwise deprioritized sets such as `70728` stay out of the
normal queue unless you opt in explicitly:

```bash
pnpm nx run commerce-seed-generator:run -- --report --include-non-active
```

Focus the report on sets with no primary seeds yet:

```bash
pnpm nx run commerce-seed-generator:run -- --report --primary-coverage-status no_primary_seeds
```

Take a deterministic batch from that report:

```bash
pnpm nx run commerce-seed-generator:run -- --report --primary-coverage-status no_primary_seeds --batch-size 25 --batch-index 0
```

Take the first deterministic partial-coverage audit batch:

```bash
pnpm nx run commerce-seed-generator:run -- --gap-audit --batch-size 10 --batch-index 0
```

Without `--merchant-slugs`, generation and validation now default to the
current primary merchants only:

- `lego-nl`
- `intertoys`
- `bol`
- `misterbricks`

Write candidate seeds:

```bash
pnpm nx run commerce-seed-generator:run -- --generate --write
```

Generate for selected sets and merchants:

```bash
pnpm nx run commerce-seed-generator:run -- --generate --write --set-ids 10316,21061 --merchant-slugs intertoys,lego-nl
```

Generate the first missing-primary batch with the default primary merchants:

```bash
pnpm nx run commerce-seed-generator:run -- --generate --write --primary-coverage-status no_primary_seeds --batch-size 25 --batch-index 0
```

Dry-run validation:

```bash
pnpm nx run commerce-seed-generator:run -- --validate
```

Write validation outcomes:

```bash
pnpm nx run commerce-seed-generator:run -- --validate --write
```

Validate a bounded batch:

```bash
pnpm nx run commerce-seed-generator:run -- --validate --write --merchant-slugs intertoys,misterbricks --limit 50
```

Validate the same batch by reusing the `selected_set_ids` output from report mode:

```bash
pnpm nx run commerce-seed-generator:run -- --validate --write --set-ids 10316,21061,76437
```

## V1 Supported Merchants

V1 generation supports merchants with deterministic search URL patterns:

- `amazon-nl`
- `bol`
- `intertoys`
- `lego-nl`
- `misterbricks`
- `proshop`
- `smyths-toys`
- `top1toys`

Operational tiering now distinguishes between:

- primary: `lego-nl`, `intertoys`, `bol`, `misterbricks`
- secondary: `top1toys`, `smyths-toys`
- blocked/deprioritized: `amazon-nl`, `proshop`

Secondary and blocked merchants stay available for explicit runs through
`--merchant-slugs`, but they are no longer the default generation target.

## Primary Coverage States

Report mode and batch generation can target one of these states:

- `no_primary_seeds`
- `no_valid_primary_offers`
- `partial_primary_coverage`
- `full_primary_coverage`
- `all`

The current working definition is:

- `no_primary_seeds`: none of the primary merchants has any seed yet
- `no_valid_primary_offers`: there are primary seeds, but zero current valid primary offers
- `partial_primary_coverage`: at least one valid primary offer exists, but not full primary coverage
- `full_primary_coverage`: every primary merchant currently has a valid offer

This keeps the operator loop simple:

1. report `no_primary_seeds`
2. generate the next deterministic batch
3. validate that batch conservatively
4. rerun report and watch sets move into `no_valid_primary_offers`, `partial_primary_coverage`, and eventually `full_primary_coverage`

Direct `--set-ids` targeting still works for exceptions. The eligibility filter
only changes the default queue and default metrics, not explicit one-off runs.

## Gap Audit

Use `--gap-audit` when a set is already in `partial_primary_coverage` and you
want to see why it is still stuck there.

This differs from the normal coverage report:

- `--report` tells you where the queue stands
- `--gap-audit` shows what kind of gap is still blocking the missing primary merchants
- `--gap-audit` now also tags every merchant-gap with a conservative recovery hint:
  - `recover_now`
  - `verify_first`
  - `parked`

The gap audit focuses on operator decisions such as:

- no seed yet
- seed exists but is `pending`, `invalid`, or `stale`
- seed is valid, but the latest refresh is `unavailable` or `error`

This recoverable-first hint is only an operator aid. It does not change:

- coverage states
- merchant tiering
- workflow execution
- sync semantics

Useful examples:

```bash
pnpm nx run commerce-seed-generator:run -- --gap-audit --primary-coverage-status partial_primary_coverage --batch-size 10 --batch-index 0
pnpm nx run commerce-seed-generator:run -- --gap-audit --merchant-slugs lego-nl
pnpm nx run commerce-seed-generator:run -- --gap-audit --set-ids 10316,76437
pnpm nx run commerce-seed-generator:run -- --gap-audit --include-non-active --set-ids 70728
```

## Batch Workflow Wrapper

For the current daily primary-coverage loop, use the thin workflow wrapper:

```bash
pnpm nx run commerce-coverage-workflow:run -- --primary-coverage-status partial_primary_coverage --batch-size 10 --batch-index 0
```

The same wrapper can narrow the batch to selected merchants:

```bash
pnpm nx run commerce-coverage-workflow:run -- --primary-coverage-status partial_primary_coverage --batch-size 10 --batch-index 2 --merchant-slugs misterbricks
```

If you explicitly want retired or deprioritized sets back in that queue, add:

```bash
pnpm nx run commerce-coverage-workflow:run -- --primary-coverage-status no_valid_primary_offers --batch-size 10 --batch-index 0 --include-non-active
```

If a merchant-scoped batch writes no new candidates and validates nothing, you
can skip the scoped sync step:

```bash
pnpm nx run commerce-coverage-workflow:run -- --primary-coverage-status partial_primary_coverage --batch-size 10 --batch-index 2 --merchant-slugs misterbricks --skip-sync-when-no-seed-work
```

If you still want the scoped sync to run anyway, `--force-sync` wins:

```bash
pnpm nx run commerce-coverage-workflow:run -- --primary-coverage-status partial_primary_coverage --batch-size 10 --batch-index 2 --merchant-slugs misterbricks --skip-sync-when-no-seed-work --force-sync
```

That command runs this exact sequence for the selected batch:

1. `report`
2. `generate --write`
3. `validate --write`
4. scoped `commerce-sync`
5. final `report`

If the selected batch is empty, the workflow stops immediately without running
generate, validate, or sync.

## Validation Rules

Validation is deterministic, not AI-based.

The validator looks for signals such as:

- exact set number match
- LEGO brand signal
- set name token match
- optional piece-count match

It rejects obvious mismatches such as:

- another LEGO set number
- lighting kits
- display cases
- sticker or replacement products
- generic marketplace noise

## Safety

- Generated candidates are written as `validation_status='pending'`
- Generated candidates stay `is_active=false` until validation promotes them
- Validated candidates become `validation_status='valid'` and `is_active=true`
- Obvious mismatches become `validation_status='invalid'`
- Ambiguous or fetch-blocked cases become `validation_status='stale'`
