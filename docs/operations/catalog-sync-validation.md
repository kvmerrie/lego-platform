# Catalog Sync Validation Plan

This checklist is for the current Rebrickable-backed sync run using the curated product-ready catalog scope. It assumes the current sync runtime, generated artifacts, overlays, and tests are already in place.

## 1. First Real Sync Run Checklist

1. Start from a clean branch and confirm the workspace is not carrying unrelated catalog changes.
2. Install dependencies with `pnpm install` if the workspace is not already current.
3. Export `REBRICKABLE_API_KEY` in your shell.
4. Run `pnpm sync:catalog:check` first.
5. If check mode reports drift, review the expected catalog changes before writing anything.
6. Run `pnpm sync:catalog` only after the drift looks intentional.
7. Review the generated diff.
8. Run:
   - `pnpm nx run catalog-data-access:test`
   - `pnpm nx run catalog-data-access-sync:test`
   - `pnpm nx run web:build`
9. If the generated artifacts and build output still match product expectations, commit the snapshot update.

## 2. Environment And Safe Local Setup

Required env vars:

- `REBRICKABLE_API_KEY`

Optional env vars:

- `REBRICKABLE_BASE_URL`
  Use only for local proxying or mock-server testing.

Safe setup guidance:

- Run sync from the workspace root so the artifact writer resolves the correct paths.
- Prefer `pnpm sync:catalog:check` before `pnpm sync:catalog`.
- Do not run the first real sync in the middle of unrelated repo changes.
- If you are intentionally expanding the curated sync scope, add the new set numbers and their local overlay entries in the same branch before running the sync.

## 3. Files To Review After The Run

Primary generated outputs:

- `libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts`
- `libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts`

Reference local inputs that should usually remain unchanged:

- `libs/catalog/data-access/src/lib/catalog-overlays.ts`
- `libs/catalog/data-access-sync/src/lib/catalog-sync-curation.ts`

What a healthy diff looks like:

- generated snapshot values update to match Rebrickable source fields
- manifest metadata such as `generatedAt` updates
- no unexpected structural changes to the generated module format
- overlays remain unchanged unless the team is intentionally adjusting local collector-facing copy

## 4. Validation Checks

### Slug Quality

Check each generated source slug in `catalog-snapshot.generated.ts`:

- slug ends with the canonical id
- slug is lowercase and hyphenated
- slug still reads naturally from the set name
- there are no duplicate slugs

Current expected source slugs:

- `lord-of-the-rings-rivendell-10316`
- `dungeons-and-dragons-red-dragons-tale-21348`
- `avengers-tower-76269`
- `lion-knights-castle-10305`
- `a-frame-cabin-21338`

Current expected public route slugs from the product-facing layer:

- `rivendell-10316`
- `dungeons-and-dragons-red-dragons-tale-21348`
- `avengers-tower-76269`
- `lion-knights-castle-10305`
- `a-frame-cabin-21338`

### Canonical Id Assumptions

Check that each source set number still maps correctly:

- `10316-1` -> `10316`
- `21348-1` -> `21348`
- `76269-1` -> `76269`
- `10305-1` -> `10305`
- `21338-1` -> `21338`

If Rebrickable returns a different source variant or an unexpected identifier shape, stop and review the normalization rule before accepting the artifacts.

### Overlay Merge Behavior

The generated snapshot should only carry source-oriented fields. Product-facing normalization and collector-facing copy still come from overlays.

Validate this by confirming:

- generated artifacts do not contain `priceRange`, `collectorAngle`, `tagline`, `availability`, or `collectorHighlights`
- every synced `canonicalId` has a matching overlay entry
- any product slug overrides remain unique after the overlay merge
- `pnpm nx run catalog-data-access:test` still passes
- `pnpm nx run web:build` still produces the current set-detail routes

If generated source data changes but the UI contract still expects the same detail shape, the read facade should continue to merge overlays without any route changes.

### Homepage Featured-Set Curation

Check `catalog-sync-manifest.generated.ts`:

- `homepageFeaturedSetIds` still contains the curated ids only
- all featured ids exist in the generated snapshot
- homepage ids remain unchanged unless the team explicitly intends to change homepage merchandising

Current expected featured ids:

- `10316`
- `21348`
- `76269`

The homepage list order is still a read-side concern, not a sync-order concern. The sync only validates the curated inclusion set.

### Generated Artifact Diffs

Review the diff for these questions:

- Did only the two generated artifact files change?
- Are changes limited to source-backed fields and timestamps?
- If new set records were added, are they accompanied by matching overlay entries and reviewable product copy?
- Did the generated module comment and formatting remain stable?
- Did any local overlay or curation file change unexpectedly?

If the answer to any of those is no, pause and inspect before committing.

## 5. Failure Cases And What They Mean

`REBRICKABLE_API_KEY is required`

- Local setup issue.
- Export the key and rerun.

`Generated catalog artifacts are stale`

- Check mode found a meaningful diff between committed artifacts and the freshly built sync output.
- Review the diff before deciding whether to write and commit it.

`Invalid Rebrickable set payload...`

- Upstream payload is missing a field or has a shape the validator does not accept.
- Stop and inspect the source response before changing validation rules.

`Invalid Rebrickable theme payload...`

- Theme lookup did not match the expected theme id or name shape.
- Stop and inspect the theme response before continuing.

`duplicate canonicalId`, `duplicate sourceSetNumber`, or `duplicate slug`

- The current normalization assumptions no longer safely represent the curated set scope.
- Do not accept the generated artifacts until the mapping rules are reviewed.

`Missing product overlay for synced catalog set ...`

- A newly curated set was added to sync scope without its required local product-facing overlay.
- Add the overlay before accepting the artifacts.

`duplicate product slug`

- Two records normalize to the same public route slug after overlay merging.
- Fix the local product slug policy before accepting the artifacts.

`Homepage featured set ... is missing from the generated catalog snapshot`

- The curated manifest assumptions and the generated source scope have diverged.
- Update curation or source coverage deliberately; do not bypass the check.

## 6. Rollback And Recovery Checklist

If the generated artifacts are not acceptable:

1. Do not commit the generated diff.
2. Restore the generated artifact files to the last known-good committed state.
3. Keep local overlay files unchanged unless the team explicitly intends to update them.
4. If the problem came from a newly added curated set, remove it from the curation list or finish its overlay review before retrying.
5. Record which source field or validation assumption failed.
6. Re-run `pnpm sync:catalog:check` only after the issue is understood.

If the issue is upstream-data-related rather than repo-related, keep the last known-good generated artifacts in place and stop the rollout.

## 7. Readiness Criteria For Broader Coverage

Do not broaden catalog sync coverage until all of these are true:

- the first real keyed sync run completes successfully
- generated diffs are small, understandable, and reviewable
- slug and canonical-id assumptions hold for the curated set scope
- overlay merge behavior remains stable and the web build still succeeds
- the team is comfortable reviewing generated artifact changes as part of normal code review
- the team can add a small curated batch without changing homepage merchandising or route behavior for existing sets
- operator docs are sufficient for someone other than the original implementer to run the workflow safely

Once those criteria are met, the next step is to expand source coverage carefully, not to change the runtime read path.
