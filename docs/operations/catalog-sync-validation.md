# Catalog Sync Validation Plan

This checklist is for the current Rebrickable-backed sync run using the curated product-ready catalog scope. It assumes the current sync runtime, generated artifacts, overlays, and tests are already in place.

The current curated public catalog scope is `54` sets.

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
- `eldorado-fortress-10320`
- `motorized-lighthouse-21335`
- `the-lord-of-the-rings-barad-dur-10333`
- `medieval-town-square-10332`
- `tranquil-garden-10315`
- `the-starry-night-21333`
- `the-insect-collection-21342`
- `concorde-10318`
- `kingfisher-bird-10331`
- `nasa-artemis-space-launch-system-10341`
- `tuxedo-cat-21349`
- `back-to-the-future-time-machine-10300`
- `titanic-10294`
- `notre-dame-de-paris-21061`
- `hokusai-the-great-wave-31208`
- `hogwarts-castle-and-grounds-76419`
- `disney-castle-43222`
- `at-at-75313`
- `polaroid-onestep-sx-70-21345`
- `natural-history-museum-10326`
- `pac-man-arcade-10323`
- `atari-2600-10306`
- `flower-bouquet-10280`
- `orchid-10311`
- `typewriter-21327`
- `viking-village-21343`
- `lamborghini-sian-fkp-37-42115`
- `ferrari-daytona-sp3-42143`
- `the-mighty-bowser-71411`
- `ninjago-city-gardens-71741`
- `sanctum-sanctorum-76218`
- `t-rex-breakout-76956`
- `the-razor-crest-75331`
- `gringotts-wizarding-bank-collectors-edition-76417`
- `daily-bugle-76178`
- `venator-class-republic-attack-cruiser-75367`
- `jaws-21350`
- `land-rover-classic-defender-90-10317`
- `the-burrow-collectors-edition-76437`
- `x-wing-starfighter-75355`
- `jabbas-sail-barge-75397`
- `talking-sorting-hat-76429`
- `hogwarts-castle-the-great-hall-76435`
- `the-x-mansion-76294`
- `the-endurance-10335`
- `dune-atreides-royal-ornithopter-10327`
- `mercedes-amg-f1-w14-e-performance-42171`
- `mclaren-p1-42172`
- `bouquet-of-roses-10328`

Current expected public route slugs from the product-facing layer:

- `rivendell-10316`
- `dungeons-and-dragons-red-dragons-tale-21348`
- `avengers-tower-76269`
- `lion-knights-castle-10305`
- `a-frame-cabin-21338`
- `eldorado-fortress-10320`
- `motorized-lighthouse-21335`
- `the-lord-of-the-rings-barad-dur-10333`
- `medieval-town-square-10332`
- `tranquil-garden-10315`
- `vincent-van-gogh-the-starry-night-21333`
- `the-insect-collection-21342`
- `concorde-10318`
- `kingfisher-bird-10331`
- `nasa-artemis-space-launch-system-10341`
- `tuxedo-cat-21349`
- `back-to-the-future-time-machine-10300`
- `titanic-10294`
- `notre-dame-de-paris-21061`
- `hokusai-the-great-wave-31208`
- `hogwarts-castle-and-grounds-76419`
- `disney-castle-43222`
- `at-at-75313`
- `polaroid-onestep-sx-70-camera-21345`
- `natural-history-museum-10326`
- `pac-man-arcade-10323`
- `atari-2600-10306`
- `flower-bouquet-10280`
- `orchid-10311`
- `typewriter-21327`
- `viking-village-21343`
- `lamborghini-sian-fkp-37-42115`
- `ferrari-daytona-sp3-42143`
- `the-mighty-bowser-71411`
- `ninjago-city-gardens-71741`
- `sanctum-sanctorum-76218`
- `t-rex-breakout-76956`
- `the-razor-crest-75331`
- `gringotts-wizarding-bank-collectors-edition-76417`
- `daily-bugle-76178`
- `venator-class-republic-attack-cruiser-75367`
- `jaws-21350`
- `land-rover-classic-defender-90-10317`
- `the-burrow-collectors-edition-76437`
- `x-wing-starfighter-75355`
- `jabbas-sail-barge-75397`
- `talking-sorting-hat-76429`
- `hogwarts-castle-the-great-hall-76435`
- `the-x-mansion-76294`
- `the-endurance-10335`
- `dune-atreides-royal-ornithopter-10327`
- `mercedes-amg-f1-w14-e-performance-42171`
- `mclaren-p1-42172`
- `bouquet-of-roses-10328`

### Canonical Id Assumptions

Check that each source set number still maps correctly:

- `10316-1` -> `10316`
- `21348-1` -> `21348`
- `76269-1` -> `76269`
- `10305-1` -> `10305`
- `21338-1` -> `21338`
- `10320-1` -> `10320`
- `21335-1` -> `21335`
- `10333-1` -> `10333`
- `10332-1` -> `10332`
- `10315-1` -> `10315`
- `21333-1` -> `21333`
- `21342-1` -> `21342`
- `10318-1` -> `10318`
- `10331-1` -> `10331`
- `10341-1` -> `10341`
- `21349-1` -> `21349`
- `10300-1` -> `10300`
- `10294-1` -> `10294`
- `21061-1` -> `21061`
- `31208-1` -> `31208`
- `76419-1` -> `76419`
- `43222-1` -> `43222`
- `75313-1` -> `75313`
- `21345-1` -> `21345`
- `10326-1` -> `10326`
- `10323-1` -> `10323`
- `10306-1` -> `10306`
- `10280-1` -> `10280`
- `10311-1` -> `10311`
- `21327-1` -> `21327`
- `21343-1` -> `21343`
- `42115-1` -> `42115`
- `42143-1` -> `42143`
- `71411-1` -> `71411`
- `71741-1` -> `71741`
- `76218-1` -> `76218`
- `76956-1` -> `76956`
- `75331-1` -> `75331`
- `76417-1` -> `76417`
- `76178-1` -> `76178`
- `75367-1` -> `75367`
- `21350-1` -> `21350`
- `10317-1` -> `10317`
- `76437-1` -> `76437`
- `75355-1` -> `75355`
- `75397-1` -> `75397`
- `76429-1` -> `76429`
- `76435-1` -> `76435`
- `76294-1` -> `76294`
- `10335-1` -> `10335`
- `10327-1` -> `10327`
- `42171-1` -> `42171`
- `42172-1` -> `42172`
- `10328-1` -> `10328`

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
- `10333`
- `21333`

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
